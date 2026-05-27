import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { getDB, saveDB, saveTable } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  user_id: string;
  type: string;
  filename: string;
  original_name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCS_DIR = path.resolve(__dirname, '../../uploads/documents');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Multer storage ───────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(DOCS_DIR)) {
      fs.mkdirSync(DOCS_DIR, { recursive: true });
    }
    cb(null, DOCS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new Error('Only PDF, JPG, JPEG, and PNG files are allowed.')
      );
    }
    cb(null, true);
  },
}).single('document');

// ─── getDocuments ─────────────────────────────────────────────────────────────

export async function getDocuments(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    // Only owner or admin can view documents
    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db   = await getDB();
    const docs = (db.documents as DocumentRow[])
      .filter((d) => d.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.status(200).json({ success: true, documents: docs, total: docs.length });
  } catch (err) {
    console.error('[Document] getDocuments error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch documents.' });
  }
}

// ─── uploadDocument ───────────────────────────────────────────────────────────

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  upload(req, res, async (err) => {
    // ── Multer errors ──────────────────────────────────────────────────────
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error:   'File size must not exceed 5 MB.',
        });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    if (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No document file provided.' });
      return;
    }

    try {
      const userId   = req.user!.id;
      const docType  = ((req.body as Record<string, string>)['doc_type'] ?? 'other').trim();
      const now      = new Date().toISOString();

      const doc: DocumentRow = {
        id:               uuidv4(),
        user_id:          userId,
        type:             docType,
        filename:         req.file.filename,
        original_name:    req.file.originalname,
        url:              `/uploads/documents/${req.file.filename}`,
        mime_type:        req.file.mimetype,
        size_bytes:       req.file.size,
        status:           'pending',
        rejection_reason: null,
        reviewed_by:      null,
        reviewed_at:      null,
        created_at:       now,
        updated_at:       now,
      };

      const db = await getDB();
      (db.documents as DocumentRow[]).push(doc);
      await saveTable('documents', db.documents as any[]);

      res.status(201).json({ success: true, document: doc });
    } catch (saveErr) {
      console.error('[Document] uploadDocument save error:', saveErr);
      // Clean up uploaded file if DB save fails
      if (req.file) {
        const filePath = path.join(DOCS_DIR, req.file.filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
      res.status(500).json({ success: false, error: 'Could not save document.' });
    }
  });
}

// ─── replaceDocument ──────────────────────────────────────────────────────────

export async function replaceDocument(req: Request, res: Response): Promise<void> {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ success: false, error: 'File size must not exceed 5 MB.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    if (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No replacement file provided.' });
      return;
    }

    try {
      const { docId } = req.params;
      const userId    = req.user!.id;

      const db   = await getDB();
      const docs = db.documents as DocumentRow[];
      const idx  = docs.findIndex((d) => d.id === docId);

      if (idx === -1) {
        // Clean up newly uploaded file since we won't use it
        const newPath = path.join(DOCS_DIR, req.file.filename);
        if (fs.existsSync(newPath)) {
          try { fs.unlinkSync(newPath); } catch { /* ignore */ }
        }
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      const doc = docs[idx]!;

      // Only owner or admin can replace
      if (doc.user_id !== userId && req.user!.role !== 'admin') {
        const newPath = path.join(DOCS_DIR, req.file.filename);
        if (fs.existsSync(newPath)) {
          try { fs.unlinkSync(newPath); } catch { /* ignore */ }
        }
        res.status(403).json({ success: false, error: 'Access denied.' });
        return;
      }

      // Delete old file from disk
      const oldPath = path.join(DOCS_DIR, doc.filename);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      }

      // Update record — reset to pending for re-review
      doc.filename         = req.file.filename;
      doc.original_name    = req.file.originalname;
      doc.url              = `/uploads/documents/${req.file.filename}`;
      doc.mime_type        = req.file.mimetype;
      doc.size_bytes       = req.file.size;
      doc.status           = 'pending';
      doc.rejection_reason = null;
      doc.reviewed_by      = null;
      doc.reviewed_at      = null;
      doc.updated_at       = new Date().toISOString();
      await saveTable('documents', db.documents as any[]);

      res.status(200).json({ success: true, document: doc });
    } catch (saveErr) {
      console.error('[Document] replaceDocument save error:', saveErr);
      res.status(500).json({ success: false, error: 'Could not replace document.' });
    }
  });
}
