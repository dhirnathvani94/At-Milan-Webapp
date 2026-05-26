import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { adminLimiter } from '../../middleware/rateLimit';
import {
  getReports,
  updateReportStatus,
  getUserReport,
  getMessageReports,
  handleMessageReport,
  getContactMessages,
  resolveContact,
  getUnblockRequests,
  handleUnblockRequest,
  getUnblockRequestDetail,
  getTickets,
  closeTicket,
  rejectTicket,
  reopenTicket,
} from '../../controllers/admin/admin.reports.controller';

const router = Router();

// ─── All routes require: authenticateToken + requireAdmin + adminLimiter ──────

// GET  /api/admin/reports
router.get('/reports', authenticateToken, requireAdmin, adminLimiter, getReports);

// POST /api/admin/reports/:id/status
router.post('/reports/:id/status', authenticateToken, requireAdmin, adminLimiter, updateReportStatus);

// GET  /api/admin/user-report/:id
router.get('/user-report/:id', authenticateToken, requireAdmin, adminLimiter, getUserReport);

// GET  /api/admin/message-reports
router.get('/message-reports', authenticateToken, requireAdmin, adminLimiter, getMessageReports);

// POST /api/admin/message-report/:id/handle
router.post('/message-report/:id/handle', authenticateToken, requireAdmin, adminLimiter, handleMessageReport);

// GET  /api/admin/contacts
router.get('/contacts', authenticateToken, requireAdmin, adminLimiter, getContactMessages);

// POST /api/admin/contacts/:id/resolve
router.post('/contacts/:id/resolve', authenticateToken, requireAdmin, adminLimiter, resolveContact);

// GET  /api/admin/unblock-requests
router.get('/unblock-requests', authenticateToken, requireAdmin, adminLimiter, getUnblockRequests);

// POST /api/admin/unblock-request/:id/handle
router.post('/unblock-request/:id/handle', authenticateToken, requireAdmin, adminLimiter, handleUnblockRequest);

// GET  /api/admin/unblock-request/:id/detail
router.get('/unblock-request/:id/detail', authenticateToken, requireAdmin, adminLimiter, getUnblockRequestDetail);

// GET  /api/admin/tickets
router.get('/tickets', authenticateToken, requireAdmin, adminLimiter, getTickets);

// POST /api/admin/tickets/:id/close
router.post('/tickets/:id/close', authenticateToken, requireAdmin, adminLimiter, closeTicket);

// POST /api/admin/tickets/:id/reject
router.post('/tickets/:id/reject', authenticateToken, requireAdmin, adminLimiter, rejectTicket);

// POST /api/admin/tickets/:id/reopen
router.post('/tickets/:id/reopen', authenticateToken, requireAdmin, adminLimiter, reopenTicket);

export default router;
