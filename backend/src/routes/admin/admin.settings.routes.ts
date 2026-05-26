import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { adminLimiter } from '../../middleware/rateLimit';
import {
  getSettings,
  updateSetting,
  getPaymentGateways,
  createPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
  testSMS,
  testFirebase,
  sendAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  deleteAdminNotification,
  getStats,
} from '../../controllers/admin/admin.settings.controller';

const router = Router();

// ─── All routes require: authenticateToken + requireAdmin + adminLimiter ──────

// GET  /api/admin/settings
router.get('/settings', authenticateToken, requireAdmin, adminLimiter, getSettings);

// POST /api/admin/settings/:key
router.post('/settings/:key', authenticateToken, requireAdmin, adminLimiter, updateSetting);

// GET  /api/admin/payment-gateways
router.get('/payment-gateways', authenticateToken, requireAdmin, adminLimiter, getPaymentGateways);

// POST /api/admin/payment-gateways
router.post('/payment-gateways', authenticateToken, requireAdmin, adminLimiter, createPaymentGateway);

// PUT  /api/admin/payment-gateways/:id
router.put('/payment-gateways/:id', authenticateToken, requireAdmin, adminLimiter, updatePaymentGateway);

// DELETE /api/admin/payment-gateways/:id
router.delete('/payment-gateways/:id', authenticateToken, requireAdmin, adminLimiter, deletePaymentGateway);

// POST /api/admin/test-sms
router.post('/test-sms', authenticateToken, requireAdmin, adminLimiter, testSMS);

// POST /api/admin/test-firebase
router.post('/test-firebase', authenticateToken, requireAdmin, adminLimiter, testFirebase);

// POST /api/admin/notifications/send
router.post('/notifications/send', authenticateToken, requireAdmin, adminLimiter, sendAdminNotification);

// GET  /api/admin/notifications
router.get('/notifications', authenticateToken, requireAdmin, adminLimiter, getAdminNotifications);

// POST /api/admin/notifications/:id  (mark read)
router.post('/notifications/:id', authenticateToken, requireAdmin, adminLimiter, markAdminNotificationRead);

// DELETE /api/admin/notifications/:id
router.delete('/notifications/:id', authenticateToken, requireAdmin, adminLimiter, deleteAdminNotification);

// GET  /api/admin/stats
router.get('/stats', authenticateToken, requireAdmin, adminLimiter, getStats);

export default router;
