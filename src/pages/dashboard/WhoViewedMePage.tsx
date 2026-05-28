import { useState, useEffect } from 'react'
import { Eye, ChevronLeft, Lock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { getRecentViewers, getDashboardStats } from '../../lib/actions/dashboardActions'
import Card from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ProfileCard from '../../components/ProfileCard'
import { WhoViewedMeSkeleton } from '../../components/ui/Skeletons'

export default function WhoViewedMePage() {
  const navigate = useNavigate()
  const { user, profile , loading: authLoading} = useAuthStore()
  const { socket } = useSocketStore()
  const [viewers, setViewers] = useState<any[]>([])
  const [totalViews, setTotalViews] = useState(0)
  const [loading, setLoading] = useState(true)

  const isPremium = profile?.is_premium || false;
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : null;
  const isPremiumActive = isPremium && premiumEnd && premiumEnd > new Date();

  useEffect(() => {
    if (user?.id) {
      fetchViewers()
    }
  }, [user?.id])

  useEffect(() => {
    if (!socket || !user?.id) return
    const handleProfileViewed = (data: any) => {
      // Only refresh if the viewed user is the current user
      if (data?.viewedId === user?.id || data?.viewedAt) {
        fetchViewers()
      }
    }
    socket.on('profile:viewed', handleProfileViewed)
    return () => {
      socket.off('profile:viewed', handleProfileViewed)
    }
  }, [socket, user?.id])

  const fetchViewers = async () => {
    try {
      setLoading(true)
      const [data, stats] = await Promise.all([
        getRecentViewers((user?.id || ''), 50),
        getDashboardStats((user?.id || ''))
      ]);
      setViewers(data)
      setTotalViews(stats.profileViews)
    } catch (error) {
      console.error('Error fetching viewers:', error)
    } finally {
      setLoading(false)
    }
  }

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <WhoViewedMeSkeleton count={8} />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors mt-1">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2 mb-2">
              Who Viewed My Profile <span className="text-purple-500">👀</span>
            </h1>
            <div className="inline-block bg-[#8B1A1A] text-white text-sm font-bold px-4 py-1.5 rounded-md shadow-sm mb-2">
              {totalViews} Total Views
            </div>
            <p className="text-gray-500">People who recently visited your profile</p>
          </div>
        </div>
      </div>

      {viewers.length > 0 ? (
        <div className="relative">
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 ${!isPremiumActive ? 'blur-[8px] pointer-events-none select-none opacity-60' : ''}`}>
            {viewers.map((view) => (
              <ProfileCard 
                key={view.id} 
                profile={view.viewer} 
                currentUserId={(user?.id || '')} 
              />
            ))}
          </div>

          {!isPremiumActive && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-gray-100 text-center max-w-sm mx-4 transform transition-all sticky top-20">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-[#B22222] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                  <Lock className="text-white" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Unlock Profile Views</h3>
                <p className="text-gray-500 text-sm mb-6">Upgrade to premium to see exactly who is interested in your profile and viewing your details.</p>
                <Link to="/membership">
                  <Button variant="primary" fullWidth className="py-3 shadow-lg hover:shadow-xl transition-all">
                    Unlock View My Profile
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState 
          icon={<Eye size={48} />} 
          title="No profile views yet" 
          description="Try updating your profile with more photos and details to attract more visitors." 
          actionLabel="Complete Profile"
          onAction={() => navigate('/complete-profile')}
        />
      )}
    </div>
  )
}
