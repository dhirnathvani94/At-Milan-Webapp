import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  purchaseMembership,
  purchaseCredits,
  getPurchaseHistory,
} from '../controllers/purchase.controller';

const router = Router();

// POST /api/purchases/membership
router.post('/membership', authenticateToken, purchaseMembership);

// POST /api/purchases/credits
router.post('/credits', authenticateToken, purchaseCredits);

// GET  /api/purchases/history/:userId
router.get('/history/:userId', authenticateToken, getPurchaseHistory);

export default router;
