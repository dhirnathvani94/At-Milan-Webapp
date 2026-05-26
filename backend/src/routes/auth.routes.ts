import { Router, Request, Response } from 'express';
import { authLimiter, otpLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../middleware/validate';
import { getDB } from '../db/database';
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
  checkDuplicate,
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

// POST /api/auth/check-duplicate
router.post('/check-duplicate', authLimiter, checkDuplicate);

// POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ error: 'Phone and OTP required.' });
      return;
    }
    const db = await getDB();
    const otps = (db.otps as any[]) || [];
    const kv: Record<string, string> = {};
    ((db.admin_settings_kv as any[]) || []).forEach((s: any) => { kv[s.key] = s.value; });
    const masterOtp = (kv['master_otp'] || '').trim();
    if (masterOtp && otp.trim() === masterOtp) {
      res.json({ success: true, message: 'OTP verified.' });
      return;
    }
    const record = otps.find((o: any) => o.phone === phone);
    if (!record) { res.status(400).json({ error: 'No OTP found. Request new OTP.' }); return; }
    if (new Date(record.expiry) < new Date()) { res.status(400).json({ error: 'OTP expired.' }); return; }
    if (record.otp !== otp.trim()) { res.status(400).json({ error: 'Incorrect OTP.' }); return; }
    res.json({ success: true, message: 'OTP verified.' });
  } catch { res.status(500).json({ error: 'Verification failed.' }); }
});

export default router;
