import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable, supabaseAdmin } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditAction =
  | 'login_success'
  | 'login_failed'
  | 'admin_login'
  | 'logout'
  | 'register'
  | 'password_reset'
  | 'password_changed'
  | 'account_deleted'
  | 'profile_verified'
  | 'document_approved'
  | 'document_rejected'
  | 'credits_adjusted'
  | 'payment_received'
  | 'sql_injection_attempt'
  | 'rate_limit_hit'
  | 'email_verified'
  | 'otp_sent'
  | 'otp_verified'
  | 'interest_sent'
  | 'interest_accepted'
  | 'interest_rejected'
  | 'profile_updated'
  | 'photo_uploaded'
  | 'document_uploaded'
  | 'user_blocked'
  | 'user_unblocked'
  | 'report_submitted'
  | string; // allow custom actions

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor_id: string | null;
  actor_ip: string | null;
  actor_user_agent: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  severity: AuditSeverity;
  created_at: string;
}

export interface CreateAuditLogInput {
  action: AuditAction;
  actor_id?: string | null;
  actor_ip?: string | null;
  actor_user_agent?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}

// ─── Severity defaults per action ────────────────────────────────────────────

const SEVERITY_MAP: Partial<Record<AuditAction, AuditSeverity>> = {
  login_success:           'info',
  login_failed:            'warning',
  admin_login:             'warning',
  logout:                  'info',
  register:                'info',
  password_reset:          'warning',
  password_changed:        'warning',
  account_deleted:         'critical',
  profile_verified:        'info',
  document_approved:       'info',
  document_rejected:       'warning',
  credits_adjusted:        'warning',
  payment_received:        'info',
  sql_injection_attempt:   'critical',
  rate_limit_hit:          'warning',
  email_verified:          'info',
  otp_sent:                'info',
  otp_verified:            'info',
  interest_sent:           'info',
  interest_accepted:       'info',
  interest_rejected:       'info',
  profile_updated:         'info',
  photo_uploaded:          'info',
  document_uploaded:       'info',
  user_blocked:            'warning',
  user_unblocked:          'info',
  report_submitted:        'warning',
};

// ─── createAuditLog ───────────────────────────────────────────────────────────

/**
 * Saves an audit log entry to the database.
 * Never throws — errors are caught and logged to console only.
 * Fire-and-forget: callers do not need to await this.
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    const entry: AuditLogEntry = {
      id:               uuidv4(),
      action:           input.action,
      actor_id:         input.actor_id         ?? null,
      actor_ip:         input.actor_ip         ?? null,
      actor_user_agent: input.actor_user_agent ?? null,
      resource_type:    input.resource_type    ?? null,
      resource_id:      input.resource_id      ?? null,
      details:          input.details          ?? null,
      severity:         input.severity ?? SEVERITY_MAP[input.action] ?? 'info',
      created_at:       new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert(entry);
      
    if (error) {
      console.error('[Audit] Failed to log:', error.message);
    }
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', (err as Error).message);
  }
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface AuditLogFilters {
  action?:        AuditAction;
  actor_id?:      string;
  resource_type?: string;
  resource_id?:   string;
  severity?:      AuditSeverity;
  from?:          string;   // ISO date string
  to?:            string;   // ISO date string
  page?:          number;
  limit?:         number;
}

export interface PaginatedAuditLogs {
  data:       AuditLogEntry[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// ─── getAuditLogs ─────────────────────────────────────────────────────────────

/**
 * Returns a paginated, filtered list of audit log entries.
 * Results are sorted newest-first.
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<PaginatedAuditLogs> {
  const db   = await getDB();
  let logs   = (db.audit_logs as AuditLogEntry[]).slice();

  // ── Apply filters ──────────────────────────────────────────────────────────
  if (filters.action) {
    logs = logs.filter((l) => l.action === filters.action);
  }
  if (filters.actor_id) {
    logs = logs.filter((l) => l.actor_id === filters.actor_id);
  }
  if (filters.resource_type) {
    logs = logs.filter((l) => l.resource_type === filters.resource_type);
  }
  if (filters.resource_id) {
    logs = logs.filter((l) => l.resource_id === filters.resource_id);
  }
  if (filters.severity) {
    logs = logs.filter((l) => l.severity === filters.severity);
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime();
    logs = logs.filter((l) => new Date(l.created_at).getTime() >= from);
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime();
    logs = logs.filter((l) => new Date(l.created_at).getTime() <= to);
  }

  // ── Sort newest first ──────────────────────────────────────────────────────
  logs.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // ── Paginate ───────────────────────────────────────────────────────────────
  const total      = logs.length;
  const page       = Math.max(1, filters.page  ?? 1);
  const limit      = Math.min(100, Math.max(1, filters.limit ?? 20));
  const totalPages = Math.ceil(total / limit);
  const offset     = (page - 1) * limit;
  const data       = logs.slice(offset, offset + limit);

  return { data, total, page, limit, totalPages };
}
