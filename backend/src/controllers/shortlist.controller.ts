import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../db/database';
import { emitToUser } from '../services/socket.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShortlistRow {
  id: string;
  user_id: string;
  target_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  profile_photo?: string | null;
  city?: string;
  state?: string;
  occupation?: string;
  religion?: string;
  marital_status?: string;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function profilePreview(profile: ProfileRow) {
  return {
    user_id:        profile.user_id,
    first_name:     profile.first_name,
    last_name:      profile.last_name,
    gender:         profile.gender,
    date_of_birth:  profile.date_of_birth,
    profile_photo:  profile.profile_photo ?? null,
    city:           profile.city          ?? null,
    state:          profile.state         ?? null,
    occupation:     profile.occupation    ?? null,
    religion:       profile.religion      ?? null,
    marital_status: profile.marital_status ?? null,
  };
}

// ─── toggleShortlist ──────────────────────────────────────────────────────────

export async function toggleShortlist(req: Request, res: Response): Promise<void> {
  try {
    const userId    = req.user!.id;
    const { target_id } = req.body as { target_id?: string };

    if (!target_id) {
      res.status(400).json({ success: false, error: 'target_id is required.' });
      return;
    }

    if (userId === target_id) {
      res.status(400).json({ success: false, error: 'You cannot shortlist yourself.' });
      return;
    }

    const db         = await getDB();
    const shortlists = db.shortlists as ShortlistRow[];
    const idx        = shortlists.findIndex(
      (s) => s.user_id === userId && s.target_id === target_id
    );

    if (idx !== -1) {
      // Already shortlisted — remove it
      shortlists.splice(idx, 1);
      await saveTable('shortlists', db.shortlists as any[]);
      try { emitToUser(target_id, 'shortlist:updated', { action: 'removed', by_user_id: userId }); } catch {}
      res.status(200).json({ success: true, added: false, message: 'Removed from shortlist.' });
      return;
    }

    // Not shortlisted — add it
    // Verify target user exists and is active
    const users  = db.users as Array<{ id: string; is_active: boolean }>;
    const target = users.find((u) => u.id === target_id);
    if (!target || !target.is_active) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const entry: ShortlistRow = {
      id:         uuidv4(),
      user_id:    userId,
      target_id,
      created_at: new Date().toISOString(),
    };

    shortlists.push(entry);
    await saveTable('shortlists', db.shortlists as any[]);
    try { emitToUser(target_id, 'shortlist:updated', { action: 'added', by_user_id: userId }); } catch {}

    res.status(201).json({ success: true, added: true, message: 'Added to shortlist.', entry });
  } catch (err) {
    console.error('[Shortlist] toggleShortlist error:', err);
    res.status(500).json({ success: false, error: 'Could not update shortlist.' });
  }
}

// ─── getShortlist ─────────────────────────────────────────────────────────────

export async function getShortlist(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(50, parseInt((req.query['limit'] as string) ?? '20', 10));

    const db         = await getDB();
    const shortlists = db.shortlists as ShortlistRow[];
    const profiles   = db.profiles   as ProfileRow[];

    const userShortlist = shortlists
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total      = userShortlist.length;
    const totalPages = Math.ceil(total / limit);
    const paged      = userShortlist.slice((page - 1) * limit, page * limit);

    const data = paged.map((s) => {
      const profile = profiles.find((p) => p.user_id === s.target_id);
      return {
        shortlist_id: s.id,
        target_id:    s.target_id,
        added_at:     s.created_at,
        profile:      profile ? profilePreview(profile) : null,
      };
    });

    res.status(200).json({ success: true, data, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Shortlist] getShortlist error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch shortlist.' });
  }
}

// ─── getShortlistByUserId ─────────────────────────────────────────────────────

export async function getShortlistByUserId(req: Request, res: Response): Promise<void> {
  // Alias — same logic, different route shape
  return getShortlist(req, res);
}

// ─── removeFromShortlist ──────────────────────────────────────────────────────

export async function removeFromShortlist(req: Request, res: Response): Promise<void> {
  try {
    const { userId, targetId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db         = await getDB();
    const shortlists = db.shortlists as ShortlistRow[];
    const idx        = shortlists.findIndex(
      (s) => s.user_id === userId && s.target_id === targetId
    );

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Shortlist entry not found.' });
      return;
    }

    shortlists.splice(idx, 1);
    await saveTable('shortlists', db.shortlists as any[]);
    try { emitToUser(targetId, 'shortlist:updated', { action: 'removed', by_user_id: userId }); } catch {}

    res.status(200).json({ success: true, message: 'Removed from shortlist.' });
  } catch (err) {
    console.error('[Shortlist] removeFromShortlist error:', err);
    res.status(500).json({ success: false, error: 'Could not remove from shortlist.' });
  }
}
