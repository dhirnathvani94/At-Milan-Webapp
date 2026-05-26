import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
} from '../controllers/notification.controller';

const router = Router();

// GET    /api/notifications/:userId
router.get('/:userId', authenticateToken, getNotifications);

// POST   /api/notifications/:id/read
router.post('/:id/read', authenticateToken, markAsRead);

// POST   /api/notifications/:userId/read-all
router.post('/:userId/read-all', authenticateToken, markAllAsRead);

// DELETE /api/notifications/:userId/clear-all
router.delete('/:userId/clear-all', authenticateToken, clearAll);

export default router;
