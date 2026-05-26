import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAdminPermissions } from '../store/adminPermissionStore'
import { PageSkeleton } from './ui/Skeletons'
import { getAuthHeaders, apiUrl } from '../lib/api'

export default function AdminRoute() {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  const { hasPermission, loaded: permLoaded } = useAdminPermissions()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) {
      setChecking(false)
      return
    }

    async function init() {
      try {
        // Step 1: Verify this user has admin role in their profile
        const profileRes = await fetch(apiUrl(`/api/profiles/${user!.id}`), { headers: getAuthHeaders() })
        if (!profileRes.ok) {
          setIsAdmin(false)
          setChecking(false)
          return
        }
        const profile = await profileRes.json()
        const isAdminUser = profile?.role === 'admin' || profile?.profile?.role === 'admin'
        if (!isAdminUser) {
          setIsAdmin(false)
          setChecking(false)
          return
        }

        // Step 2: Fetch EXACT permissions from server
        // This is the single source of truth — no defaults, no fallbacks to ['*']
        try {
          const permRes = await fetch(apiUrl('/api/admin/my-permissions'), { headers: getAuthHeaders() })
          const permData = permRes.ok ? await permRes.json() : null

          useAdminPermissions.setState({
            role: permData?.role || 'admin',
            // CRITICAL: never default to ['*'] — use exactly what server returns
            permissions: permData?.permissions || ['/admin'],
            name: permData?.name || '',
            loaded: true,
          })
        } catch {
          // Network error fetching permissions — give minimal access only
          useAdminPermissions.setState({
            role: 'admin',
            permissions: ['/admin'],
            loaded: true,
          })
        }

        setIsAdmin(true)
      } catch {
        setIsAdmin(false)
      } finally {
        setChecking(false)
      }
    }

    init()
  }, [user?.id])

  if (loading || checking) {
    return (
      <div className="min-h-screen pt-20 bg-gray-50">
        <PageSkeleton />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  if (!permLoaded) {
    return (
      <div className="min-h-screen pt-20 bg-gray-50">
        <PageSkeleton />
      </div>
    )
  }

  // Block access to pages not in this admin's permission list
  if (location.pathname !== '/admin' && !hasPermission(location.pathname)) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
