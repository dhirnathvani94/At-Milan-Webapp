import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Search } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { getShortlistedProfiles } from '../../lib/actions/dashboardActions'
import ProfileCard from '../../components/ProfileCard'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { ProfileGridSkeleton } from '../../components/ui/Skeletons'

export default function ShortlistPage() {
  const navigate = useNavigate()
  const { user , loading: authLoading} = useAuthStore()
  const { socket } = useSocketStore()
  const [shortlistedProfiles, setShortlistedProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetchShortlisted()
    }
  }, [user?.id])

  useEffect(() => {
    if (!socket || !user?.id) return
    const handleUpdate = () => {
      fetchShortlisted()
    }
    socket.on('shortlist:updated', handleUpdate)
    socket.on('interest:updated', handleUpdate)
    return () => {
      socket.off('shortlist:updated', handleUpdate)
      socket.off('interest:updated', handleUpdate)
    }
  }, [socket, user?.id])

  const fetchShortlisted = async () => {
    try {
      setLoading(true)
      const profiles = await getShortlistedProfiles((user?.id || ''))
      setShortlistedProfiles(profiles)
    } catch (error) {
      console.error('Error fetching shortlist:', error)
    } finally {
      setLoading(false)
    }
  }

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProfileGridSkeleton count={8} />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-gray-900 flex items-center gap-2">
          Shortlisted Profiles <Heart className="text-red-500 fill-red-500" />
        </h1>
        <p className="text-gray-500">Profiles you have saved for later</p>
      </div>

      {shortlistedProfiles.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {shortlistedProfiles.map(profile => (
            <ProfileCard 
              key={(profile?.id || '')} 
              profile={profile} 
              currentUserId={(user?.id || '')}
              onInterestSent={fetchShortlisted} // Refresh if needed
            />
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={<Search size={48} />} 
          title="Your shortlist is empty" 
          description="You haven't shortlisted anyone yet. Browse profiles to find your match!" 
          actionLabel="Browse Profiles"
          onAction={() => navigate('/search')}
        />
      )}
    </div>
  )
}
