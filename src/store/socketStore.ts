import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from './authStore'

interface SocketState {
  socket: Socket | null
  connected: boolean
  onlineUsers: string[]
  typingUsers: Record<string, boolean>
  _pendingListeners: Array<{ event: string; callback: (...args: any[]) => void }>
  _reconnectCount: number
  connect: () => void
  disconnect: () => void
  joinConversation: (otherUserId: string) => void
  leaveConversation: (otherUserId: string) => void
  emitTypingStart: (toUserId: string) => void
  emitTypingStop: (toUserId: string) => void
  isUserOnline: (userId: string) => boolean
  on: (event: string, callback: (...args: any[]) => void) => void
  off: (event: string, callback: (...args: any[]) => void) => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  onlineUsers: [],
  typingUsers: {},
  _pendingListeners: [],
  _reconnectCount: 0,

  connect: () => {
    const { user } = useAuthStore.getState()
    if (!user) return

    // Prevent duplicate connections
    const existing = get().socket
    if (existing?.connected) return

    const token = localStorage.getItem('atmilan-token')

    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      auth: { token },
      query: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id)
      set({ connected: true, _reconnectCount: (get()._reconnectCount || 0) + 1 })
      // Re-register any pending listeners
      const pending = get()._pendingListeners;
      if (pending.length > 0) {
        pending.forEach(({ event, callback }) => socket.on(event, callback));
        set({ _pendingListeners: [] });
      }
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected')
      // Don't update state on every disconnect to prevent re-render churn
      // State will update on next connect
    })

    socket.on('online:users', (users: string[]) => {
      set({ onlineUsers: users })
    })

    socket.on('user:online', ({ userId }: { userId: string }) => {
      set((state) => {
        if (state.onlineUsers.includes(userId)) return state
        return { onlineUsers: [...state.onlineUsers, userId] }
      })
    })

    socket.on('user:offline', ({ userId }: { userId: string }) => {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== userId)
      }))
    })

    socket.on('typing:started', ({ fromUserId }: { fromUserId: string }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [fromUserId]: true }
      }))
    })

    socket.on('typing:stopped', ({ fromUserId }: { fromUserId: string }) => {
      set((state) => {
        const updated = { ...state.typingUsers }
        delete updated[fromUserId]
        return { typingUsers: updated }
      })
    })

    socket.on('credits:updated', (data: any) => {
      // Refresh credits when server notifies this user's credits changed
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        if (data && data.credits) {
          authStore.setCredits({ ...authStore.credits, ...data.credits } as any);
        } else {
          authStore.refreshCredits();
        }
      }
    })

    socket.on('profile:credits-updated', (data: any) => {
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        authStore.refreshCredits();
        authStore.refreshProfile();
      }
    })

    // When admin approves/rejects a profile, update store directly — NO API call.
    // The server sends the full updated profile in the payload.
    // Calling refreshProfile() here causes a race: navigate('/dashboard') fires before
    // the async fetch completes, ProtectedRoute sees stale profile, bounces user back.
    socket.on('profile:updated', (data: any) => {
      const authStore = useAuthStore.getState();
      if (authStore.user && data?.id === authStore.user.id) {
        authStore.setProfile(data);
      }
    })

    // When admin approves a reactivation request, immediately mark profile as active
    // in the global store. ReactivationPendingPage watches profile state changes and
    // navigates automatically — no component-level socket listener needed for navigation.
    socket.on('profile:reactivated', () => {
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        const current = authStore.profile;
        if (current) {
          authStore.setProfile({
            ...current,
            profile_status: 'active',
            reactivation_status: 'approved',
            match_confirmed: false,
            match_type: null,
          });
        }
        // NOTE: Do NOT call refreshProfile() here.
        // refreshProfile() is an async HTTP fetch — if it resolves with slightly stale
        // data (race vs. DB write), it overwrites our setProfile() with the old status,
        // causing ProtectedRoute to bounce the user back to /reactivation-pending.
        // The dashboard fetches fresh data naturally after it mounts.
      }
    })


    // When admin approves/rejects a document, refresh profile in real-time
    socket.on('document:status-changed', (data: any) => {
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        authStore.refreshProfile();
      }
    })


    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, onlineUsers: [], typingUsers: {} })
    }
  },

  joinConversation: (otherUserId: string) => {
    const { socket } = get()
    if (socket?.connected) socket.emit('conversation:join', otherUserId)
  },

  leaveConversation: (otherUserId: string) => {
    const { socket } = get()
    if (socket?.connected) socket.emit('conversation:leave', otherUserId)
  },

  emitTypingStart: (toUserId: string) => {
    const { socket } = get()
    if (socket?.connected) socket.emit('typing:start', { toUserId })
  },

  emitTypingStop: (toUserId: string) => {
    const { socket } = get()
    if (socket?.connected) socket.emit('typing:stop', { toUserId })
  },

  isUserOnline: (userId: string) => {
    return get().onlineUsers.includes(userId)
  },

  on: (event: string, callback: (...args: any[]) => void) => {
    const { socket } = get()
    if (socket?.connected) {
      socket.on(event, callback)
    } else {
      // Queue listener for when socket connects
      set((state) => ({ _pendingListeners: [...state._pendingListeners, { event, callback }] }))
    }
  },

  off: (event: string, callback: (...args: any[]) => void) => {
    const { socket } = get()
    if (socket) socket.off(event, callback)
    // Also remove from pending
    set((state) => ({ _pendingListeners: state._pendingListeners.filter(l => !(l.event === event && l.callback === callback)) }))
  },
}))
