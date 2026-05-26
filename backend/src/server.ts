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
import { authenticateToken } from './middleware/auth';

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
import { reactivationRouter, referralRouter, matchRouter } from './routes/stubs.routes';

// ─── XSS clean ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xssClean = require('xss-clean') as () => express.RequestHandler;

// ─── App ──────────────────────────────────────────────────────────────────────

const app        = express();
app.set('trust proxy', 1);          // Trust Render/Heroku reverse proxy for X-Forwarded-For
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

// ── Stub routes (prevent 404 for unimplemented features) ─────────────────────
app.use('/api/reactivation',       reactivationRouter);
app.use('/api/referral',           referralRouter);
app.use('/api/match-confirmation', matchRouter);

// GET /api/profile-status/:userId
app.get('/api/profile-status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const db = await getDB();
    const profile = (db.profiles as any[]).find(
      (p: any) => p.user_id === userId || p.id === userId
    );
    if (!profile) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({
      profile_status:                  profile.profile_status                  || 'active',
      reactivation_count:              profile.reactivation_count              || 0,
      reactivation_status:             profile.reactivation_status             || 'none',
      reactivation_rejection_remark:   profile.reactivation_rejection_remark   || '',
      match_confirmed:                 profile.match_confirmed                 || false,
      match_type:                      profile.match_type                      || null,
    });
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ─── MISSING ROUTE 1: interests status between two users ────────────────────
app.get('/api/interests/status/:userA/:userB', async (req: Request, res: Response) => {
  try {
    const { userA, userB } = req.params;
    const db = await getDB();
    const interests = db.interests as any[];
    const sent     = interests.filter((i: any) => i.sender_id === userA && i.receiver_id === userB);
    const received = interests.filter((i: any) => i.sender_id === userB && i.receiver_id === userA);
    const getPriority = (s: string) => s === 'accepted' ? 4 : s === 'pending' ? 3 : s === 'declined' ? 2 : 1;
    sent.sort((a: any, b: any) => getPriority(b.status) - getPriority(a.status));
    received.sort((a: any, b: any) => getPriority(b.status) - getPriority(a.status));
    res.json({ sent: sent[0] || null, received: received[0] || null });
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ─── MISSING ROUTE 2: public banners ────────────────────────────────────────
app.get('/api/public/banners', async (_req: Request, res: Response) => {
  try {
    const db = await getDB();
    const kv = db.admin_settings_kv as any[];
    const setting = kv.find((s: any) => s.key === 'home_banners');
    if (!setting?.value) { res.json({ banners: [] }); return; }
    try { res.json({ banners: JSON.parse(setting.value) }); }
    catch { res.json({ banners: [] }); }
  } catch { res.json({ banners: [] }); }
});

// ─── MISSING ROUTE 3: match-confirmation-email ──────────────────────────────
app.post('/api/match-confirmation-email', async (req: Request, res: Response) => {
  try {
    const { user_id, match_type, match_platform, partner_profile_id } = req.body;
    if (!user_id) { res.status(400).json({ error: 'Missing user_id' }); return; }
    const db = await getDB();
    const profile = (db.profiles as any[]).find((p: any) => p.user_id === user_id || p.id === user_id);
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    const newStatus = match_type === 'marriage' ? 'married' : 'engaged';
    profile.match_confirmed     = true;
    profile.match_type          = match_type     || 'engagement';
    profile.match_platform      = match_platform || 'other';
    profile.match_partner_profile_id = partner_profile_id || '';
    profile.profile_status      = newStatus;
    if (!(db as any).match_confirmations) (db as any).match_confirmations = [];
    const already = (db as any).match_confirmations.find((m: any) => m.user_id === user_id && m.status !== 'rejected');
    if (!already) {
      (db as any).match_confirmations.push({
        id: uuidv4(), user_id,
        match_type:          match_type          || 'engagement',
        match_platform:      match_platform      || 'other',
        partner_profile_id:  partner_profile_id  || '',
        status: 'pending', created_at: new Date().toISOString()
      });
    }
    await saveDB(db);
    res.json({ success: true, status: newStatus });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed' }); }
});

// ─── MISSING ROUTE 4: admin reactivation requests ───────────────────────────
app.get('/api/admin/reactivation-requests', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const db = await getDB();
    const requests = ((db as any).reactivation_requests || []).map((r: any) => {
      const profile = (db.profiles as any[]).find((p: any) => p.user_id === r.user_id || p.id === r.user_id);
      return {
        ...r, user: profile ? {
          first_name:         profile.first_name,
          last_name:          profile.last_name,
          profile_id:         profile.profile_id,
          profile_photo_url:  profile.profile_photo_url,
          profile_status:     profile.profile_status
        } : null
      };
    });
    res.json(requests);
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ─── MISSING ROUTE 5: admin reactivation decision ───────────────────────────
app.post('/api/admin/reactivation/:requestId/decision', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { decision, remark } = req.body;
    const db = await getDB();
    const requests = ((db as any).reactivation_requests || []) as any[];
    const request = requests.find((r: any) => r.id === requestId);
    if (!request) { res.status(404).json({ error: 'Request not found' }); return; }
    request.status             = decision;
    request.rejection_remark   = remark || '';
    request.decided_at         = new Date().toISOString();
    const profile = (db.profiles as any[]).find((p: any) => p.user_id === request.user_id || p.id === request.user_id);
    if (profile) {
      if (decision === 'approved') {
        profile.profile_status                = 'active';
        profile.reactivation_status           = 'approved';
        profile.match_confirmed               = false;
        profile.match_type                    = null;
        profile.reactivation_rejection_remark = '';
      } else {
        profile.reactivation_status           = 'rejected';
        profile.reactivation_rejection_remark = remark || '';
      }
    }
    await saveDB(db);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message || 'Failed' }); }
});

// ─── MISSING ROUTE 6: admin match-confirmations list ────────────────────────
app.get('/api/admin/match-confirmations', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const db = await getDB();
    const confirmations = ((db as any).match_confirmations || []).map((m: any) => {
      const profile = (db.profiles as any[]).find((p: any) => p.user_id === m.user_id || p.id === m.user_id);
      return {
        ...m, user: profile ? {
          first_name:         profile.first_name,
          last_name:          profile.last_name,
          profile_id:         profile.profile_id,
          profile_photo_url:  profile.profile_photo_url
        } : null
      };
    });
    res.json(confirmations);
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ─── MISSING ROUTE 7: admin referral-links ──────────────────────────────────
app.get('/api/admin/referral-links', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const db = await getDB();
    const links = ((db as any).referral_links || []).map((l: any) => {
      const profile = (db.profiles as any[]).find((p: any) => p.user_id === l.user_id || p.id === l.user_id);
      return {
        id:             l.id,
        user_id:        l.user_id,
        code:           l.code,
        type:           l.match_type || l.type || 'engagement',
        status:         l.is_used ? 'used' : 'active',
        used_by:        l.used_by   || null,
        used_at:        l.used_date || l.used_at || null,
        created_at:     l.created_at,
        premium_months: l.premium_months || 1,
        user: profile ? {
          first_name: profile.first_name,
          last_name:  profile.last_name || '',
          profile_id: profile.profile_id
        } : null
      };
    });
    res.json(links);
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ─── MISSING ROUTE 8: admin notifications mark-read ─────────────────────────
app.post('/api/admin/notifications/:notifId/mark-read', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const { user_id } = req.body;
    const notif = (db.notifications as any[]).find(
      (n: any) => n.admin_notification_id === req.params.notifId && n.user_id === user_id
    );
    if (notif) {
      notif.is_read = true;
      const adminNotif = ((db as any).admin_notifications as any[] || []).find((n: any) => n.id === req.params.notifId);
      if (adminNotif) adminNotif.read_count = (adminNotif.read_count || 0) + 1;
      await saveDB(db);
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── MISSING ROUTE 9: accessibility-status ──────────────────────────────────
app.get('/api/admin/accessibility-status', (_req: Request, res: Response) => {
  res.json({
    wcag_version: '2.1', conformance_level: 'AA',
    features: {
      skip_to_content: true, focus_indicators: true,
      keyboard_navigation: true, screen_reader_support: true,
      aria_landmarks: true, reduced_motion: true
    }
  });
});

// ─── MISSING ROUTE 10: scaling-status (stub) ────────────────────────────────
app.get('/api/admin/scaling-status', (_req: Request, res: Response) => {
  res.json({
    cluster:     { mode: 'single', pid: process.pid, cpuCores: 1 },
    autoScaling: { enabled: false },
    load:        { requests: { rps: 0 } }
  });
});

// ─── MISSING ROUTE 11: scaling-decision (stub) ──────────────────────────────
app.get('/api/admin/scaling-decision', (_req: Request, res: Response) => {
  res.json({ decision: 'none', reason: 'Auto-scaling not configured on this plan.' });
});

// ─── MISSING ROUTE 12: cdn-config (stub) ────────────────────────────────────
app.post('/api/admin/cdn-config', authenticateToken, (_req: Request, res: Response) => {
  res.json({ success: true, message: 'CDN config updated.' });
});

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

    let adminUser = users.find(
      (u) => u.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() && u.role === 'admin'
    );

    if (adminUser) {
      console.log(`[Bootstrap] Admin account ready: ${env.ADMIN_EMAIL}`);
    } else {
      // Create admin — password comes from env only, never hardcoded
      const now          = new Date().toISOString();
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
      const newId        = uuidv4();

      const newAdmin = {
        id:                          newId,
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
      };
      users.push(newAdmin);
      adminUser = newAdmin as any;

      // Log email only — NEVER log the password
      console.log(`[Bootstrap] Admin account created: ${env.ADMIN_EMAIL}`);
    }

    // ── Seed admin into admin_managers with full master access ────────────────
    // Ensures the main admin always has ['*'] permissions on every startup.
    try {
      if (!(db as any).admin_managers) (db as any).admin_managers = [];
      const managers = (db as any).admin_managers as any[];

      const existingEntry = managers.find(
        (m: any) => m.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()
      );

      if (!existingEntry) {
        const now = new Date().toISOString();
        managers.push({
          id:           adminUser!.id,
          email:        adminUser!.email,
          password_hash: adminUser!.password_hash,
          name:         'Master Admin',
          role:         'master_admin',
          permissions:  ['*'],
          is_active:    true,
          created_by:   'system',
          created_at:   now,
          updated_at:   now,
          last_login:   null,
        });
        console.log('[Bootstrap] Master Admin seeded into admin_managers with full permissions.');
      } else if (!existingEntry.permissions?.includes('*')) {
        // Upgrade existing entry to full permissions if not already set
        existingEntry.permissions = ['*'];
        existingEntry.role        = 'master_admin';
        existingEntry.updated_at  = new Date().toISOString();
        console.log('[Bootstrap] Master Admin permissions upgraded to ["*"].');
      }
    } catch (seedErr) {
      console.warn('[Bootstrap] Could not seed admin_managers:', (seedErr as Error).message);
    }

    saveDB(db);
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

  // Load master OTP from settings
  try {
    const db2 = await getDB();
    const kv2 = db2.admin_settings_kv as Array<{key:string;value:string}>;
    const masterOtpRow = kv2.find((s: any) => s.key === 'master_otp');
    if (masterOtpRow?.value) {
      const { setMasterOTP } = await import('./services/otp.service');
      setMasterOTP(masterOtpRow.value);
      console.log('[OTP] Master OTP loaded from admin settings.');
    }
  } catch {
    // Non-fatal
  }

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
