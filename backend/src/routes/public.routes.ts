import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  getSuccessStories,
  shareSuccessStory,
  submitContact,
  validateCoupon,
  getFirebaseConfig,
  getFCMConfig,
  registerFCMToken,
  unregisterFCMToken,
  getUsersOnline,
} from '../controllers/public.controller';

const router = Router();

// ─── Success stories ──────────────────────────────────────────────────────────

// GET  /api/success-stories            — public
router.get('/success-stories', getSuccessStories);

// POST /api/success-stories/share      — authenticated
router.post('/success-stories/share', authenticateToken, shareSuccessStory);

// ─── Contact form ─────────────────────────────────────────────────────────────

// POST /api/contact                    — rate limited, no auth
router.post('/contact', apiLimiter, submitContact);

// ─── Coupons ──────────────────────────────────────────────────────────────────

// POST /api/coupons/validate           — authenticated
router.post('/coupons/validate', authenticateToken, validateCoupon);

// ─── Firebase / FCM config ────────────────────────────────────────────────────

// GET  /api/admin/settings/firebase-config  — public (needed on page load before auth)
router.get('/admin/settings/firebase-config', getFirebaseConfig);

// GET  /api/fcm/config                 — public alias
router.get('/fcm/config', getFCMConfig);

// POST /api/fcm/register-token         — authenticated
router.post('/fcm/register-token', authenticateToken, registerFCMToken);

// POST /api/fcm/unregister-token       — authenticated
router.post('/fcm/unregister-token', authenticateToken, unregisterFCMToken);

// ─── Online users ─────────────────────────────────────────────────────────────

// GET  /api/users/online               — authenticated
router.get('/users/online', authenticateToken, getUsersOnline);

export default router;
