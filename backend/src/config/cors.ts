import { CorsOptions } from 'cors';
import { env } from './env';

const allowedOrigins: string[] = [
  env.FRONTEND_URL,
  'https://atmilan-frontend.vercel.app',
];

// Add all Vercel preview URL patterns
const allowedPatterns: RegExp[] = [
  /^https:\/\/atmilan-frontend.*\.vercel\.app$/,
  /^https:\/\/at-milan.*\.vercel\.app$/,
];

if (env.IS_DEVELOPMENT) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
  );
}

export const ALLOWED_ORIGINS: string[] = [...new Set(allowedOrigins)];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin header
    // This covers: mobile apps, Postman, server-to-server,
    // some mobile browsers, React Native, PWA
    if (!origin) {
      return callback(null, true);
    }

    // Check exact match
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Check pattern match (Vercel preview URLs)
    if (allowedPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }

    callback(new Error(`CORS: Origin "${origin}" is not allowed.`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    "Content-Type","Authorization","X-Requested-With",
    "Cache-Control","Pragma","x-user-id","x-device-id"
  ],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400,
};
