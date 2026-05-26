import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Send, Eye, Star, Users, ChevronRight, Loader2, ShieldCheck, Mail, Phone, Camera, AlertTriangle, Lock } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { 
  getDashboardStats, 
  getRecentViewers
} from '../../lib/actions/dashboardActions'
import {
  getRecommendations, 
  getNewMembers, 
} from '../../lib/actions/searchActions'

import ProfileCard from '../../components/ProfileCard'
import Card from '../../components/ui/Card'
import ProgressBar from '../../components/ui/ProgressBar'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import CreditWidget from '../../components/credits/CreditWidget'
import MembershipWidget from '../../components/credits/MembershipWidget'
import MembershipExpiryPopup from '../../components/credits/MembershipExpiryPopup'
import CreditLowPopup from '../../components/credits/CreditLowPopup'
import ProfilePhotoFrame, { ProfileStatus } from '../../components/ProfilePhotoFrame'
import { getRelativeTime } from '../../lib/utils'
import { DashboardSkeleton } from '../../components/ui/Skeletons'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, profile, refreshCredits , loading: authLoading} = useAuthStore()
  const { socket } = useSocketStore()
  const [stats, setStats] = useState({
    interestsReceived: 0,
    interestsSent: 0,
    profileViews: 0,
    shortlistedBy: 0
  })
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [newMembers, setNewMembers] = useState<any[]>([])
  const [recentViewers, setRecentViewers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAllRecs, setShowAllRecs] = useState(false)
  const [showAllNew, setShowAllNew] = useState(false)

  const isPremium = profile?.is_premium || false;
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : null;
  const isPremiumActive = isPremium && premiumEnd && premiumEnd > new Date();

  useEffect(() => {
    if (profile?.role === 'admin') {
      navigate('/admin')
    } else if (user?.id) {
      fetchDashboardData()
      refreshCredits()
    }
  }, [user?.id, profile?.role])

  // Real-time: refresh credits when tab becomes visible (after contact reveal on other page)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        refreshCredits();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    // Also refresh on window focus (covers alt-tab back)
    const onFocus = () => { if (user?.id) refreshCredits(); };
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return;
    const handleUpdate = () => {
      fetchDashboardData(true);
    };
    socket.on('interest:new', handleUpdate);
    socket.on('interest:updated', handleUpdate);
    socket.on('notification:new', handleUpdate);
    socket.on('profile:viewed', handleUpdate);
    return () => {
      socket.off('interest:new', handleUpdate);
      socket.off('interest:updated', handleUpdate);
      socket.off('notification:new', handleUpdate);
      socket.off('profile:viewed', handleUpdate);
    };
  }, [socket, user?.id]);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [statsRes, recsRes, newRes, viewersRes] = await Promise.all([
        getDashboardStats((user?.id || '')),
        getRecommendations((user?.id || ''), 8),
        getNewMembers((user?.id || ''), 8),
        getRecentViewers((user?.id || ''), 8)
      ])
      setStats(statsRes)
      setRecommendations(recsRes)
      setNewMembers(newRes)
      setRecentViewers(viewersRes)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Guard: wait for data to load before rendering
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <DashboardSkeleton />
      </div>
    )
  }

  const hour = new Date().getHours()
  let greeting = 'Good Evening'
  if (hour < 12) greeting = 'Good Morning'
  else if (hour < 17) greeting = 'Good Afternoon'

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <MembershipExpiryPopup profile={profile} user={user} />
      <CreditLowPopup />
      {/* SECTION 1 - WELCOME */}
      <div className="bg-gradient-to-r from-primary to-primary-700 rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 text-white shadow-xl shadow-primary/20">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 w-full lg:w-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile?.profile_photo_url ? (
                 <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                 <span className="text-2xl sm:text-3xl font-bold">{profile?.first_name?.[0] || 'U'}</span>
              )}
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-heading font-bold">
                {greeting}, {profile?.first_name || 'Member'}!
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {profile?.email_verified ? (
                   <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-blue-500/20 text-blue-100 px-2.5 py-1 rounded-full border border-blue-400/30">
                     <ShieldCheck size={12} className="text-blue-300" /> Email Verified
                   </span>
                ) : null}
                {profile?.phone_verified ? (
                   <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-green-500/20 text-green-100 px-2.5 py-1 rounded-full border border-green-400/30">
                     <Phone size={12} className="text-green-300" /> Phone Verified
                   </span>
                ) : null}
                {profile?.aadhaar_verified ? (
                   <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-yellow-500/20 text-yellow-100 px-2.5 py-1 rounded-full border border-yellow-400/30">
                     <ShieldCheck size={12} className="text-yellow-300" /> Aadhaar Verified
                   </span>
                ) : null}
                {profile?.photo_verified ? (
                   <span className="flex items-center gap-1 text-[10px] sm:text-xs bg-purple-500/20 text-purple-100 px-2.5 py-1 rounded-full border border-purple-400/30">
                     <Camera size={12} className="text-purple-300" /> Photo Verified
                   </span>
                ) : null}
              </div>
            </div>
          </div>
          
          {profile?.verification_status === 'pending' && profile?.role !== 'admin' && (
             <div className="bg-amber-500/20 text-amber-100 rounded-2xl p-4 backdrop-blur-md border border-amber-400/30 w-full lg:w-auto flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
                <AlertTriangle size={24} className="text-amber-300 flex-shrink-0" />
                <div>
                   <p className="text-sm font-bold text-amber-200">Pending Verification</p>
                   <p className="text-xs text-amber-100/80 mt-1">Your profile is awaiting admin approval.</p>
                </div>
             </div>
          )}

          {profile && profile.profile_completion < 100 && profile.verification_status !== 'pending' && (
            <div className="bg-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md border border-white/20 w-full lg:w-auto lg:min-w-[300px]">
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-center mb-4 gap-3 sm:gap-4">
                <p className="text-sm font-medium whitespace-nowrap">Profile {profile.profile_completion}% complete</p>
                <Link to="/complete-profile" className="text-[11px] sm:text-xs font-bold bg-yellow-500 text-white px-4 py-2 rounded-full hover:bg-yellow-600 transition-colors flex items-center gap-1 shrink-0 shadow-md w-full sm:w-auto justify-center">
                  Complete Profile <ChevronRight size={14} />
                </Link>
              </div>
              <ProgressBar percentage={profile.profile_completion} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2 - CREDIT WIDGET */}
      <CreditWidget />

      {/* MEMBERSHIP PLAN WIDGET */}
      <MembershipWidget />

      {/* SECTION 3 - STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="bg-pink-50 border-pink-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/interests?tab=received')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-200">
              <Heart size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.interestsReceived}</p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Interests Received</p>
            </div>
          </div>
        </Card>

        <Card 
          className="bg-blue-50 border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/interests?tab=sent')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Send size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.interestsSent}</p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Interests Sent</p>
            </div>
          </div>
        </Card>

        <Card 
          className="bg-purple-50 border-purple-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/who-viewed-me')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-200">
              <Eye size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.profileViews}</p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Profile Views</p>
            </div>
          </div>
        </Card>

        <Card 
          className="bg-yellow-50 border-yellow-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/shortlist')}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500 flex items-center justify-center text-white shadow-lg shadow-yellow-200">
              <Star size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.shortlistedBy}</p>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Shortlisted By</p>
            </div>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS */}
      {stats.interestsReceived > 0 && (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-pink-500">
              <Heart size={24} className="fill-current" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">You have {stats.interestsReceived} pending interest(s)!</p>
              <p className="text-sm text-gray-600">Review and respond to connect with your potential matches.</p>
            </div>
          </div>
          <Link to="/interests">
            <Button size="md" variant="primary" className="shadow-lg shadow-primary/20">
              View Interests <ChevronRight size={18} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* SECTION 3 - RECOMMENDATIONS */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            Recommended For You <span className="text-pink-500">💕</span>
          </h2>
          <button
            onClick={() => navigate('/search')}
            className="text-primary font-bold text-sm hover:underline flex items-center gap-1"
          >
            Browse All <ChevronRight size={16} />
          </button>
        </div>
        
        {recommendations.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {(showAllRecs ? recommendations : recommendations.slice(0, 4)).map((rec: any) => {
                const age = rec.date_of_birth ? new Date().getFullYear() - new Date(rec.date_of_birth).getFullYear() : 25;
                const education = rec.education_career?.highest_education || rec.education_career?.[0]?.highest_education || 'Not specified';
                const occupation = rec.education_career?.occupation || rec.education_career?.[0]?.occupation || 'Not specified';
                const city = rec.city || rec.education_career?.working_city || rec.education_career?.[0]?.working_city || 'Not specified';
                const isOnline = rec.updated_at ? new Date().getTime() - new Date(rec.updated_at).getTime() < 15 * 60 * 1000 : false;
                const photo = rec.profile_photo_url || (rec.gender === 'Female' ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg' : 'https://www.w3schools.com/howto/img_avatar.png');
                const matchPct = rec.matchPct || 0;
                return (
                  <div
                    key={rec.id}
                    className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:-translate-y-1 text-center relative cursor-pointer"
                    onClick={() => navigate(`/profile/${rec.id}`)}
                  >
                    {/* Online indicator */}
                    {isOnline && (
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-green-500/10 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Online
                      </div>
                    )}
                    {/* Match % badge */}
                    {matchPct > 0 && (
                      <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {matchPct}% Match
                      </div>
                    )}
                    {/* Verified badge - only when no match badge */}
                    {rec.is_verified && !matchPct && (
                      <div className="absolute top-4 right-4 text-secondary" title="Verified Member">
                        <ShieldCheck size={20} />
                      </div>
                    )}
                    {/* Photo */}
                    <div className="relative w-24 h-24 mx-auto mb-4 mt-6">
                      <ProfilePhotoFrame
                        photoUrl={photo}
                        status={(rec.profile_status as ProfileStatus) || "active"}
                        size={96}
                        alt={rec.first_name}
                      />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{rec.first_name} {rec.last_name?.[0]}.</h3>
                    <p className="text-sm text-gray-500 mt-1">{age} yrs | {city}</p>
                    <div className="text-xs text-gray-400 mt-2 line-clamp-1">{education} • {occupation}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${rec.id}`); }}
                      className="mt-6 w-full py-2 px-1 sm:px-4 rounded-full border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors text-[11px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      View Profile
                    </button>
                  </div>
                );
              })}
            </div>
            {recommendations.length > 4 && (
              <div className="text-center mt-8">
                <button
                  onClick={() => showAllRecs ? navigate('/search') : setShowAllRecs(true)}
                  className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary-700 transition inline-flex items-center gap-2"
                >
                  {showAllRecs ? 'Browse All Profiles' : `View More (${recommendations.length - 4} more)`}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState 
            icon={<Heart size={48} />} 
            title="No high-match profiles yet" 
            description="Complete your profile and partner preferences to get personalized 60%+ matches" 
            actionLabel="Update Preferences" 
            onAction={() => navigate('/complete-profile')}
          />
        )}
      </section>

      {/* PREMIUM UPGRADE BANNER */}
      {!profile?.is_premium && (
        <div className="bg-gradient-to-r from-secondary-600 to-secondary-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-heading font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                <Star className="text-yellow-400 fill-yellow-400" /> Upgrade to Premium
              </h3>
              <p className="text-white/80 max-w-xl">
                Get 10x more matches, view contact numbers, and message anyone directly. Don't let your perfect match slip away!
              </p>
            </div>
            <Link to="/membership" className="shrink-0">
              <Button variant="outline" className="bg-white text-secondary-700 border-white hover:bg-gray-50 font-bold px-8 py-3 rounded-full shadow-lg">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* SECTION 4 - NEW MEMBERS */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            New Members <span className="text-blue-500">🆕</span>
          </h2>
          <button
            onClick={() => navigate('/search')}
            className="text-primary font-bold text-sm hover:underline flex items-center gap-1"
          >
            Browse All <ChevronRight size={16} />
          </button>
        </div>
        
        {newMembers.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {(showAllNew ? newMembers : newMembers.slice(0, 4)).map((mem: any) => {
                const age = mem.date_of_birth ? new Date().getFullYear() - new Date(mem.date_of_birth).getFullYear() : 25;
                const education = mem.education_career?.highest_education || mem.education_career?.[0]?.highest_education || 'Not specified';
                const occupation = mem.education_career?.occupation || mem.education_career?.[0]?.occupation || 'Not specified';
                const city = mem.city || mem.education_career?.working_city || mem.education_career?.[0]?.working_city || 'Not specified';
                const isOnline = mem.updated_at ? new Date().getTime() - new Date(mem.updated_at).getTime() < 15 * 60 * 1000 : false;
                const photo = mem.profile_photo_url || (mem.gender === 'Female' ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg' : 'https://www.w3schools.com/howto/img_avatar.png');
                const sameCity = (profile as any)?.city && mem.city && mem.city === (profile as any).city;
                const sameState = (profile as any)?.state && mem.state && mem.state === (profile as any).state;
                return (
                  <div
                    key={mem.id}
                    className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:-translate-y-1 text-center relative cursor-pointer"
                    onClick={() => navigate(`/profile/${mem.id}`)}
                  >
                    {/* Online indicator */}
                    {isOnline && (
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-green-500/10 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Online
                      </div>
                    )}
                    {/* Location match badge */}
                    {(sameCity || sameState) && (
                      <div className="absolute top-4 right-4 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {sameCity ? 'Same City' : 'Same State'}
                      </div>
                    )}
                    {/* Verified badge if no location badge */}
                    {mem.is_verified && !sameCity && !sameState && (
                      <div className="absolute top-4 right-4 text-secondary" title="Verified Member">
                        <ShieldCheck size={20} />
                      </div>
                    )}
                    {/* Photo */}
                    <div className="relative w-24 h-24 mx-auto mb-4 mt-6">
                      <ProfilePhotoFrame
                        photoUrl={photo}
                        status={(mem.profile_status as ProfileStatus) || "active"}
                        size={96}
                        alt={mem.first_name}
                      />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{mem.first_name} {mem.last_name?.[0]}.</h3>
                    <p className="text-sm text-gray-500 mt-1">{age} yrs | {city}</p>
                    <div className="text-xs text-gray-400 mt-2 line-clamp-1">{education} • {occupation}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${mem.id}`); }}
                      className="mt-6 w-full py-2 px-1 sm:px-4 rounded-full border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors text-[11px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      View Profile
                    </button>
                  </div>
                );
              })}
            </div>
            {newMembers.length > 4 && (
              <div className="text-center mt-8">
                <button
                  onClick={() => showAllNew ? navigate('/search') : setShowAllNew(true)}
                  className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary-700 transition inline-flex items-center gap-2"
                >
                  {showAllNew ? 'Browse All Profiles' : `View More (${newMembers.length - 4} more)`}
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No new members in your area yet</p>
          </div>
        )}
      </section>

      {/* SECTION 5 - RECENT VIEWERS */}
      <section>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2 mb-3">
              Recently Viewed Your Profile <span className="text-purple-500">👀</span>
            </h2>
            <div className="inline-block bg-[#8B1A1A] text-white text-sm font-bold px-4 py-1.5 rounded-md shadow-sm">
              {stats.profileViews} Total Views
            </div>
          </div>
          <Link to="/who-viewed-me" className="text-primary font-bold text-sm hover:underline flex items-center gap-1 mt-1">
            View All <ChevronRight size={16} />
          </Link>
        </div>
        
        {recentViewers.length > 0 ? (
          <div className="relative">
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 ${!isPremiumActive ? 'blur-[8px] pointer-events-none select-none opacity-60' : ''}`}>
              {recentViewers.map((view) => (
                <ProfileCard 
                  key={view.id} 
                  profile={view.viewer} 
                  currentUserId={(user?.id || '')} 
                />
              ))}
            </div>

            {!isPremiumActive && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
                <div className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-gray-100 text-center max-w-sm mx-4 transform transition-all">
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
          <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No one has viewed your profile yet</p>
          </div>
        )}
      </section>
    </div>
  )
}
