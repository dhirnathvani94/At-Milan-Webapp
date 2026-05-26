import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
  iat?: number;
  exp?: number;
}

// Extend Express Request so downstream handlers get full type safety
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Helper: extract raw token from request ───────────────────────────────────

/**
 * Reads the Bearer token from the Authorization header.
 * The React frontend stores the token in localStorage under the key
 * "atmilan-token" and sends it as:  Authorization: Bearer <token>
 */
export function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') return null;

  const token = parts[1];
  return token && token.trim() !== '' ? token.trim() : null;
}

// ─── authenticateToken ────────────────────────────────────────────────────────

/**
 * Middleware — requires a valid JWT.
 * Attaches req.user = { id, email, role } on success.
 * Returns 401 JSON on any failure.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = getTokenFromRequest(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Validate the payload has the fields we expect
    if (!decoded.id || !decoded.email || !decoded.role) {
      res.status(401).json({
        success: false,
        error: 'Invalid token payload.',
      });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token. Please log in again.',
        code: 'TOKEN_INVALID',
      });
      return;
    }

    // Unexpected error
    res.status(401).json({
      success: false,
      error: 'Authentication failed.',
    });
  }
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────

/**
 * Middleware — must be used AFTER authenticateToken.
 * Allows only users with role === 'admin'.
 * Returns 403 JSON for everyone else.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    // Guard: authenticateToken was not applied before this middleware
    res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.',
    });
    return;
  }

  next();
}

// ─── optionalAuth ─────────────────────────────────────────────────────────────

/**
 * Middleware — tries to read and verify the token.
 * Attaches req.user if valid, but NEVER blocks the request if token is
 * missing or invalid. Useful for public routes that show extra data
 * when the user happens to be logged in (e.g. profile pages).
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (decoded.id && decoded.email && decoded.role) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };
    }
  } catch {
    // Silently ignore — token is invalid or expired, treat as unauthenticated
  }

  next();
}
