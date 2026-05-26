import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { adminLimiter, uploadLimiter } from '../middleware/rateLimit';
import {
  getPendingVerifications,
  getAllVerifications,
  getVerifiedUsers,
  getVerificationStatus,
  approveDocument,
  rejectDocument,
  replaceDocument,
  changeDocStatus,
} from '../controllers/verification.controller';

const router = Router();

// GET  /api/verification/pending
router.get('/pending', authenticateToken, requireAdmin, adminLimiter, getPendingVerifications);

// GET  /api/verification/all
router.get('/all', authenticateToken, requireAdmin, adminLimiter, getAllVerifications);

// GET  /api/verification/verified-users
router.get('/verified-users', authenticateToken, requireAdmin, adminLimiter, getVerifiedUsers);

// GET  /api/verification/status/:userId
router.get('/status/:userId', authenticateToken, getVerificationStatus);

// POST /api/verification/approve/:id
router.post('/approve/:id', authenticateToken, requireAdmin, adminLimiter, approveDocument);

// POST /api/verification/reject/:id
router.post('/reject/:id', authenticateToken, requireAdmin, adminLimiter, rejectDocument);

// POST /api/verification/replace/:docId
router.post('/replace/:docId', authenticateToken, uploadLimiter, replaceDocument);

// POST /api/verification/change-status/:docId
router.post('/change-status/:docId', authenticateToken, requireAdmin, adminLimiter, changeDocStatus);

export default router;
