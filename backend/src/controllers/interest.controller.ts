import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../db/database';
import { emitToUser, emitToAdmin } from '../services/socket.service';
import { createNotification } from './notification.controller';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  profile_photo?: string | null;
  city?: string;
  state?: string;
  occupation?: string;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function profilePreview(profile: ProfileRow) {
  return {
    user_id:       profile.user_id,
    first_name:    profile.first_name,
    last_name:     profile.last_name,
    gender:        profile.gender,
    date_of_birth: profile.date_of_birth,
    profile_photo: profile.profile_photo ?? null,
    city:          profile.city ?? null,
    state:         profile.state ?? null,
    occupation:    profile.occupation ?? null,
  };
}

function paginate<T>(arr: T[], page: number, limit: number) {
  const total      = arr.length;
  const totalPages = Math.ceil(total / limit);
  const data       = arr.slice((page - 1) * limit, page * limit);
  return { data, total, page, limit, totalPages };
}

// ─── sendInterest ─────────────────────────────────────────────────────────────

export async function sendInterest(req: Request, res: Response): Promise<void> {
  try {
    const senderId   = req.user!.id;
    const { receiver_id } = req.body as { receiver_id: string };

    if (!receiver_id) {
      res.status(400).json({ success: false, error: 'receiver_id is required.' });
      return;
    }

    if (senderId === receiver_id) {
      res.status(400).json({ success: false, error: 'You cannot send interest to yourself.' });
      return;
    }

    const db       = await getDB();
    const interests = db.interests as InterestRow[];

    // Check not already sent
    const existing = interests.find(
      (i) => i.sender_id === senderId && i.receiver_id === receiver_id
    );
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'You have already sent an interest to this profile.',
        interest: existing,
      });
      return;
    }

    // Check receiver exists and is active
    const users = db.users as Array<{ id: string; is_active: boolean }>;
    const receiver = users.find((u) => u.id === receiver_id);
    if (!receiver || !receiver.is_active) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const now      = new Date().toISOString();
    const interest: InterestRow = {
      id:          uuidv4(),
      sender_id:   senderId,
      receiver_id,
      status:      'pending',
      created_at:  now,
      updated_at:  now,
    };

    interests.push(interest);
    saveDB(db);

    // Get sender profile for notification payload
    const profiles  = db.profiles as ProfileRow[];
    const senderProfile = profiles.find((p) => p.user_id === senderId);
    const senderName    = senderProfile
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : 'Someone';

    // Real-time: notify receiver
    emitToUser(receiver_id, 'interest:received', {
      interest,
      sender: senderProfile ? profilePreview(senderProfile) : null,
    });

    // Real-time: notify admin room
    emitToAdmin('admin:interest-sent', {
      interest,
      senderName,
    });

    // Persistent notification for receiver
    createNotification(
      receiver_id,
      'interest',
      'New Interest Received',
      `${senderName} has sent you an interest.`,
      { interest_id: interest.id, sender_id: senderId }
    );

    res.status(201).json({ success: true, interest });
  } catch (err) {
    console.error('[Interest] sendInterest error:', err);
    res.status(500).json({ success: false, error: 'Could not send interest.' });
  }
}

// ─── respondToInterest ────────────────────────────────────────────────────────

export async function respondToInterest(req: Request, res: Response): Promise<void> {
  try {
    const { id }     = req.params;
    const userId     = req.user!.id;
    const { status } = req.body as { status: 'accepted' | 'declined' };

    if (!['accepted', 'declined'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be "accepted" or "declined".' });
      return;
    }

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const idx       = interests.findIndex((i) => i.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Interest not found.' });
      return;
    }

    const interest = interests[idx]!;

    // Only the receiver can respond
    if (interest.receiver_id !== userId) {
      res.status(403).json({ success: false, error: 'Only the receiver can respond to this interest.' });
      return;
    }

    if (interest.status !== 'pending') {
      res.status(409).json({ success: false, error: `Interest already ${interest.status}.` });
      return;
    }

    interest.status     = status;
    interest.updated_at = new Date().toISOString();
    saveDB(db);

    // Get receiver profile for notification
    const profiles       = db.profiles as ProfileRow[];
    const receiverProfile = profiles.find((p) => p.user_id === userId);
    const receiverName    = receiverProfile
      ? `${receiverProfile.first_name} ${receiverProfile.last_name}`
      : 'Someone';

    // Real-time: notify sender
    const event = status === 'accepted' ? 'interest:accepted' : 'interest:declined';
    emitToUser(interest.sender_id, event, {
      interest,
      receiver: receiverProfile ? profilePreview(receiverProfile) : null,
    });

    // Persistent notification for sender
    const title   = status === 'accepted' ? 'Interest Accepted!' : 'Interest Declined';
    const message = status === 'accepted'
      ? `${receiverName} has accepted your interest.`
      : `${receiverName} has declined your interest.`;

    createNotification(
      interest.sender_id,
      'interest_response',
      title,
      message,
      { interest_id: interest.id, receiver_id: userId, status }
    );

    res.status(200).json({ success: true, interest });
  } catch (err) {
    console.error('[Interest] respondToInterest error:', err);
    res.status(500).json({ success: false, error: 'Could not respond to interest.' });
  }
}

// ─── getReceivedInterests ─────────────────────────────────────────────────────

export async function getReceivedInterests(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    // Only owner or admin
    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(50, parseInt((req.query['limit'] as string) ?? '20', 10));
    const statusFilter = req.query['status'] as string | undefined;

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const profiles  = db.profiles as ProfileRow[];

    let received = interests
      .filter((i) => i.receiver_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (statusFilter) {
      received = received.filter((i) => i.status === statusFilter);
    }

    const paged = paginate(received, page, limit);

    const data = paged.data.map((i) => ({
      ...i,
      sender: profilePreview(
        profiles.find((p) => p.user_id === i.sender_id) ?? ({} as ProfileRow)
      ),
    }));

    res.status(200).json({ success: true, ...paged, data });
  } catch (err) {
    console.error('[Interest] getReceivedInterests error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch received interests.' });
  }
}

// ─── getSentInterests ─────────────────────────────────────────────────────────

export async function getSentInterests(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page']  as string) ?? '1',  10));
    const limit = Math.min(50, parseInt((req.query['limit'] as string) ?? '20', 10));
    const statusFilter = req.query['status'] as string | undefined;

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const profiles  = db.profiles as ProfileRow[];

    let sent = interests
      .filter((i) => i.sender_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (statusFilter) {
      sent = sent.filter((i) => i.status === statusFilter);
    }

    const paged = paginate(sent, page, limit);

    const data = paged.data.map((i) => ({
      ...i,
      receiver: profilePreview(
        profiles.find((p) => p.user_id === i.receiver_id) ?? ({} as ProfileRow)
      ),
    }));

    res.status(200).json({ success: true, ...paged, data });
  } catch (err) {
    console.error('[Interest] getSentInterests error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch sent interests.' });
  }
}

// ─── getAllSentInterests ──────────────────────────────────────────────────────

export async function getAllSentInterests(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;

    if (req.user!.id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const profiles  = db.profiles as ProfileRow[];

    const sent = interests
      .filter((i) => i.sender_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((i) => ({
        ...i,
        receiver: profilePreview(
          profiles.find((p) => p.user_id === i.receiver_id) ?? ({} as ProfileRow)
        ),
      }));

    res.status(200).json({ success: true, data: sent, total: sent.length });
  } catch (err) {
    console.error('[Interest] getAllSentInterests error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch all sent interests.' });
  }
}

// ─── getInterestById ──────────────────────────────────────────────────────────

export async function getInterestById(req: Request, res: Response): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user!.id;

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const interest  = interests.find((i) => i.id === id);

    if (!interest) {
      res.status(404).json({ success: false, error: 'Interest not found.' });
      return;
    }

    // Only sender, receiver, or admin can view
    if (
      interest.sender_id   !== userId &&
      interest.receiver_id !== userId &&
      req.user!.role       !== 'admin'
    ) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const profiles = db.profiles as ProfileRow[];
    res.status(200).json({
      success: true,
      interest: {
        ...interest,
        sender:   profilePreview(profiles.find((p) => p.user_id === interest.sender_id)   ?? ({} as ProfileRow)),
        receiver: profilePreview(profiles.find((p) => p.user_id === interest.receiver_id) ?? ({} as ProfileRow)),
      },
    });
  } catch (err) {
    console.error('[Interest] getInterestById error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch interest.' });
  }
}

// ─── deleteInterest ───────────────────────────────────────────────────────────

export async function deleteInterest(req: Request, res: Response): Promise<void> {
  try {
    const { id }  = req.params;
    const userId  = req.user!.id;

    const db        = await getDB();
    const interests = db.interests as InterestRow[];
    const idx       = interests.findIndex((i) => i.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Interest not found.' });
      return;
    }

    const interest = interests[idx]!;

    // Only sender can delete
    if (interest.sender_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only the sender can delete this interest.' });
      return;
    }

    interests.splice(idx, 1);
    saveDB(db);

    res.status(200).json({ success: true, message: 'Interest deleted.' });
  } catch (err) {
    console.error('[Interest] deleteInterest error:', err);
    res.status(500).json({ success: false, error: 'Could not delete interest.' });
  }
}
