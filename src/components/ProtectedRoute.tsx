import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import { PageSkeleton } from './ui/Skeletons'

export default function ProtectedRoute() {
  const { user, profile, loading, setProfile } = useAuthStore()
  const location = useLocation()

  // Real-time: when admin approves/rejects docs, server emits profile:updated
  // socketStore already calls setProfile(data) synchronously for profile:updated events.
  // This secondary listener handles the case where ProtectedRoute is mounted while waiting.
  useEffect(() => {
    if (!user) return

    const handleProfileUpdated = (updatedProfile: any) => {
      if (updatedProfile?.id === user.id) {
        setProfile(updatedProfile)
      }
    }

    // Safety net for reactivation approval — synchronously update profile_status to 'active'
    // so ProtectedRoute does NOT bounce user back to /reactivation-pending
    const handleReactivated = () => {
      const current = useAuthStore.getState().profile
      if (current) {
        setProfile({
          ...current,
          profile_status: 'active',
          reactivation_status: 'approved',
          match_confirmed: false,
          match_type: null,
        })
      }
    }

    // Subscribe reactively — handles case where socket connects after mount
    const unsubSocket = useSocketStore.subscribe((state) => {
      if (state.socket) {
        state.socket.off('profile:updated', handleProfileUpdated)
        state.socket.on('profile:updated', handleProfileUpdated)
        state.socket.off('profile:reactivated', handleReactivated)
        state.socket.on('profile:reactivated', handleReactivated)
      }
    })
    // Also register on currently connected socket if already available
    const currentSocket = useSocketStore.getState().socket
    if (currentSocket) {
      currentSocket.off('profile:updated', handleProfileUpdated)
      currentSocket.on('profile:updated', handleProfileUpdated)
      currentSocket.off('profile:reactivated', handleReactivated)
      currentSocket.on('profile:reactivated', handleReactivated)
    }

    return () => {
      unsubSocket()
      const s = useSocketStore.getState().socket
      if (s) {
        s.off('profile:updated', handleProfileUpdated)
        s.off('profile:reactivated', handleReactivated)
      }
    }
  }, [user?.id])

  // Still initialising — show skeleton, never crash
  if (loading) return (
    <div className="min-h-screen pt-20 bg-gray-50">
      <PageSkeleton />
    </div>
  )

  // No authenticated user — redirect to login
  if (!user) return <Navigate to="/login" replace />

  // Admin bypasses approval check — guard against null/undefined profile safely
  if (profile != null && profile.role === 'admin') return <Outlet />

  // Profile not yet approved by admin — send to waiting page
  // Treat missing is_verified field as false (profile may be partially loaded)
  if (!profile || profile.is_verified !== true) {
    return <Navigate to="/pending-approval" replace />
  }

  // Profile paused/engaged/married — send to reactivation page
  // Exception: if admin just approved (reactivation_status === 'approved'), let them through
  // even if profile_status hasn't been updated in the store yet (timing gap)
  const profileStatus: string = profile.profile_status ?? ''
  const reactivationStatus: string = profile.reactivation_status ?? ''
  const blockedStatuses = ['yellow', 'red', 'engaged', 'married']
  if (blockedStatuses.includes(profileStatus) && reactivationStatus !== 'approved') {
    return <Navigate to="/reactivation-pending" replace />
  }

  return <Outlet />
}
