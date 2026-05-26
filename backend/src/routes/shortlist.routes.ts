import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getShortlist,
  toggleShortlist,
  removeFromShortlist,
} from '../controllers/shortlist.controller';

const router = Router();

// GET    /api/shortlists/:userId
router.get('/:userId', authenticateToken, getShortlist);

// POST   /api/shortlists/toggle
router.post('/toggle', authenticateToken, toggleShortlist);

// DELETE /api/shortlists/:userId/:targetId
router.delete('/:userId/:targetId', authenticateToken, removeFromShortlist);

export default router;
