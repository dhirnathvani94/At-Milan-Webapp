import { Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../db/database';
import { emitToAdmin } from '../services/socket.service';
import { createAuditLog } from '../services/audit.service';
import { createNotification } from './notification.controller';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GatewayRow {
  id: string;
  name: string;
  provider: string;          // 'razorpay' | 'stripe' | etc.
  key_id: string;            // public key — safe to send to frontend
  key_secret: string;        // NEVER sent to frontend
  is_active: boolean;
  webhook_secret?: string;
  created_at: string;
  updated_at?: string;
}

interface PurchaseRow {
  id: string;
  user_id: string;
  type: 'membership' | 'credits';
  plan_id: string | null;
  amount: number;
  currency: string;
  credits_added: number;
  gateway_id: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
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
  type: 'credit' | 'debit';
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
  [key: string]: unknown;
}

interface CreditPlanRow {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  is_active: boolean;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveGatewayRow(): Promise<GatewayRow | null> {
  const db = await getDB();
  return (
    (db.payment_gateways as GatewayRow[]).find((g) => g.is_active) ?? null
  );
}

function getOrCreateCreditRow(credits: CreditRow[], userId: string): CreditRow {
  let row = credits.find((c) => c.user_id === userId);
  if (!row) {
    const now = new Date().toISOString();
    row = { id: uuidv4(), user_id: userId, balance: 0, updated_at: now };
    credits.push(row);
  }
  return row;
}

async function addCreditsToUser(
  userId: string,
  amount: number,
  reason: string,
  referenceId: string | null
): Promise<void> {
  const db      = await getDB();
  const credits = db.credits as CreditRow[];
  const history = db.credits_history as CreditHistoryRow[];

  const row      = getOrCreateCreditRow(credits, userId);
  row.balance   += amount;
  row.updated_at = new Date().toISOString();

  history.push({
    id:            uuidv4(),
    user_id:       userId,
    type:          'credit',
    amount,
    reason,
    reference_id:  referenceId,
    balance_after: row.balance,
    created_at:    new Date().toISOString(),
  });

  await saveDB(db);
}

// ─── getActiveGateway ─────────────────────────────────────────────────────────

/**
 * Returns ONLY public-safe fields: { id, name, provider, key_id }.
 * key_secret is NEVER included in any response.
 */
export async function getActiveGateway(req: Request, res: Response): Promise<void> {
  try {
    const gateway = await getActiveGatewayRow();

    if (!gateway) {
      res.status(404).json({ success: false, error: 'No active payment gateway configured.' });
      return;
    }

    // Explicitly pick only public fields — never spread the full object
    res.status(200).json({
      success: true,
      gateway: {
        id:       gateway.id,
        name:     gateway.name,
        provider: gateway.provider,
        key_id:   gateway.key_id,
        // key_secret intentionally omitted
      },
    });
  } catch (err) {
    console.error('[Payment] getActiveGateway error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch payment gateway.' });
  }
}

// ─── createOrder ─────────────────────────────────────────────────────────────

/**
 * Creates a Razorpay order server-side using key_secret (never exposed).
 * Returns { order_id, amount, currency, key_id } to the frontend.
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { amount, currency = 'INR', plan_id, type } = req.body as {
      amount: number;
      currency?: string;
      plan_id?: string;
      type: 'membership' | 'credits';
    };

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid amount is required.' });
      return;
    }

    if (!['membership', 'credits'].includes(type)) {
      res.status(400).json({ success: false, error: 'type must be "membership" or "credits".' });
      return;
    }

    const gateway = await getActiveGatewayRow();
    if (!gateway) {
      res.status(503).json({ success: false, error: 'Payment gateway not configured.' });
      return;
    }

    if (gateway.provider !== 'razorpay') {
      res.status(400).json({ success: false, error: `Provider "${gateway.provider}" order creation not implemented.` });
      return;
    }

    // ── Call Razorpay Orders API using key_secret server-side ──────────────
    const amountInPaise = Math.round(amount * 100); // Razorpay uses smallest currency unit
    const receiptId     = `rcpt_${uuidv4().replace(/-/g, '').substring(0, 20)}`;

    const credentials = Buffer.from(`${gateway.key_id}:${gateway.key_secret}`).toString('base64');

    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount:   amountInPaise,
        currency: currency.toUpperCase(),
        receipt:  receiptId,
        notes:    { user_id: userId, plan_id: plan_id ?? '', type },
      }),
    });

    if (!razorpayRes.ok) {
      const errBody = await razorpayRes.text();
      console.error('[Payment] Razorpay order creation failed:', errBody);
      res.status(502).json({ success: false, error: 'Payment gateway error. Please try again.' });
      return;
    }

    const order = await razorpayRes.json() as {
      id: string;
      amount: number;
      currency: string;
      status: string;
    };

    // Save a pending purchase record
    const db = await getDB();
    const purchase: PurchaseRow = {
      id:                 uuidv4(),
      user_id:            userId,
      type,
      plan_id:            plan_id ?? null,
      amount,
      currency:           currency.toUpperCase(),
      credits_added:      0,
      gateway_id:         gateway.id,
      gateway_order_id:   order.id,
      gateway_payment_id: null,
      gateway_signature:  null,
      status:             'pending',
      expires_at:         null,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    };

    (db.purchases as PurchaseRow[]).push(purchase);
    saveDB(db);

    // Return ONLY public data — key_secret never leaves the server
    res.status(201).json({
      success: true,
      order_id:   order.id,
      amount:     order.amount,
      currency:   order.currency,
      key_id:     gateway.key_id,
      purchase_id: purchase.id,
    });
  } catch (err) {
    console.error('[Payment] createOrder error:', err);
    res.status(500).json({ success: false, error: 'Could not create order.' });
  }
}

// ─── verifyPayment ────────────────────────────────────────────────────────────

/**
 * Verifies Razorpay HMAC signature server-side using key_secret.
 * On success: credits/membership are activated, audit log created.
 */
export async function verifyPayment(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purchase_id,
    } = req.body as {
      razorpay_order_id:   string;
      razorpay_payment_id: string;
      razorpay_signature:  string;
      purchase_id:         string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !purchase_id) {
      res.status(400).json({ success: false, error: 'razorpay_order_id, razorpay_payment_id, razorpay_signature, and purchase_id are required.' });
      return;
    }

    const gateway = await getActiveGatewayRow();
    if (!gateway) {
      res.status(503).json({ success: false, error: 'Payment gateway not configured.' });
      return;
    }

    // ── HMAC-SHA256 signature verification ────────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', gateway.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      createAuditLog({
        action:        'payment_received',
        actor_id:      userId,
        resource_type: 'purchase',
        resource_id:   purchase_id,
        details:       { reason: 'signature_mismatch', order_id: razorpay_order_id },
        severity:      'critical',
      });
      res.status(400).json({ success: false, error: 'Payment verification failed: invalid signature.' });
      return;
    }

    // ── Update purchase record ─────────────────────────────────────────────
    const db        = await getDB();
    const purchases = db.purchases as PurchaseRow[];
    const purchase  = purchases.find((p) => p.id === purchase_id && p.user_id === userId);

    if (!purchase) {
      res.status(404).json({ success: false, error: 'Purchase record not found.' });
      return;
    }

    if (purchase.status === 'completed') {
      res.status(409).json({ success: false, error: 'Payment already verified.' });
      return;
    }

    purchase.gateway_payment_id = razorpay_payment_id;
    purchase.gateway_signature  = razorpay_signature;
    purchase.status             = 'completed';
    purchase.updated_at         = new Date().toISOString();

    // ── Activate credits or membership ─────────────────────────────────────
    if (purchase.type === 'credits' && purchase.plan_id) {
      const plan = (db.credit_plans as CreditPlanRow[]).find((p) => p.id === purchase.plan_id);
      if (plan) {
        purchase.credits_added = plan.credits;
        await addCreditsToUser(userId, plan.credits, 'credit_purchase', purchase.id);
      }
    }

    if (purchase.type === 'membership' && purchase.plan_id) {
      const plan = (db.membership_plans as MembershipPlanRow[]).find((p) => p.id === purchase.plan_id);
      if (plan) {
        const expiresAt = new Date(
          Date.now() + plan.duration_days * 24 * 60 * 60 * 1000
        ).toISOString();
        purchase.expires_at = expiresAt;

        // Add included credits
        if (plan.credits_included > 0) {
          purchase.credits_added = plan.credits_included;
          await addCreditsToUser(userId, plan.credits_included, 'membership_credits', purchase.id);
        }
      }
    }

    await saveDB(db);

    // ── Audit + socket ─────────────────────────────────────────────────────
    createAuditLog({
      action:        'payment_received',
      actor_id:      userId,
      resource_type: 'purchase',
      resource_id:   purchase.id,
      details: {
        type:       purchase.type,
        amount:     purchase.amount,
        currency:   purchase.currency,
        order_id:   razorpay_order_id,
        payment_id: razorpay_payment_id,
      },
      severity: 'info',
    });

    emitToAdmin('admin:payment-received', {
      user_id:    userId,
      purchase_id: purchase.id,
      type:       purchase.type,
      amount:     purchase.amount,
      currency:   purchase.currency,
    });

    createNotification(
      userId,
      'payment_success',
      'Payment Successful',
      `Your payment of ${purchase.currency} ${purchase.amount} was successful.`,
      { purchase_id: purchase.id, type: purchase.type }
    );

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      purchase: {
        id:            purchase.id,
        type:          purchase.type,
        amount:        purchase.amount,
        currency:      purchase.currency,
        credits_added: purchase.credits_added,
        expires_at:    purchase.expires_at,
        status:        purchase.status,
      },
    });
  } catch (err) {
    console.error('[Payment] verifyPayment error:', err);
    res.status(500).json({ success: false, error: 'Payment verification failed.' });
  }
}

// ─── checkout ─────────────────────────────────────────────────────────────────

/**
 * Processes a purchase after payment has been verified.
 * Validates the purchase record is completed, then returns a summary.
 */
export async function checkout(req: Request, res: Response): Promise<void> {
  try {
    const userId      = req.user!.id;
    const { purchase_id } = req.body as { purchase_id?: string };

    if (!purchase_id) {
      res.status(400).json({ success: false, error: 'purchase_id is required.' });
      return;
    }

    const db       = await getDB();
    const purchase = (db.purchases as PurchaseRow[]).find(
      (p) => p.id === purchase_id && p.user_id === userId
    );

    if (!purchase) {
      res.status(404).json({ success: false, error: 'Purchase not found.' });
      return;
    }

    if (purchase.status !== 'completed') {
      res.status(400).json({
        success: false,
        error: 'Purchase is not completed. Please verify payment first.',
        status: purchase.status,
      });
      return;
    }

    // Return checkout summary
    const creditRow = (db.credits as CreditRow[]).find((c) => c.user_id === userId);

    res.status(200).json({
      success: true,
      message: 'Checkout complete.',
      purchase: {
        id:            purchase.id,
        type:          purchase.type,
        amount:        purchase.amount,
        currency:      purchase.currency,
        credits_added: purchase.credits_added,
        expires_at:    purchase.expires_at,
        status:        purchase.status,
        created_at:    purchase.created_at,
      },
      currentCreditBalance: creditRow?.balance ?? 0,
    });
  } catch (err) {
    console.error('[Payment] checkout error:', err);
    res.status(500).json({ success: false, error: 'Checkout failed.' });
  }
}
