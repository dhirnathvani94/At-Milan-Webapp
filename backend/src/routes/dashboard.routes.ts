import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard/stats/:userId
router.get('/stats/:userId', authenticateToken, getDashboardStats);

export default router;
