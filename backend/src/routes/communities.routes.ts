import { Router, Request, Response } from 'express';
import { getDB, saveDB } from '../db/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { adminLimiter, apiLimiter } from '../middleware/rateLimit';

const router = Router();

// ── GET /api/communities/active ──────────────────────────────────────────────
// PUBLIC — no auth needed — used by registration page dropdown
// Returns only active communities sorted by display_order
router.get('/active', apiLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];
    const active = communities
      .filter((c) => c.is_active !== false)
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));
    res.status(200).json({ success: true, communities: active });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not fetch communities.' });
  }
});

// ── GET /api/communities ─────────────────────────────────────────────────────
// ADMIN ONLY — returns ALL communities including inactive ones
router.get('/', authenticateToken, requireAdmin, adminLimiter, async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];
    const sorted = [...communities].sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));
    res.status(200).json({ success: true, communities: sorted });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not fetch communities.' });
  }
});

// ── POST /api/communities ────────────────────────────────────────────────────
// ADMIN ONLY — create a new community
router.post('/', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sub_castes, gotras, is_active, display_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Community name must be at least 2 characters.' });
      return;
    }

    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];

    // Prevent duplicate names (case-insensitive)
    const duplicate = communities.find((c: any) =>
      c.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (duplicate) {
      res.status(409).json({ success: false, error: `Community '${name}' already exists.` });
      return;
    }

    const newCommunity = {
      id: crypto.randomUUID(),
      name: name.trim(),
      sub_castes: Array.isArray(sub_castes) ? sub_castes.filter(Boolean) : [],
      gotras: Array.isArray(gotras) ? gotras.filter(Boolean) : [],
      is_active: is_active !== false,
      display_order: typeof display_order === 'number' ? display_order : communities.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    communities.push(newCommunity);
    (db as any).communities = communities;
    saveDB(db);

    res.status(201).json({ success: true, community: newCommunity });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not create community.' });
  }
});

// ── PUT /api/communities/:id ─────────────────────────────────────────────────
// ADMIN ONLY — update an existing community
router.put('/:id', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, sub_castes, gotras, is_active, display_order } = req.body;

    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];
    const idx = communities.findIndex((c: any) => c.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Community not found.' });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
        return;
      }
      // Check duplicate name (excluding self)
      const dup = communities.find((c: any, i: number) =>
        i !== idx && c.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (dup) {
        res.status(409).json({ success: false, error: `Community '${name}' already exists.` });
        return;
      }
      communities[idx].name = name.trim();
    }

    if (Array.isArray(sub_castes)) communities[idx].sub_castes = sub_castes.filter(Boolean);
    if (Array.isArray(gotras))     communities[idx].gotras     = gotras.filter(Boolean);
    if (typeof is_active === 'boolean') communities[idx].is_active = is_active;
    if (typeof display_order === 'number') communities[idx].display_order = display_order;
    communities[idx].updated_at = new Date().toISOString();

    (db as any).communities = communities;
    saveDB(db);

    res.status(200).json({ success: true, community: communities[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update community.' });
  }
});

// ── DELETE /api/communities/:id ──────────────────────────────────────────────
// ADMIN ONLY — delete a community (only if it has no registered users)
router.delete('/:id', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];
    const community = communities.find((c: any) => c.id === id);

    if (!community) {
      res.status(404).json({ success: false, error: 'Community not found.' });
      return;
    }

    // Prevent deleting the last active community
    const activeCount = communities.filter((c: any) => c.is_active).length;
    if (community.is_active && activeCount <= 1) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete the last active community. Deactivate it instead.',
      });
      return;
    }

    (db as any).communities = communities.filter((c: any) => c.id !== id);
    saveDB(db);

    res.status(200).json({ success: true, message: 'Community deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not delete community.' });
  }
});

// ── PATCH /api/communities/:id/toggle ───────────────────────────────────────
// ADMIN ONLY — toggle active/inactive
router.patch('/:id/toggle', authenticateToken, requireAdmin, adminLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = await getDB();
    const communities = ((db as any).communities ?? []) as any[];
    const idx = communities.findIndex((c: any) => c.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Community not found.' });
      return;
    }

    const activeCount = communities.filter((c: any) => c.is_active).length;
    if (communities[idx].is_active && activeCount <= 1) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate the last active community.',
      });
      return;
    }

    communities[idx].is_active = !communities[idx].is_active;
    communities[idx].updated_at = new Date().toISOString();

    (db as any).communities = communities;
    saveDB(db);

    res.status(200).json({ success: true, community: communities[idx] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not toggle community.' });
  }
});

export default router;
