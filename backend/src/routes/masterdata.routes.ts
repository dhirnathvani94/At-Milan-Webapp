import { Router, Request, Response } from 'express';
import { getDB } from '../db/database';

const router = Router();

const TABLE_MAP: Record<string, string> = {
  castes:            'master_castes',
  sub_castes:        'master_sub_castes',
  gotras:            'master_gotras',
  nakshatras:        'master_nakshatras',
  raashis:           'master_raashis',
  heights:           'master_heights',
  weights:           'master_weights',
  body_types:        'master_body_types',
  complexions:       'master_complexions',
  blood_groups:      'master_blood_groups',
  marital_statuses:  'master_marital_statuses',
  education_levels:  'master_education_levels',
  occupations:       'master_occupations',
  incomes:           'master_incomes',
  countries:         'master_countries',
  states:            'master_states',
  cities:            'master_cities',
  family_types:      'master_family_types',
  diets:             'master_diets',
  habits:            'master_habits',
  hobbies:           'master_hobbies',
  languages:         'master_languages',
};

const BLOCKED_TABLES = new Set([
  'admin_settings_kv',
  'users',
  'audit_logs',
  'otps',
  'fcm_tokens',
  'credits',
  'credits_history',
  'purchases',
  'payment_gateways',
]);

const PUBLIC_SETTING_KEYS = new Set([
  'platform_name', 'site_title', 'site_name', 'community_name',
  'company_tagline', 'company_website', 'company_gstin',
  'invoice_prefix', 'invoice_logo', 'support_whatsapp',
  'contact_email', 'contact_phone', 'contact_address', 'smtp_from_name',
  'site_logo_image', 'site_favicon',
  'facebook_link', 'twitter_link', 'instagram_link', 'youtube_link',
  'app_store_link', 'play_store_link',
  'stat_profiles', 'stat_marriages', 'stat_happy_users', 'stat_years',
  'hero_description', 'free_journey_text',
  'section_how_it_works_title', 'section_love_stories_title', 'section_testimonials_title',
  'how_it_works_items', 'love_stories_items', 'testimonials_items',
  'home_banners', 'success_page_stories',
  'gdpr_cookie_text', 'gdpr_cookie_notice',
  'faq_data', 'privacy_policy_data', 'terms_data', 'mission_title',
  'popup_show_days_before_expiry', 'credit_low_popup_threshold_percent',
  'posthog_api_key', 'posthog_host', 'firebase_apis',
]);

interface CacheEntry {
  data: Record<string, unknown[]>;
  expiresAt: number;
}

let allTablesCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

function getActiveItems(items: unknown[]): unknown[] {
  return items.filter((item) => {
    const row = item as Record<string, unknown>;
    return row['is_active'] !== false;
  });
}

async function buildAllTablesPayload(): Promise<Record<string, unknown[]>> {
  const db = await getDB();
  const payload: Record<string, unknown[]> = {};
  for (const [publicKey, dbKey] of Object.entries(TABLE_MAP)) {
    const raw = (db as unknown as Record<string, unknown[]>)[dbKey] ?? [];
    payload[publicKey] = getActiveItems(raw);
  }
  return payload;
}

// GET /api/master-data
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = Date.now();
    if (allTablesCache && allTablesCache.expiresAt > now) {
      res.status(200).json({ success: true, cached: true, data: allTablesCache.data });
      return;
    }
    const data = await buildAllTablesPayload();
    allTablesCache = { data, expiresAt: now + CACHE_TTL_MS };
    res.status(200).json({ success: true, cached: false, data });
  } catch (err) {
    console.error('[MasterData] GET / error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch master data.' });
  }
});

// GET /api/master-data/app-config
// Returns ONLY safe public settings — never secret keys
// MUST stay above router.get('/:table') — otherwise Express matches app-config as :table
router.get('/app-config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDB();
    const allSettings = (db.admin_settings_kv as Array<{ key: string; value: string; setting_type: string }>) ?? [];
    const safe = allSettings.filter((s) => PUBLIC_SETTING_KEYS.has(s.key));
    res.status(200).json({ success: true, data: { admin_settings_kv: safe } });
  } catch (err) {
    console.error('[MasterData] GET /app-config error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch app config.' });
  }
});

// GET /api/master-data/:table
// NOTE: This wildcard route must always stay BELOW /app-config
router.get('/:table', async (req: Request, res: Response): Promise<void> => {
  try {
    const { table } = req.params;
    if (BLOCKED_TABLES.has(table)) {
      res.status(403).json({ success: false, error: 'Access to this table is forbidden.' });
      return;
    }
    const dbKey = TABLE_MAP[table];
    if (!dbKey) {
      res.status(404).json({ success: false, error: `Unknown master data table: "${table}". Valid tables: ${Object.keys(TABLE_MAP).join(', ')}` });
      return;
    }
    const db = await getDB();
    const raw = (db as unknown as Record<string, unknown[]>)[dbKey] ?? [];
    const data = getActiveItems(raw);
    res.status(200).json({ success: true, table, data });
  } catch (err) {
    console.error('[MasterData] GET /:table error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch master data table.' });
  }
});

export default router;
