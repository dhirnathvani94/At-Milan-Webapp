import { create } from 'zustand'
import type { Profile } from '../lib/types'
import { useSocketStore } from './socketStore'
import { getAuthHeaders, apiUrl } from '../lib/api'

interface User {
  id: string;
  email: string;
}

interface Credits {
  id: string;
  user_id: string;
  free_monthly_limit: number;
  free_views_remaining: number;
  free_views_reset_date: string;
  paid_views_balance: number;
  paid_credits_expiry: string | null; // null = tied to membership (no independent expiry)
  paid_credits_purchased: number;
  total_unlocks_done: number;
  paid_credits_expiry_after_membership?: number | null; // days to expire after membership ends
}

interface AuthState {
  user: User | null
  profile: Profile | null
  credits: Credits | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setCredits: (credits: Credits | null) => void
  setLoading: (loading: boolean) => void
  fetchProfile: (userId: string) => Promise<void>
  refreshProfile: () => Promise<void>
  refreshCredits: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  credits: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setCredits: (credits) => set({ credits }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/profiles/${userId}`), {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch profile')
      const data = await response.json()
      set({ profile: data })
    } catch (error) {
      console.error('Error fetching profile:', error)
      set({ profile: null })
    }
  },

  refreshProfile: async () => {
    const user = get().user
    if (user) {
      await get().fetchProfile((user?.id || ''))
    }
  },

  refreshCredits: async () => {
    const user = get().user
    if (user) {
      try {
        const response = await fetch(apiUrl(`/api/credits/${(user?.id || '')}?t=${Date.now()}`), {
          headers: {
            ...getAuthHeaders(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
        })
        if (response.ok) {
          const data = await response.json()
          set({ credits: data })
        }
      } catch (error) {
        console.error('Error fetching credits:', error)
      }
    }
  },

  signOut: async () => {
    useSocketStore.getState().disconnect()
    localStorage.removeItem('atmilan-token')
    sessionStorage.removeItem('hasSeenExpiryPopup')
    sessionStorage.removeItem('hasSeenCreditLowPopup')
    set({ user: null, profile: null, credits: null })
    // Reset admin permissions so next login gets fresh permissions
    try {
      const { useAdminPermissions } = await import('./adminPermissionStore')
      useAdminPermissions.getState().reset()
    } catch { /* ignore — permissions will be re-fetched on next admin login */ }
  },

  initialize: async () => {
    if (get().initialized) return;

    try {
      const token = localStorage.getItem('atmilan-token')
      if (token) {
        let payload: any = null
        try {
          // Safely decode — malformed/expired tokens are removed
          payload = JSON.parse(atob(token.split('.')[1]))
        } catch {
          // Token is corrupt — wipe it so it never causes issues again
          localStorage.removeItem('atmilan-token')
        }

        if (payload && payload.id) {
          // Check token expiry
          const now = Math.floor(Date.now() / 1000)
          if (payload.exp && payload.exp < now) {
            // Token expired — clear it
            localStorage.removeItem('atmilan-token')
          } else {
            set({ user: { id: payload.id, email: payload.email } as any })
            await get().fetchProfile(payload.id)
            await get().refreshCredits()
            useSocketStore.getState().connect()
          }
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      // On any unexpected error, clear the token to prevent future loops
      localStorage.removeItem('atmilan-token')
    } finally {
      set({ loading: false, initialized: true })
    }
  }
}))
