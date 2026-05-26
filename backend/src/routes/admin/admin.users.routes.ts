import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { adminLimiter, uploadLimiter } from '../../middleware/rateLimit';
import { getDB, saveDB } from '../../db/database';
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
  getAdminStats,
} from '../../controllers/admin/admin.users.controller';

const router = Router();

// ─── All routes require: authenticateToken + requireAdmin + adminLimiter ──────

// GET /api/admin/stats
router.get('/stats', authenticateToken, requireAdmin, adminLimiter, getAdminStats);

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

// GET /api/admin/my-permissions
router.get('/my-permissions', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const managers = (db as any).admin_managers || [];
    const manager = managers.find((m: any) =>
      m.id === req.user?.id ||
      (m.email || '').toLowerCase() === (req.user?.email || '').toLowerCase()
    );
    if (!manager) {
      res.json({ success: true, role: 'admin', permissions: ['/admin'] });
      return;
    }
    res.json({
      success: true,
      role: manager.role,
      permissions: manager.permissions,
      name: manager.name,
      is_active: manager.is_active
    });
  } catch { res.status(500).json({ error: 'Failed to fetch permissions.' }); }
});

// POST /api/admin/change-password
router.post('/change-password', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      res.status(400).json({ error: 'Both passwords required.' });
      return;
    }
    const db = await getDB();
    const users = db.users as any[];
    const user = users.find((u: any) => u.id === req.user?.id);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect.' }); return; }
    user.password_hash = await bcrypt.hash(new_password, 12);
    user.updated_at = new Date().toISOString();
    await saveDB(db);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch { res.status(500).json({ error: 'Failed to change password.' }); }
});

export default router;
