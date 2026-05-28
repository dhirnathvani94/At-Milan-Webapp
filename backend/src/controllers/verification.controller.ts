import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../db/database';
import { emitToUser, emitToAdmin } from '../services/socket.service';
import { createNotification } from './notification.controller';
import { documentUpload } from './profile.controller';
import multer from 'multer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  user_id: string;
  type: string;
  filename: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface ProfileRow {
  user_id: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  profile_photo?: string | null;
  [key: string]: unknown;
}

interface UserRow {
  id: string;
  email: string;
  is_active: boolean;
  [key: string]: unknown;
}

// ─── getPendingVerifications ──────────────────────────────────────────────────

export async function getPendingVerifications(req: Request, res: Response): Promise<void> {
  try {
    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query['limit'] as string) ?? '20', 10));

    const db   = await getDB();
    const docs = (db.documents as DocumentRow[])
      .filter((d) => d.status === 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const total      = docs.length;
    const totalPages = Math.ceil(total / limit);
    const data       = docs.slice((page - 1) * limit, page * limit);

    // Enrich with user info
    const profiles = db.profiles as ProfileRow[];
    const users2 = db.users as any[];
    const enriched = data.map((d: any) => {
      const profile = profiles.find((p: any) => p.user_id === d.user_id) ?? null;
      const userRow = users2.find((u: any) => u.id === d.user_id) ?? null;
      return {
        ...d,
        // Add all field aliases frontend expects
        profile,
        user: profile,
        file_url: d.url,
        document_type: d.type,
        uploaded_at: d.created_at,
        verification_status: d.status,
        email: (userRow as any)?.email ?? null,
      };
    });

    res.status(200).json({ success: true, data: enriched, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Verification] getPendingVerifications error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch pending verifications.' });
  }
}

// ─── getAllVerifications ──────────────────────────────────────────────────────

export async function getAllVerifications(req: Request, res: Response): Promise<void> {
  try {
    const q      = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const status = q['status'];
    const userId = q['user_id'];
    const type   = q['type'];

    const db  = await getDB();
    let docs  = db.documents as DocumentRow[];

    if (status)  docs = docs.filter((d) => d.status    === status);
    if (userId)  docs = docs.filter((d) => d.user_id   === userId);
    if (type)    docs = docs.filter((d) => d.type      === type);

    docs = [...docs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const total      = docs.length;
    const totalPages = Math.ceil(total / limit);
    const data       = docs.slice((page - 1) * limit, page * limit);

    const profiles = db.profiles as ProfileRow[];
    const users3 = db.users as any[];
    const enriched = data.map((d: any) => {
      const profile = profiles.find((p: any) => p.user_id === d.user_id) ?? null;
      const userRow = users3.find((u: any) => u.id === d.user_id) ?? null;
      return {
        ...d,
        profile,
        user: profile,
        file_url: d.url,
        document_type: d.type,
        uploaded_at: d.created_at,
        verification_status: d.status,
        email: (userRow as any)?.email ?? null,
      };
    });

    res.status(200).json({ success: true, data: enriched, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Verification] getAllVerifications error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch verifications.' });
  }
}

// ─── getVerifiedUsers ─────────────────────────────────────────────────────────

export async function getVerifiedUsers(req: Request, res: Response): Promise<void> {
  try {
    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query['limit'] as string) ?? '20', 10));

    const db       = await getDB();
    const profiles = (db.profiles as ProfileRow[]).filter((p) => p.is_verified);

    const total      = profiles.length;
    const totalPages = Math.ceil(total / limit);
    const data       = profiles.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, data, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Verification] getVerifiedUsers error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch verified users.' });
  }
}

// ─── getVerificationStatus ────────────────────────────────────────────────────

export async function getVerificationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db   = await getDB();
    const docs = (db.documents as DocumentRow[]).filter((d) => d.user_id === userId);
    const profile = (db.profiles as ProfileRow[]).find((p) => p.user_id === userId);

    const summary = {
      is_verified:       profile?.is_verified ?? false,
      total_documents:   docs.length,
      pending:           docs.filter((d) => d.status === 'pending').length,
      approved:          docs.filter((d) => d.status === 'approved').length,
      rejected:          docs.filter((d) => d.status === 'rejected').length,
      documents:         docs,
    };

    res.status(200).json({ success: true, ...summary });
  } catch (err) {
    console.error('[Verification] getVerificationStatus error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch verification status.' });
  }
}

// ─── approveDocument ─────────────────────────────────────────────────────────

export async function approveDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id }    = req.params;
    const adminId   = req.user!.id;

    const db   = await getDB();
    const docs = db.documents as DocumentRow[];
    const idx  = docs.findIndex((d) => d.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }

    const doc = docs[idx]!;
    doc.status      = 'approved';
    doc.reviewed_by = adminId;
    doc.reviewed_at = new Date().toISOString();
    doc.updated_at  = new Date().toISOString();
    doc.rejection_reason = null;

    // Check if all docs for this user are approved → mark profile verified
    const userDocs = docs.filter((d) => d.user_id === doc.user_id);
    const allApproved = userDocs.length > 0 && userDocs.every((d) => d.status === 'approved');

    const profiles = db.profiles as ProfileRow[];
    const profile  = profiles.find((p) => p.user_id === doc.user_id);
    if (profile && allApproved) {
      profile.is_verified = true;
    }

    await saveTable('documents', db.documents as any[]);
    if (allApproved) {
      await saveTable('profiles', db.profiles as any[]);
    }

    // Real-time + notification
    emitToUser(doc.user_id, 'document:approved', { document_id: id, type: doc.type });
    emitToUser(doc.user_id, 'document:status-changed', {
      userId: doc.user_id,
      status: 'approved',
      documentId: id,
      type: doc.type,
      isVerified: allApproved,
    });
    emitToAdmin('admin:doc-status-changed', {
      userId: doc.user_id,
      documentId: id,
      status: 'approved',
    });
    emitToAdmin('admin:document-approved', { document_id: id, user_id: doc.user_id });

    // If all documents approved → profile fully verified, notify user
    if (allApproved) {
      emitToUser(doc.user_id, 'account:approved', {
        is_verified: true,
        message: 'Your profile has been approved! You now have full access.',
      });
      emitToAdmin('admin:profile-approved', { user_id: doc.user_id });
      if (profile) {
        emitToUser(doc.user_id, 'profile:updated', {
          ...profile,
          is_verified: true,
        });
      }
    }
    if (allApproved && profile) {
      emitToUser(doc.user_id, 'profile:updated', {
        ...profile,
        is_verified: true,
      });
    }

    createNotification(
      doc.user_id,
      'document_approved',
      'Document Approved',
      `Your ${doc.type} document has been approved.${allApproved ? ' Your profile is now verified!' : ''}`,
      { document_id: id }
    );

    res.status(200).json({ success: true, document: doc, profileVerified: allApproved });
  } catch (err) {
    console.error('[Verification] approveDocument error:', err);
    res.status(500).json({ success: false, error: 'Could not approve document.' });
  }
}

// ─── rejectDocument ───────────────────────────────────────────────────────────

export async function rejectDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id }    = req.params;
    const adminId   = req.user!.id;
    const { reason } = req.body as { reason?: string };

    const db   = await getDB();
    const docs = db.documents as DocumentRow[];
    const idx  = docs.findIndex((d) => d.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }

    const doc = docs[idx]!;
    doc.status           = 'rejected';
    doc.reviewed_by      = adminId;
    doc.reviewed_at      = new Date().toISOString();
    doc.updated_at       = new Date().toISOString();
    doc.rejection_reason = reason ?? 'Document did not meet requirements.';

    // Unverify profile if it was verified
    const profiles = db.profiles as ProfileRow[];
    const profile  = profiles.find((p) => p.user_id === doc.user_id);
    if (profile) profile.is_verified = false;

    await saveTable('documents', db.documents as any[]);
    await saveTable('profiles', db.profiles as any[]);

    emitToUser(doc.user_id, 'document:rejected', {
      document_id: id,
      type:        doc.type,
      reason:      doc.rejection_reason,
    });
    emitToUser(doc.user_id, 'document:status-changed', {
      userId: doc.user_id,
      status: 'rejected',
      documentId: id,
      type: doc.type,
      isVerified: false,
      rejection_reason: doc.rejection_reason,
    });
    emitToAdmin('admin:doc-status-changed', {
      userId: doc.user_id,
      documentId: id,
      status: 'rejected',
    });
    emitToAdmin('admin:document-rejected', { document_id: id, user_id: doc.user_id });

    createNotification(
      doc.user_id,
      'document_rejected',
      'Document Rejected',
      `Your ${doc.type} document was rejected. Reason: ${doc.rejection_reason}`,
      { document_id: id, reason: doc.rejection_reason }
    );

    res.status(200).json({ success: true, document: doc });
  } catch (err) {
    console.error('[Verification] rejectDocument error:', err);
    res.status(500).json({ success: false, error: 'Could not reject document.' });
  }
}

// ─── replaceDocument ──────────────────────────────────────────────────────────

export async function replaceDocument(req: Request, res: Response): Promise<void> {
  documentUpload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided.' });
      return;
    }

    try {
      const { docId }  = req.params;
      const userId     = req.user!.id;

      const db   = await getDB();
      const docs = db.documents as DocumentRow[];
      const idx  = docs.findIndex((d) => d.id === docId);

      if (idx === -1) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      const doc = docs[idx]!;

      if (doc.user_id !== userId && req.user!.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Access denied.' });
        return;
      }

      // Delete old file from disk
      const oldPath = path.resolve(__dirname, '../../uploads/documents', doc.filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      doc.filename   = req.file.filename;
      doc.url        = `/uploads/documents/${req.file.filename}`;
      doc.status     = 'pending';
      doc.updated_at = new Date().toISOString();
      doc.rejection_reason = null;
      doc.reviewed_by      = null;
      doc.reviewed_at      = null;

      await saveTable('documents', db.documents as any[]);

      res.status(200).json({ success: true, document: doc });
    } catch (saveErr) {
      console.error('[Verification] replaceDocument save error:', saveErr);
      res.status(500).json({ success: false, error: 'Could not replace document.' });
    }
  });
}

// ─── changeDocStatus ──────────────────────────────────────────────────────────

export async function changeDocStatus(req: Request, res: Response): Promise<void> {
  try {
    const { docId }  = req.params;
    const { status, reason } = req.body as {
      status: 'pending' | 'approved' | 'rejected';
      reason?: string;
    };

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be pending, approved, or rejected.' });
      return;
    }

    const db   = await getDB();
    const docs = db.documents as DocumentRow[];
    const idx  = docs.findIndex((d) => d.id === docId);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Document not found.' });
      return;
    }

    const doc        = docs[idx]!;
    doc.status       = status;
    doc.updated_at   = new Date().toISOString();
    doc.reviewed_by  = req.user!.id;
    doc.reviewed_at  = new Date().toISOString();
    if (status === 'rejected' && reason) doc.rejection_reason = reason;
    if (status !== 'rejected') doc.rejection_reason = null;

    await saveTable('documents', db.documents as any[]);

    res.status(200).json({ success: true, document: doc });
  } catch (err) {
    console.error('[Verification] changeDocStatus error:', err);
    res.status(500).json({ success: false, error: 'Could not change document status.' });
  }
}
