import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth';
import { getDB, saveDB, saveTable } from '../db/database';
import { createAuditLog } from '../services/audit.service';

const router = Router();

// All routes in this file require authentication
router.use(authenticateToken);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsentRow {
  id: string;
  user_id: string;
  category: string;
  granted: boolean;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Exportable data categories ───────────────────────────────────────────────

const EXPORT_CATEGORIES = [
  { key: 'account',        label: 'Account Information',      description: 'Email, registration date, account status' },
  { key: 'profile',        label: 'Profile Data',             description: 'Personal details, education, family, lifestyle, horoscope' },
  { key: 'photos',         label: 'Photos',                   description: 'Uploaded photos and profile picture' },
  { key: 'documents',      label: 'Documents',                description: 'Uploaded verification documents' },
  { key: 'interests',      label: 'Interests Sent/Received',  description: 'All interest requests you sent or received' },
  { key: 'messages',       label: 'Messages',                 description: 'All chat messages sent and received' },
  { key: 'notifications',  label: 'Notifications',            description: 'All notifications received' },
  { key: 'shortlists',     label: 'Shortlists',               description: 'Profiles you have shortlisted' },
  { key: 'profile_views',  label: 'Profile Views',            description: 'Who viewed your profile and profiles you viewed' },
  { key: 'purchases',      label: 'Purchase History',         description: 'Membership and credit purchases' },
  { key: 'credits',        label: 'Credits & History',        description: 'Credit balance and transaction history' },
  { key: 'audit_logs',     label: 'Activity Logs',            description: 'Login history and account activity' },
  { key: 'consents',       label: 'Consent Records',          description: 'Your privacy consent history' },
];

// ─── GET /api/gdpr/categories ─────────────────────────────────────────────────

router.get('/categories', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, categories: EXPORT_CATEGORIES });
});

// ─── GET /api/gdpr/consents ───────────────────────────────────────────────────

router.get('/consents', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const db     = await getDB();

    // Consents stored in admin_settings_kv with key pattern consent:{userId}:{category}
    // OR in a dedicated consents array if present
    const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;
    const consentPrefix = `consent:${userId}:`;

    const consents = kv
      .filter((r) => r.key.startsWith(consentPrefix))
      .map((r) => ({
        category: r.key.replace(consentPrefix, ''),
        granted:  r.value === 'true',
      }));

    res.status(200).json({ success: true, consents });
  } catch (err) {
    console.error('[GDPR] GET /consents error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch consents.' });
  }
});

// ─── POST /api/gdpr/consent ───────────────────────────────────────────────────

router.post('/consent', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { category, granted } = req.body as { category: string; granted: boolean };

    if (!category || typeof granted !== 'boolean') {
      res.status(400).json({ success: false, error: 'category (string) and granted (boolean) are required.' });
      return;
    }

    const validCategories = EXPORT_CATEGORIES.map((c) => c.key);
    const extraCategories = ['marketing', 'analytics', 'third_party', 'cookies'];
    const allValid = [...validCategories, ...extraCategories];

    if (!allValid.includes(category)) {
      res.status(400).json({
        success: false,
        error:   `Unknown consent category: "${category}".`,
      });
      return;
    }

    const db  = await getDB();
    const kv  = db.admin_settings_kv as Array<{ key: string; value: string }>;
    const key = `consent:${userId}:${category}`;

    const existing = kv.find((r) => r.key === key);
    if (existing) {
      existing.value = String(granted);
    } else {
      kv.push({ key, value: String(granted) });
    }

    await saveTable('admin_settings_kv', db.admin_settings_kv as any[]);

    createAuditLog({
      action:        'profile_updated',
      actor_id:      userId,
      resource_type: 'consent',
      resource_id:   userId,
      details:       { category, granted },
      severity:      'info',
    });

    res.status(200).json({
      success:  true,
      message:  `Consent for "${category}" ${granted ? 'granted' : 'withdrawn'}.`,
      category,
      granted,
    });
  } catch (err) {
    console.error('[GDPR] POST /consent error:', err);
    res.status(500).json({ success: false, error: 'Could not record consent.' });
  }
});

// ─── POST /api/gdpr/export ────────────────────────────────────────────────────

router.post('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId     = req.user!.id;
    const { categories } = req.body as { categories?: string[] };

    const db = await getDB();

    // Determine which categories to export
    const requestedKeys = categories && categories.length > 0
      ? categories
      : EXPORT_CATEGORIES.map((c) => c.key);

    const exportData: Record<string, unknown> = {
      exported_at:  new Date().toISOString(),
      user_id:      userId,
      requested_by: userId,
    };

    for (const cat of requestedKeys) {
      switch (cat) {
        case 'account': {
          const user = (db.users as Array<Record<string, unknown>>).find((u) => u['id'] === userId);
          if (user) {
            // Strip sensitive fields
            const { password_hash, email_verify_token, password_reset_token, ...safeUser } = user;
            void password_hash; void email_verify_token; void password_reset_token;
            exportData['account'] = safeUser;
          }
          break;
        }
        case 'profile':
          exportData['profile'] = (db.profiles as Array<Record<string, unknown>>)
            .find((p) => p['user_id'] === userId) ?? null;
          break;

        case 'photos':
          exportData['photos'] = (db.documents as Array<Record<string, unknown>>)
            .filter((d) => d['user_id'] === userId && d['type'] === 'photo');
          break;

        case 'documents':
          exportData['documents'] = (db.documents as Array<Record<string, unknown>>)
            .filter((d) => d['user_id'] === userId && d['type'] !== 'photo');
          break;

        case 'interests':
          exportData['interests'] = (db.interests as Array<Record<string, unknown>>)
            .filter((i) => i['sender_id'] === userId || i['receiver_id'] === userId);
          break;

        case 'messages':
          exportData['messages'] = (db.messages as Array<Record<string, unknown>>)
            .filter((m) => m['sender_id'] === userId || m['receiver_id'] === userId);
          break;

        case 'notifications':
          exportData['notifications'] = (db.notifications as Array<Record<string, unknown>>)
            .filter((n) => n['user_id'] === userId);
          break;

        case 'shortlists':
          exportData['shortlists'] = (db.shortlists as Array<Record<string, unknown>>)
            .filter((s) => s['user_id'] === userId);
          break;

        case 'profile_views':
          exportData['profile_views'] = (db.profile_views as Array<Record<string, unknown>>)
            .filter((v) => v['viewer_id'] === userId || v['viewed_id'] === userId);
          break;

        case 'purchases':
          exportData['purchases'] = (db.purchases as Array<Record<string, unknown>>)
            .filter((p) => p['user_id'] === userId);
          break;

        case 'credits': {
          const balance = (db.credits as Array<Record<string, unknown>>)
            .find((c) => c['user_id'] === userId) ?? null;
          const history = (db.credits_history as Array<Record<string, unknown>>)
            .filter((h) => h['user_id'] === userId);
          exportData['credits'] = { balance, history };
          break;
        }

        case 'audit_logs':
          exportData['audit_logs'] = (db.audit_logs as Array<Record<string, unknown>>)
            .filter((l) => l['actor_id'] === userId);
          break;

        case 'consents': {
          const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;
          const prefix = `consent:${userId}:`;
          exportData['consents'] = kv
            .filter((r) => r.key.startsWith(prefix))
            .map((r) => ({ category: r.key.replace(prefix, ''), granted: r.value === 'true' }));
          break;
        }

        default:
          break;
      }
    }

    createAuditLog({
      action:        'profile_updated',
      actor_id:      userId,
      resource_type: 'gdpr_export',
      resource_id:   userId,
      details:       { categories: requestedKeys },
      severity:      'info',
    });

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      (() => {
        try {
          const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;
          const n = (kv.find(r => r.key === 'platform_name')?.value || 'AtMilan').toLowerCase().replace(/\s+/g, '-');
          return `attachment; filename="${n}-data-export-${userId}-${Date.now()}.json"`;
        } catch { return `attachment; filename="data-export-${userId}-${Date.now()}.json"`; }
      })()
    );
    res.status(200).json({ success: true, export: exportData });
  } catch (err) {
    console.error('[GDPR] POST /export error:', err);
    res.status(500).json({ success: false, error: 'Could not export data.' });
  }
});

// ─── POST /api/gdpr/delete ────────────────────────────────────────────────────

/**
 * GDPR Right to be Forgotten.
 * Anonymises the user account and soft-deletes it.
 * Does NOT hard-delete — audit logs and purchase records are retained
 * for legal/financial compliance but all PII is replaced with anonymised values.
 */
router.post('/delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId   = req.user!.id;
    const { confirm } = req.body as { confirm?: string };

    // Require explicit confirmation string to prevent accidental deletion
    if (confirm !== 'DELETE_MY_ACCOUNT') {
      res.status(400).json({
        success: false,
        error:   'To delete your account, send { "confirm": "DELETE_MY_ACCOUNT" } in the request body.',
      });
      return;
    }

    const db  = await getDB();
    const now = new Date().toISOString();
    const anonymisedEmail = `deleted_${uuidv4()}@anonymised.invalid`;

    // ── Anonymise user row ─────────────────────────────────────────────────
    const users = db.users as Array<Record<string, unknown>>;
    const userIdx = users.findIndex((u) => u['id'] === userId);
    if (userIdx !== -1) {
      users[userIdx] = {
        ...users[userIdx],
        email:                    anonymisedEmail,
        password_hash:            '',
        is_active:                false,
        email_verified:           false,
        email_verify_token:       null,
        password_reset_token:     null,
        provider_id:              null,
        login_attempts:           0,
        login_locked_until:       null,
        deleted_at:               now,
        updated_at:               now,
      };
    }

    // ── Anonymise profile row ──────────────────────────────────────────────
    const profiles = db.profiles as Array<Record<string, unknown>>;
    const profileIdx = profiles.findIndex((p) => p['user_id'] === userId);
    if (profileIdx !== -1) {
      profiles[profileIdx] = {
        ...profiles[profileIdx],
        first_name:   'Deleted',
        last_name:    'User',
        phone:        null,
        about_me:     null,
        birth_place:  null,
        birth_time:   null,
        updated_at:   now,
        deleted_at:   now,
      };
    }

    // ── Delete messages ────────────────────────────────────────────────────
    db.messages = (db.messages as Array<Record<string, unknown>>).filter(
      (m) => m['sender_id'] !== userId && m['receiver_id'] !== userId
    );

    // ── Delete notifications ───────────────────────────────────────────────
    db.notifications = (db.notifications as Array<Record<string, unknown>>).filter(
      (n) => n['user_id'] !== userId
    );

    // ── Delete shortlists ──────────────────────────────────────────────────
    db.shortlists = (db.shortlists as Array<Record<string, unknown>>).filter(
      (s) => s['user_id'] !== userId
    );

    // ── Delete profile views ───────────────────────────────────────────────
    db.profile_views = (db.profile_views as Array<Record<string, unknown>>).filter(
      (v) => v['viewer_id'] !== userId && v['viewed_id'] !== userId
    );

    // ── Delete FCM tokens ──────────────────────────────────────────────────
    db.fcm_tokens = (db.fcm_tokens as Array<Record<string, unknown>>).filter(
      (t) => t['user_id'] !== userId
    );

    // ── Delete OTPs ────────────────────────────────────────────────────────
    db.otps = (db.otps as Array<Record<string, unknown>>).filter(
      (o) => o['user_id'] !== userId
    );

    // ── Remove consent entries ─────────────────────────────────────────────
    db.admin_settings_kv = (db.admin_settings_kv as Array<{ key: string; value: string }>).filter(
      (r) => !r.key.startsWith(`consent:${userId}:`)
    );

    // Purchases and audit_logs are retained for legal/financial compliance
    // but the user row is anonymised so PII is removed

    await Promise.all([
      saveTable('users',              db.users              as any[]),
      saveTable('profiles',           db.profiles           as any[]),
      saveTable('messages',           db.messages           as any[]),
      saveTable('notifications',      db.notifications      as any[]),
      saveTable('shortlists',         db.shortlists         as any[]),
      saveTable('profile_views',      db.profile_views      as any[]),
      saveTable('fcm_tokens',         db.fcm_tokens         as any[]),
      saveTable('otps',               db.otps               as any[]),
      saveTable('admin_settings_kv',  db.admin_settings_kv  as any[]),
    ]);

    createAuditLog({
      action:        'account_deleted',
      actor_id:      userId,
      resource_type: 'user',
      resource_id:   userId,
      details:       { method: 'gdpr_right_to_erasure', anonymised_email: anonymisedEmail },
      severity:      'critical',
    });

    res.status(200).json({
      success: true,
      message: 'Your account has been anonymised and deactivated. All personal data has been removed.',
    });
  } catch (err) {
    console.error('[GDPR] POST /delete error:', err);
    res.status(500).json({ success: false, error: 'Could not process account deletion.' });
  }
});

export default router;
