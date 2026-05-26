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
        } else {
          // Non-ok response — silently set credits to null, do not crash
          set({ credits: null })
        }
      } catch (error) {
        console.error('Error fetching credits:', error)
        set({ credits: null })
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
      if (!token) return;

      let payload: any = null
      try {
        // Safely decode — malformed/expired tokens are removed
        payload = JSON.parse(atob(token.split('.')[1]))
      } catch {
        // Token is corrupt — wipe it so it never causes issues again
        localStorage.removeItem('atmilan-token')
        return;
      }

      if (!payload || !payload.id) return;

      // Check token expiry
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        // Token expired — clear it
        localStorage.removeItem('atmilan-token')
        return;
      }

      // Set user from JWT payload
      set({ user: { id: payload.id, email: payload.email } as any })

      // Fetch profile — failure sets profile to null, never crashes
      try {
        await get().fetchProfile(payload.id)
      } catch (profileError) {
        console.error('Auth init — profile fetch failed:', profileError)
        set({ profile: null })
      }

      // Fetch credits — failure sets credits to null, never crashes
      try {
        await get().refreshCredits()
      } catch (creditsError) {
        console.error('Auth init — credits fetch failed:', creditsError)
        set({ credits: null })
      }

      // Connect socket — failure is non-fatal
      try {
        useSocketStore.getState().connect()
      } catch (socketError) {
        console.error('Auth init — socket connect failed:', socketError)
      }

    } catch (error) {
      console.error('Auth initialization error:', error)
      // On any unexpected error, clear auth state completely
      localStorage.removeItem('atmilan-token')
      set({ user: null, profile: null, credits: null })
    } finally {
      // Always mark as done — app must never be stuck in loading state
      set({ loading: false, initialized: true })
    }
  }
}))
