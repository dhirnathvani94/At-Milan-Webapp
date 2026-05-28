import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDB, saveDB, saveTable } from "../db/database";
import { createAuditLog } from "../services/audit.service";
import { emitToAdmin } from "../services/socket.service";

// Types
interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  type: string;
  reason: string;
  details: string | null;
  message_id: string | null;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
}

interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

interface UnblockRequestRow {
  id: string;
  requester_id: string;
  blocked_id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

// reportUser
export async function reportUser(req: Request, res: Response): Promise<void> {
  try {
    const reporterId = req.user!.id;
    const { reported_id, reported_user_id, reason, details, note } = req.body as {
      reported_id?: string;
      reported_user_id?: string;
      reason: string;
      details?: string;
      note?: string;
    };

    const finalReportedId = reported_id || reported_user_id;
    const finalDetails = details || note || null;

    if (!finalReportedId || !reason) {
      res.status(400).json({ success: false, error: "reported_id and reason are required." });
      return;
    }
    if (reporterId === finalReportedId) {
      res.status(400).json({ success: false, error: "You cannot report yourself." });
      return;
    }

    const db = await getDB();
    const report: ReportRow = {
      id: uuidv4(),
      reporter_id: reporterId,
      reported_id: finalReportedId,
      type: "user",
      reason,
      details: finalDetails,
      message_id: null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    (db.reports as ReportRow[]).push(report);
    await saveTable('reports', db.reports as any[]);

    try {
      emitToAdmin("admin:user-reported", { report });
      // The instruction specifically requested admin:report-received
      emitToAdmin("admin:report-received", { report });
    } catch {}

    createAuditLog({
      action: "report_submitted",
      actor_id: reporterId,
      resource_type: "user",
      resource_id: finalReportedId,
      details: { reason },
      severity: "warning",
    });

    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("[Safety] reportUser error:", err);
    res.status(500).json({ success: false, error: "Could not submit report." });
  }
}

// reportMessage
export async function reportMessage(req: Request, res: Response): Promise<void> {
  try {
    const reporterId = req.user!.id;
    const { message_id, reported_id, reason, details } = req.body as {
      message_id: string;
      reported_id: string;
      reason: string;
      details?: string;
    };

    if (!message_id || !reported_id || !reason) {
      res.status(400).json({ success: false, error: "message_id, reported_id, and reason are required." });
      return;
    }

    const db = await getDB();
    const report: ReportRow = {
      id: uuidv4(),
      reporter_id: reporterId,
      reported_id,
      type: "message",
      reason,
      details: details ?? null,
      message_id,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    (db.reports as ReportRow[]).push(report);
    await saveTable('reports', db.reports as any[]);

    emitToAdmin("admin:message-reported", { report });

    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("[Safety] reportMessage error:", err);
    res.status(500).json({ success: false, error: "Could not report message." });
  }
}

// blockUser
export async function blockUser(req: Request, res: Response): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const { blocked_id } = req.body as { blocked_id: string };

    if (!blocked_id) {
      res.status(400).json({ success: false, error: "blocked_id is required." });
      return;
    }
    if (blockerId === blocked_id) {
      res.status(400).json({ success: false, error: "You cannot block yourself." });
      return;
    }

    const db = await getDB();
    const blocks = db.user_blocks as BlockRow[];

    const existing = blocks.find((b) => b.blocker_id === blockerId && b.blocked_id === blocked_id);
    if (existing) {
      res.status(409).json({ success: false, error: "User is already blocked." });
      return;
    }

    const block: BlockRow = {
      id: uuidv4(),
      blocker_id: blockerId,
      blocked_id,
      created_at: new Date().toISOString(),
    };

    blocks.push(block);
    await saveTable('user_blocks', db.user_blocks as any[]);

    createAuditLog({
      action: "user_blocked",
      actor_id: blockerId,
      resource_type: "user",
      resource_id: blocked_id,
      severity: "warning",
    });

    res.status(201).json({ success: true, block });
  } catch (err) {
    console.error("[Safety] blockUser error:", err);
    res.status(500).json({ success: false, error: "Could not block user." });
  }
}

// unblockUser
export async function unblockUser(req: Request, res: Response): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const { blocked_id } = req.body as { blocked_id: string };

    if (!blocked_id) {
      res.status(400).json({ success: false, error: "blocked_id is required." });
      return;
    }

    const db = await getDB();
    const blocks = db.user_blocks as BlockRow[];
    const idx = blocks.findIndex((b) => b.blocker_id === blockerId && b.blocked_id === blocked_id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: "Block not found." });
      return;
    }

    blocks.splice(idx, 1);
    await saveTable('user_blocks', db.user_blocks as any[]);

    createAuditLog({
      action: "user_unblocked",
      actor_id: blockerId,
      resource_type: "user",
      resource_id: blocked_id,
      severity: "info",
    });

    res.status(200).json({ success: true, message: "User unblocked." });
  } catch (err) {
    console.error("[Safety] unblockUser error:", err);
    res.status(500).json({ success: false, error: "Could not unblock user." });
  }
}

// getBlockedUsers
export async function getBlockedUsers(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== "admin") {
      res.status(403).json({ success: false, error: "Access denied." });
      return;
    }

    const db = await getDB();
    const blocks = (db.user_blocks as BlockRow[]).filter((b) => b.blocker_id === userId);
    const profiles = db.profiles as Array<{ user_id: string; first_name: string; last_name: string; profile_photo?: string | null }>;

    const data = blocks.map((b) => {
      const profile = profiles.find((p) => p.user_id === b.blocked_id);
      return {
        block_id: b.id,
        blocked_id: b.blocked_id,
        blocked_at: b.created_at,
        profile: profile
          ? { user_id: profile.user_id, first_name: profile.first_name, last_name: profile.last_name, profile_photo: profile.profile_photo ?? null }
          : null,
      };
    });

    res.status(200).json({ success: true, data, total: data.length });
  } catch (err) {
    console.error("[Safety] getBlockedUsers error:", err);
    res.status(500).json({ success: false, error: "Could not fetch blocked users." });
  }
}

// reportViolation
export async function reportViolation(req: Request, res: Response): Promise<void> {
  try {
    const reporterId = req.user!.id;
    const { reported_id, violation_type, details } = req.body as {
      reported_id: string;
      violation_type: string;
      details?: string;
    };

    if (!reported_id || !violation_type) {
      res.status(400).json({ success: false, error: "reported_id and violation_type are required." });
      return;
    }

    const db = await getDB();
    const report: ReportRow = {
      id: uuidv4(),
      reporter_id: reporterId,
      reported_id,
      type: "violation",
      reason: violation_type,
      details: details ?? null,
      message_id: null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    (db.reports as ReportRow[]).push(report);
    await saveTable('reports', db.reports as any[]);

    emitToAdmin("admin:violation-reported", { report });
    createAuditLog({
      action: "report_submitted",
      actor_id: reporterId,
      resource_type: "user",
      resource_id: reported_id,
      details: { violation_type },
      severity: "critical",
    });

    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("[Safety] reportViolation error:", err);
    res.status(500).json({ success: false, error: "Could not report violation." });
  }
}

// submitUnblockRequest
export async function submitUnblockRequest(req: Request, res: Response): Promise<void> {
  try {
    const requesterId = req.user!.id;
    const { blocked_by_id, reason } = req.body as { blocked_by_id: string; reason: string };

    if (!blocked_by_id || !reason) {
      res.status(400).json({ success: false, error: "blocked_by_id and reason are required." });
      return;
    }

    const db = await getDB();
    const blocks = db.user_blocks as BlockRow[];
    const isBlocked = blocks.some((b) => b.blocker_id === blocked_by_id && b.blocked_id === requesterId);

    if (!isBlocked) {
      res.status(404).json({ success: false, error: "No block found from that user." });
      return;
    }

    const existing = (db.unblock_requests as UnblockRequestRow[]).find(
      (r) => r.requester_id === requesterId && r.blocked_id === blocked_by_id && r.status === "pending"
    );
    if (existing) {
      res.status(409).json({ success: false, error: "An unblock request is already pending." });
      return;
    }

    const request: UnblockRequestRow = {
      id: uuidv4(),
      requester_id: requesterId,
      blocked_id: blocked_by_id,
      reason,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    (db.unblock_requests as UnblockRequestRow[]).push(request);
    await saveTable('unblock_requests', db.unblock_requests as any[]);

    emitToAdmin("admin:unblock-request", { request });

    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error("[Safety] submitUnblockRequest error:", err);
    res.status(500).json({ success: false, error: "Could not submit unblock request." });
  }
}

// getChatSafetyStatus
export async function getChatSafetyStatus(req: Request, res: Response): Promise<void> {
  try {
    const viewerId = req.user!.id;
    const { userId } = req.params;

    const db = await getDB();
    const blocks = db.user_blocks as BlockRow[];

    const iBlockedThem = blocks.some((b) => b.blocker_id === viewerId && b.blocked_id === userId);
    const theyBlockedMe = blocks.some((b) => b.blocker_id === userId && b.blocked_id === viewerId);

    const canChat = !iBlockedThem && !theyBlockedMe;

    res.status(200).json({
      success: true,
      canChat,
      iBlockedThem,
      theyBlockedMe,
    });
  } catch (err) {
    console.error("[Safety] getChatSafetyStatus error:", err);
    res.status(500).json({ success: false, error: "Could not check chat safety status." });
  }
}

// getReportStatus (used in safety routes)
export async function getReportStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { reported_id } = req.query as { reported_id?: string };

    const db = await getDB();
    const reports = (db.reports as ReportRow[]).filter(
      (r) => r.reporter_id === userId && (!reported_id || r.reported_id === reported_id)
    );

    res.status(200).json({ success: true, reports, total: reports.length });
  } catch (err) {
    console.error("[Safety] getReportStatus error:", err);
    res.status(500).json({ success: false, error: "Could not fetch report status." });
  }
}
