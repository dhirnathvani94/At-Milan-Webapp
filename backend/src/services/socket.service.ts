import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../middleware/auth';

// ─── Module-level singletons ──────────────────────────────────────────────────

let io: SocketIOServer | null = null;

// userId → Set of socketIds (one user can have multiple tabs/devices)
const onlineUsers = new Map<string, Set<string>>();

// ─── Typed socket with user attached ─────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: 'user' | 'admin';
}

// ─── initSocket ───────────────────────────────────────────────────────────────

/**
 * Initialises Socket.IO on the given HTTP server.
 * Call this once from server.ts after creating the HTTP server.
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.IS_DEVELOPMENT
        ? [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']
        : [env.FRONTEND_URL],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── JWT auth middleware ────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      // Accept token from auth object or query string
      const token =
        (socket.handshake.auth as Record<string, string>)['token'] ||
        (socket.handshake.query['token'] as string | undefined);

      if (!token) {
        return next(new Error('Authentication required: no token provided.'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      if (!decoded.id || !decoded.email || !decoded.role) {
        return next(new Error('Authentication required: invalid token payload.'));
      }

      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId    = decoded.id;
      authSocket.userEmail = decoded.email;
      authSocket.userRole  = decoded.role;

      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('Authentication required: token expired.'));
      }
      return next(new Error('Authentication required: invalid token.'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, userRole } = socket;

    console.log(`[Socket] Connected: userId=${userId} socketId=${socket.id}`);

    // ── Track online user ──────────────────────────────────────────────────
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Send current online user list to the newly connected socket
    socket.emit('online:users', getOnlineUserIds());

    // Broadcast to everyone else that this user is online
    socket.broadcast.emit('user:online', { userId });

    // ── user:join ──────────────────────────────────────────────────────────
    socket.on('user:join', () => {
      // Already handled on connection; re-emit online list as convenience
      socket.emit('online:users', getOnlineUserIds());
    });

    // ── Admin room ─────────────────────────────────────────────────────────
    if (userRole === 'admin') {
      socket.join('admin:room');
      console.log(`[Socket] Admin ${userId} joined admin:room`);
    }

    // ── conversation:join ──────────────────────────────────────────────────
    socket.on('conversation:join', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const room = `conversation:${data.conversationId}`;
      socket.join(room);
      console.log(`[Socket] userId=${userId} joined room ${room}`);
    });

    // ── conversation:leave ─────────────────────────────────────────────────
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const room = `conversation:${data.conversationId}`;
      socket.leave(room);
      console.log(`[Socket] userId=${userId} left room ${room}`);
    });

    // ── typing:start ───────────────────────────────────────────────────────
    socket.on('typing:start', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit('typing:started', {
        conversationId: data.conversationId,
        userId,
      });
    });

    // ── typing:stop ────────────────────────────────────────────────────────
    socket.on('typing:stop', (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit('typing:stopped', {
        conversationId: data.conversationId,
        userId,
      });
    });

    // ── message:send ───────────────────────────────────────────────────────
    // Real persistence is handled by the messages REST controller.
    // This event is for real-time delivery only.
    socket.on(
      'message:send',
      (data: { conversationId: string; content: string; tempId?: string }) => {
        if (!data?.conversationId || !data?.content) return;

        const room = `conversation:${data.conversationId}`;
        // Broadcast to everyone in the room except the sender
        socket.to(room).emit('message:received', {
          conversationId: data.conversationId,
          senderId: userId,
          content: data.content,
          tempId: data.tempId ?? null,
          timestamp: new Date().toISOString(),
        });
      }
    );

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket] Disconnected: userId=${userId} socketId=${socket.id} reason=${reason}`
      );

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          // All tabs/devices disconnected — user is truly offline
          onlineUsers.delete(userId);
          socket.broadcast.emit('user:offline', { userId });
        }
      }
    });
  });

  console.log('[Socket] Socket.IO initialised.');
  return io;
}

// ─── getIO ────────────────────────────────────────────────────────────────────

/**
 * Returns the Socket.IO server instance, or null if not yet initialised.
 * Safe to call at any time; callers should guard with `if (io)`.
 */
export function getIO(): SocketIOServer | null {
  return io;
}

// ─── emitToUser ───────────────────────────────────────────────────────────────

/**
 * Emits an event to all sockets belonging to a specific user.
 * Safe to call even if the user is offline (no-op).
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (!sockets || sockets.size === 0) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, data);
  }
}

// ─── emitToAdmin ──────────────────────────────────────────────────────────────

/**
 * Emits an event to the admin:room (all connected admins).
 */
export function emitToAdmin(event: string, data: unknown): void {
  if (!io) return;
  io.to('admin:room').emit(event, data);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

/**
 * Check if a specific user is currently online.
 */
export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return !!sockets && sockets.size > 0;
}
