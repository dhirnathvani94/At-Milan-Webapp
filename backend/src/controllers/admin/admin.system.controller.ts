import { Request, Response } from 'express';
import { env } from '../../config/env';
import { getDB } from '../../db/database';
import { getAuditLogs } from '../../services/audit.service';
import type { AuditLogFilters } from '../../services/audit.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogRow {
  id: string;
  action: string;
  actor_id: string | null;
  severity: string;
  created_at: string;
  details?: Record<string, unknown> | null;
}

// ─── getPerformance ───────────────────────────────────────────────────────────

export async function getPerformance(req: Request, res: Response): Promise<void> {
  try {
    const mem = process.memoryUsage();

    res.status(200).json({
      success: true,
      performance: {
        uptime_seconds: Math.floor(process.uptime()),
        uptime_human: formatUptime(process.uptime()),
        memory: {
          rss_mb:        toMB(mem.rss),
          heap_used_mb:  toMB(mem.heapUsed),
          heap_total_mb: toMB(mem.heapTotal),
          external_mb:   toMB(mem.external),
        },
        node_version: process.version,
        platform:     process.platform,
        arch:         process.arch,
        environment:  env.NODE_ENV,
        pid:          process.pid,
      },
    });
  } catch (err) {
    console.error('[AdminSystem] getPerformance error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch performance data.' });
  }
}

// ─── getSecurityStatus ────────────────────────────────────────────────────────

export async function getSecurityStatus(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDB();
    const auditLogs = db.audit_logs as AuditLogRow[];

    // Recent audit log entries (last 10)
    const recentLogs = auditLogs
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    // Suspicious activity: failed logins in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const suspiciousCount = auditLogs.filter(
      (l) =>
        l.action === 'login_failed' &&
        new Date(l.created_at) >= oneDayAgo
    ).length;

    // Rate limit config summary (static — reflects rateLimit.ts values)
    const rateLimitConfig = {
      auth:   { windowMs: 15 * 60 * 1000, max: 5,  description: 'Login / Register / Forgot-password' },
      otp:    { windowMs: 10 * 60 * 1000, max: 3,  description: 'OTP send / verify' },
      api:    { windowMs: 60 * 1000,       max: 100, description: 'Global API' },
      upload: { windowMs: 60 * 1000,       max: 10,  description: 'File uploads' },
      admin:  { windowMs: 60 * 1000,       max: 60,  description: 'Admin panel' },
    };

    res.status(200).json({
      success: true,
      security: {
        rate_limit_config: rateLimitConfig,
        recent_audit_logs: recentLogs,
        suspicious_activity_count_24h: suspiciousCount,
      },
    });
  } catch (err) {
    console.error('[AdminSystem] getSecurityStatus error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch security status.' });
  }
}

// ─── reindexElasticsearch ─────────────────────────────────────────────────────

export async function reindexElasticsearch(req: Request, res: Response): Promise<void> {
  try {
    if (!env.ELASTICSEARCH_URL) {
      res.status(200).json({ success: true, message: 'ElasticSearch not configured' });
      return;
    }

    const db = await getDB();
    const profiles = db.profiles as Array<Record<string, unknown>>;

    // Bulk index all profiles into ES
    const https = await import('https');
    const http  = await import('http');

    const esUrl = new URL(`${env.ELASTICSEARCH_URL}/profiles/_bulk`);
    const isHttps = esUrl.protocol === 'https:';

    const bulkBody = profiles
      .map((p) => {
        const indexAction = JSON.stringify({ index: { _index: 'profiles', _id: p['user_id'] } });
        const doc = JSON.stringify(p);
        return `${indexAction}\n${doc}`;
      })
      .join('\n') + '\n';

    const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: esUrl.hostname,
        port:     esUrl.port || (isHttps ? 443 : 9200),
        path:     esUrl.pathname,
        method:   'POST',
        headers:  {
          'Content-Type': 'application/x-ndjson',
          'Content-Length': Buffer.byteLength(bulkBody),
        },
      };

      const transport = isHttps ? https : http;
      const reqHttp = (transport as typeof https).request(options, (r) => {
        let body = '';
        r.on('data', (chunk) => { body += chunk; });
        r.on('end', () => resolve({ statusCode: r.statusCode ?? 0, body }));
      });
      reqHttp.on('error', reject);
      reqHttp.write(bulkBody);
      reqHttp.end();
    });

    if (result.statusCode >= 200 && result.statusCode < 300) {
      res.status(200).json({
        success: true,
        message: `Reindex complete. ${profiles.length} profiles indexed.`,
        es_response: JSON.parse(result.body),
      });
    } else {
      res.status(502).json({
        success: false,
        error: 'ElasticSearch returned an error during reindex.',
        es_response: result.body,
      });
    }
  } catch (err) {
    console.error('[AdminSystem] reindexElasticsearch error:', err);
    res.status(500).json({ success: false, error: 'Could not reindex ElasticSearch.' });
  }
}

// ─── getESStatus ──────────────────────────────────────────────────────────────

export async function getESStatus(req: Request, res: Response): Promise<void> {
  try {
    if (!env.ELASTICSEARCH_URL) {
      res.status(200).json({
        success: true,
        status: 'not_configured',
        message: 'ElasticSearch not configured',
      });
      return;
    }

    const https = await import('https');
    const http  = await import('http');

    const esUrl   = new URL(`${env.ELASTICSEARCH_URL}/_cluster/health`);
    const isHttps = esUrl.protocol === 'https:';

    const result = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const options = {
        hostname: esUrl.hostname,
        port:     esUrl.port || (isHttps ? 443 : 9200),
        path:     esUrl.pathname,
        method:   'GET',
      };

      const transport = isHttps ? https : http;
      const reqHttp = (transport as typeof https).request(options, (r) => {
        let body = '';
        r.on('data', (chunk) => { body += chunk; });
        r.on('end', () => resolve({ statusCode: r.statusCode ?? 0, body }));
      });
      reqHttp.on('error', reject);
      reqHttp.end();
    });

    if (result.statusCode === 200) {
      const health = JSON.parse(result.body);
      res.status(200).json({ success: true, status: 'connected', health });
    } else {
      res.status(502).json({ success: false, status: 'error', message: 'Could not reach ElasticSearch.' });
    }
  } catch (err) {
    console.error('[AdminSystem] getESStatus error:', err);
    res.status(200).json({
      success: false,
      status: 'unreachable',
      message: (err as Error).message,
    });
  }
}

// ─── getAuditLogs ─────────────────────────────────────────────────────────────

export async function getAuditLogsHandler(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;

    const filters: AuditLogFilters = {
      page:  Math.max(1, parseInt(q['page']  ?? '1',  10)),
      limit: Math.min(100, parseInt(q['limit'] ?? '20', 10)),
    };

    if (q['action'])        filters.action        = q['action'];
    if (q['actor_id'])      filters.actor_id      = q['actor_id'];
    if (q['severity'])      filters.severity      = q['severity'] as AuditLogFilters['severity'];
    if (q['resource_type']) filters.resource_type = q['resource_type'];
    if (q['resource_id'])   filters.resource_id   = q['resource_id'];
    if (q['from'])          filters.from          = q['from'];
    if (q['to'])            filters.to            = q['to'];

    const result = await getAuditLogs(filters);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[AdminSystem] getAuditLogs error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch audit logs.' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
