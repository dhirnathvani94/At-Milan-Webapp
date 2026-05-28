import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../../db/database';
import { createAuditLog } from '../../services/audit.service';
import { emitToAdmin } from '../../services/socket.service';
import nodemailer from 'nodemailer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingRow {
  key: string;
  value: string;
  setting_type: string;
  label?: string;
  group?: string;
  updated_at: string;
}

interface PaymentGatewayRow {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
  key_id?: string;
  key_secret?: string;
  merchant_id?: string;
  webhook_secret?: string;
  environment: 'sandbox' | 'production';
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface AdminNotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  target: 'all' | 'premium' | 'verified' | 'specific';
  target_user_ids?: string[];
  is_read: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface UserRow {
  id: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  is_verified: boolean;
}

interface PurchaseRow {
  user_id: string;
  type: string;
  status: string;
  expires_at: string | null;
  amount: number;
}

interface DocumentRow {
  user_id: string;
  status: string;
}

interface ReportRow {
  status: string;
  [key: string]: unknown;
}

interface InterestRow {
  status: string;
  [key: string]: unknown;
}

interface MessageRow {
  id: string;
}

// Secret setting keys — never expose their values
const SECRET_KEYS = new Set([
  'smtp_pass',
  'firebase_server_key',
  'firebase_vapid_key',
  'sms_api_key',
  'payu_salt',
  'cashfree_secret',
  'razorpay_key_secret',
]);

// ─── getSettings ─────────────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const SECRET_KEYS = new Set([
      'smtp_pass', 'firebase_server_key', 'firebase_vapid_key',
      'sms_api_key', 'payu_salt', 'cashfree_secret', 'razorpay_key_secret'
    ]);
    const settings = (db.admin_settings_kv as any[]).map((s: any, idx: number) => ({
      id: s.id || `set_${idx}`,
      setting_key: s.key,
      setting_value: SECRET_KEYS.has(s.key) ? '' : (s.value ?? ''),
      setting_type: s.setting_type || s.type || 'string',
      description: s.description || s.key,
      is_secret: SECRET_KEYS.has(s.key),
    }));
    res.status(200).json(settings);
  } catch (err) {
    console.error('[AdminSettings] getSettings error:', err);
    res.status(200).json([]);
  }
}

// ─── updateSetting ────────────────────────────────────────────────────────────

export async function updateSetting(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { value } = req.body as { value: string };
    const adminId = req.user!.id;

    if (value === undefined || value === null) {
      res.status(400).json({ success: false, error: 'value is required.' });
      return;
    }

    const db = await getDB();
    const settings = db.admin_settings_kv as SettingRow[];
    const idx = settings.findIndex((s) => s.key === key);
    const now = new Date().toISOString();

    if (idx === -1) {
      // Create new setting
      settings.push({
        key,
        value: String(value),
        setting_type: SECRET_KEYS.has(key) ? 'password' : 'text',
        updated_at: now,
      });
    } else {
      settings[idx] = { ...settings[idx]!, value: String(value), updated_at: now };
    }

    await saveTable('admin_settings_kv', db.admin_settings_kv as any[]);

    // Emit real-time settings:updated socket event
    try {
      const { getIO } = await import('../../services/socket.service');
      const io = getIO();
      if (io) {
        io.emit('settings:updated', { key, value });
        if (key === 'site_title') {
          io.emit('settings:updated', { key: 'platform_name', value });
        }
      }
    } catch { /* non-fatal */ }

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'setting',
      resource_id: key,
      details: { key, is_secret: SECRET_KEYS.has(key) },
      severity: 'warning',
    });

    // Return masked value for secrets
    const saved = settings.find((s) => s.key === key)!;
    const response = SECRET_KEYS.has(key)
      ? { ...saved, value: '', is_secret: true }
      : { ...saved, is_secret: false };

    res.status(200).json({ success: true, setting: response });
  } catch (err) {
    console.error('[AdminSettings] updateSetting error:', err);
    res.status(500).json({ success: false, error: 'Could not update setting.' });
  }
}

// ─── getPaymentGateways ───────────────────────────────────────────────────────

export async function getPaymentGateways(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const gateways = db.payment_gateways as PaymentGatewayRow[];
    // Admin endpoint — return full details including key_secret
    res.status(200).json(gateways);
  } catch (err) {
    console.error('[AdminSettings] getPaymentGateways error:', err);
    res.status(200).json([]);
  }
}

// ─── createPaymentGateway ─────────────────────────────────────────────────────

export async function createPaymentGateway(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id;
    const body = req.body as Partial<PaymentGatewayRow>;

    if (!body.name || !body.provider) {
      res.status(400).json({ success: false, error: 'name and provider are required.' });
      return;
    }

    const db = await getDB();
    const now = new Date().toISOString();
    const gateway: PaymentGatewayRow = {
      id: uuidv4(),
      name: body.name,
      provider: body.provider,
      is_active: body.is_active ?? false,
      is_default: body.is_default ?? false,
      key_id: body.key_id ?? '',
      key_secret: body.key_secret ?? '',
      merchant_id: body.merchant_id ?? '',
      webhook_secret: body.webhook_secret ?? '',
      environment: body.environment ?? 'sandbox',
      created_at: now,
      updated_at: now,
    };

    // If this is set as default, unset others
    if (gateway.is_default) {
      (db.payment_gateways as PaymentGatewayRow[]).forEach((g) => {
        g.is_default = false;
      });
    }

    (db.payment_gateways as unknown[]).push(gateway);
    await saveTable('payment_gateways', db.payment_gateways as any[]);

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'payment_gateway',
      resource_id: gateway.id,
      details: { action: 'created', name: gateway.name, provider: gateway.provider },
      severity: 'warning',
    });

    res.status(201).json({ success: true, gateway });
  } catch (err) {
    console.error('[AdminSettings] createPaymentGateway error:', err);
    res.status(500).json({ success: false, error: 'Could not create payment gateway.' });
  }
}

// ─── updatePaymentGateway ─────────────────────────────────────────────────────

export async function updatePaymentGateway(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const gateways = db.payment_gateways as PaymentGatewayRow[];
    const idx = gateways.findIndex((g) => g.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Payment gateway not found.' });
      return;
    }

    const body = req.body as Partial<PaymentGatewayRow>;
    const FORBIDDEN = new Set(['id', 'created_at']);
    const updates: Partial<PaymentGatewayRow> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!FORBIDDEN.has(k)) (updates as Record<string, unknown>)[k] = v;
    }

    // If setting as default, unset others
    if (updates.is_default) {
      gateways.forEach((g) => { g.is_default = false; });
    }

    gateways[idx] = { ...gateways[idx]!, ...updates, updated_at: new Date().toISOString() };
    await saveTable('payment_gateways', db.payment_gateways as any[]);

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'payment_gateway',
      resource_id: id,
      details: { action: 'updated', updated_fields: Object.keys(updates) },
      severity: 'warning',
    });

    res.status(200).json({ success: true, gateway: gateways[idx] });
  } catch (err) {
    console.error('[AdminSettings] updatePaymentGateway error:', err);
    res.status(500).json({ success: false, error: 'Could not update payment gateway.' });
  }
}

// ─── deletePaymentGateway ─────────────────────────────────────────────────────

export async function deletePaymentGateway(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const gateways = db.payment_gateways as PaymentGatewayRow[];
    const idx = gateways.findIndex((g) => g.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Payment gateway not found.' });
      return;
    }

    const deleted = gateways.splice(idx, 1)[0];
    await saveTable('payment_gateways', db.payment_gateways as any[]);

    createAuditLog({
      action: 'account_deleted',
      actor_id: adminId,
      resource_type: 'payment_gateway',
      resource_id: id,
      details: { name: deleted?.name, provider: deleted?.provider },
      severity: 'critical',
    });

    res.status(200).json({ success: true, message: 'Payment gateway deleted.' });
  } catch (err) {
    console.error('[AdminSettings] deletePaymentGateway error:', err);
    res.status(500).json({ success: false, error: 'Could not delete payment gateway.' });
  }
}

// ─── testSMS ──────────────────────────────────────────────────────────────────

export async function testSMS(req: Request, res: Response): Promise<void> {
  try {
    const { provider, api_key, sender_id, to, message } = req.body as {
      provider?: string;
      api_key?: string;
      sender_id?: string;
      to?: string;
      message?: string;
    };

    if (!to || !message) {
      res.status(400).json({ success: false, error: 'to and message are required.' });
      return;
    }

    // Use stored settings if not provided in body
    const db = await getDB();
    const settings = db.admin_settings_kv as SettingRow[];
    const getSetting = (key: string) => settings.find((s) => s.key === key)?.value ?? '';

    const resolvedProvider = provider ?? getSetting('sms_provider');
    const resolvedApiKey   = api_key   ?? getSetting('sms_api_key');
    const resolvedSender   = sender_id ?? getSetting('sms_sender_id');

    if (!resolvedApiKey) {
      res.status(400).json({ success: false, error: 'SMS API key not configured.' });
      return;
    }

    // Build provider-specific request using node's built-in https
    const https = await import('https');
    const url   = new URL(
      resolvedProvider === 'msg91'
        ? `https://api.msg91.com/api/v5/flow/`
        : `https://www.fast2sms.com/dev/bulkV2`
    );

    const payload = JSON.stringify({
      route: 'q',
      numbers: to,
      message,
      flash: 0,
      sender_id: resolvedSender || 'SHUBHM',
    });

    const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'authorization': resolvedApiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const reqHttp = https.request(options, (r) => {
        let body = '';
        r.on('data', (chunk) => { body += chunk; });
        r.on('end', () => resolve({ statusCode: r.statusCode ?? 0, body }));
      });
      reqHttp.on('error', reject);
      reqHttp.write(payload);
      reqHttp.end();
    });

    if (result.statusCode >= 200 && result.statusCode < 300) {
      res.status(200).json({ success: true, message: 'Test SMS sent.', response: result.body });
    } else {
      res.status(502).json({ success: false, error: 'SMS provider returned an error.', response: result.body });
    }
  } catch (err) {
    console.error('[AdminSettings] testSMS error:', err);
    res.status(500).json({ success: false, error: 'Could not send test SMS.' });
  }
}

// ─── testFirebase ─────────────────────────────────────────────────────────────

export async function testFirebase(req: Request, res: Response): Promise<void> {
  try {
    const { fcm_token, title, body: msgBody } = req.body as {
      fcm_token?: string;
      title?: string;
      body?: string;
    };

    if (!fcm_token) {
      res.status(400).json({ success: false, error: 'fcm_token is required.' });
      return;
    }

    const db = await getDB();
    const settings = db.admin_settings_kv as SettingRow[];
    const getSetting = (key: string) => settings.find((s) => s.key === key)?.value ?? '';

    const serverKey = getSetting('firebase_server_key');
    if (!serverKey) {
      res.status(400).json({ success: false, error: 'Firebase server key not configured in settings.' });
      return;
    }

    const https = await import('https');
    const payload = JSON.stringify({
      to: fcm_token,
      notification: {
        title: title ?? 'Test Notification',
        body: msgBody ?? (() => {
          try {
            const appName = settings.find((s) => s.key === 'platform_name')?.value || 'AtMilan';
            return `This is a test push notification from ${appName} admin.`;
          } catch { return 'This is a test push notification from admin.'; }
        })(),
      },
    });

    const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: 'fcm.googleapis.com',
        path: '/fcm/send',
        method: 'POST',
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const reqHttp = https.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => { data += chunk; });
        r.on('end', () => resolve({ statusCode: r.statusCode ?? 0, body: data }));
      });
      reqHttp.on('error', reject);
      reqHttp.write(payload);
      reqHttp.end();
    });

    if (result.statusCode === 200) {
      res.status(200).json({ success: true, message: 'Test Firebase push sent.', response: JSON.parse(result.body) });
    } else {
      res.status(502).json({ success: false, error: 'Firebase returned an error.', response: result.body });
    }
  } catch (err) {
    console.error('[AdminSettings] testFirebase error:', err);
    res.status(500).json({ success: false, error: 'Could not send test Firebase notification.' });
  }
}

// ─── sendAdminNotification ────────────────────────────────────────────────────

export async function sendAdminNotification(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id;
    const {
      title,
      body,
      type = 'announcement',
      target = 'all',
      target_user_ids,
    } = req.body as {
      title?: string;
      body?: string;
      type?: string;
      target?: 'all' | 'premium' | 'verified' | 'specific';
      target_user_ids?: string[];
    };

    if (!title || !body) {
      res.status(400).json({ success: false, error: 'title and body are required.' });
      return;
    }

    if (target === 'specific' && (!target_user_ids || target_user_ids.length === 0)) {
      res.status(400).json({ success: false, error: 'target_user_ids required when target is specific.' });
      return;
    }

    const db = await getDB();
    const now = new Date().toISOString();

    const notification: AdminNotificationRow = {
      id: uuidv4(),
      title,
      body,
      type,
      target,
      target_user_ids: target === 'specific' ? target_user_ids : undefined,
      is_read: false,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    };

    (db.admin_notifications as unknown[]).push(notification);

    // Also push into user notifications table for targeted users
    const users = db.users as UserRow[];
    const profiles = db.profiles as ProfileRow[];
    const purchases = db.purchases as PurchaseRow[];

    let targetUserIds: string[] = [];
    if (target === 'all') {
      targetUserIds = users.filter((u) => u.role !== 'admin' && u.is_active).map((u) => u.id);
    } else if (target === 'premium') {
      targetUserIds = users
        .filter((u) => u.role !== 'admin' && u.is_active)
        .filter((u) =>
          purchases.some(
            (p) =>
              p.user_id === u.id &&
              p.type === 'membership' &&
              p.status === 'completed' &&
              p.expires_at &&
              new Date(p.expires_at) > new Date()
          )
        )
        .map((u) => u.id);
    } else if (target === 'verified') {
      targetUserIds = users
        .filter((u) => u.role !== 'admin' && u.is_active)
        .filter((u) => profiles.find((p) => p.user_id === u.id)?.is_verified)
        .map((u) => u.id);
    } else if (target === 'specific') {
      targetUserIds = target_user_ids ?? [];
    }

    const userNotifications = db.notifications as Array<Record<string, unknown>>;
    targetUserIds.forEach((uid) => {
      userNotifications.push({
        id: uuidv4(),
        user_id: uid,
        type,
        title,
        body,
        data: { admin_notification_id: notification.id },
        is_read: false,
        created_at: now,
      });
    });

    await saveTable('admin_notifications', db.admin_notifications as any[]);
    await saveTable('notifications', db.notifications as any[]);

    // Emit via socket
    emitToAdmin('admin:notification-sent', { notification, recipient_count: targetUserIds.length });

    try {
      const { emitToUser, getIO } = await import("../../services/socket.service");
      const io = getIO();
      if (notification.target === "all" && io) {
        io.emit("notification:new", { notification });
      } else if (targetUserIds && targetUserIds.length > 0) {
        targetUserIds.forEach(uid => emitToUser(uid, "notification:new", { notification }));
      }
    } catch (e) {
      console.error('[AdminSettings] Socket emit error:', e);
    }

    createAuditLog({
      action: 'profile_updated',
      actor_id: adminId,
      resource_type: 'admin_notification',
      resource_id: notification.id,
      details: { title, target, recipient_count: targetUserIds.length },
      severity: 'info',
    });

    res.status(201).json({
      success: true,
      notification,
      recipient_count: targetUserIds.length,
    });
  } catch (err) {
    console.error('[AdminSettings] sendAdminNotification error:', err);
    res.status(500).json({ success: false, error: 'Could not send notification.' });
  }
}

// ─── getAdminNotifications ────────────────────────────────────────────────────

export async function getAdminNotifications(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const notifications = (db.admin_notifications as AdminNotificationRow[]).slice();
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const notificationsData = notifications.slice((page - 1) * limit, page * limit);

    const today = new Date().toDateString();
    const stats = {
      total: notifications.length,
      today: notifications.filter((n: any) =>
        new Date(n.created_at || n.sent_at).toDateString() === today
      ).length,
      totalReach: notifications.reduce((sum: number, n: any) =>
        sum + (n.delivery_count || 0), 0),
      avgRead: notifications.length > 0
        ? Math.round(notifications.reduce((sum: number, n: any) => {
            const dc = n.delivery_count || 0;
            const rc = n.read_count || 0;
            return sum + (dc > 0 ? (rc / dc) * 100 : 0);
          }, 0) / notifications.length)
        : 0,
    };

    const db2 = await getDB();
    const deviceCount = (db2.fcm_tokens as any[] || []).length;

    res.status(200).json({
      notifications: notificationsData,
      stats,
      device_count: deviceCount,
    });
  } catch (err) {
    console.error('[AdminSettings] getAdminNotifications error:', err);
    res.status(200).json({ notifications: [], stats: { total: 0, today: 0, totalReach: 0, avgRead: 0 }, device_count: 0 });
  }
}

// ─── markAdminNotificationRead ────────────────────────────────────────────────

export async function markAdminNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = await getDB();
    const notifications = db.admin_notifications as AdminNotificationRow[];
    const idx = notifications.findIndex((n) => n.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }

    notifications[idx] = { ...notifications[idx]!, is_read: true, updated_at: new Date().toISOString() };
    await saveTable('admin_notifications', db.admin_notifications as any[]);

    res.status(200).json({ success: true, notification: notifications[idx] });
  } catch (err) {
    console.error('[AdminSettings] markAdminNotificationRead error:', err);
    res.status(500).json({ success: false, error: 'Could not mark notification as read.' });
  }
}

// ─── deleteAdminNotification ──────────────────────────────────────────────────

export async function deleteAdminNotification(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = await getDB();
    const notifications = db.admin_notifications as AdminNotificationRow[];
    const idx = notifications.findIndex((n) => n.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }

    notifications.splice(idx, 1);
    await saveTable('admin_notifications', db.admin_notifications as any[]);

    res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    console.error('[AdminSettings] deleteAdminNotification error:', err);
    res.status(500).json({ success: false, error: 'Could not delete notification.' });
  }
}

// ─── getStats ─────────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const users     = (db.users     as UserRow[]).filter((u) => u.role !== 'admin');
    const profiles  = db.profiles   as ProfileRow[];
    const purchases = db.purchases  as PurchaseRow[];
    const documents = db.documents  as DocumentRow[];
    const reports   = db.reports    as ReportRow[];
    const interests = db.interests  as InterestRow[];
    const messages  = db.messages   as MessageRow[];

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const isPremium = (userId: string) =>
      purchases.some(
        (p) =>
          p.user_id === userId &&
          p.type === 'membership' &&
          p.status === 'completed' &&
          p.expires_at &&
          new Date(p.expires_at) > now
      );

    const totalUsers    = users.length;
    const activeUsers   = users.filter((u) => u.is_active).length;
    const premiumUsers  = users.filter((u) => isPremium(u.id)).length;
    const verifiedUsers = profiles.filter((p) => p.is_verified).length;
    const pendingDocs   = documents.filter((d) => d.status === 'pending').length;
    const pendingReports = reports.filter((r) => (r as Record<string, unknown>)['status'] === 'pending').length;

    const totalInterests    = interests.length;
    const acceptedInterests = interests.filter((i) => (i as Record<string, unknown>)['status'] === 'accepted').length;

    const newToday    = users.filter((u) => new Date(u.created_at) >= today).length;
    const newThisWeek = users.filter((u) => new Date(u.created_at) >= weekAgo).length;

    const totalRevenue = purchases
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);

    const messagesTotal = messages.length;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        premiumUsers,
        verifiedUsers,
        pendingDocs,
        pendingReports,
        totalInterests,
        acceptedInterests,
        newToday,
        newThisWeek,
        totalRevenue,
        messagesTotal,
      },
    });
  } catch (err) {
    console.error('[AdminSettings] getStats error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch stats.' });
  }
}
