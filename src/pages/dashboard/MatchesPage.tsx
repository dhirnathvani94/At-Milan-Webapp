import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Sparkles } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { getRecommendations } from '../../lib/actions/searchActions'
import ProfileCard from '../../components/ProfileCard'
import Spinner from '../../components/ui/Spinner'
import { ProfileGridSkeleton } from '../../components/ui/Skeletons'
import EmptyState from '../../components/ui/EmptyState'
import Tabs from '../../components/ui/Tabs'

export default function MatchesPage() {
  const navigate = useNavigate()
  const { user , loading: authLoading} = useAuthStore()
  const { socket } = useSocketStore()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (user?.id) {
      fetchMatches()
    }
  }, [user?.id])

  useEffect(() => {
    if (!socket || !user?.id) return
    const handleUpdate = () => {
      fetchMatches()
    }
    socket.on('interest:updated', handleUpdate)
    socket.on('interest:new', handleUpdate)
    return () => {
      socket.off('interest:updated', handleUpdate)
      socket.off('interest:new', handleUpdate)
    }
  }, [socket, user?.id])

  const fetchMatches = async () => {
    try {
      setLoading(true)
      const data = await getRecommendations((user?.id || ''), 50)
      setMatches(data)
    } catch (error) {
      console.error('Error fetching matches:', error)
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-900 flex items-center gap-2">
            Your Matches <Sparkles className="text-yellow-500" />
          </h1>
          <p className="text-gray-500">Profiles matching your partner preferences</p>
        </div>
      </div>

      <Tabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        tabs={[
          { id: 'all', label: 'All Matches' },
          { id: 'new', label: 'New This Week' }
        ]}
      />

      {matches.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
          {matches.map(profile => (
            <ProfileCard 
              key={(profile?.id || '')} 
              profile={profile} 
              currentUserId={(user?.id || '')} 
            />
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={<Heart size={48} />} 
          title="No matches found" 
          description="Update your partner preferences to get better matches that suit your requirements." 
          actionLabel="Update Preferences"
          onAction={() => navigate('/complete-profile')}
        />
      )}
    </div>
  )
}
