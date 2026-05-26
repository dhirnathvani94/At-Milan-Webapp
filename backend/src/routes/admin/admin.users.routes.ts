import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { adminLimiter, uploadLimiter } from '../../middleware/rateLimit';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  adjustCredits,
  setPremium,
  removePremium,
  approveAllDocuments,
  getUserDocumentByType,
  updateDocumentStatus,
  uploadDocumentForUser,
  deleteUserDocument,
  getUserChats,
  getUserChatMessages,
} from '../../controllers/admin/admin.users.controller';

const router = Router();

// ─── All routes require: authenticateToken + requireAdmin + adminLimiter ──────

// GET  /api/admin/users
router.get('/users', authenticateToken, requireAdmin, adminLimiter, getAllUsers);

// GET  /api/admin/profiles  (alias for getAllUsers)
router.get('/profiles', authenticateToken, requireAdmin, adminLimiter, getAllUsers);

// GET  /api/admin/users/:userId
router.get('/users/:userId', authenticateToken, requireAdmin, adminLimiter, getUserById);

// PATCH /api/admin/users/:userId
router.patch('/users/:userId', authenticateToken, requireAdmin, adminLimiter, updateUser);

// DELETE /api/admin/users/:userId
router.delete('/users/:userId', authenticateToken, requireAdmin, adminLimiter, deleteUser);

// POST /api/admin/users/:userId/credits
router.post('/users/:userId/credits', authenticateToken, requireAdmin, adminLimiter, adjustCredits);

// POST /api/admin/users/:userId/premium
router.post('/users/:userId/premium', authenticateToken, requireAdmin, adminLimiter, setPremium);

// POST /api/admin/users/:userId/remove-premium
router.post('/users/:userId/remove-premium', authenticateToken, requireAdmin, adminLimiter, removePremium);

// POST /api/admin/users/:userId/approve-all-docs
router.post('/users/:userId/approve-all-docs', authenticateToken, requireAdmin, adminLimiter, approveAllDocuments);

// GET  /api/admin/users/:userId/documents/:docType
router.get('/users/:userId/documents/:docType', authenticateToken, requireAdmin, adminLimiter, getUserDocumentByType);

// POST /api/admin/users/:userId/documents/:docType/status
router.post('/users/:userId/documents/:docType/status', authenticateToken, requireAdmin, adminLimiter, updateDocumentStatus);

// POST /api/admin/users/:userId/documents/upload  (uploadLimiter added alongside adminLimiter)
router.post('/users/:userId/documents/upload', authenticateToken, requireAdmin, adminLimiter, uploadLimiter, uploadDocumentForUser);

// DELETE /api/admin/users/:userId/documents/:docType
router.delete('/users/:userId/documents/:docType', authenticateToken, requireAdmin, adminLimiter, deleteUserDocument);

// GET  /api/admin/users/:userId/chats
router.get('/users/:userId/chats', authenticateToken, requireAdmin, adminLimiter, getUserChats);

// GET  /api/admin/users/:userId/chats/:otherUserId
router.get('/users/:userId/chats/:otherUserId', authenticateToken, requireAdmin, adminLimiter, getUserChatMessages);

export default router;
