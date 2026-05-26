import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { adminLimiter } from '../middleware/rateLimit';
import {
  getMembershipPlans,
  getMembershipPlanById,
  getCreditPlans,
  getCreditPlanById,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  createCreditPlan,
  updateCreditPlan,
  deleteCreditPlan,
} from '../controllers/plans.controller';

const router = Router();

// ─── Membership plans ─────────────────────────────────────────────────────────

// GET    /api/plans/membership         — public
router.get('/membership', getMembershipPlans);

// GET    /api/plans/membership/:id     — public
router.get('/membership/:id', getMembershipPlanById);

// POST   /api/plans/membership         — admin only
router.post('/membership', authenticateToken, requireAdmin, adminLimiter, createMembershipPlan);

// PUT    /api/plans/membership/:id     — admin only
router.put('/membership/:id', authenticateToken, requireAdmin, adminLimiter, updateMembershipPlan);

// DELETE /api/plans/membership/:id     — admin only
router.delete('/membership/:id', authenticateToken, requireAdmin, adminLimiter, deleteMembershipPlan);

// ─── Credit plans ─────────────────────────────────────────────────────────────

// GET    /api/plans/credits            — public
router.get('/credits', getCreditPlans);

// GET    /api/plans/credits/:id        — public
router.get('/credits/:id', getCreditPlanById);

// POST   /api/plans/credits            — admin only
router.post('/credits', authenticateToken, requireAdmin, adminLimiter, createCreditPlan);

// PUT    /api/plans/credits/:id        — admin only
router.put('/credits/:id', authenticateToken, requireAdmin, adminLimiter, updateCreditPlan);

// DELETE /api/plans/credits/:id        — admin only
router.delete('/credits/:id', authenticateToken, requireAdmin, adminLimiter, deleteCreditPlan);

export default router;
