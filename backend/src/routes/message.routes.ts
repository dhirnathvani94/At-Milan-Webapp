import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  getMessages,
  sendMessage,
  markAllRead,
  getUnreadCount,
} from '../controllers/message.controller';

const router = Router();

// GET  /api/messages/unread-count/:userId
router.get('/unread-count/:userId', authenticateToken, getUnreadCount);

// GET  /api/messages/:userId/:otherUserId
router.get('/:userId/:otherUserId', authenticateToken, getMessages);

// POST /api/messages
router.post('/', authenticateToken, apiLimiter, sendMessage);

// POST /api/messages/:userId/:otherUserId/read
router.post('/:userId/:otherUserId/read', authenticateToken, markAllRead);

// POST /api/messages/:userId/read-all
router.post('/:userId/read-all', authenticateToken, markAllRead);

export default router;
