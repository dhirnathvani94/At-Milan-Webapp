import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../middleware/auth';

// ─── Generate Token ───────────────────────────────────────────────────────────

/**
 * Signs a JWT with the payload { id, email, role }.
 * Secret and expiry come exclusively from env — never hardcoded.
 */
export function generateToken(
  userId: string,
  email: string,
  role: 'user' | 'admin'
): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    id: userId,
    email,
    role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
    issuer: 'atmilan',
    audience: 'atmilan-client',
  });
}

// ─── Verify Token ─────────────────────────────────────────────────────────────

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws jwt.JsonWebTokenError or jwt.TokenExpiredError on failure —
 * callers should handle these explicitly.
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'atmilan',
    audience: 'atmilan-client',
  }) as JwtPayload;

  return decoded;
}
