import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

import { getDB, saveTable } from '../db/database';
import { emitToUser, emitToAdmin } from '../services/socket.service';
import { v4 as uuidv4 } from 'uuid';

export const reactivationRouter = Router();

// POST /api/reactivation/request
reactivationRouter.post('/request', authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { reason } = req.body as { reason?: string };
      const db = await getDB();
      const profiles = db.profiles as any[];
      const pIdx = profiles.findIndex(
        (p: any) => p.user_id === userId || p.id === userId
      );
      if (pIdx === -1) {
        res.status(404).json({ success: false, error: 'Profile not found.' });
        return;
      }
      profiles[pIdx].reactivation_status = 'pending';
      profiles[pIdx].updated_at = new Date().toISOString();
      await saveTable('profiles', profiles);

      const request = {
        id: uuidv4(),
        user_id: userId,
        reason: reason ?? '',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      try { (db.reactivation_requests as any[]).push(request); } catch {}
      try {
        await saveTable('reactivation_requests', db.reactivation_requests as any[]);
      } catch {}

      try {
        emitToAdmin('admin:reactivation-request', {
          userId,
          request,
          profile: profiles[pIdx],
        });
      } catch {}

      res.json({ success: true, message: 'Reactivation request submitted.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/reactivation/approve/:userId
reactivationRouter.post('/approve/:userId', authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const db = await getDB();
      const profiles = db.profiles as any[];
      const pIdx = profiles.findIndex(
        (p: any) => p.user_id === userId || p.id === userId
      );
      if (pIdx !== -1) {
        profiles[pIdx].profile_status = 'active';
        profiles[pIdx].reactivation_status = 'approved';
        profiles[pIdx].updated_at = new Date().toISOString();
        await saveTable('profiles', profiles);
        try {
          emitToUser(userId, 'profile:reactivated', {
            profile_status: 'active',
            reactivation_status: 'approved',
          });
          emitToUser(userId, 'profile:updated', {
            ...profiles[pIdx],
            profile_status: 'active',
            reactivation_status: 'approved',
          });
          emitToUser(userId, 'notification:new', {
            type: 'reactivation_approved',
            message: 'Your profile has been reactivated!',
          });
        } catch {}
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/reactivation/reject/:userId
reactivationRouter.post('/reject/:userId', authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body as { reason?: string };
      const db = await getDB();
      const profiles = db.profiles as any[];
      const pIdx = profiles.findIndex(
        (p: any) => p.user_id === userId || p.id === userId
      );
      if (pIdx !== -1) {
        profiles[pIdx].reactivation_status = 'rejected';
        profiles[pIdx].reactivation_rejection_remark = reason ?? '';
        profiles[pIdx].updated_at = new Date().toISOString();
        await saveTable('profiles', profiles);
        try {
          emitToUser(userId, 'profile:updated', {
            ...profiles[pIdx],
            reactivation_status: 'rejected',
            reactivation_rejection_remark: reason ?? '',
          });
          emitToUser(userId, 'notification:new', {
            type: 'reactivation_rejected',
            message: reason ?? 'Your reactivation request was rejected.',
          });
        } catch {}
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/reactivation/requests (admin)
reactivationRouter.get('/requests', authenticateToken,
  async (_req: Request, res: Response) => {
    try {
      const db = await getDB();
      const requests = db.reactivation_requests as any[] || [];
      const profiles = db.profiles as any[];
      const enriched = requests.map((r: any) => ({
        ...r,
        profile: profiles.find((p: any) =>
          p.user_id === r.user_id || p.id === r.user_id
        ) ?? null,
      }));
      res.json({ success: true, requests: enriched, total: enriched.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

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
