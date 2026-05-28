import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../../db/database';
import { createAuditLog } from '../../services/audit.service';
import { emitToUser } from '../../services/socket.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  action_taken?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ProfileRow {
  user_id: string;
  first_name: string;
  last_name: string;
  gender?: string;
  city?: string;
  [key: string]: unknown;
}

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_reported?: boolean;
  report_reason?: string;
  report_status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  report_reviewed_by?: string;
  report_reviewed_at?: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'open' | 'resolved';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

interface UnblockRequestRow {
  id: string;
  requester_id: string;
  blocked_user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

interface TicketRow {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'closed' | 'rejected' | 'reopened';
  priority?: 'low' | 'medium' | 'high';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Helper: profile preview ──────────────────────────────────────────────────

function profilePreview(profiles: ProfileRow[], userId: string) {
  const p = profiles.find((pr) => pr.user_id === userId);
  if (!p) return { user_id: userId, first_name: 'Unknown', last_name: '' };
  return {
    user_id: p.user_id,
    first_name: p.first_name,
    last_name: p.last_name,
    gender: p.gender,
    city: p.city,
  };
}

// ─── getReports ───────────────────────────────────────────────────────────────

export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']   ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const status = q['status'];

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    let reports = (db.reports as ReportRow[]).slice();

    if (status) {
      reports = reports.filter((r) => r.status === status);
    }

    reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = reports.length;
    const totalPages = Math.ceil(total / limit);
    const data = reports.slice((page - 1) * limit, page * limit).map((r) => ({
      ...r,
      reporter_profile: profilePreview(profiles, r.reporter_id),
      reported_profile: profilePreview(profiles, r.reported_id),
    }));

    res.status(200).json({ reports: data, totalCount: total });
  } catch (err) {
    console.error('[AdminReports] getReports error:', err);
    res.status(200).json({ reports: [], totalCount: 0 });
  }
}

// ─── updateReportStatus ───────────────────────────────────────────────────────

export async function updateReportStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { status, action_taken } = req.body as {
      status: ReportRow['status'];
      action_taken?: string;
    };

    const VALID_STATUSES = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    const db = await getDB();
    const reports = db.reports as ReportRow[];
    const idx = reports.findIndex((r) => r.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    const now = new Date().toISOString();
    reports[idx] = {
      ...reports[idx]!,
      status,
      action_taken: action_taken ?? reports[idx]!.action_taken,
      reviewed_by: adminId,
      reviewed_at: now,
      updated_at: now,
    };
    await saveTable('reports', db.reports as any[]);

    createAuditLog({
      action: 'report_submitted',
      actor_id: adminId,
      resource_type: 'report',
      resource_id: id,
      details: { status, action_taken },
      severity: 'warning',
    });

    res.status(200).json({ success: true, report: reports[idx] });
  } catch (err) {
    console.error('[AdminReports] updateReportStatus error:', err);
    res.status(500).json({ success: false, error: 'Could not update report status.' });
  }
}

// ─── getUserReport ────────────────────────────────────────────────────────────

export async function getUserReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = await getDB();
    const report = (db.reports as ReportRow[]).find((r) => r.id === id);

    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    const profiles = db.profiles as ProfileRow[];
    res.status(200).json({
      success: true,
      report: {
        ...report,
        reporter_profile: profilePreview(profiles, report.reporter_id),
        reported_profile: profilePreview(profiles, report.reported_id),
      },
    });
  } catch (err) {
    console.error('[AdminReports] getUserReport error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch report.' });
  }
}

// ─── getMessageReports ────────────────────────────────────────────────────────

export async function getMessageReports(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q['page']  ?? '1',  10));
    const limit = Math.min(100, parseInt(q['limit'] ?? '20', 10));

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    let messages = (db.messages as MessageRow[]).filter((m) => m.is_reported === true);

    messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = messages.length;
    const totalPages = Math.ceil(total / limit);
    const data = messages.slice((page - 1) * limit, page * limit).map((m) => ({
      ...m,
      sender_profile: profilePreview(profiles, m.sender_id),
      receiver_profile: profilePreview(profiles, m.receiver_id),
    }));

    res.status(200).json({ reports: data, totalCount: total });
  } catch (err) {
    console.error('[AdminReports] getMessageReports error:', err);
    res.status(200).json({ reports: [], totalCount: 0 });
  }
}

// ─── handleMessageReport ──────────────────────────────────────────────────────

export async function handleMessageReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { action } = req.body as { action: 'resolve' | 'dismiss' | 'warn_sender' | 'delete_message' };

    const VALID_ACTIONS = ['resolve', 'dismiss', 'warn_sender', 'delete_message'];
    if (!VALID_ACTIONS.includes(action)) {
      res.status(400).json({ success: false, error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
      return;
    }

    const db = await getDB();
    const messages = db.messages as MessageRow[];
    const idx = messages.findIndex((m) => m.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Message not found.' });
      return;
    }

    const now = new Date().toISOString();

    if (action === 'delete_message') {
      messages.splice(idx, 1);
    } else {
      const statusMap: Record<string, MessageRow['report_status']> = {
        resolve: 'resolved',
        dismiss: 'dismissed',
        warn_sender: 'reviewed',
      };
      messages[idx] = {
        ...messages[idx]!,
        report_status: statusMap[action],
        report_reviewed_by: adminId,
        report_reviewed_at: now,
        updated_at: now,
      };

      if (action === 'warn_sender' && messages[idx]) {
        emitToUser(messages[idx]!.sender_id, 'account:warning', {
          reason: 'Your message was reported and reviewed by an admin.',
        });
      }
    }

    await saveTable('messages', db.messages as any[]);

    createAuditLog({
      action: 'report_submitted',
      actor_id: adminId,
      resource_type: 'message',
      resource_id: id,
      details: { action },
      severity: 'warning',
    });

    res.status(200).json({ success: true, message: `Message report handled: ${action}.` });
  } catch (err) {
    console.error('[AdminReports] handleMessageReport error:', err);
    res.status(500).json({ success: false, error: 'Could not handle message report.' });
  }
}

// ─── getContactMessages ───────────────────────────────────────────────────────

export async function getContactMessages(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']   ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const status = q['status'];

    const db = await getDB();
    let contacts = (db.contact_messages as ContactMessageRow[]).slice();

    if (status) {
      contacts = contacts.filter((c) => c.status === status);
    }

    contacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = contacts.length;
    const totalPages = Math.ceil(total / limit);
    const data = contacts.slice((page - 1) * limit, page * limit);

    res.status(200).json({ contacts: data, totalCount: total });
  } catch (err) {
    console.error('[AdminReports] getContactMessages error:', err);
    res.status(200).json({ contacts: [], totalCount: 0 });
  }
}

// ─── resolveContact ───────────────────────────────────────────────────────────

export async function resolveContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const contacts = db.contact_messages as ContactMessageRow[];
    const idx = contacts.findIndex((c) => c.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Contact message not found.' });
      return;
    }

    const now = new Date().toISOString();
    contacts[idx] = {
      ...contacts[idx]!,
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
    };
    await saveTable('contact_messages', db.contact_messages as any[]);

    res.status(200).json({ success: true, contact: contacts[idx] });
  } catch (err) {
    console.error('[AdminReports] resolveContact error:', err);
    res.status(500).json({ success: false, error: 'Could not resolve contact message.' });
  }
}

// ─── getUnblockRequests ───────────────────────────────────────────────────────

export async function getUnblockRequests(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']   ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const status = q['status'];

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    let requests = (db.unblock_requests as UnblockRequestRow[]).slice();

    if (status) {
      requests = requests.filter((r) => r.status === status);
    }

    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = requests.length;
    const totalPages = Math.ceil(total / limit);
    const data = requests.slice((page - 1) * limit, page * limit).map((r) => ({
      ...r,
      requester_profile: profilePreview(profiles, r.requester_id),
      blocked_user_profile: profilePreview(profiles, r.blocked_user_id),
    }));

    res.status(200).json({ success: true, requests: data, total, page, limit, totalPages });
  } catch (err) {
    console.error('[AdminReports] getUnblockRequests error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch unblock requests.' });
  }
}

// ─── handleUnblockRequest ─────────────────────────────────────────────────────

export async function handleUnblockRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { action, admin_note } = req.body as {
      action: 'approve' | 'reject';
      admin_note?: string;
    };

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: 'action must be approve or reject.' });
      return;
    }

    const db = await getDB();
    const requests = db.unblock_requests as UnblockRequestRow[];
    const idx = requests.findIndex((r) => r.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Unblock request not found.' });
      return;
    }

    const now = new Date().toISOString();
    const newStatus: UnblockRequestRow['status'] = action === 'approve' ? 'approved' : 'rejected';

    requests[idx] = {
      ...requests[idx]!,
      status: newStatus,
      reviewed_by: adminId,
      reviewed_at: now,
      admin_note: admin_note ?? requests[idx]!.admin_note,
      updated_at: now,
    };

    // If approved, remove the block entry
    if (action === 'approve') {
      const req_ = requests[idx]!;
      const blocks = db.user_blocks as Array<{ blocker_id: string; blocked_id: string }>;
      db.user_blocks = blocks.filter(
        (b) => !(b.blocker_id === req_.requester_id && b.blocked_id === req_.blocked_user_id)
      );
      emitToUser(req_.requester_id, 'user:unblocked', { unblocked_user_id: req_.blocked_user_id });
      emitToUser(req_.requester_id, 'notification:new', {
        type: 'unblock_approved',
        message: 'Your unblock request has been approved. You can now message again.',
      });
    }

    if (action === 'reject') {
      emitToUser(requests[idx]!.requester_id, 'unblock:rejected', {
        request_id: id,
        admin_note: admin_note ?? '',
        message: 'Your unblock request was rejected.',
      });
      emitToUser(requests[idx]!.requester_id, 'notification:new', {
        type: 'unblock_rejected',
        message: 'Your unblock request was rejected.',
      });
    }

    await saveTable('unblock_requests', db.unblock_requests as any[]);
    if (action === 'approve') {
      await saveTable('user_blocks', db.user_blocks as any[]);
    }

    createAuditLog({
      action: 'user_unblocked',
      actor_id: adminId,
      resource_type: 'unblock_request',
      resource_id: id,
      details: { action, admin_note },
      severity: 'info',
    });

    res.status(200).json({ success: true, request: requests[idx] });
  } catch (err) {
    console.error('[AdminReports] handleUnblockRequest error:', err);
    res.status(500).json({ success: false, error: 'Could not handle unblock request.' });
  }
}

// ─── getUnblockRequestDetail ──────────────────────────────────────────────────

export async function getUnblockRequestDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = await getDB();
    const request = (db.unblock_requests as UnblockRequestRow[]).find((r) => r.id === id);

    if (!request) {
      res.status(404).json({ success: false, error: 'Unblock request not found.' });
      return;
    }

    const profiles = db.profiles as ProfileRow[];
    res.status(200).json({
      success: true,
      request: {
        ...request,
        requester_profile: profilePreview(profiles, request.requester_id),
        blocked_user_profile: profilePreview(profiles, request.blocked_user_id),
      },
    });
  } catch (err) {
    console.error('[AdminReports] getUnblockRequestDetail error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch unblock request.' });
  }
}

// ─── getTickets ───────────────────────────────────────────────────────────────

export async function getTickets(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const page   = Math.max(1, parseInt(q['page']   ?? '1',  10));
    const limit  = Math.min(100, parseInt(q['limit'] ?? '20', 10));
    const status = q['status'];

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    let tickets = (db.tickets as TicketRow[]).slice();

    if (status) {
      tickets = tickets.filter((t) => t.status === status);
    }

    tickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = tickets.length;
    const totalPages = Math.ceil(total / limit);
    const data = tickets.slice((page - 1) * limit, page * limit).map((t) => ({
      ...t,
      user_profile: profilePreview(profiles, t.user_id),
    }));

    res.status(200).json({ success: true, tickets: data, total, page, limit, totalPages });
  } catch (err) {
    console.error('[AdminReports] getTickets error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch tickets.' });
  }
}

// ─── closeTicket ──────────────────────────────────────────────────────────────

export async function closeTicket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const tickets = db.tickets as TicketRow[];
    const idx = tickets.findIndex((t) => t.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }

    const now = new Date().toISOString();
    tickets[idx] = {
      ...tickets[idx]!,
      status: 'closed',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
    };
    await saveTable('tickets', db.tickets as any[]);

    emitToUser(tickets[idx]!.user_id, 'ticket:closed', { ticket_id: id });
    res.status(200).json({ success: true, ticket: tickets[idx] });
  } catch (err) {
    console.error('[AdminReports] closeTicket error:', err);
    res.status(500).json({ success: false, error: 'Could not close ticket.' });
  }
}

// ─── rejectTicket ─────────────────────────────────────────────────────────────

export async function rejectTicket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { reason } = req.body as { reason?: string };
    const db = await getDB();
    const tickets = db.tickets as TicketRow[];
    const idx = tickets.findIndex((t) => t.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }

    const now = new Date().toISOString();
    tickets[idx] = {
      ...tickets[idx]!,
      status: 'rejected',
      resolved_by: adminId,
      resolved_at: now,
      updated_at: now,
      ...(reason ? { rejection_reason: reason } : {}),
    };
    await saveTable('tickets', db.tickets as any[]);

    emitToUser(tickets[idx]!.user_id, 'ticket:rejected', { ticket_id: id, reason });
    res.status(200).json({ success: true, ticket: tickets[idx] });
  } catch (err) {
    console.error('[AdminReports] rejectTicket error:', err);
    res.status(500).json({ success: false, error: 'Could not reject ticket.' });
  }
}

// ─── reopenTicket ─────────────────────────────────────────────────────────────

export async function reopenTicket(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const db = await getDB();
    const tickets = db.tickets as TicketRow[];
    const idx = tickets.findIndex((t) => t.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found.' });
      return;
    }

    const now = new Date().toISOString();
    tickets[idx] = {
      ...tickets[idx]!,
      status: 'reopened',
      resolved_by: undefined,
      resolved_at: undefined,
      updated_at: now,
    };
    await saveTable('tickets', db.tickets as any[]);

    emitToUser(tickets[idx]!.user_id, 'ticket:reopened', { ticket_id: id });
    res.status(200).json({ success: true, ticket: tickets[idx] });
  } catch (err) {
    console.error('[AdminReports] reopenTicket error:', err);
    res.status(500).json({ success: false, error: 'Could not reopen ticket.' });
  }
}
