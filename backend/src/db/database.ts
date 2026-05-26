import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// ─── Types ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbTable = any[];

export interface Database {
  users: DbTable;
  profiles: DbTable;
  interests: DbTable;
  messages: DbTable;
  conversations: DbTable;
  notifications: DbTable;
  shortlists: DbTable;
  documents: DbTable;
  credits: DbTable;
  credits_history: DbTable;
  payment_gateways: DbTable;
  subscription_plans: DbTable;
  membership_plans: DbTable;
  credit_plans: DbTable;
  audit_logs: DbTable;
  success_stories: DbTable;
  contact_messages: DbTable;
  reports: DbTable;
  coupons: DbTable;
  admin_settings_kv: DbTable;
  profile_views: DbTable;
  fcm_tokens: DbTable;
  otps: DbTable;
  user_blocks: DbTable;
  unblock_requests: DbTable;
  tickets: DbTable;
  admin_notifications: DbTable;
  purchases: DbTable;
  communities: DbTable;
  master_castes: DbTable;
  master_sub_castes: DbTable;
  master_gotras: DbTable;
  master_nakshatras: DbTable;
  master_raashis: DbTable;
  master_heights: DbTable;
  master_weights: DbTable;
  master_body_types: DbTable;
  master_complexions: DbTable;
  master_blood_groups: DbTable;
  master_marital_statuses: DbTable;
  master_education_levels: DbTable;
  master_occupations: DbTable;
  master_incomes: DbTable;
  master_countries: DbTable;
  master_states: DbTable;
  master_cities: DbTable;
  master_family_types: DbTable;
  master_diets: DbTable;
  master_habits: DbTable;
  master_hobbies: DbTable;
  master_languages: DbTable;
}

// ─── Empty structure ──────────────────────────────────────────────────────────
// Used as a safe fallback when a table fetch fails, and by getDBSync().

const EMPTY_DB: Database = {
  users: [],
  profiles: [],
  interests: [],
  messages: [],
  conversations: [],
  notifications: [],
  shortlists: [],
  documents: [],
  credits: [],
  credits_history: [],
  payment_gateways: [],
  subscription_plans: [],
  membership_plans: [],
  credit_plans: [],
  audit_logs: [],
  success_stories: [],
  contact_messages: [],
  reports: [],
  coupons: [],
  admin_settings_kv: [],
  profile_views: [],
  fcm_tokens: [],
  otps: [],
  user_blocks: [],
  unblock_requests: [],
  tickets: [],
  admin_notifications: [],
  purchases: [],
  communities: [],
  master_castes: [],
  master_sub_castes: [],
  master_gotras: [],
  master_nakshatras: [],
  master_raashis: [],
  master_heights: [],
  master_weights: [],
  master_body_types: [],
  master_complexions: [],
  master_blood_groups: [],
  master_marital_statuses: [],
  master_education_levels: [],
  master_occupations: [],
  master_incomes: [],
  master_countries: [],
  master_states: [],
  master_cities: [],
  master_family_types: [],
  master_diets: [],
  master_habits: [],
  master_hobbies: [],
  master_languages: [],
};

// ─── Supabase admin client ────────────────────────────────────────────────────
// Exported so controllers can use it directly for reads and writes.
// Uses the service-role key which bypasses Row Level Security.

export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// ─── Table list ───────────────────────────────────────────────────────────────
// All table names that map 1-to-1 to the Database interface properties.

const TABLE_NAMES: (keyof Database)[] = [
  'users',
  'profiles',
  'interests',
  'messages',
  'conversations',
  'notifications',
  'shortlists',
  'documents',
  'credits',
  'credits_history',
  'payment_gateways',
  'subscription_plans',
  'membership_plans',
  'credit_plans',
  'audit_logs',
  'success_stories',
  'contact_messages',
  'reports',
  'coupons',
  'admin_settings_kv',
  'profile_views',
  'fcm_tokens',
  'otps',
  'user_blocks',
  'unblock_requests',
  'tickets',
  'admin_notifications',
  'purchases',
  'communities',
  'master_castes',
  'master_sub_castes',
  'master_gotras',
  'master_nakshatras',
  'master_raashis',
  'master_heights',
  'master_weights',
  'master_body_types',
  'master_complexions',
  'master_blood_groups',
  'master_marital_statuses',
  'master_education_levels',
  'master_occupations',
  'master_incomes',
  'master_countries',
  'master_states',
  'master_cities',
  'master_family_types',
  'master_diets',
  'master_habits',
  'master_hobbies',
  'master_languages',
];

// ─── Fetch a single table safely ─────────────────────────────────────────────
// Returns an empty array (never throws) so one bad table cannot crash getDB().

async function fetchTable(table: keyof Database): Promise<DbTable> {
  try {
    const { data, error } = await supabaseAdmin
      .from(table as string)
      .select('*');

    if (error) {
      console.error(`[DB] Error fetching table "${table}":`, error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error(
      `[DB] Unexpected error fetching table "${table}":`,
      (err as Error).message
    );
    return [];
  }
}

// ─── getDB ────────────────────────────────────────────────────────────────────

/**
 * Fetches ALL rows from every Supabase table in parallel and returns them
 * as a typed Database object.
 *
 * If any individual table fetch fails, that table is returned as an empty
 * array and the error is logged — getDB() never throws.
 */
export async function getDB(): Promise<Database> {
  const results = await Promise.all(TABLE_NAMES.map(fetchTable));

  const db = { ...EMPTY_DB } as Database;
  TABLE_NAMES.forEach((name, i) => {
    db[name] = results[i];
  });

  return db;
}

// ─── getDBSync ────────────────────────────────────────────────────────────────

/**
 * Synchronous backwards-compatibility stub.
 *
 * ⚠️  WARNING: This function does NOT fetch real data from Supabase.
 * It returns an empty Database shell and logs a deprecation warning.
 *
 * All existing controllers that call getDB() synchronously should be
 * migrated to `await getDB()` or use `supabaseAdmin` directly.
 * This stub exists only to prevent compile-time errors during migration.
 */
export function getDBSync(): Database {
  console.warn(
    '[DB] getDBSync() called — this returns EMPTY data. ' +
      'Migrate this call site to `await getDB()` or use `supabaseAdmin` directly.'
  );
  return { ...EMPTY_DB };
}

// ─── saveDB ───────────────────────────────────────────────────────────────────

/**
 * Persists a full Database snapshot back to Supabase.
 *
 * For every table in the Database object, all rows are upserted using the
 * `id` column as the conflict target.  Each table is wrapped in its own
 * try/catch so a failure on one table never blocks the rest.
 *
 * Errors are logged to the console but never thrown.
 *
 * @param data - The full Database object returned by getDB() (and mutated
 *               in-place by controllers before being passed here).
 */
export async function saveDB(data: Database): Promise<void> {
  for (const table of TABLE_NAMES) {
    const rows: DbTable = data[table];

    // Nothing to upsert for this table — skip it.
    if (!Array.isArray(rows) || rows.length === 0) continue;

    try {
      const { error } = await supabaseAdmin
        .from(table as string)
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error(
          `[DB] saveDB — error upserting table "${table}":`,
          error.message
        );
      }
    } catch (err) {
      console.error(
        `[DB] saveDB — unexpected error on table "${table}":`,
        (err as Error).message
      );
    }
  }
}

