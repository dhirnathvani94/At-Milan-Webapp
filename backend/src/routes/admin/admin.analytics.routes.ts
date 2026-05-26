import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { adminLimiter } from '../../middleware/rateLimit';
import {
  getFinancialTransactions,
  getFinancialSubscriptions,
  getFinancialInvoices,
  getFinancialUserSummaries,
  getFinancialUserDetail,
  getFinancialAnalytics,
  getSuccessStories,
  updateSuccessStory,
  deleteSuccessStory,
  approveSuccessStory,
  setStoryVisibility,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../../controllers/admin/admin.analytics.controller';
import {
  getPerformance,
  getSecurityStatus,
  reindexElasticsearch,
  getESStatus,
  getAuditLogsHandler,
} from '../../controllers/admin/admin.system.controller';

const router = Router();

// ─── All routes require: authenticateToken + requireAdmin + adminLimiter ──────

// ── Financial ─────────────────────────────────────────────────────────────────

// GET  /api/admin/financial/transactions
router.get('/financial/transactions', authenticateToken, requireAdmin, adminLimiter, getFinancialTransactions);

// GET  /api/admin/financial/subscriptions
router.get('/financial/subscriptions', authenticateToken, requireAdmin, adminLimiter, getFinancialSubscriptions);

// GET  /api/admin/financial/invoices
router.get('/financial/invoices', authenticateToken, requireAdmin, adminLimiter, getFinancialInvoices);

// GET  /api/admin/financial/user-summaries
router.get('/financial/user-summaries', authenticateToken, requireAdmin, adminLimiter, getFinancialUserSummaries);

// GET  /api/admin/financial/user/:userId
router.get('/financial/user/:userId', authenticateToken, requireAdmin, adminLimiter, getFinancialUserDetail);

// GET  /api/admin/financial/analytics
router.get('/financial/analytics', authenticateToken, requireAdmin, adminLimiter, getFinancialAnalytics);

// ── Success Stories ───────────────────────────────────────────────────────────

// GET  /api/admin/success-stories
router.get('/success-stories', authenticateToken, requireAdmin, adminLimiter, getSuccessStories);

// PUT  /api/admin/success-stories/:id
router.put('/success-stories/:id', authenticateToken, requireAdmin, adminLimiter, updateSuccessStory);

// DELETE /api/admin/success-stories/:id
router.delete('/success-stories/:id', authenticateToken, requireAdmin, adminLimiter, deleteSuccessStory);

// POST /api/admin/success-stories/:id/approve
router.post('/success-stories/:id/approve', authenticateToken, requireAdmin, adminLimiter, approveSuccessStory);

// POST /api/admin/success-stories/:id/visibility
router.post('/success-stories/:id/visibility', authenticateToken, requireAdmin, adminLimiter, setStoryVisibility);

// ── Coupons ───────────────────────────────────────────────────────────────────

// GET  /api/admin/coupons
router.get('/coupons', authenticateToken, requireAdmin, adminLimiter, getCoupons);

// POST /api/admin/coupons
router.post('/coupons', authenticateToken, requireAdmin, adminLimiter, createCoupon);

// PUT  /api/admin/coupons/:id
router.put('/coupons/:id', authenticateToken, requireAdmin, adminLimiter, updateCoupon);

// DELETE /api/admin/coupons/:id
router.delete('/coupons/:id', authenticateToken, requireAdmin, adminLimiter, deleteCoupon);

// ── System / Performance ──────────────────────────────────────────────────────

// GET  /api/admin/performance
router.get('/performance', authenticateToken, requireAdmin, adminLimiter, getPerformance);

// GET  /api/admin/security-status
router.get('/security-status', authenticateToken, requireAdmin, adminLimiter, getSecurityStatus);

// POST /api/admin/es/reindex
router.post('/es/reindex', authenticateToken, requireAdmin, adminLimiter, reindexElasticsearch);

// GET  /api/admin/es/status
router.get('/es/status', authenticateToken, requireAdmin, adminLimiter, getESStatus);

// GET  /api/admin/audit-logs
router.get('/audit-logs', authenticateToken, requireAdmin, adminLimiter, getAuditLogsHandler);

export default router;
