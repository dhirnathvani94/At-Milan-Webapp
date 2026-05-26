import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

// ── Reactivation router ───────────────────────────────────────────────────────
export const reactivationRouter = Router();

// POST /api/reactivation/request
reactivationRouter.post('/request', authenticateToken, (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Request received.' });
});

// ── Referral router ───────────────────────────────────────────────────────────
export const referralRouter = Router();

// POST /api/referral/use
referralRouter.post('/use', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// ── Match-confirmation router ─────────────────────────────────────────────────
export const matchRouter = Router();

// POST /api/match-confirmation
matchRouter.post('/', authenticateToken, (_req: Request, res: Response) => {
  res.json({ success: true });
});
