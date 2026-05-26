import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  getReceivedInterests,
  getSentInterests,
  getAllSentInterests,
  getInterestById,
  sendInterest,
  respondToInterest,
  deleteInterest,
} from '../controllers/interest.controller';

const router = Router();

// GET  /api/interests/received/:userId
router.get('/received/:userId', authenticateToken, getReceivedInterests);

// GET  /api/interests/sent/:userId
router.get('/sent/:userId', authenticateToken, getSentInterests);

// GET  /api/interests/sent-all/:userId
router.get('/sent-all/:userId', authenticateToken, getAllSentInterests);

// GET  /api/interests/:id
router.get('/:id', authenticateToken, getInterestById);

// POST /api/interests
router.post('/', authenticateToken, apiLimiter, sendInterest);

// POST /api/interests/:id/status
router.post('/:id/status', authenticateToken, respondToInterest);

// DELETE /api/interests/:id
router.delete('/:id', authenticateToken, deleteInterest);

export default router;
