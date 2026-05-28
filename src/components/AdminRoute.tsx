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
        // Use role from auth store JWT — admin has no profile row
        // so we must NOT rely on /api/profiles/:id returning role
        const storeRole = user?.role
        
        if (storeRole !== 'admin') {
          // Double-check with backend only if store says not admin
          // to handle edge cases where JWT might be stale
          const profileRes = await fetch(
            apiUrl(`/api/profiles/${user!.id}`),
            { headers: getAuthHeaders() }
          )
          if (profileRes.ok) {
            const profileData = await profileRes.json()
            const isAdminUser = 
              profileData?.role === 'admin' || 
              profileData?.profile?.role === 'admin' ||
              profileData?.user?.role === 'admin'
            if (!isAdminUser) {
              setIsAdmin(false)
              setChecking(false)
              return
            }
          } else {
            // Profile not found and not admin in store
            setIsAdmin(false)
            setChecking(false)
            return
          }
        }
        
        // User is admin — fetch permissions
        try {
          const permRes = await fetch(
            apiUrl('/api/admin/my-permissions'),
            { headers: getAuthHeaders() }
          )
          const permData = permRes.ok ? await permRes.json() : null

          useAdminPermissions.setState({
            role: permData?.role || 'admin',
            permissions: permData?.permissions || ['/admin'],
            name: permData?.name || '',
            loaded: true,
          })
        } catch {
          useAdminPermissions.setState({
            role: 'master_admin',
            permissions: ['*'],
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
