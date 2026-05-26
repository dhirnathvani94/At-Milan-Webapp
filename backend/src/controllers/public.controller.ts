import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, getDBSync, saveDB } from '../db/database';
import { sendEmail } from '../services/email.service';
import { isUserOnline } from '../services/socket.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuccessStoryRow {
  id: string;
  user_id: string;
  partner_user_id: string | null;
  title: string;
  story: string;
  photo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  created_at: string;
}

interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percent' | 'flat';
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  applicable_to: 'all' | 'membership' | 'credits';
}

interface FcmTokenRow {
  id: string;
  user_id: string;
  token: string;
  device_type: string;
  created_at: string;
  updated_at: string;
}

interface AdminSettingRow {
  key: string;
  value: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAdminSetting(key: string): string {
  const db  = getDBSync();
  const kv  = db.admin_settings_kv as AdminSettingRow[];
  return kv.find((r) => r.key === key)?.value ?? '';
}

// ─── getSuccessStories ────────────────────────────────────────────────────────

export async function getSuccessStories(req: Request, res: Response): Promise<void> {
  try {
    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(50, parseInt((req.query['limit'] as string) ?? '12', 10));

    const db      = await getDB();
    const stories = (db.success_stories as SuccessStoryRow[])
      .filter((s) => s.status === 'approved')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total      = stories.length;
    const totalPages = Math.ceil(total / limit);
    const data       = stories.slice((page - 1) * limit, page * limit);

    // Enrich with profile names
    const profiles = db.profiles as Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      profile_photo?: string | null;
    }>;

    const enriched = data.map((s) => {
      const profile = profiles.find((p) => p.user_id === s.user_id);
      return {
        ...s,
        author: profile
          ? {
              first_name:    profile.first_name,
              last_name:     profile.last_name,
              profile_photo: profile.profile_photo ?? null,
            }
          : null,
      };
    });

    res.status(200).json({ success: true, data: enriched, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Public] getSuccessStories error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch success stories.' });
  }
}

// ─── shareSuccessStory ────────────────────────────────────────────────────────

export async function shareSuccessStory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { title, story, partner_user_id, photo_url } = req.body as {
      title: string;
      story: string;
      partner_user_id?: string;
      photo_url?: string;
    };

    if (!title || !story) {
      res.status(400).json({ success: false, error: 'title and story are required.' });
      return;
    }

    if (story.trim().length < 50) {
      res.status(400).json({ success: false, error: 'Story must be at least 50 characters.' });
      return;
    }

    const db = await getDB();
    const now = new Date().toISOString();

    const entry: SuccessStoryRow = {
      id:              uuidv4(),
      user_id:         userId,
      partner_user_id: partner_user_id ?? null,
      title:           title.trim(),
      story:           story.trim(),
      photo_url:       photo_url ?? null,
      status:          'pending',   // Admin must approve before it goes public
      created_at:      now,
      updated_at:      now,
    };

    (db.success_stories as SuccessStoryRow[]).push(entry);
    saveDB(db);

    res.status(201).json({
      success: true,
      message: 'Your story has been submitted and is pending review.',
      story: entry,
    });
  } catch (err) {
    console.error('[Public] shareSuccessStory error:', err);
    res.status(500).json({ success: false, error: 'Could not submit story.' });
  }
}

// ─── submitContact ────────────────────────────────────────────────────────────

export async function submitContact(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, phone, subject, message } = req.body as {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
    };

    if (!name || !email || !subject || !message) {
      res.status(400).json({ success: false, error: 'name, email, subject, and message are required.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
      return;
    }

    const db = await getDB();
    const entry: ContactMessageRow = {
      id:         uuidv4(),
      name:       name.trim(),
      email:      email.toLowerCase().trim(),
      phone:      phone ?? null,
      subject:    subject.trim(),
      message:    message.trim(),
      status:     'new',
      created_at: new Date().toISOString(),
    };

    (db.contact_messages as ContactMessageRow[]).push(entry);
    saveDB(db);

    // Send email to admin — non-blocking
    const adminEmail = getAdminSetting('admin_contact_email') ||
                       getAdminSetting('smtp_from_email');

    if (adminEmail) {
      const html = `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p>${message.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p style="font-size:12px;color:#999;">Submitted at ${entry.created_at}</p>
      `;
      sendEmail(adminEmail, `Contact Form: ${subject}`, html).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been received. We will get back to you shortly.',
    });
  } catch (err) {
    console.error('[Public] submitContact error:', err);
    res.status(500).json({ success: false, error: 'Could not submit contact form.' });
  }
}

// ─── validateCoupon ───────────────────────────────────────────────────────────

export async function validateCoupon(req: Request, res: Response): Promise<void> {
  try {
    const { code, amount, type } = req.body as {
      code: string;
      amount?: number;
      type?: 'membership' | 'credits' | 'all';
    };

    if (!code) {
      res.status(400).json({ success: false, error: 'Coupon code is required.' });
      return;
    }

    const db     = await getDB();
    const coupon = (db.coupons as CouponRow[]).find(
      (c) => c.code.toUpperCase() === code.toUpperCase().trim()
    );

    if (!coupon || !coupon.is_active) {
      res.status(404).json({ success: false, error: 'Invalid or expired coupon code.' });
      return;
    }

    const now = new Date();
    if (new Date(coupon.valid_from) > now || new Date(coupon.valid_until) < now) {
      res.status(400).json({ success: false, error: 'Coupon is not valid at this time.' });
      return;
    }

    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
      res.status(400).json({ success: false, error: 'Coupon usage limit has been reached.' });
      return;
    }

    if (type && coupon.applicable_to !== 'all' && coupon.applicable_to !== type) {
      res.status(400).json({ success: false, error: `Coupon is not applicable to ${type} purchases.` });
      return;
    }

    if (amount !== undefined && coupon.min_order_amount > 0 && amount < coupon.min_order_amount) {
      res.status(400).json({
        success: false,
        error: `Minimum order amount for this coupon is ${coupon.min_order_amount}.`,
      });
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    if (amount !== undefined) {
      discountAmount = coupon.discount_type === 'percent'
        ? Math.round((amount * coupon.discount_value) / 100)
        : coupon.discount_value;
      discountAmount = Math.min(discountAmount, amount); // never exceed order amount
    }

    res.status(200).json({
      success: true,
      valid: true,
      coupon: {
        id:             coupon.id,
        code:           coupon.code,
        discount_type:  coupon.discount_type,
        discount_value: coupon.discount_value,
        applicable_to:  coupon.applicable_to,
      },
      discountAmount,
      finalAmount: amount !== undefined ? amount - discountAmount : undefined,
    });
  } catch (err) {
    console.error('[Public] validateCoupon error:', err);
    res.status(500).json({ success: false, error: 'Could not validate coupon.' });
  }
}

// ─── getFirebaseConfig ────────────────────────────────────────────────────────

/**
 * Returns ONLY public Firebase keys needed by the frontend SDK.
 * firebase_server_key and firebase_private_key are NEVER returned.
 */
export async function getFirebaseConfig(_req: Request, res: Response): Promise<void> {
  try {
    const publicKeys = [
      'firebase_api_key',
      'firebase_auth_domain',
      'firebase_project_id',
      'firebase_storage_bucket',
      'firebase_messaging_sender_id',
      'firebase_app_id',
      'firebase_vapid_key',
    ];

    const db  = await getDB();
    const kv  = db.admin_settings_kv as AdminSettingRow[];

    const config: Record<string, string> = {};
    for (const key of publicKeys) {
      const val = kv.find((r) => r.key === key)?.value ?? '';
      // Map DB key names to Firebase SDK property names
      const sdkKey = key
        .replace('firebase_', '')
        .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      config[sdkKey] = val;
    }

    res.status(200).json({ success: true, config });
  } catch (err) {
    console.error('[Public] getFirebaseConfig error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch Firebase config.' });
  }
}

// ─── getFCMConfig ─────────────────────────────────────────────────────────────

// Alias — same as getFirebaseConfig
export const getFCMConfig = getFirebaseConfig;

// ─── registerFCMToken ─────────────────────────────────────────────────────────

export async function registerFCMToken(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { token, device_type = 'web' } = req.body as {
      token: string;
      device_type?: string;
    };

    if (!token) {
      res.status(400).json({ success: false, error: 'FCM token is required.' });
      return;
    }

    const db     = await getDB();
    const tokens = db.fcm_tokens as FcmTokenRow[];
    const now    = new Date().toISOString();

    // Update if token already exists for this user+device, else insert
    const existing = tokens.find((t) => t.user_id === userId && t.token === token);
    if (existing) {
      existing.updated_at  = now;
      existing.device_type = device_type;
    } else {
      tokens.push({
        id:          uuidv4(),
        user_id:     userId,
        token,
        device_type,
        created_at:  now,
        updated_at:  now,
      });
    }

    saveDB(db);

    res.status(200).json({ success: true, message: 'FCM token registered.' });
  } catch (err) {
    console.error('[Public] registerFCMToken error:', err);
    res.status(500).json({ success: false, error: 'Could not register FCM token.' });
  }
}

// ─── unregisterFCMToken ───────────────────────────────────────────────────────

export async function unregisterFCMToken(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { token } = req.body as { token?: string };

    if (!token) {
      res.status(400).json({ success: false, error: 'FCM token is required.' });
      return;
    }

    const db     = await getDB();
    const before = (db.fcm_tokens as FcmTokenRow[]).length;
    db.fcm_tokens = (db.fcm_tokens as FcmTokenRow[]).filter(
      (t) => !(t.user_id === userId && t.token === token)
    );
    const removed = before - (db.fcm_tokens as FcmTokenRow[]).length;

    if (removed > 0) saveDB(db);

    res.status(200).json({ success: true, message: 'FCM token unregistered.' });
  } catch (err) {
    console.error('[Public] unregisterFCMToken error:', err);
    res.status(500).json({ success: false, error: 'Could not unregister FCM token.' });
  }
}

// ─── getUsersOnline ───────────────────────────────────────────────────────────

export async function getUsersOnline(_req: Request, res: Response): Promise<void> {
  try {
    const db      = await getDB();
    const users   = db.users as Array<{ id: string; is_active: boolean; role: string }>;

    // Return only active non-admin user IDs that are currently connected via socket
    const onlineIds = users
      .filter((u) => u.is_active && u.role !== 'admin' && isUserOnline(u.id))
      .map((u) => u.id);

    res.status(200).json({ success: true, onlineUserIds: onlineIds, count: onlineIds.length });
  } catch (err) {
    console.error('[Public] getUsersOnline error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch online users.' });
  }
}
