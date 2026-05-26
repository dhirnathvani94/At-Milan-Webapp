import { CorsOptions } from 'cors';
import { env } from './env';

// ─── Allowed origins ──────────────────────────────────────────────────────────

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
export const ALLOWED_ORIGINS: string[] = [...new Set(allowedOrigins)];

// ─── CORS options ─────────────────────────────────────────────────────────────

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman in dev, mobile apps)
    if (!origin) {
      if (env.IS_DEVELOPMENT) return callback(null, true);
      return callback(new Error('CORS: requests without an Origin header are not allowed in production.'), false);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error(`CORS: Origin "${origin}" is not allowed.`), false);
  },
  credentials: true,                   // Allow Authorization header + cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,                        // Cache preflight for 24 h
};
