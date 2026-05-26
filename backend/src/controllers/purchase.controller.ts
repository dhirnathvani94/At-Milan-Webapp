import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDB, saveDB } from "../db/database";

interface PurchaseRow {
  id: string;
  user_id: string;
  type: "membership" | "credits";
  plan_id: string | null;
  amount: number;
  currency: string;
  credits_added: number;
  gateway_id: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  status: "pending" | "completed" | "failed" | "refunded";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreditRow {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
}

interface CreditHistoryRow {
  id: string;
  user_id: string;
  type: "credit" | "debit";
  amount: number;
  reason: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

interface MembershipPlanRow {
  id: string;
  name: string;
  duration_days: number;
  credits_included: number;
  price: number;
  currency: string;
  is_active: boolean;
}

interface CreditPlanRow {
  id: string;
  name: string;
  credits: number;
  bonus_credits: number;
  price: number;
  currency: string;
  is_active: boolean;
}

// Helpers
function getOrCreateCreditRow(credits: CreditRow[], userId: string): CreditRow {
  let row = credits.find((c) => c.user_id === userId);
  if (!row) {
    const now = new Date().toISOString();
    row = { id: uuidv4(), user_id: userId, balance: 0, updated_at: now };
    credits.push(row);
  }
  return row;
}

// purchaseMembership
export async function purchaseMembership(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { plan_id, purchase_id } = req.body as { plan_id: string; purchase_id: string };

    if (!plan_id || !purchase_id) {
      res.status(400).json({ success: false, error: "plan_id and purchase_id are required." });
      return;
    }

    const db = await getDB();
    const purchases = db.purchases as PurchaseRow[];
    const purchase = purchases.find((p) => p.id === purchase_id && p.user_id === userId);

    if (!purchase) {
      res.status(404).json({ success: false, error: "Purchase record not found." });
      return;
    }

    if (purchase.status !== "completed") {
      res.status(400).json({ success: false, error: "Payment not verified. Complete payment first." });
      return;
    }

    const plan = (db.membership_plans as MembershipPlanRow[]).find((p) => p.id === plan_id && p.is_active);
    if (!plan) {
      res.status(404).json({ success: false, error: "Membership plan not found or inactive." });
      return;
    }

    // Set expiry
    const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
    purchase.expires_at = expiresAt;
    purchase.updated_at = new Date().toISOString();

    // Add included credits
    if (plan.credits_included > 0) {
      const credits = db.credits as CreditRow[];
      const history = db.credits_history as CreditHistoryRow[];
      const row = getOrCreateCreditRow(credits, userId);
      row.balance += plan.credits_included;
      row.updated_at = new Date().toISOString();
      purchase.credits_added = plan.credits_included;
      history.push({
        id: uuidv4(),
        user_id: userId,
        type: "credit",
        amount: plan.credits_included,
        reason: "membership_credits",
        reference_id: purchase.id,
        balance_after: row.balance,
        created_at: new Date().toISOString(),
      });
    }

    saveDB(db);

    res.status(200).json({
      success: true,
      message: "Membership activated.",
      purchase: {
        id: purchase.id,
        type: purchase.type,
        plan_id: purchase.plan_id,
        expires_at: purchase.expires_at,
        credits_added: purchase.credits_added,
        status: purchase.status,
      },
    });
  } catch (err) {
    console.error("[Purchase] purchaseMembership error:", err);
    res.status(500).json({ success: false, error: "Could not activate membership." });
  }
}

// purchaseCredits
export async function purchaseCredits(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { plan_id, purchase_id } = req.body as { plan_id: string; purchase_id: string };

    if (!plan_id || !purchase_id) {
      res.status(400).json({ success: false, error: "plan_id and purchase_id are required." });
      return;
    }

    const db = await getDB();
    const purchases = db.purchases as PurchaseRow[];
    const purchase = purchases.find((p) => p.id === purchase_id && p.user_id === userId);

    if (!purchase) {
      res.status(404).json({ success: false, error: "Purchase record not found." });
      return;
    }

    if (purchase.status !== "completed") {
      res.status(400).json({ success: false, error: "Payment not verified. Complete payment first." });
      return;
    }

    const plan = (db.credit_plans as CreditPlanRow[]).find((p) => p.id === plan_id && p.is_active);
    if (!plan) {
      res.status(404).json({ success: false, error: "Credit plan not found or inactive." });
      return;
    }

    const totalCredits = plan.credits + (plan.bonus_credits ?? 0);
    const credits = db.credits as CreditRow[];
    const history = db.credits_history as CreditHistoryRow[];
    const row = getOrCreateCreditRow(credits, userId);

    row.balance += totalCredits;
    row.updated_at = new Date().toISOString();
    purchase.credits_added = totalCredits;
    purchase.updated_at = new Date().toISOString();

    history.push({
      id: uuidv4(),
      user_id: userId,
      type: "credit",
      amount: totalCredits,
      reason: "credit_purchase",
      reference_id: purchase.id,
      balance_after: row.balance,
      created_at: new Date().toISOString(),
    });

    saveDB(db);

    res.status(200).json({
      success: true,
      message: `${totalCredits} credits added to your account.`,
      creditsAdded: totalCredits,
      newBalance: row.balance,
      purchase: {
        id: purchase.id,
        credits_added: purchase.credits_added,
        status: purchase.status,
      },
    });
  } catch (err) {
    console.error("[Purchase] purchaseCredits error:", err);
    res.status(500).json({ success: false, error: "Could not add credits." });
  }
}

// getPurchaseHistory
export async function getPurchaseHistory(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Access denied." });
      return;
    }

    const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1", 10));
    const limit = Math.min(100, parseInt((req.query["limit"] as string) ?? "20", 10));

    const db = await getDB();
    const purchases = (db.purchases as PurchaseRow[])
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = purchases.length;
    const totalPages = Math.ceil(total / limit);
    const data = purchases.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, data, total, page, limit, totalPages });
  } catch (err) {
    console.error("[Purchase] getPurchaseHistory error:", err);
    res.status(500).json({ success: false, error: "Could not fetch purchase history." });
  }
}
