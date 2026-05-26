import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

// ─── Sensitive field names that must NEVER appear in logs ─────────────────────

const SENSITIVE_KEYS = new Set([
  'password',
  'password_confirm',
  'new_password',
  'old_password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'otp',
  'otp_code',
  'secret',
  'jwt',
  'credit_card',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'encryption_key',
  'jwt_secret',
]);

// ─── Sanitise an object before logging ───────────────────────────────────────

function sanitise(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[deep]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitise(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitise(value, depth + 1);
    }
  }
  return result;
}

// ─── Log file setup (production only) ────────────────────────────────────────

const LOG_DIR = path.resolve(__dirname, '../../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function writeToFile(line: string): void {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  } catch {
    // If we can't write to the log file, fall back to console silently
    console.error('[Logger] Could not write to log file:', LOG_FILE);
  }
}

// ─── Format a log entry ───────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  responseTimeMs: number;
  ip: string;
  userAgent?: string;
  userId?: string;
  body?: unknown;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// ─── Logger middleware ────────────────────────────────────────────────────────

/**
 * Logs every HTTP request with:
 *   timestamp | method | path | status | response time | IP
 *
 * Development → console (coloured, human-readable)
 * Production  → logs/app.log (JSON, one entry per line)
 *
 * Sensitive fields (passwords, tokens, OTPs, card numbers) are ALWAYS
 * stripped before any log output.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startAt = process.hrtime.bigint();

  // Capture the original end() so we can hook into it
  const originalEnd = res.end.bind(res);

  // @ts-ignore — overriding overloaded method
  res.end = function (
    chunk?: unknown,
    encoding?: BufferEncoding | (() => void),
    callback?: () => void
  ): Response {
    const durationNs = process.hrtime.bigint() - startAt;
    const durationMs = Number(durationNs) / 1_000_000;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      'unknown';

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      responseTimeMs: Math.round(durationMs * 100) / 100,
      ip,
      userAgent: req.headers['user-agent'],
      userId: (req as Request & { user?: { id: string } }).user?.id,
    };

    // In development, also log sanitised body for easier debugging
    if (env.IS_DEVELOPMENT && req.body && Object.keys(req.body).length > 0) {
      entry.body = sanitise(req.body);
    }

    if (env.IS_DEVELOPMENT) {
      // Coloured console output
      const statusColor =
        res.statusCode >= 500
          ? '\x1b[31m'   // red
          : res.statusCode >= 400
          ? '\x1b[33m'   // yellow
          : res.statusCode >= 300
          ? '\x1b[36m'   // cyan
          : '\x1b[32m';  // green
      const reset = '\x1b[0m';

      console.log(
        `${entry.timestamp} ${req.method.padEnd(7)} ${statusColor}${res.statusCode}${reset}` +
          ` ${entry.responseTimeMs}ms  ${entry.path}  [${ip}]` +
          (entry.userId ? `  uid:${entry.userId}` : '')
      );
    } else {
      // Production: write JSON to file
      writeToFile(formatEntry(entry));
    }

    // Call the original end()
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    }
    return originalEnd(chunk, encoding as BufferEncoding, callback);
  };

  next();
}
