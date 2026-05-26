// ─── STEP 1: Validate env FIRST — server stops here if anything is missing ────
// This import throws immediately if JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
// or ENCRYPTION_KEY are missing or still contain placeholder values.
import { env } from './config/env';

import http from 'http';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ─── Config ───────────────────────────────────────────────────────────────────
import { corsOptions } from './config/cors';

// ─── Middleware ───────────────────────────────────────────────────────────────
import { requestLogger } from './middleware/logger';
import { apiLimiter } from './middleware/rateLimit';

// ─── Database ─────────────────────────────────────────────────────────────────
import { getDB, saveDB } from './db/database';

// ─── Socket ───────────────────────────────────────────────────────────────────
import { initSocket } from './services/socket.service';

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes                                          from './routes/auth.routes';
import profileRoutes                                       from './routes/profile.routes';
import { searchRouter, recommendationsRouter, newMembersRouter } from './routes/search.routes';
import interestRoutes                                      from './routes/interest.routes';
import messageRoutes                                       from './routes/message.routes';
import notificationRoutes                                  from './routes/notification.routes';
import shortlistRoutes                                     from './routes/shortlist.routes';
import creditsRoutes                                       from './routes/credits.routes';
import dashboardRoutes                                     from './routes/dashboard.routes';
import paymentRoutes, { gatewayRouter, checkoutRouter }   from './routes/payment.routes';
import plansRoutes                                         from './routes/plans.routes';
import purchaseRoutes                                      from './routes/purchase.routes';
import verificationRoutes                                  from './routes/verification.routes';
import safetyRoutes                                        from './routes/safety.routes';
import gdprRoutes                                          from './routes/gdpr.routes';
import documentRoutes                                      from './routes/document.routes';
import masterdataRoutes                                    from './routes/masterdata.routes';
import communitiesRoutes                                   from './routes/communities.routes';
import publicRoutes                                        from './routes/public.routes';
import uploadRoutes, { photosRouter, profileViewsRouter } from './routes/upload.routes';

// ─── Admin Routes ─────────────────────────────────────────────────────────────
import adminUsersRoutes     from './routes/admin/admin.users.routes';
import adminSettingsRoutes  from './routes/admin/admin.settings.routes';
import adminReportsRoutes   from './routes/admin/admin.reports.routes';
import adminAnalyticsRoutes from './routes/admin/admin.analytics.routes';

// ─── XSS clean ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xssClean = require('xss-clean') as () => express.RequestHandler;

// ─── App ──────────────────────────────────────────────────────────────────────

const app        = express();
const httpServer = http.createServer(app);

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE — applied in exact specified order
// ═══════════════════════════════════════════════════════════════════════════════

// 1. Request logger (before everything so every request is captured)
app.use(requestLogger);

// 2. Helmet — security headers
app.use(
  helmet({
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'", "'unsafe-inline'"],
        imgSrc:      ["'self'", 'data:', 'blob:'],
        connectSrc:  ["'self'"],
        fontSrc:     ["'self'"],
        objectSrc:   ["'none'"],
        frameSrc:    ["'none'"],
        upgradeInsecureRequests: env.IS_PRODUCTION ? [] : null,
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    dnsPrefetchControl: { allow: false },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }) as express.RequestHandler
);

// 3. CORS — locked to FRONTEND_URL only (+ localhost in dev)
app.use(cors(corsOptions) as express.RequestHandler);

// 4. Compression
app.use(compression() as express.RequestHandler);

// 5. Body parsers — 10 mb limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. XSS sanitisation on req.body / req.query / req.params
app.use(xssClean());

// 7. Global API rate limiter on all /api/* routes
app.use('/api', apiLimiter);

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECKS — no auth, no rate limit
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status:      'ok',
    uptime:      Math.floor(process.uptime()),
    timestamp:   new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.get('/api/lb-health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC FILES — serve uploads folder
// ═══════════════════════════════════════════════════════════════════════════════

app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'), {
    maxAge: env.IS_PRODUCTION ? '7d' : '0',
    etag:   true,
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES — mounted in exact specified order
// ═══════════════════════════════════════════════════════════════════════════════

// Auth
app.use('/api/auth',                authRoutes);

// Profiles
app.use('/api/profiles',            profileRoutes);

// Upload (photo + document)
app.use('/api/upload',              uploadRoutes);

// Photos (delete)
app.use('/api/photos',              photosRouter);

// Search
app.use('/api/search',              searchRouter);
app.use('/api/recommendations',     recommendationsRouter);
app.use('/api/new-members',         newMembersRouter);

// Interests
app.use('/api/interests',           interestRoutes);

// Messages
app.use('/api/messages',            messageRoutes);

// Notifications
app.use('/api/notifications',       notificationRoutes);

// Shortlists
app.use('/api/shortlists',          shortlistRoutes);

// Credits
app.use('/api/credits',             creditsRoutes);

// Dashboard
app.use('/api/dashboard',           dashboardRoutes);

// Payment
app.use('/api/payment',             paymentRoutes);
app.use('/api/payment-gateways',    gatewayRouter);

// Plans
app.use('/api/plans',               plansRoutes);

// Purchases
app.use('/api/purchases',           purchaseRoutes);

// Checkout
app.use('/api/checkout',            checkoutRouter);

// Verification (admin)
app.use('/api/verification',        verificationRoutes);

// Safety (users + chat-safety — both prefixes handled inside safety.routes.ts)
app.use('/api',                     safetyRoutes);

// GDPR
app.use('/api/gdpr',                gdprRoutes);

// Documents
app.use('/api/documents',           documentRoutes);

// Master data
app.use('/api/master-data',         masterdataRoutes);

// Communities (public active list + admin CRUD)
app.use('/api/communities',         communitiesRoutes);

// Profile views
app.use('/api/profile-views',       profileViewsRouter);

// Public routes (success-stories, contact, coupons, fcm, firebase-config, users/online)
app.use('/api',                     publicRoutes);

// ── Admin routes ───────────────────────────────────────────────────────────────
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/admin', adminReportsRoutes);
app.use('/api/admin', adminAnalyticsRoutes);

// ═══════════════════════════════════════════════════════════════════════════════
// 404 HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error:   'Route not found.',
    path:    req.path,
    method:  req.method,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Always log the full error server-side
  console.error(`[Error] ${req.method} ${req.path} —`, err.message);
  if (env.IS_DEVELOPMENT) {
    console.error(err.stack);
  }

  // CORS errors
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ success: false, error: err.message });
    return;
  }

  // In production: never expose stack trace or internal error details
  res.status(500).json({
    success: false,
    error:   env.IS_PRODUCTION
      ? 'Internal server error.'
      : err.message,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════════

async function bootstrapAdmin(): Promise<void> {
  try {
    const db    = await getDB();
    const users = db.users as Array<{
      id: string;
      email: string;
      password_hash: string;
      role: string;
      is_active: boolean;
      email_verified: boolean;
      email_verify_token: null;
      email_verify_token_expiry: null;
      password_reset_token: null;
      password_reset_token_expiry: null;
      last_login: null;
      login_attempts: number;
      login_locked_until: null;
      provider: null;
      provider_id: null;
      created_at: string;
      updated_at: string;
    }>;

    const existingAdmin = users.find(
      (u) => u.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() && u.role === 'admin'
    );

    if (existingAdmin) {
      console.log(`[Bootstrap] Admin account ready: ${env.ADMIN_EMAIL}`);
      return;
    }

    // Create admin — password comes from env only, never hardcoded
    const now          = new Date().toISOString();
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);

    users.push({
      id:                          uuidv4(),
      email:                       env.ADMIN_EMAIL.toLowerCase(),
      password_hash:               passwordHash,
      role:                        'admin',
      is_active:                   true,
      email_verified:              true,
      email_verify_token:          null,
      email_verify_token_expiry:   null,
      password_reset_token:        null,
      password_reset_token_expiry: null,
      last_login:                  null,
      login_attempts:              0,
      login_locked_until:          null,
      provider:                    null,
      provider_id:                 null,
      created_at:                  now,
      updated_at:                  now,
    });

    saveDB(db);

    // Log email only — NEVER log the password
    console.log(`[Bootstrap] Admin account created: ${env.ADMIN_EMAIL}`);
  } catch (err) {
    console.error('[Bootstrap] Failed to bootstrap admin account:', (err as Error).message);
    // Non-fatal — server continues running
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer(): Promise<void> {
  // Bootstrap admin account before accepting requests
  await bootstrapAdmin();

  // Initialise Socket.IO on the HTTP server
  initSocket(httpServer);

  // Start listening
  httpServer.listen(env.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║   💍 AtMilan Backend running on port ${String(env.PORT).padEnd(5)}  ║`);
    console.log(`║   Environment : ${env.NODE_ENV.padEnd(31)}║`);
    console.log(`║   Frontend URL: ${env.FRONTEND_URL.substring(0, 31).padEnd(31)}║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    httpServer.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });

    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // ── Unhandled rejection guard ──────────────────────────────────────────────
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught Exception:', err.message);
    if (env.IS_PRODUCTION) {
      process.exit(1);
    }
  });
}

startServer().catch((err: Error) => {
  console.error('[Server] Fatal startup error:', err.message);
  process.exit(1);
});

export { app, httpServer };
