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

// GET  /api/admin/users/export  — MUST be before /users/:userId
router.get('/users/export', authenticateToken, requireAdmin, adminLimiter,
  async (_req: Request, res: Response) => {
    try {
      const db = await getDB();
      const profiles = (db.profiles as any[]).filter((p: any) => p.role !== 'admin');
      const users = db.users as any[];
      const exportData = profiles.map((p: any) => {
        const u = users.find((usr: any) => usr.id === p.user_id || usr.id === p.id);
        return {
          profile_id:  p.profile_id  || '',
          email:       u?.email      || '',
          first_name:  p.first_name  || '',
          last_name:   p.last_name   || '',
          gender:      p.gender      || '',
          date_of_birth: p.date_of_birth || '',
          phone:       p.phone       || '',
          state:       p.state       || '',
          city:        p.city        || '',
          occupation:  p.occupation  || '',
          is_verified: p.is_verified || false,
          is_premium:  u?.is_premium || false,
          created_at:  p.created_at  || '',
        };
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
      const headers = Object.keys(exportData[0] || {}).join(',');
      const rows = exportData.map((row: any) =>
        Object.values(row).map((v: any) =>
          `"${String(v ?? '').replace(/"/g, '""')}"`
        ).join(',')
      );
      res.send([headers, ...rows].join('\n'));
    } catch { res.status(500).json({ error: 'Export failed.' }); }
  }
);

// POST /api/admin/users/import  — MUST be before /users/:userId
router.post('/users/import', authenticateToken, requireAdmin, adminLimiter,
  async (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Import feature coming soon.', imported: 0 });
  }
);

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

// POST /api/admin/users/:userId/reset-password
router.post('/users/:userId/reset-password', authenticateToken, requireAdmin, adminLimiter,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { new_password } = req.body;
      if (!new_password || new_password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      const db = await getDB();
      const users = db.users as any[];
      const user = users.find((u: any) => u.id === userId);
      if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
      const bcrypt = await import('bcryptjs');
      user.password_hash = await bcrypt.hash(new_password, 12);
      user.updated_at = new Date().toISOString();
      await saveDB(db);
      res.json({ success: true, message: 'Password reset successfully.' });
    } catch { res.status(500).json({ error: 'Failed to reset password.' }); }
  }
);

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

// GET /api/admin/managers
router.get('/managers', authenticateToken, requireAdmin, adminLimiter,
  async (_req: Request, res: Response) => {
    try {
      const db = await getDB();
      const managers = ((db as any).admin_managers || []).map((m: any) => {
        const { password_hash, ...safe } = m;
        return safe;
      });
      res.json({ success: true, managers });
    } catch { res.status(500).json({ error: 'Failed to fetch managers.' }); }
  }
);

// POST /api/admin/managers
router.post('/managers', authenticateToken, requireAdmin, adminLimiter,
  async (req: Request, res: Response) => {
    try {
      const { name, email, password, role, permissions } = req.body;
      if (!name || !email || !password || !role) {
        res.status(400).json({ error: 'Name, email, password, role required.' });
        return;
      }
      const db = await getDB();
      if (!(db as any).admin_managers) (db as any).admin_managers = [];
      const managers = (db as any).admin_managers as any[];
      const duplicate = managers.find((m: any) =>
        (m.email || '').toLowerCase() === email.toLowerCase()
      );
      if (duplicate) {
        res.status(409).json({ error: `Admin with email "${email}" already exists.` });
        return;
      }
      const bcrypt = await import('bcryptjs');
      const { v4: uuidv4 } = await import('uuid');
      const hashedPassword = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();
      const newId = uuidv4();
      const newManager = {
        id: newId, email: email.toLowerCase().trim(),
        password_hash: hashedPassword, name, role,
        permissions: Array.isArray(permissions) && permissions.length > 0
          ? permissions : ['/admin'],
        is_active: true, created_by: req.user?.id ?? 'system',
        created_at: now, updated_at: now, last_login: null,
      };
      (db.users as any[]).push({
        id: newId, email: email.toLowerCase().trim(),
        password_hash: hashedPassword, role: 'admin',
        is_active: true, email_verified: true,
        created_at: now, updated_at: now
      });
      (db.profiles as any[]).push({
        id: newId, user_id: newId, first_name: name,
        last_name: '', role: 'admin', is_active: true,
        created_at: now, updated_at: now
      });
      managers.push(newManager);
      await saveDB(db);
      const { password_hash, ...safe } = newManager;
      res.status(201).json({ success: true, manager: safe });
    } catch (err: any) {
      res.status(500).json({ error: 'Server error: ' + (err?.message ?? 'unknown') });
    }
  }
);

// PUT /api/admin/managers/:id
router.put('/managers/:id', authenticateToken, requireAdmin, adminLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, role, permissions, is_active } = req.body;
      const db = await getDB();
      const managers = ((db as any).admin_managers as any[]) || [];
      const idx = managers.findIndex((m: any) => m.id === id);
      if (idx === -1) { res.status(404).json({ error: 'Manager not found.' }); return; }
      if (name !== undefined) managers[idx].name = name.trim();
      if (role !== undefined) managers[idx].role = role;
      if (Array.isArray(permissions)) managers[idx].permissions = permissions;
      if (typeof is_active === 'boolean') managers[idx].is_active = is_active;
      managers[idx].updated_at = new Date().toISOString();
      (db as any).admin_managers = managers;
      await saveDB(db);
      const { password_hash, ...safe } = managers[idx];
      res.json({ success: true, manager: safe });
    } catch { res.status(500).json({ error: 'Failed to update manager.' }); }
  }
);

// DELETE /api/admin/managers/:id
router.delete('/managers/:id', authenticateToken, requireAdmin, adminLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const db = await getDB();
      (db as any).admin_managers = ((db as any).admin_managers || [])
        .filter((m: any) => m.id !== id);
      await saveDB(db);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete manager.' }); }
  }
);

// POST /api/admin/managers/:id/change-password
router.post('/managers/:id/change-password', authenticateToken, requireAdmin, adminLimiter,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      const db = await getDB();
      const managers = ((db as any).admin_managers || []) as any[];
      const manager = managers.find((m: any) => m.id === id);
      if (!manager) { res.status(404).json({ error: 'Manager not found.' }); return; }
      const bcrypt = await import('bcryptjs');
      manager.password_hash = await bcrypt.hash(newPassword, 12);
      manager.updated_at = new Date().toISOString();
      // Also sync to the users table
      const user = (db.users as any[]).find((u: any) => u.id === id);
      if (user) user.password_hash = manager.password_hash;
      await saveDB(db);
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch { res.status(500).json({ error: 'Failed to change password.' }); }
  }
);

export default router;
