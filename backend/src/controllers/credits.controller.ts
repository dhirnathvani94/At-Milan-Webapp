import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreditRow {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

interface CreditHistoryRow {
  id: string;
  user_id: string;
  type: 'debit' | 'credit';
  amount: number;
  reason: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string;
  is_active: boolean;
  [key: string]: unknown;
}

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  [key: string]: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTACT_REVEAL_COST = 5; // credits per reveal

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateCreditRow(
  credits: CreditRow[],
  userId: string
): CreditRow {
  let row = credits.find((c) => c.user_id === userId);
  if (!row) {
    const now = new Date().toISOString();
    row = { id: uuidv4(), user_id: userId, balance: 0, created_at: now, updated_at: now };
    credits.push(row);
  }
  return row;
}

function recordHistory(
  history: CreditHistoryRow[],
  userId: string,
  type: 'debit' | 'credit',
  amount: number,
  reason: string,
  balanceAfter: number,
  referenceId: string | null = null
): void {
  history.push({
    id:            uuidv4(),
    user_id:       userId,
    type,
    amount,
    reason,
    reference_id:  referenceId,
    balance_after: balanceAfter,
    created_at:    new Date().toISOString(),
  });
}

// ─── getCredits ───────────────────────────────────────────────────────────────

export async function getCredits(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db      = await getDB();
    const credits = db.credits as CreditRow[];
    const row     = getOrCreateCreditRow(credits, userId);

    // Fetch recent history
    const history = (db.credits_history as CreditHistoryRow[])
      .filter((h) => h.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    await saveTable('credits', db.credits as any[]); // persist if row was just created

    res.status(200).json({
      success: true,
      credits: { balance: row.balance, user_id: row.user_id },
      history,
    });
  } catch (err) {
    console.error('[Credits] getCredits error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch credits.' });
  }
}

// ─── revealContact ────────────────────────────────────────────────────────────

export async function revealContact(req: Request, res: Response): Promise<void> {
  try {
    const viewerId  = req.user!.id;
    const { target_user_id } = req.body as { target_user_id?: string };

    if (!target_user_id) {
      res.status(400).json({ success: false, error: 'target_user_id is required.' });
      return;
    }

    if (viewerId === target_user_id) {
      res.status(400).json({ success: false, error: 'You cannot reveal your own contact.' });
      return;
    }

    const db      = await getDB();
    const credits = db.credits as CreditRow[];
    const history = db.credits_history as CreditHistoryRow[];

    // Check if already revealed (free re-reveal)
    const alreadyRevealed = history.some(
      (h) =>
        h.user_id      === viewerId &&
        h.reason       === 'contact_reveal' &&
        h.reference_id === target_user_id
    );

    if (alreadyRevealed) {
      // Return contact info without charging again
      const profiles = db.profiles as ProfileRow[];
      const users    = db.users    as UserRow[];
      const profile  = profiles.find((p) => p.user_id === target_user_id);
      const user     = users.find((u) => u.id === target_user_id);

      if (!profile || !user || !user.is_active) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        alreadyRevealed: true,
        contact: { phone: profile.phone, email: user.email },
      });
      return;
    }

    // Check viewer has enough credits
    const viewerCredits = getOrCreateCreditRow(credits, viewerId);
    if (viewerCredits.balance < CONTACT_REVEAL_COST) {
      res.status(402).json({
        success: false,
        error: `Insufficient credits. You need ${CONTACT_REVEAL_COST} credits to reveal contact details.`,
        required: CONTACT_REVEAL_COST,
        available: viewerCredits.balance,
      });
      return;
    }

    // Check target exists
    const profiles = db.profiles as ProfileRow[];
    const users    = db.users    as UserRow[];
    const profile  = profiles.find((p) => p.user_id === target_user_id);
    const user     = users.find((u) => u.id === target_user_id);

    if (!profile || !user || !user.is_active) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    // Deduct credits
    viewerCredits.balance  -= CONTACT_REVEAL_COST;
    viewerCredits.updated_at = new Date().toISOString();

    recordHistory(
      history,
      viewerId,
      'debit',
      CONTACT_REVEAL_COST,
      'contact_reveal',
      viewerCredits.balance,
      target_user_id
    );

    await saveTable('credits', db.credits as any[]);
    await saveTable('credits_history', db.credits_history as any[]);

    try {
      const { emitToUser } = await import('../services/socket.service');
      emitToUser(viewerId, 'credits:updated', { balance: viewerCredits.balance });
    } catch {}

    res.status(200).json({
      success: true,
      alreadyRevealed: false,
      creditsDeducted: CONTACT_REVEAL_COST,
      remainingCredits: viewerCredits.balance,
      contact: { phone: profile.phone, email: user.email },
    });
  } catch (err) {
    console.error('[Credits] revealContact error:', err);
    res.status(500).json({ success: false, error: 'Could not reveal contact.' });
  }
}

// ─── checkRevealContact ───────────────────────────────────────────────────────

export async function checkRevealContact(req: Request, res: Response): Promise<void> {
  try {
    const viewerId      = req.user!.id;
    const target_user_id = req.query['target_user_id'] as string | undefined;

    if (!target_user_id) {
      res.status(400).json({ success: false, error: 'target_user_id query param is required.' });
      return;
    }

    const db      = await getDB();
    const history = db.credits_history as CreditHistoryRow[];
    const credits = db.credits         as CreditRow[];

    const alreadyRevealed = history.some(
      (h) =>
        h.user_id      === viewerId &&
        h.reason       === 'contact_reveal' &&
        h.reference_id === target_user_id
    );

    const viewerCredits = getOrCreateCreditRow(credits, viewerId);

    res.status(200).json({
      success: true,
      alreadyRevealed,
      canReveal: alreadyRevealed || viewerCredits.balance >= CONTACT_REVEAL_COST,
      currentBalance: viewerCredits.balance,
      revealCost: CONTACT_REVEAL_COST,
    });
  } catch (err) {
    console.error('[Credits] checkRevealContact error:', err);
    res.status(500).json({ success: false, error: 'Could not check reveal status.' });
  }
}
