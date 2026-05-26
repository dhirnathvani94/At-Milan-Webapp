import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../db/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ─── createNotification (internal helper) ─────────────────────────────────────

/**
 * Creates a persistent notification in the DB.
 * Called internally by other controllers — never throws.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  try {
    const db = await getDB();
    const notification: NotificationRow = {
      id:         uuidv4(),
      user_id:    userId,
      type,
      title,
      message,
      data,
      is_read:    false,
      created_at: new Date().toISOString(),
    };
    (db.notifications as NotificationRow[]).push(notification);
    saveDB(db);
  } catch (err) {
    console.error('[Notification] createNotification error:', (err as Error).message);
  }
}

// ─── getNotifications ─────────────────────────────────────────────────────────

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query['limit'] as string) ?? '20', 10));
    const unreadOnly = req.query['unread'] === 'true';

    const db = await getDB();
    let notifications = (db.notifications as NotificationRow[])
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.is_read);
    }

    const total      = notifications.length;
    const totalPages = Math.ceil(total / limit);
    const data       = notifications.slice((page - 1) * limit, page * limit);
    const unreadCount = (db.notifications as NotificationRow[]).filter(
      (n) => n.user_id === userId && !n.is_read
    ).length;

    res.status(200).json({ success: true, data, total, page, limit, totalPages, unreadCount });
  } catch (err) {
    console.error('[Notification] getNotifications error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch notifications.' });
  }
}

// ─── markAsRead ───────────────────────────────────────────────────────────────

export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user!.id;

    const db            = await getDB();
    const notifications = db.notifications as NotificationRow[];
    const notification  = notifications.find((n) => n.id === id);

    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found.' });
      return;
    }

    if (notification.user_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    notification.is_read = true;
    saveDB(db);

    res.status(200).json({ success: true, notification });
  } catch (err) {
    console.error('[Notification] markAsRead error:', err);
    res.status(500).json({ success: false, error: 'Could not mark notification as read.' });
  }
}

// ─── markAllAsRead ────────────────────────────────────────────────────────────

export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db            = await getDB();
    const notifications = db.notifications as NotificationRow[];
    let   count         = 0;

    notifications.forEach((n) => {
      if (n.user_id === userId && !n.is_read) {
        n.is_read = true;
        count++;
      }
    });

    saveDB(db);

    res.status(200).json({ success: true, message: `${count} notification(s) marked as read.` });
  } catch (err) {
    console.error('[Notification] markAllAsRead error:', err);
    res.status(500).json({ success: false, error: 'Could not mark notifications as read.' });
  }
}

// ─── clearAll ─────────────────────────────────────────────────────────────────

export async function clearAll(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db            = await getDB();
    const before        = (db.notifications as NotificationRow[]).length;
    db.notifications    = (db.notifications as NotificationRow[]).filter(
      (n) => n.user_id !== userId
    );
    const deleted = before - (db.notifications as NotificationRow[]).length;
    saveDB(db);

    res.status(200).json({ success: true, message: `${deleted} notification(s) cleared.` });
  } catch (err) {
    console.error('[Notification] clearAll error:', err);
    res.status(500).json({ success: false, error: 'Could not clear notifications.' });
  }
}
