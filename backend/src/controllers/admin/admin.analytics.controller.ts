import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../../db/database';
import { createAuditLog } from '../../services/audit.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseRow {
  id: string;
  user_id: string;
  type: string;
  plan_id: string | null;
  amount: number;
  currency: string;
  status: string;
  gateway_id?: string;
  gateway_order_id?: string | null;
  gateway_payment_id?: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ProfileRow {
  user_id: string;
  first_name: string;
  last_name: string;
  [key: string]: unknown;
}

interface SuccessStoryRow {
  id: string;
  user_id?: string;
  bride_name: string;
  groom_name: string;
  wedding_date?: string;
  story?: string;
  photo_url?: string;
  is_approved: boolean;
  is_visible: boolean;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount?: number;
  max_uses?: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ─── getFinancialTransactions ─────────────────────────────────────────────────

export async function getFinancialTransactions(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']   ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    let purchases = (db.purchases as PurchaseRow[]).slice();

    // Filters
    if (q['status'])   purchases = purchases.filter((p) => p.status === q['status']);
    if (q['type'])     purchases = purchases.filter((p) => p.type === q['type']);
    if (q['user_id'])  purchases = purchases.filter((p) => p.user_id === q['user_id']);
    if (q['from'])     purchases = purchases.filter((p) => new Date(p.created_at) >= new Date(q['from']!));
    if (q['to'])       purchases = purchases.filter((p) => new Date(p.created_at) <= new Date(q['to']!));
    if (q['gateway'])  purchases = purchases.filter((p) => p.gateway_id === q['gateway']);

    purchases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = purchases.length;
    const totalPages = Math.ceil(total / limit);
    const data = purchases.slice((page - 1) * limit, page * limit).map((p) => {
      const profile = profiles.find((pr) => pr.user_id === p.user_id);
      return {
        ...p,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
      };
    });

    res.status(200).json({ transactions: data, totalCount: total });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialTransactions error:', err);
    res.status(200).json({ transactions: [], totalCount: 0 });
  }
}

// ─── getFinancialSubscriptions ────────────────────────────────────────────────

export async function getFinancialSubscriptions(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    const now = new Date();

    let subscriptions = (db.purchases as PurchaseRow[]).filter(
      (p) =>
        p.type === 'membership' &&
        p.status === 'completed' &&
        p.expires_at &&
        new Date(p.expires_at) > now
    );

    subscriptions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = subscriptions.length;
    const totalPages = Math.ceil(total / limit);
    const data = subscriptions.slice((page - 1) * limit, page * limit).map((p) => {
      const profile = profiles.find((pr) => pr.user_id === p.user_id);
      return {
        ...p,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        days_remaining: p.expires_at
          ? Math.max(0, Math.ceil((new Date(p.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0,
      };
    });

    res.status(200).json({ subscriptions: data, totalCount: total });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialSubscriptions error:', err);
    res.status(200).json({ subscriptions: [], totalCount: 0 });
  }
}

// ─── getFinancialInvoices ─────────────────────────────────────────────────────

export async function getFinancialInvoices(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];

    // Invoices are completed purchases with a payment ID (real transactions)
    let invoices = (db.purchases as PurchaseRow[]).filter(
      (p) => p.status === 'completed' && p.amount > 0
    );

    invoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = invoices.length;
    const totalPages = Math.ceil(total / limit);
    const data = invoices.slice((page - 1) * limit, page * limit).map((p) => {
      const profile = profiles.find((pr) => pr.user_id === p.user_id);
      return {
        invoice_id: `INV-${p.id.substring(0, 8).toUpperCase()}`,
        purchase_id: p.id,
        user_id: p.user_id,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        type: p.type,
        amount: p.amount,
        currency: p.currency,
        gateway_id: p.gateway_id,
        gateway_payment_id: p.gateway_payment_id,
        issued_at: p.created_at,
        expires_at: p.expires_at,
      };
    });

    res.status(200).json({ invoices: data, totalCount: total });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialInvoices error:', err);
    res.status(200).json({ invoices: [], totalCount: 0 });
  }
}

// ─── getFinancialUserSummaries ────────────────────────────────────────────────

export async function getFinancialUserSummaries(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    const purchases = db.purchases as PurchaseRow[];

    // Group by user_id
    const summaryMap = new Map<string, { total_spent: number; transaction_count: number; last_purchase: string }>();

    purchases
      .filter((p) => p.status === 'completed' && p.amount > 0)
      .forEach((p) => {
        const existing = summaryMap.get(p.user_id);
        if (existing) {
          existing.total_spent += p.amount;
          existing.transaction_count += 1;
          if (new Date(p.created_at) > new Date(existing.last_purchase)) {
            existing.last_purchase = p.created_at;
          }
        } else {
          summaryMap.set(p.user_id, {
            total_spent: p.amount,
            transaction_count: 1,
            last_purchase: p.created_at,
          });
        }
      });

    let summaries = Array.from(summaryMap.entries()).map(([user_id, stats]) => {
      const profile = profiles.find((pr) => pr.user_id === user_id);
      return {
        user_id,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        ...stats,
      };
    });

    summaries.sort((a, b) => b.total_spent - a.total_spent);

    const total = summaries.length;
    const totalPages = Math.ceil(total / limit);
    const data = summaries.slice((page - 1) * limit, page * limit);

    res.status(200).json({ users: data, totalCount: total });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialUserSummaries error:', err);
    res.status(200).json({ users: [], totalCount: 0 });
  }
}

// ─── getFinancialUserDetail ───────────────────────────────────────────────────

export async function getFinancialUserDetail(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    const profile = profiles.find((p) => p.user_id === userId);

    const purchases = (db.purchases as PurchaseRow[])
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const completedPurchases = purchases.filter((p) => p.status === 'completed');
    const totalSpent = completedPurchases.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const transactionCount = completedPurchases.length;

    const now = new Date();
    const activeMembership = purchases.find(
      (p) =>
        p.type === 'membership' &&
        p.status === 'completed' &&
        p.expires_at &&
        new Date(p.expires_at) > now
    );

    res.status(200).json({
      success: true,
      user_id: userId,
      user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
      summary: {
        total_spent: totalSpent,
        transaction_count: transactionCount,
        active_membership: activeMembership ?? null,
      },
      purchases,
    });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialUserDetail error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch user financial detail.' });
  }
}

// ─── getFinancialAnalytics ────────────────────────────────────────────────────

export async function getFinancialAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };

    const db = await getDB();
    let purchases = (db.purchases as PurchaseRow[]).filter((p) => p.status === 'completed' && p.amount > 0);

    if (fromDate) purchases = purchases.filter((p) => new Date(p.created_at) >= new Date(fromDate));
    if (toDate)   purchases = purchases.filter((p) => new Date(p.created_at) <= new Date(toDate));

    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const totalTransactions = purchases.length;

    // Revenue by type
    const revenueByType: Record<string, number> = {};
    purchases.forEach((p) => {
      revenueByType[p.type] = (revenueByType[p.type] ?? 0) + p.amount;
    });

    // Revenue by gateway
    const revenueByGateway: Record<string, number> = {};
    purchases.forEach((p) => {
      const gw = p.gateway_id ?? 'unknown';
      revenueByGateway[gw] = (revenueByGateway[gw] ?? 0) + p.amount;
    });

    // Daily chart data — group by date
    const dailyMap = new Map<string, number>();
    purchases.forEach((p) => {
      const day = p.created_at.substring(0, 10); // YYYY-MM-DD
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + p.amount);
    });
    const chartData = Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly totals
    const monthlyMap = new Map<string, number>();
    purchases.forEach((p) => {
      const month = p.created_at.substring(0, 7); // YYYY-MM
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + p.amount);
    });
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.status(200).json({
      success: true,
      analytics: {
        totalRevenue,
        totalTransactions,
        revenueByType,
        revenueByGateway,
        chartData,
        monthlyData,
        period: { fromDate: fromDate ?? null, toDate: toDate ?? null },
      },
    });
  } catch (err) {
    console.error('[AdminAnalytics] getFinancialAnalytics error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch financial analytics.' });
  }
}

// ─── getSuccessStories ────────────────────────────────────────────────────────

export async function getSuccessStories(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    let stories = (db.success_stories as SuccessStoryRow[]).slice();

    if (q['approved'] !== undefined) {
      stories = stories.filter((s) => String(s.is_approved) === q['approved']);
    }
    if (q['visible'] !== undefined) {
      stories = stories.filter((s) => String(s.is_visible) === q['visible']);
    }

    stories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = stories.length;
    const totalPages = Math.ceil(total / limit);
    const data = stories.slice((page - 1) * limit, page * limit);

    res.status(200).json({ stories: data, totalCount: total });
  } catch (err) {
    console.error('[AdminAnalytics] getSuccessStories error:', err);
    res.status(200).json({ stories: [], totalCount: 0 });
  }
}

// ─── updateSuccessStory ───────────────────────────────────────────────────────

export async function updateSuccessStory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const stories = db.success_stories as SuccessStoryRow[];
    const idx = stories.findIndex((s) => s.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Success story not found.' });
      return;
    }

    const FORBIDDEN = new Set(['id', 'created_at', 'user_id']);
    const updates: Partial<SuccessStoryRow> = {};
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      if (!FORBIDDEN.has(k)) (updates as Record<string, unknown>)[k] = v;
    }

    stories[idx] = { ...stories[idx]!, ...updates, updated_at: new Date().toISOString() };
    saveDB(db);

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'success_story',
      resource_id: id,
      details: { updated_fields: Object.keys(updates) },
      severity: 'info',
    });

    res.status(200).json({ success: true, story: stories[idx] });
  } catch (err) {
    console.error('[AdminAnalytics] updateSuccessStory error:', err);
    res.status(500).json({ success: false, error: 'Could not update success story.' });
  }
}

// ─── deleteSuccessStory ───────────────────────────────────────────────────────

export async function deleteSuccessStory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const stories = db.success_stories as SuccessStoryRow[];
    const idx = stories.findIndex((s) => s.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Success story not found.' });
      return;
    }

    stories.splice(idx, 1);
    saveDB(db);

    // Emit real-time socket event
    try {
      const { getIO } = await import('../../services/socket.service');
      const io = getIO();
      if (io) io.emit('success-story:updated', { id, deleted: true });
    } catch { /* non-fatal */ }

    createAuditLog({
      action: 'account_deleted',
      actor_id: adminId,
      resource_type: 'success_story',
      resource_id: id,
      severity: 'warning',
    });

    res.status(200).json({ success: true, message: 'Success story deleted.' });
  } catch (err) {
    console.error('[AdminAnalytics] deleteSuccessStory error:', err);
    res.status(500).json({ success: false, error: 'Could not delete success story.' });
  }
}

// ─── approveSuccessStory ──────────────────────────────────────────────────────

export async function approveSuccessStory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const stories = db.success_stories as SuccessStoryRow[];
    const idx = stories.findIndex((s) => s.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Success story not found.' });
      return;
    }

    const now = new Date().toISOString();
    stories[idx] = {
      ...stories[idx]!,
      is_approved: true,
      approved_by: adminId,
      approved_at: now,
      updated_at: now,
    };
    saveDB(db);

    // Emit real-time socket event
    try {
      const { getIO } = await import('../../services/socket.service');
      const io = getIO();
      if (io) io.emit('success-story:updated', { id, is_approved: true });
    } catch { /* non-fatal */ }

    res.status(200).json({ success: true, story: stories[idx] });
  } catch (err) {
    console.error('[AdminAnalytics] approveSuccessStory error:', err);
    res.status(500).json({ success: false, error: 'Could not approve success story.' });
  }
}

// ─── setStoryVisibility ───────────────────────────────────────────────────────

export async function setStoryVisibility(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { visible } = req.body as { visible: boolean };

    if (typeof visible !== 'boolean') {
      res.status(400).json({ success: false, error: 'visible (boolean) is required.' });
      return;
    }

    const db = await getDB();
    const stories = db.success_stories as SuccessStoryRow[];
    const idx = stories.findIndex((s) => s.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Success story not found.' });
      return;
    }

    stories[idx] = { ...stories[idx]!, is_visible: visible, updated_at: new Date().toISOString() };
    saveDB(db);

    // Emit real-time socket event
    try {
      const { getIO } = await import('../../services/socket.service');
      const io = getIO();
      if (io) io.emit('success-story:updated', { id, is_visible: visible });
    } catch { /* non-fatal */ }

    res.status(200).json({ success: true, story: stories[idx] });
  } catch (err) {
    console.error('[AdminAnalytics] setStoryVisibility error:', err);
    res.status(500).json({ success: false, error: 'Could not update story visibility.' });
  }
}

// ─── getCoupons ───────────────────────────────────────────────────────────────

export async function getCoupons(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const coupons = (db.coupons as CouponRow[]).slice();
    coupons.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.status(200).json({ success: true, coupons, total: coupons.length });
  } catch (err) {
    console.error('[AdminAnalytics] getCoupons error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch coupons.' });
  }
}

// ─── createCoupon ─────────────────────────────────────────────────────────────

export async function createCoupon(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id;
    const body = req.body as Partial<CouponRow>;

    if (!body.code || !body.discount_type || body.discount_value === undefined) {
      res.status(400).json({ success: false, error: 'code, discount_type, and discount_value are required.' });
      return;
    }

    if (!['percent', 'flat'].includes(body.discount_type)) {
      res.status(400).json({ success: false, error: 'discount_type must be percent or flat.' });
      return;
    }

    const db = await getDB();
    const existing = (db.coupons as CouponRow[]).find(
      (c) => c.code.toLowerCase() === body.code!.toLowerCase()
    );
    if (existing) {
      res.status(409).json({ success: false, error: 'Coupon code already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const coupon: CouponRow = {
      id: uuidv4(),
      code: body.code.toUpperCase(),
      discount_type: body.discount_type,
      discount_value: Number(body.discount_value),
      min_order_amount: body.min_order_amount ?? 0,
      max_uses: body.max_uses ?? undefined,
      used_count: 0,
      is_active: body.is_active ?? true,
      expires_at: body.expires_at ?? null,
      created_at: now,
      updated_at: now,
    };

    (db.coupons as unknown[]).push(coupon);
    saveDB(db);

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'coupon',
      resource_id: coupon.id,
      details: { action: 'created', code: coupon.code },
      severity: 'info',
    });

    res.status(201).json({ success: true, coupon });
  } catch (err) {
    console.error('[AdminAnalytics] createCoupon error:', err);
    res.status(500).json({ success: false, error: 'Could not create coupon.' });
  }
}

// ─── updateCoupon ─────────────────────────────────────────────────────────────

export async function updateCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const coupons = db.coupons as CouponRow[];
    const idx = coupons.findIndex((c) => c.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Coupon not found.' });
      return;
    }

    const FORBIDDEN = new Set(['id', 'used_count', 'created_at']);
    const updates: Partial<CouponRow> = {};
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
      if (!FORBIDDEN.has(k)) (updates as Record<string, unknown>)[k] = v;
    }

    // Normalise code to uppercase if provided
    if (updates.code) updates.code = (updates.code as string).toUpperCase();

    coupons[idx] = { ...coupons[idx]!, ...updates, updated_at: new Date().toISOString() };
    saveDB(db);

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'coupon',
      resource_id: id,
      details: { updated_fields: Object.keys(updates) },
      severity: 'info',
    });

    res.status(200).json({ success: true, coupon: coupons[idx] });
  } catch (err) {
    console.error('[AdminAnalytics] updateCoupon error:', err);
    res.status(500).json({ success: false, error: 'Could not update coupon.' });
  }
}

// ─── deleteCoupon ─────────────────────────────────────────────────────────────

export async function deleteCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const coupons = db.coupons as CouponRow[];
    const idx = coupons.findIndex((c) => c.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Coupon not found.' });
      return;
    }

    coupons.splice(idx, 1);
    saveDB(db);

    createAuditLog({
      action: 'account_deleted',
      actor_id: adminId,
      resource_type: 'coupon',
      resource_id: id,
      severity: 'warning',
    });

    res.status(200).json({ success: true, message: 'Coupon deleted.' });
  } catch (err) {
    console.error('[AdminAnalytics] deleteCoupon error:', err);
    res.status(500).json({ success: false, error: 'Could not delete coupon.' });
  }
}
