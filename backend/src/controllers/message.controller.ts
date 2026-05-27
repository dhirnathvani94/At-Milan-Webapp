import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable } from '../db/database';
import { emitToUser } from '../services/socket.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  conversation_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ConversationRow {
  id: string;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic conversation ID from two user IDs (order-independent) */
function getConversationKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function findOrCreateConversation(
  conversations: ConversationRow[],
  userId: string,
  otherId: string
): ConversationRow {
  const existing = conversations.find(
    (c) =>
      c.participant_ids.includes(userId) && c.participant_ids.includes(otherId)
  );
  if (existing) return existing;

  const now: string = new Date().toISOString();
  const conv: ConversationRow = {
    id:               uuidv4(),
    participant_ids:  [userId, otherId],
    last_message:     null,
    last_message_at:  null,
    created_at:       now,
    updated_at:       now,
  };
  conversations.push(conv);
  return conv;
}

// ─── getMessages ──────────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { userId, otherUserId } = req.params;
    const requesterId = req.user!.id;

    // Only participants or admin can read the conversation
    if (
      requesterId !== userId &&
      requesterId !== otherUserId &&
      req.user!.role !== 'admin'
    ) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query['limit'] as string) ?? '50', 10));

    const db       = await getDB();
    const messages = db.messages as MessageRow[];

    // Get all messages between the two users (both directions)
    let thread = messages
      .filter(
        (m) =>
          (m.sender_id === userId   && m.receiver_id === otherUserId) ||
          (m.sender_id === otherUserId && m.receiver_id === userId)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const total      = thread.length;
    const totalPages = Math.ceil(total / limit);
    const data       = thread.slice((page - 1) * limit, page * limit);

    // Mark messages sent TO the requester as read
    let changed = false;
    messages.forEach((m) => {
      if (
        m.sender_id   === otherUserId &&
        m.receiver_id === requesterId &&
        !m.is_read
      ) {
        m.is_read = true;
        changed   = true;
      }
    });
    if (changed) {
      await saveTable('messages', db.messages as any[]);
    }

    res.status(200).json({ success: true, data, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Message] getMessages error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch messages.' });
  }
}

// ─── sendMessage ──────────────────────────────────────────────────────────────

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const senderId = req.user!.id;
    const { receiver_id, content } = req.body as {
      receiver_id: string;
      content: string;
    };

    if (!receiver_id) {
      res.status(400).json({ success: false, error: 'receiver_id is required.' });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message content cannot be empty.' });
      return;
    }

    if (content.trim().length > 2000) {
      res.status(400).json({ success: false, error: 'Message cannot exceed 2000 characters.' });
      return;
    }

    if (senderId === receiver_id) {
      res.status(400).json({ success: false, error: 'You cannot message yourself.' });
      return;
    }

    // Check receiver exists and is active
    const db    = await getDB();
    const users = db.users as Array<{ id: string; is_active: boolean }>;
    const receiver = users.find((u) => u.id === receiver_id);
    if (!receiver || !receiver.is_active) {
      res.status(404).json({ success: false, error: 'Recipient not found.' });
      return;
    }

    // Check sender is not blocked by receiver
    const blocks = db.user_blocks as Array<{ blocker_id: string; blocked_id: string }>;
    const isBlocked = blocks.some(
      (b) => b.blocker_id === receiver_id && b.blocked_id === senderId
    );
    if (isBlocked) {
      res.status(403).json({ success: false, error: 'You cannot send messages to this user.' });
      return;
    }

    // Find or create conversation
    const conversations = db.conversations as ConversationRow[];
    const conversation  = findOrCreateConversation(conversations, senderId, receiver_id);

    const now     = new Date().toISOString();
    const message: MessageRow = {
      id:              uuidv4(),
      sender_id:       senderId,
      receiver_id,
      conversation_id: conversation.id,
      content:         content.trim(),
      is_read:         false,
      created_at:      now,
    };

    (db.messages as MessageRow[]).push(message);

    // Update conversation last_message
    conversation.last_message    = content.trim().substring(0, 100);
    conversation.last_message_at = now;
    conversation.updated_at      = now;

    await saveTable('messages', db.messages as any[]);
    await saveTable('conversations', db.conversations as any[]);

    // Real-time delivery to receiver
    emitToUser(receiver_id, 'message:new', {
      message,
      conversation_id: conversation.id,
    });

    res.status(201).json({ success: true, message, conversation_id: conversation.id });
  } catch (err) {
    console.error('[Message] sendMessage error:', err);
    res.status(500).json({ success: false, error: 'Could not send message.' });
  }
}

// ─── getUnreadCount ───────────────────────────────────────────────────────────

export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db    = await getDB();
    const count = (db.messages as MessageRow[]).filter(
      (m) => m.receiver_id === userId && !m.is_read
    ).length;

    res.status(200).json({ success: true, unreadCount: count });
  } catch (err) {
    console.error('[Message] getUnreadCount error:', err);
    res.status(500).json({ success: false, error: 'Could not get unread count.' });
  }
}

// ─── markAllRead ──────────────────────────────────────────────────────────────

export async function markAllRead(req: Request, res: Response): Promise<void> {
  try {
    const { userId, otherUserId } = req.params;
    const requesterId = req.user!.id;

    if (requesterId !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db       = await getDB();
    const messages = db.messages as MessageRow[];
    let   count    = 0;

    messages.forEach((m) => {
      // If otherUserId provided, mark only that conversation; otherwise mark all
      const matchesSender = otherUserId ? m.sender_id === otherUserId : true;
      if (m.receiver_id === userId && matchesSender && !m.is_read) {
        m.is_read = true;
        count++;
      }
    });

    if (count > 0) {
      await saveTable('messages', db.messages as any[]);
    }

    res.status(200).json({ success: true, markedRead: count });
  } catch (err) {
    console.error('[Message] markAllRead error:', err);
    res.status(500).json({ success: false, error: 'Could not mark messages as read.' });
  }
}
