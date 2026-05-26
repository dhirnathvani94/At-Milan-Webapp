import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  reportUser,
  reportMessage,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportViolation,
  submitUnblockRequest,
  getChatSafetyStatus,
  getReportStatus,
} from '../controllers/safety.controller';

const router = Router();

// ─── User safety ──────────────────────────────────────────────────────────────

// POST /api/users/report
router.post('/users/report', authenticateToken, apiLimiter, reportUser);

// GET  /api/users/report-status
router.get('/users/report-status', authenticateToken, getReportStatus);

// POST /api/users/block
router.post('/users/block', authenticateToken, blockUser);

// POST /api/users/unblock
router.post('/users/unblock', authenticateToken, unblockUser);

// GET  /api/users/:userId/blocked
router.get('/users/:userId/blocked', authenticateToken, getBlockedUsers);

// ─── Chat safety ──────────────────────────────────────────────────────────────

// GET  /api/chat-safety/status/:userId
router.get('/chat-safety/status/:userId', authenticateToken, getChatSafetyStatus);

// POST /api/chat-safety/report
router.post('/chat-safety/report', authenticateToken, reportMessage);

// POST /api/chat-safety/violation
router.post('/chat-safety/violation', authenticateToken, reportViolation);

// POST /api/chat-safety/unblock-request
router.post('/chat-safety/unblock-request', authenticateToken, submitUnblockRequest);

export default router;
