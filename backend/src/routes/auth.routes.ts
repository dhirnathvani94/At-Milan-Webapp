import { Router } from 'express';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../middleware/validate';
import {
  register,
  login,
  adminLogin,
  verifyEmail,
  resendVerification,
  sendOTP,
  verifyOTP,
  socialLogin,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';

const router = Router();

// ─── Public auth routes ───────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', authLimiter, validate(registerSchema), register);

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), login);

// POST /api/auth/admin/login
router.post('/admin/login', authLimiter, adminLogin);

// GET  /api/auth/verify-email?token=<token>
router.get('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, resendVerification);

// POST /api/auth/send-otp
router.post('/send-otp', otpLimiter, sendOTP);

// POST /api/auth/verify-otp
router.post('/verify-otp', otpLimiter, verifyOTP);

// POST /api/auth/social-login
router.post('/social-login', authLimiter, socialLogin);

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

export default router;
