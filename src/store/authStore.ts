import { create } from 'zustand'
import type { Profile } from '../lib/types'
import { useSocketStore } from './socketStore'
import { getAuthHeaders, apiUrl } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  role?: string;    // Stored from JWT payload or login response — never derived later
}

interface Credits {
  id: string;
  user_id: string;
  free_monthly_limit: number;
  free_views_remaining: number;
  free_views_reset_date: string;
  paid_views_balance: number;
  paid_credits_expiry: string | null;
  paid_credits_purchased: number;
  total_unlocks_done: number;
  paid_credits_expiry_after_membership?: number | null;
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

// ─── Store ────────────────────────────────────────────────────────────────────

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

  // ─── fetchProfile ──────────────────────────────────────────────────────────
  fetchProfile: async (userId: string) => {
    try {
      const response = await fetch(apiUrl(`/api/profiles/${userId}`), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        set({ profile: null })
        return
      }

      const raw = await response.json()

      // The backend can return the profile in several shapes:
      //   { profile: {...} }       — wrapped
      //   { data: {...} }          — wrapped differently
      //   { success:true, ...fields } — profile spread at top level
      //   {...fields}              — bare profile object
      // We normalise all shapes to a single profile object.
      let profile: Profile | null = null

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (raw.profile && typeof raw.profile === 'object') {
          profile = raw.profile as Profile
        } else if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
          profile = raw.data as Profile
        } else if (raw.id || raw.user_id || raw.first_name) {
          // Bare profile or top-level object
          profile = raw as Profile
        }
      }

      set({ profile })

      // If the API response includes a user object with role,
      // update user.role in the auth store to stay consistent.
      // Backend shape: { success, user: { id, email, role }, profile: {...} }
      if (raw.user && typeof raw.user.role === 'string' && raw.user.role) {
        set((state) => ({
          user: state.user ? { ...state.user, role: raw.user.role } : state.user,
        }))
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      set({ profile: null })
    }
  },

  // ─── refreshProfile ────────────────────────────────────────────────────────
  refreshProfile: async () => {
    const user = get().user
    if (user?.id) {
      await get().fetchProfile(user.id)
    }
  },

  // ─── refreshCredits ────────────────────────────────────────────────────────
  refreshCredits: async () => {
    const user = get().user
    if (!user?.id) return

    try {
      const response = await fetch(
        apiUrl(`/api/credits/${user.id}?t=${Date.now()}`),
        {
          headers: {
            ...getAuthHeaders(),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      )

      if (response.ok) {
        const raw = await response.json()
        // Credits can be returned as { credits: {...} } or bare object
        let credits: Credits | null = null
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          credits = (raw.credits ?? raw) as Credits
        }
        set({ credits })
      } else {
        set({ credits: null })
      }
    } catch (error) {
      console.error('Error fetching credits:', error)
      set({ credits: null })
    }
  },

  // ─── signOut ───────────────────────────────────────────────────────────────
  signOut: async () => {
    useSocketStore.getState().disconnect()
    localStorage.removeItem('atmilan-token')
    sessionStorage.removeItem('hasSeenExpiryPopup')
    sessionStorage.removeItem('hasSeenCreditLowPopup')
    set({ user: null, profile: null, credits: null })
    try {
      const { useAdminPermissions } = await import('./adminPermissionStore')
      useAdminPermissions.getState().reset()
    } catch { /* ignore */ }
  },

  // ─── initialize ────────────────────────────────────────────────────────────
  //
  // Called on app boot AND after every login (LoginPage resets initialized=false
  // then calls this). On boot it reads the JWT from localStorage.  On post-login
  // the token was already stored by loginUser() / socialLoginUser().
  //
  // ROLE STRATEGY:
  //   1. Decode JWT — it now contains { id, email, role } (backend embeds it).
  //   2. Set user immediately with the role from the JWT payload.
  //   3. Fetch the profile in the background — the profile's `role` field also
  //      comes back from the DB, but we do NOT wait for it to determine admin
  //      routing.  LoginPage reads user.role directly after initialize().
  //
  initialize: async () => {
    if (get().initialized) return

    try {
      const token = localStorage.getItem('atmilan-token')
      if (!token) return

      // Safely decode JWT payload (base64url middle segment)
      let payload: any = null
      try {
        const base64 = token.split('.')[1]
        if (!base64) throw new Error('malformed token')
        payload = JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')))
      } catch {
        localStorage.removeItem('atmilan-token')
        return
      }

      if (!payload || !payload.id) return

      // Check expiry
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        localStorage.removeItem('atmilan-token')
        return
      }

      // ── Set user WITH role from JWT — no extra round-trip needed ─────────
      const userFromToken: User = {
        id:    payload.id,
        email: payload.email ?? '',
        role:  payload.role  ?? 'user',   // role is in JWT because backend embeds it
      }
      set({ user: userFromToken })

      // ── Fetch profile — never crashes the app ─────────────────────────────
      try {
        await get().fetchProfile(payload.id)
      } catch (profileError) {
        console.error('Auth init — profile fetch failed:', profileError)
        set({ profile: null })
      }

      // ── If profile loaded and has a role, keep user.role consistent ───────
      // (profile.role comes from DB and is the authoritative source)
      const loadedProfile = get().profile
      if (loadedProfile && typeof loadedProfile.role === 'string' && loadedProfile.role) {
        set((state) => ({
          user: state.user ? { ...state.user, role: loadedProfile.role } : state.user,
        }))
      }

      // ── Fetch credits ─────────────────────────────────────────────────────
      try {
        await get().refreshCredits()
      } catch (creditsError) {
        console.error('Auth init — credits fetch failed:', creditsError)
        set({ credits: null })
      }

      // ── Connect socket ────────────────────────────────────────────────────
      try {
        useSocketStore.getState().connect()
      } catch (socketError) {
        console.error('Auth init — socket connect failed:', socketError)
      }

    } catch (error) {
      console.error('Auth initialization error:', error)
      localStorage.removeItem('atmilan-token')
      set({ user: null, profile: null, credits: null })
    } finally {
      // Always unblock the app — never stay stuck in loading state
      set({ loading: false, initialized: true })
    }
  },
}))
