import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root (one level up from src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[ENV] Missing required environment variable: "${key}"\n` +
        `  → Copy .env.example to .env and fill in all required values.`
    );
  }
  return value.trim();
}

function requireSecret(key: string, placeholder: string): string {
  const value = requireEnv(key);
  if (value.includes(placeholder) || value.startsWith('GENERATE')) {
    throw new Error(
      `[ENV] "${key}" still contains the placeholder value "${value}".\n` +
        `  → Generate a real secret with:\n` +
        `     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  return value;
}

// ─── Validate all critical secrets at startup ────────────────────────────────

const JWT_SECRET = requireSecret('JWT_SECRET', 'GENERATE');
const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
const ENCRYPTION_KEY = requireSecret('ENCRYPTION_KEY', 'GENERATE');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = requireEnv('SUPABASE_SERVICE_KEY');

// Validate ENCRYPTION_KEY is exactly 32 bytes (64 hex chars)
if (ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    `[ENV] "ENCRYPTION_KEY" must be exactly 64 hex characters (32 bytes).\n` +
      `  Current length: ${ENCRYPTION_KEY.length}\n` +
      `  → Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  );
}

// Validate ADMIN_EMAIL is a real email address
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) {
  throw new Error(
    `[ENV] "ADMIN_EMAIL" does not look like a valid email address: "${ADMIN_EMAIL}"`
  );
}

// Validate ADMIN_PASSWORD has minimum strength
if (ADMIN_PASSWORD.length < 12) {
  throw new Error(
    `[ENV] "ADMIN_PASSWORD" must be at least 12 characters long for security.`
  );
}

// ─── Exported typed config ───────────────────────────────────────────────────

export const env = {
  // Server
  PORT: parseInt(process.env['PORT'] ?? '5000', 10),
  NODE_ENV: (process.env['NODE_ENV'] ?? 'development') as
    | 'development'
    | 'production'
    | 'test',

  // CORS
  FRONTEND_URL: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',

  // JWT
  JWT_SECRET,
  JWT_EXPIRY: (process.env['JWT_EXPIRY'] ?? '2h') as string,

  // Admin credentials
  ADMIN_EMAIL,
  ADMIN_PASSWORD,

  // Encryption
  ENCRYPTION_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,

  // Database
  DB_FILE: process.env['DB_FILE'] ?? './database.json',

  // Elasticsearch (optional)
  ELASTICSEARCH_URL: process.env['ELASTICSEARCH_URL'] ?? '',

  // Derived helpers
  IS_PRODUCTION: process.env['NODE_ENV'] === 'production',
  IS_DEVELOPMENT: process.env['NODE_ENV'] !== 'production',
} as const;

export type Env = typeof env;
