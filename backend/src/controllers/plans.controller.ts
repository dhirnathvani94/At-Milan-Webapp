import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MembershipPlanRow {
  id: string;
  name: string;
  description: string;
  duration_days: number;
  credits_included: number;
  price: number;
  currency: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CreditPlanRow {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number;
  currency: string;
  bonus_credits: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── getMembershipPlans ───────────────────────────────────────────────────────

export async function getMembershipPlans(_req: Request, res: Response): Promise<void> {
  try {
    const db    = await getDB();
    const plans = (db.membership_plans as MembershipPlanRow[])
      .filter((p) => p.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    res.status(200).json({ success: true, plans });
  } catch (err) {
    console.error('[Plans] getMembershipPlans error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch membership plans.' });
  }
}

// ─── getMembershipPlanById ────────────────────────────────────────────────────

export async function getMembershipPlanById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plan   = (db.membership_plans as MembershipPlanRow[]).find((p) => p.id === id);

    if (!plan) {
      res.status(404).json({ success: false, error: 'Membership plan not found.' });
      return;
    }

    res.status(200).json({ success: true, plan });
  } catch (err) {
    console.error('[Plans] getMembershipPlanById error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch plan.' });
  }
}

// ─── getCreditPlans ───────────────────────────────────────────────────────────

export async function getCreditPlans(_req: Request, res: Response): Promise<void> {
  try {
    const db    = await getDB();
    const plans = (db.credit_plans as CreditPlanRow[])
      .filter((p) => p.is_active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    res.status(200).json({ success: true, plans });
  } catch (err) {
    console.error('[Plans] getCreditPlans error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch credit plans.' });
  }
}

// ─── getCreditPlanById ────────────────────────────────────────────────────────

export async function getCreditPlanById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plan   = (db.credit_plans as CreditPlanRow[]).find((p) => p.id === id);

    if (!plan) {
      res.status(404).json({ success: false, error: 'Credit plan not found.' });
      return;
    }

    res.status(200).json({ success: true, plan });
  } catch (err) {
    console.error('[Plans] getCreditPlanById error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch plan.' });
  }
}

// ─── createMembershipPlan ─────────────────────────────────────────────────────

export async function createMembershipPlan(req: Request, res: Response): Promise<void> {
  try {
    const {
      name, description = '', duration_days, credits_included = 0,
      price, currency = 'INR', features = [], sort_order = 0,
    } = req.body as Partial<MembershipPlanRow>;

    if (!name || !duration_days || price === undefined) {
      res.status(400).json({ success: false, error: 'name, duration_days, and price are required.' });
      return;
    }

    const now  = new Date().toISOString();
    const plan: MembershipPlanRow = {
      id:               uuidv4(),
      name,
      description,
      duration_days,
      credits_included,
      price,
      currency,
      features,
      is_active:        true,
      sort_order,
      created_at:       now,
      updated_at:       now,
    };

    const db = await getDB();
    (db.membership_plans as MembershipPlanRow[]).push(plan);
    saveDB(db);

    res.status(201).json({ success: true, plan });
  } catch (err) {
    console.error('[Plans] createMembershipPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not create plan.' });
  }
}

// ─── updateMembershipPlan ─────────────────────────────────────────────────────

export async function updateMembershipPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plans  = db.membership_plans as MembershipPlanRow[];
    const idx    = plans.findIndex((p) => p.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Membership plan not found.' });
      return;
    }

    const FORBIDDEN = new Set(['id', 'created_at']);
    const updates: Partial<MembershipPlanRow> = {};

    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      if (!FORBIDDEN.has(key)) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }

    plans[idx] = { ...plans[idx]!, ...updates, updated_at: new Date().toISOString() };
    saveDB(db);

    res.status(200).json({ success: true, plan: plans[idx] });
  } catch (err) {
    console.error('[Plans] updateMembershipPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not update plan.' });
  }
}

// ─── deleteMembershipPlan ─────────────────────────────────────────────────────

export async function deleteMembershipPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plans  = db.membership_plans as MembershipPlanRow[];
    const idx    = plans.findIndex((p) => p.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Membership plan not found.' });
      return;
    }

    // Soft delete — set is_active false rather than removing
    plans[idx]!.is_active   = false;
    plans[idx]!.updated_at  = new Date().toISOString();
    saveDB(db);

    res.status(200).json({ success: true, message: 'Membership plan deactivated.' });
  } catch (err) {
    console.error('[Plans] deleteMembershipPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not delete plan.' });
  }
}

// ─── createCreditPlan ─────────────────────────────────────────────────────────

export async function createCreditPlan(req: Request, res: Response): Promise<void> {
  try {
    const {
      name, description = '', credits, price,
      currency = 'INR', bonus_credits = 0, sort_order = 0,
    } = req.body as Partial<CreditPlanRow>;

    if (!name || credits === undefined || price === undefined) {
      res.status(400).json({ success: false, error: 'name, credits, and price are required.' });
      return;
    }

    const now  = new Date().toISOString();
    const plan: CreditPlanRow = {
      id:            uuidv4(),
      name,
      description,
      credits,
      price,
      currency,
      bonus_credits,
      is_active:     true,
      sort_order,
      created_at:    now,
      updated_at:    now,
    };

    const db = await getDB();
    (db.credit_plans as CreditPlanRow[]).push(plan);
    saveDB(db);

    res.status(201).json({ success: true, plan });
  } catch (err) {
    console.error('[Plans] createCreditPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not create credit plan.' });
  }
}

// ─── updateCreditPlan ─────────────────────────────────────────────────────────

export async function updateCreditPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plans  = db.credit_plans as CreditPlanRow[];
    const idx    = plans.findIndex((p) => p.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Credit plan not found.' });
      return;
    }

    const FORBIDDEN = new Set(['id', 'created_at']);
    const updates: Partial<CreditPlanRow> = {};

    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      if (!FORBIDDEN.has(key)) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }

    plans[idx] = { ...plans[idx]!, ...updates, updated_at: new Date().toISOString() };
    saveDB(db);

    res.status(200).json({ success: true, plan: plans[idx] });
  } catch (err) {
    console.error('[Plans] updateCreditPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not update credit plan.' });
  }
}

// ─── deleteCreditPlan ─────────────────────────────────────────────────────────

export async function deleteCreditPlan(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db     = await getDB();
    const plans  = db.credit_plans as CreditPlanRow[];
    const idx    = plans.findIndex((p) => p.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Credit plan not found.' });
      return;
    }

    plans[idx]!.is_active  = false;
    plans[idx]!.updated_at = new Date().toISOString();
    saveDB(db);

    res.status(200).json({ success: true, message: 'Credit plan deactivated.' });
  } catch (err) {
    console.error('[Plans] deleteCreditPlan error:', err);
    res.status(500).json({ success: false, error: 'Could not delete credit plan.' });
  }
}
