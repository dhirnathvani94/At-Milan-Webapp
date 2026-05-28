import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getCredits,
  revealContact,
  checkRevealContact,
} from '../controllers/credits.controller';

const router = Router();

// GET  /api/credits/reveal-contact/check
router.get('/reveal-contact/check', authenticateToken, checkRevealContact);

// POST /api/credits/reveal-contact
router.post('/reveal-contact', authenticateToken, revealContact);

// GET  /api/credits/:userId
router.get('/:userId', authenticateToken, getCredits);

export default router;
