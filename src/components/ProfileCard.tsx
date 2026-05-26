import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, HeartHandshake, ShieldCheck, Star, Lock, Clock, Ban, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  toggleShortlist, 
  isShortlisted, 
  checkInterestStatus 
} from '../lib/actions/dashboardActions'
import { sendInterest } from '../lib/actions/interestActions'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import Avatar from './ui/Avatar'
import Button from './ui/Button'
import Badge from './ui/Badge'
import { calculateAge, formatHeight, calculateMatchPercentage } from '../lib/utils'
import ConfirmDialog from './ui/ConfirmDialog'
import ProfilePhotoFrame, { ProfileStatus } from './ProfilePhotoFrame'

interface ProfileCardProps {
  profile: any
  currentUserId: string
  onInterestSent?: () => void
}

export default function ProfileCard({ profile, currentUserId, onInterestSent }: ProfileCardProps) {
  const navigate = useNavigate()
  const { profile: myProfile } = useAuthStore()
  const [shortlisted, setShortlisted] = useState(false)
  const [interestStatus, setInterestStatus] = useState<any>(null)
  const [sendingInterest, setSendingInterest] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { socket } = useSocketStore()

  useEffect(() => {
    if (currentUserId && (profile?.id || '')) {
      checkStatus()
    }
  }, [currentUserId, (profile?.id || '')])

  useEffect(() => {
    if (!socket || !currentUserId || !profile?.id) return;
    const handleUpdate = async (data: any) => {
      const isRelevant =
        data?.sender_id === currentUserId ||
        data?.receiver_id === currentUserId ||
        data?.sender_id === profile.id ||
        data?.receiver_id === profile.id;
      if (!isRelevant) return;
      try {
        const res = await checkInterestStatus(currentUserId, profile.id);
        setInterestStatus(res);
      } catch {}
    };
    socket.on('interest:updated', handleUpdate);
    socket.on('interest:new', handleUpdate);
    return () => {
      socket.off('interest:updated', handleUpdate);
      socket.off('interest:new', handleUpdate);
    };
  }, [socket, currentUserId, profile?.id]);

  const checkStatus = async () => {
    try {
      const [shortlistedRes, interestRes] = await Promise.all([
        isShortlisted(currentUserId, (profile?.id || '')).catch(() => false),
        checkInterestStatus(currentUserId, (profile?.id || '')).catch(() => null)
      ])
      setShortlisted(shortlistedRes)
      setInterestStatus(interestRes)
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  const handleToggleShortlist = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const added = await toggleShortlist(currentUserId, (profile?.id || ''))
      setShortlisted(added)
      toast.success(added ? 'Added to shortlist' : 'Removed from shortlist', { icon: added ? <Star className="text-yellow-500 fill-yellow-500" /> : <XCircle className="text-gray-500" /> })
    } catch (error) {
      toast.error('Failed to update shortlist')
    }
  }

  const confirmSendInterest = async () => {
    setSendingInterest(true)
    try {
      const res = await sendInterest(currentUserId, (profile?.id || ''))
      setInterestStatus(res)
      toast.success('Interest sent successfully!', { icon: <Heart className="text-red-500 fill-red-500" /> })
      if (onInterestSent) onInterestSent()
    } catch (error: any) {
      if (error.code === 'COOLDOWN') {
        toast.error(`⏳ Wait ${error.hoursLeft}h before resending interest`)
        // Refresh status to show cooldown UI
        const status = await checkInterestStatus(currentUserId, (profile?.id || '')).catch(() => null)
        if (status) setInterestStatus(status)
      } else if (error.code === 'REJECTED') {
        toast.error('This profile has declined your interest. You cannot resend.')
        const status = await checkInterestStatus(currentUserId, (profile?.id || '')).catch(() => null)
        if (status) setInterestStatus(status)
      } else {
        toast.error(error.message || 'Failed to send interest')
      }
    } finally {
      setSendingInterest(false)
    }
  }

  const age = calculateAge(profile.date_of_birth)
  const height = formatHeight(profile.height_cm)
  const education = profile.education_career?.[0]?.highest_education || profile.education_career?.highest_education || 'Education not specified'
  const occupation = profile.education_career?.[0]?.occupation || profile.education_career?.occupation || 'Not specified'
  const city = profile.city || profile.state
  const location = city ? `${city}` : 'Location not specified'
  
  const isOwnProfile = currentUserId === (profile?.id || '')
  const isAdmin = myProfile?.role === 'admin'
  // Contact reveal requires the viewer to have SENT an interest that was ACCEPTED.
  const isSenderAccepted = interestStatus?.sent?.status === 'accepted'
  // Blur only when user explicitly set privacy to 'accepted' AND viewer has no accepted sent interest
  const isPrivacyLocked = profile.photo_privacy === 'accepted' && !isSenderAccepted
  const isPhotoBlurred = !isOwnProfile && !isAdmin && isPrivacyLocked

  const matchPercentage = calculateMatchPercentage(myProfile, profile)
  
  // Determine online status (active within last 15 minutes)
  const isOnline = profile.updated_at 
    ? new Date().getTime() - new Date(profile.updated_at).getTime() < 15 * 60 * 1000
    : false

  const renderInterestButton = () => {
    // If they sent to me and it's pending, show Accept/Decline
    if (interestStatus?.received?.status === 'pending') {
      return (
        <div className="flex gap-2 w-full">
          <Button variant="primary" size="sm" className="flex-1 bg-green-600 hover:bg-green-700">Accept</Button>
          <Button variant="outline" size="sm" className="flex-1 border-red-200 text-red-600 hover:bg-red-50">Decline</Button>
        </div>
      )
    }

    // If EITHER direction is accepted, they are connected
    if (interestStatus?.sent?.status === 'accepted' || interestStatus?.received?.status === 'accepted') {
      return (
        <Button variant="outline" size="sm" fullWidth className="bg-green-50 text-green-700 border-green-200 hover:bg-primary hover:text-white hover:border-primary">
          <HeartHandshake size={15} className="mr-1.5 flex-shrink-0" />
          Accepted
        </Button>
      )
    }

    // Now handle the interest I sent to them
    if (!interestStatus?.sent) {
      return (
        <Button 
          variant="primary" 
          size="sm" 
          fullWidth 
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          loading={sendingInterest}
          disabled={sendingInterest}
        >
          {sendingInterest ? 'Sending...' : 'Send Interest'}
        </Button>
      )
    }

    if (interestStatus.sent.status === 'pending') {
      return (
        <Button variant="outline" size="sm" fullWidth disabled className="bg-orange-50 text-orange-700 border-orange-200">
          Interest Sent
        </Button>
      )
    }
    if (interestStatus.sent.status === 'declined') {
      return (
        <Button variant="outline" size="sm" fullWidth disabled className="bg-red-50 text-red-700 border-red-200">
          <Ban size={12} className="mr-1" /> Interest Declined
        </Button>
      )
    }
    // Cancelled with 48h cooldown
    if (interestStatus.sent.status === 'cancelled' && interestStatus.sent.cancelled_at) {
      const cancelledAt = new Date(interestStatus.sent.cancelled_at).getTime();
      const hoursPassed = (Date.now() - cancelledAt) / (1000 * 60 * 60);
      const hoursLeft = Math.ceil(48 - hoursPassed);
      if (hoursLeft > 0) {
        return (
          <Button variant="outline" size="sm" fullWidth disabled className="bg-gray-50 text-gray-500 border-gray-200">
            <Clock size={12} className="mr-1" /> Resend in {hoursLeft}h
          </Button>
        )
      }
      // Cooldown over — allow resend
      return (
        <Button 
          variant="primary" 
          size="sm" 
          fullWidth 
          onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
          loading={sendingInterest}
        >
          {sendingInterest ? 'Sending...' : 'Send Interest'}
        </Button>
      )
    }

    return null
  }

  const defaultPhoto = profile.gender === 'Female' 
    ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
    : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'

  return (
    <div 
      onClick={() => navigate(`/profile/${(profile?.id || '')}`)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg group flex flex-col h-full text-center relative p-6"
      role="article"
      aria-label={`Profile card for ${profile.first_name} ${profile.last_name}, ${age} years old, ${profile.occupation || occupation}, from ${location}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${(profile?.id || '')}`); } }}
    >
      {/* Premium/Featured Badge */}
      {profile.is_premium && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg shadow-sm z-10 flex items-center gap-1">
          <Star size={10} className="fill-white" /> FEATURED
        </div>
      )}
      
      {/* Left Side Active Indicator */}
      {isOnline && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-green-500/10 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Online
        </div>
      )}

      {/* Shortlist Heart (absolute left, below online indicator if present) */}
      <button 
        onClick={handleToggleShortlist}
        className={`absolute ${isOnline ? 'top-12' : 'top-4'} left-4 w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform z-10`}
        aria-label={shortlisted ? `Remove ${profile.first_name} from shortlist` : `Add ${profile.first_name} to shortlist`}
        aria-pressed={shortlisted}
      >
        <Heart size={14} className={`${shortlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} aria-hidden="true" />
      </button>
      
      {/* Gold Shield Badge (Verified/Unverified) */}
      <div className="absolute top-4 right-4 z-10">
        {profile.is_verified ? (
          <div className="text-secondary" title="Verified Member" aria-label="Verified Member">
            <ShieldCheck size={20} fill="currentColor" className="text-white" aria-hidden="true" />
            <ShieldCheck size={20} className="absolute inset-0" aria-hidden="true" />
          </div>
        ) : (
          <div className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200">
            Unverified
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center mt-6">

        <div className="relative w-24 h-24 mx-auto mb-4 mt-2 shrink-0">
          {isPhotoBlurred ? (
            <img
              src={profile.profile_photo_url || defaultPhoto}
              alt={profile.first_name}
              className="w-full h-full object-cover rounded-full blur-md scale-110 select-none pointer-events-none"
              onError={(e) => { (e.target as HTMLImageElement).src = defaultPhoto }}
            />
          ) : (
            <ProfilePhotoFrame
              photoUrl={profile.profile_photo_url || defaultPhoto}
              status={(profile.profile_status as ProfileStatus) || "active"}
              size={96}
              alt={profile.first_name}
            />
          )}
          {isPhotoBlurred && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-full z-10">
              <Lock className="text-white w-5 h-5 drop-shadow-md" />
            </div>
          )}
        </div>
        {isPhotoBlurred && (
          <p className="text-[11px] text-gray-400 -mt-2 mb-2 flex items-center justify-center gap-1">
            <Lock size={10} /> Photo hidden
          </p>
        )}

      </div>

      <h3 className="font-bold text-lg text-gray-900 truncate">
        {profile.first_name} {profile.last_name}
      </h3>
      <p className="text-xs text-gray-400 mb-1">#{profile.profile_id}</p>
      
      <p className="text-sm text-gray-500 mt-1">{age} yrs | {city || 'Location not specified'}</p>
      <div className="text-xs text-gray-400 mt-2 mb-6 line-clamp-1">{education} • {occupation}</div>

      {/* BOTTOM SECTION - Buttons */}
      <div className="mt-auto flex flex-col gap-2 shrink-0">
        <button 
          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${(profile?.id || '')}`); }}
          className="w-full py-2 px-2 rounded-full border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors text-xs whitespace-nowrap overflow-hidden text-ellipsis"
        >
          View Profile
        </button>
        <div className="w-full [&>button]:rounded-full [&>button]:text-xs" onClick={(e) => e.stopPropagation()}>
          {renderInterestButton()}
        </div>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm}
        title="Send Interest"
        message={`Are you sure you want to send an interest to ${profile.first_name}?`}
        confirmText="Send Interest"
        variant="primary"
        onConfirm={confirmSendInterest}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  )
}
