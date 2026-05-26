import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import {
  getDocuments,
  uploadDocument,
  replaceDocument,
} from '../controllers/document.controller';

const router = Router();

// GET  /api/documents/:userId
router.get('/:userId', authenticateToken, getDocuments);

// POST /api/upload  (document upload — mounted at /api/upload in server.ts)
// Note: also exported for use in upload.routes.ts
export const uploadDocumentHandler = [authenticateToken, uploadLimiter, uploadDocument];

// PATCH /api/documents/:docId/replace
router.patch('/:docId/replace', authenticateToken, uploadLimiter, replaceDocument);

export default router;
