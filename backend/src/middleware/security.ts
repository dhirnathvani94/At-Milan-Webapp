import { RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { env } from '../config/env';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const allowedOrigins: string[] = [env.FRONTEND_URL];

// In development, also allow common local dev ports
if (env.IS_DEVELOPMENT) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  );
}

// Deduplicate
const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman in dev)
    if (!origin) {
      if (env.IS_DEVELOPMENT) return callback(null, true);
      return callback(new Error('CORS: No origin header'), false);
    }

    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error(`CORS: Origin "${origin}" is not allowed`), false);
  },
  credentials: true,                  // Allow cookies / Authorization header
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],  // Useful for paginated list responses
  maxAge: 86400,                      // Cache preflight for 24 h
};

// ─── Helmet ───────────────────────────────────────────────────────────────────

const helmetMiddleware = helmet({
  // Hide "X-Powered-By: Express"
  hidePoweredBy: true,

  // HTTP Strict Transport Security — 1 year, include subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  // Prevent MIME-type sniffing
  noSniff: true,

  // XSS filter (legacy browsers)
  xssFilter: true,

  // Deny framing entirely (clickjacking protection)
  frameguard: { action: 'deny' },

  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: env.IS_PRODUCTION ? [] : null,
    },
  },

  // Referrer policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // Disable DNS prefetch
  dnsPrefetchControl: { allow: false },

  // IE no-open
  ieNoOpen: true,

  // Permissions policy (formerly Feature-Policy)
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

// ─── XSS clean (sanitise req.body, req.query, req.params) ────────────────────
// xss-clean doesn't ship its own types; cast to RequestHandler
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xssClean = require('xss-clean') as () => RequestHandler;

// ─── Assemble middleware array ────────────────────────────────────────────────

export const securityMiddleware: RequestHandler[] = [
  // 1. Security headers
  helmetMiddleware as unknown as RequestHandler,

  // 2. CORS
  cors(corsOptions) as RequestHandler,

  // 3. Parse JSON bodies — 10 mb limit
  express.json({ limit: '10mb' }),

  // 4. Parse URL-encoded bodies — 10 mb limit
  express.urlencoded({ extended: true, limit: '10mb' }),

  // 5. Strip MongoDB operator injection ($where, $gt, etc.)
  mongoSanitize() as unknown as RequestHandler,

  // 6. Strip XSS from body / query / params
  xssClean(),

  // 7. Prevent HTTP Parameter Pollution
  hpp() as unknown as RequestHandler,
];
