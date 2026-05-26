import { Request, Response } from 'express';
import { getDB } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileRow {
  user_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  profile_photo?: string | null;
  profile_complete: boolean;
  // All optional fields for completion %
  religion?: string;
  caste?: string;
  education_level?: string;
  occupation?: string;
  annual_income?: string;
  city?: string;
  state?: string;
  about_me?: string;
  marital_status?: string;
  height?: string;
  phone?: string | null;
  [key: string]: unknown;
}

// ─── Profile completion calculator ───────────────────────────────────────────

const COMPLETION_FIELDS: Array<keyof ProfileRow> = [
  'first_name', 'last_name', 'gender', 'date_of_birth',
  'religion', 'caste', 'education_level', 'occupation',
  'annual_income', 'city', 'state', 'about_me',
  'marital_status', 'height', 'phone',
];

function calcProfileCompletion(profile: ProfileRow): number {
  const filled = COMPLETION_FIELDS.filter((f) => {
    const val = profile[f];
    return val !== null && val !== undefined && String(val).trim() !== '';
  }).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

// ─── getDashboardStats ────────────────────────────────────────────────────────

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db = await getDB();

    // ── My profile ─────────────────────────────────────────────────────────
    const myProfile = (db.profiles as ProfileRow[]).find((p) => p.user_id === userId);
    const profileCompletionPct = myProfile ? calcProfileCompletion(myProfile) : 0;

    // ── Interests ──────────────────────────────────────────────────────────
    const interests = db.interests as Array<{
      sender_id: string;
      receiver_id: string;
      status: string;
      created_at: string;
    }>;

    const interestsReceived = interests.filter((i) => i.receiver_id === userId).length;
    const interestsSent     = interests.filter((i) => i.sender_id   === userId).length;
    const pendingInterests  = interests.filter(
      (i) => i.receiver_id === userId && i.status === 'pending'
    ).length;

    // ── New matches (interests received in last 7 days) ────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newMatches   = interests.filter(
      (i) =>
        i.receiver_id === userId &&
        new Date(i.created_at) > sevenDaysAgo
    ).length;

    // ── Profile views ──────────────────────────────────────────────────────
    const profileViews = (db.profile_views as Array<{ viewed_id: string }>)
      .filter((v) => v.viewed_id === userId).length;

    const recentViews = (
      db.profile_views as Array<{ viewed_id: string; viewed_at: string }>
    ).filter(
      (v) => v.viewed_id === userId && new Date(v.viewed_at) > sevenDaysAgo
    ).length;

    // ── Unread messages ────────────────────────────────────────────────────
    const unreadMessages = (
      db.messages as Array<{ receiver_id: string; is_read: boolean }>
    ).filter((m) => m.receiver_id === userId && !m.is_read).length;

    // ── Shortlist ──────────────────────────────────────────────────────────
    const shortlistCount = (db.shortlists as Array<{ user_id: string }>)
      .filter((s) => s.user_id === userId).length;

    // ── Credits ────────────────────────────────────────────────────────────
    const creditRow = (db.credits as Array<{ user_id: string; balance: number }>)
      .find((c) => c.user_id === userId);
    const creditBalance = creditRow?.balance ?? 0;

    // ── Unread notifications ───────────────────────────────────────────────
    const unreadNotifications = (
      db.notifications as Array<{ user_id: string; is_read: boolean }>
    ).filter((n) => n.user_id === userId && !n.is_read).length;

    // ── Membership status ──────────────────────────────────────────────────
    const activeMembership = (
      db.purchases as Array<{
        user_id: string;
        type: string;
        status: string;
        expires_at: string;
      }>
    ).find(
      (p) =>
        p.user_id === userId &&
        p.type    === 'membership' &&
        p.status  === 'active' &&
        new Date(p.expires_at) > new Date()
    );

    res.status(200).json({
      success: true,
      stats: {
        profileCompletionPct,
        newMatches,
        interestsReceived,
        interestsSent,
        pendingInterests,
        profileViews,
        recentViews,
        unreadMessages,
        shortlistCount,
        creditBalance,
        unreadNotifications,
        hasMembership:    !!activeMembership,
        membershipExpiry: activeMembership?.expires_at ?? null,
      },
    });
  } catch (err) {
    console.error('[Dashboard] getDashboardStats error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch dashboard stats.' });
  }
}
