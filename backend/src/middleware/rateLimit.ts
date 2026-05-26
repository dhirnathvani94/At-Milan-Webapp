import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';

// ─── Shared JSON error handler ────────────────────────────────────────────────

/**
 * Always returns JSON — never HTML — so the React frontend can parse the error.
 */
const jsonHandler: Partial<Options> = {
  standardHeaders: true,   // Return rate-limit info in `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  handler: (req, res, _next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000 / 60), // minutes
    });
  },
};

// ─── Auth limiter ─────────────────────────────────────────────────────────────
// Covers: /api/auth/login, /api/auth/register, /api/auth/forgot-password

export const authLimiter: RateLimitRequestHandler = rateLimit({
  ...jsonHandler,
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,
  message: 'Too many attempts. Try again in 15 minutes.',
  skipSuccessfulRequests: false,
});

// ─── OTP limiter ──────────────────────────────────────────────────────────────
// Covers: /api/auth/send-otp, /api/auth/verify-otp

export const otpLimiter: RateLimitRequestHandler = rateLimit({
  ...jsonHandler,
  windowMs: 10 * 60 * 1000,   // 10 minutes
  max: 3,
  message: 'Too many OTP requests. Try again in 10 minutes.',
  skipSuccessfulRequests: false,
});

// ─── General API limiter ──────────────────────────────────────────────────────
// Applied globally to all /api/* routes

export const apiLimiter: RateLimitRequestHandler = rateLimit({
  ...jsonHandler,
  windowMs: 60 * 1000,         // 1 minute
  max: 100,
  message: 'Too many requests. Slow down.',
  skipSuccessfulRequests: false,
});

// ─── Upload limiter ───────────────────────────────────────────────────────────
// Covers: /api/upload/*, /api/documents/*

export const uploadLimiter: RateLimitRequestHandler = rateLimit({
  ...jsonHandler,
  windowMs: 60 * 1000,         // 1 minute
  max: 10,
  message: 'Too many upload requests. Slow down.',
  skipSuccessfulRequests: false,
});

// ─── Admin limiter ────────────────────────────────────────────────────────────
// Applied to all /api/admin/* routes

export const adminLimiter: RateLimitRequestHandler = rateLimit({
  ...jsonHandler,
  windowMs: 60 * 1000,         // 1 minute
  max: 60,
  message: 'Too many admin requests. Slow down.',
  skipSuccessfulRequests: false,
});
