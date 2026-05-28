import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, HeartHandshake, MessageCircle, Send, Clock, Check, X, User, ShieldCheck, Star, MapPin, Lock, XCircle, CheckCircle, CheckCircle2, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { 
  getReceivedInterests, 
  getSentInterests, 
  getAcceptedInterestsFromData,
  getRejectedInterestsFromData,
  acceptInterest, 
  declineInterest, 
  cancelInterest, 
  getInterestCountsFromData 
} from '../../lib/actions/interestActions'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { calculateAge, formatHeight, getRelativeTime } from '../../lib/utils'
import { InterestListSkeleton } from '../../components/ui/Skeletons'
import ProfilePhotoFrame, { ProfileStatus } from '../../components/ProfilePhotoFrame'

export default function InterestsPage() {
  const navigate = useNavigate()
  const { user, profile: myProfile , loading: authLoading} = useAuthStore()
  const [activeTab, setActiveTab] = useState('received')
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ received: 0, sent: 0, accepted: 0, rejected: 0 })
  
  const [receivedInterests, setReceivedInterests] = useState<any[]>([])
  const [sentInterests, setSentInterests] = useState<any[]>([])
  const [acceptedInterests, setAcceptedInterests] = useState<any[]>([])
  const [rejectedInterests, setRejectedInterests] = useState<any[]>([])
  
  const [showConfirm, setShowConfirm] = useState<{ id: string, type: 'decline' | 'cancel', senderId?: string } | null>(null)

  // Deduplicate interests by a specific user field (sender_id or receiver_id)
  const deduplicateByUser = (interests: any[], userField: string) => {
    const seen = new Set<string>()
    return interests.filter((i: any) => {
      const uid = i[userField]
      if (!uid || seen.has(uid)) return false
      seen.add(uid)
      return true
    })
  }

  // Deduplicate by the "other" user (works for accepted/rejected where user could be sender or receiver)
  const deduplicateByOtherUser = (interests: any[], currentUserId: string) => {
    const seen = new Set<string>()
    return interests.filter((i: any) => {
      const otherId = i.sender_id === currentUserId ? i.receiver_id : i.sender_id
      if (!otherId || seen.has(otherId)) return false
      seen.add(otherId)
      return true
    })
  }

  const { socket, on: socketOn, off: socketOff } = useSocketStore()

  // Ref so socket handlers always call the latest fetchAllData (never stale closure)
  const fetchAllDataRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (user?.id) {
      fetchAllData()
    }
  }, [user?.id])

  useEffect(() => {
    fetchAllDataRef.current = () => fetchAllData(true)
  })

  // Real-time: refresh interests when any interest status changes
  useEffect(() => {
    if (!user?.id) return;
    const handleInterestUpdate = () => { 
      fetchAllDataRef.current(); 
    };
    const handleNotification = (notif: any) => {
      if (notif.type === 'interest_received' || notif.type === 'interest_accepted' || notif.type === 'interest_declined') {
        fetchAllDataRef.current();
      }
    };

    // Register on current socket immediately (if already connected)
    const currentSocket = useSocketStore.getState().socket;
    if (currentSocket) {
      currentSocket.on('interest:updated', handleInterestUpdate);
      currentSocket.on('interest:new', handleInterestUpdate);
      currentSocket.on('notification:new', handleNotification);
    }

    // Re-register whenever socket instance changes (reconnect, late connect, etc.)
    const unsubSocket = useSocketStore.subscribe((state) => {
      if (state.socket) {
        state.socket.off('interest:updated', handleInterestUpdate);
        state.socket.off('interest:new', handleInterestUpdate);
        state.socket.off('notification:new', handleNotification);
        state.socket.on('interest:updated', handleInterestUpdate);
        state.socket.on('interest:new', handleInterestUpdate);
        state.socket.on('notification:new', handleNotification);
      }
    });

    // Fallback: refresh on tab focus/visibility (covers reconnection gaps)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAllDataRef.current(); };
    const onFocus = () => fetchAllDataRef.current();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      unsubSocket();
      const s = useSocketStore.getState().socket;
      if (s) {
        s.off('interest:updated', handleInterestUpdate);
        s.off('interest:new', handleInterestUpdate);
        s.off('notification:new', handleNotification);
      }
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  const fetchAllData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [received, sent] = await Promise.all([
        getReceivedInterests((user?.id || '')),
        getSentInterests((user?.id || ''))
      ])
      const accepted = getAcceptedInterestsFromData(received || [], sent || [])
      const rejected = getRejectedInterestsFromData(received || [], sent || [])
      const countsData = getInterestCountsFromData(received || [], sent || [])
      
      // Filter by status: each tab shows only its correct status
      // Received = pending interests where I am the receiver
      const filteredReceived = deduplicateByUser(
        (received || []).filter((i: any) => i.status === 'pending'), 'sender_id'
      )
      // Sent = pending interests where I am the sender
      const filteredSent = deduplicateByUser(
        (sent || []).filter((i: any) => i.status === 'pending'), 'receiver_id'
      )
      // Accepted = all accepted interests (from both sent and received)
      const filteredAccepted = deduplicateByOtherUser(
        (accepted || []), (user?.id || '')
      )
      // Rejected = declined interests
      const filteredRejected = deduplicateByOtherUser(
        (rejected || []), (user?.id || '')
      )

      setReceivedInterests(filteredReceived)
      setSentInterests(filteredSent)
      setAcceptedInterests(filteredAccepted)
      setRejectedInterests(filteredRejected)
      setCounts({
        received: filteredReceived.length,
        sent: filteredSent.length,
        accepted: filteredAccepted.length,
        rejected: filteredRejected.length,
      })
    } catch (error) {
      console.error('Error fetching interests:', error)
      if (!silent) toast.error('Failed to load interests')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (interest: any) => {
    try {
      await acceptInterest(interest.id, interest.sender_id, (myProfile?.first_name || ''))
      toast.success(`Interest accepted! You can now chat with ${interest.sender.first_name}`, { icon: <CheckCircle className="text-green-500 fill-green-500" /> })
      // Immediately remove from received and add to accepted for instant UI update
      setReceivedInterests(prev => prev.filter(i => i.id !== interest.id))
      setAcceptedInterests(prev => [{ ...interest, status: 'accepted' }, ...prev])
      setCounts(prev => ({ ...prev, received: prev.received - 1, accepted: prev.accepted + 1 }))
      // Also refresh from server for consistency
      fetchAllData(true)
    } catch (error) {
      toast.error('Failed to accept interest')
    }
  }

  const handleDecline = async () => {
    if (!showConfirm) return
    try {
      await declineInterest(showConfirm.id, showConfirm.senderId!, (myProfile?.first_name || ''))
      toast.success('Interest declined', { icon: <XCircle className="text-gray-500" /> })
      // Immediately remove from received and add to rejected
      setReceivedInterests(prev => prev.filter(i => i.id !== showConfirm.id))
      setCounts(prev => ({ ...prev, received: prev.received - 1, rejected: prev.rejected + 1 }))
      fetchAllData(true)
    } catch (error) {
      toast.error('Failed to decline interest')
    } finally {
      setShowConfirm(null)
    }
  }

  const handleCancel = async () => {
    if (!showConfirm) return
    try {
      await cancelInterest(showConfirm.id)
      toast.success('Interest cancelled', { icon: <XCircle className="text-gray-500" /> })
      fetchAllData(true)
    } catch (error) {
      toast.error('Failed to cancel interest')
    } finally {
      setShowConfirm(null)
    }
  }

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-64 animate-pulse"></div>
        </div>
        <InterestListSkeleton count={6} />
      </div>
    )
  }
  if (!user) return null

  const tabs = [
    { id: 'received', label: 'Received', count: counts.received },
    { id: 'sent', label: 'Sent', count: counts.sent },
    { id: 'accepted', label: 'Accepted', count: counts.accepted },
    { id: 'rejected', label: 'Rejected', count: counts.rejected }
  ]

  // Reusable card component matching ShortlistPage / ProfileCard style
  const InterestCard = ({ person, interest, type }: { person: any, interest: any, type: 'received' | 'sent' | 'accepted' | 'rejected' }) => {
    const age = calculateAge(person.date_of_birth)
    const city = person.education_career?.[0]?.working_city || person.education_career?.working_city || ''
    const education = person.education_career?.[0]?.highest_education || person.education_career?.highest_education || ''
    const occupation = person.education_career?.[0]?.occupation || person.education_career?.occupation || ''
    
    const isMutuallyAccepted = interest.status === 'accepted' || type === 'accepted';
    const isPrivacyLocked = person.photo_privacy === 'accepted' && !isMutuallyAccepted;

    return (
      <div 
        onClick={() => navigate(`/profile/${person.id}`)}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg group flex flex-col h-full text-center relative p-5"
      >
        {/* Premium Badge */}
        {person.is_premium && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg shadow-sm z-10 flex items-center gap-1">
            <Star size={10} className="fill-white" /> FEATURED
          </div>
        )}

        {/* Status Badge - top left */}
        <div className="absolute top-3 left-3 z-10">
          {type === 'received' && interest.status === 'pending' && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">New</span>
          )}
          {type === 'sent' && interest.status === 'pending' && (
            <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><Clock size={9} /> Pending</span>
          )}
          {type === 'accepted' && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><Check size={9} /> Accepted</span>
          )}
          {type === 'rejected' && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><X size={9} /> Declined</span>
          )}
          {type === 'sent' && interest.status === 'accepted' && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><Check size={9} /> Accepted</span>
          )}
          {type === 'sent' && interest.status === 'declined' && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><X size={9} /> Declined</span>
          )}
          {type === 'received' && interest.status === 'accepted' && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><Check size={9} /> Accepted</span>
          )}
          {type === 'received' && interest.status === 'declined' && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5"><X size={9} /> Declined</span>
          )}
        </div>
        
        {/* Verified badge - top right */}
        <div className="absolute top-3 right-3 z-10">
          {person.is_verified ? (
            <div className="text-secondary" title="Verified Member">
              <ShieldCheck size={20} fill="currentColor" className="text-white" />
              <ShieldCheck size={20} className="absolute inset-0" />
            </div>
          ) : (
            <div className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200">
              Unverified
            </div>
          )}
        </div>

        {/* Avatar — with ProfilePhotoFrame showing user status ring (same as Dashboard/Browse) */}
        <div className="relative w-24 h-24 mx-auto mb-3 mt-4 shrink-0">
          {isPrivacyLocked ? (
            <>
              <img
                src={person.profile_photo_url || (person.gender === 'Female'
                  ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
                  : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
                )}
                alt={person.first_name}
                className="w-full h-full object-cover rounded-full blur-md scale-110 select-none pointer-events-none"
                onError={(e) => {
                  const t = e.target as HTMLImageElement
                  t.src = person.gender === 'Female'
                    ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
                    : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-full z-10">
                <Lock className="text-white w-5 h-5 drop-shadow-md" />
              </div>
            </>
          ) : (
            <ProfilePhotoFrame
              photoUrl={person.profile_photo_url || (person.gender === 'Female'
                ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
                : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
              )}
              status={(person.profile_status as ProfileStatus) || 'active'}
              size={96}
              alt={person.first_name}
            />
          )}
        </div>

        {/* Name & Details */}
        <h3 className="font-bold text-lg text-gray-900 truncate">
          {person.first_name} {person.last_name}
        </h3>
        <p className="text-xs text-gray-400 mb-1">#{person.profile_id}</p>
        <p className="text-sm text-gray-500 mt-1">{age} yrs | {city || 'Location not specified'}</p>
        <div className="text-xs text-gray-400 mt-1 line-clamp-1">{education}{occupation ? ` • ${occupation}` : ''}</div>
        
        {/* Time */}
        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 justify-center">
          <Clock size={10} /> {type === 'sent' ? 'Sent' : type === 'received' ? 'Received' : ''} {getRelativeTime(interest.created_at)}
        </p>

        {/* Action Buttons */}
        <div className="mt-auto pt-4 flex flex-col gap-2 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${person.id}`); }}
            className="w-full py-2 px-2 rounded-full border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors text-xs"
          >
            View Profile
          </button>

          {/* Received: Accept/Decline */}
          {type === 'received' && interest.status === 'pending' && (
            <div className="flex gap-2 w-full" onClick={(e) => e.stopPropagation()}>
              <Button variant="primary" size="sm" className="flex-1 rounded-full text-xs bg-green-600 hover:bg-green-700" onClick={() => handleAccept(interest)}>
                <CheckCircle2 size={14} className="mr-1 flex-shrink-0" />
                Accept
              </Button>
              <Button variant="outline" size="sm" className="flex-1 rounded-full text-xs border-red-200 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500" onClick={() => setShowConfirm({ id: interest.id, type: 'decline', senderId: interest.sender_id })}>
                <XCircle size={14} className="mr-1 flex-shrink-0" />
                Decline
              </Button>
            </div>
          )}

          {/* Sent pending: Cancel */}
          {type === 'sent' && interest.status === 'pending' && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" fullWidth className="rounded-full text-xs text-gray-500 hover:text-red-500 hover:border-red-200" onClick={() => setShowConfirm({ id: interest.id, type: 'cancel' })}>
                <Ban size={13} className="mr-1 flex-shrink-0" />
                Cancel Interest
              </Button>
            </div>
          )}

          {/* Accepted: Chat Now */}
          {(type === 'accepted' || interest.status === 'accepted') && (
            <button 
              onClick={(e) => { e.stopPropagation(); navigate('/messages'); }}
              className="w-full py-2 px-2 rounded-full border border-primary bg-primary text-white font-medium hover:bg-primary-700 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <MessageCircle size={14} className="flex-shrink-0" />
              Chat Now
            </button>
          )}
        </div>
      </div>
    )
  }

  const getInterestList = () => {
    switch(activeTab) {
      case 'received': return receivedInterests
      case 'sent': return sentInterests
      case 'accepted': return acceptedInterests
      case 'rejected': return rejectedInterests
      default: return []
    }
  }

  const getPersonFromInterest = (interest: any) => {
    if (activeTab === 'received' || (activeTab === 'rejected' && interest.receiver_id === (user?.id || ''))) {
      return interest.sender
    }
    if (activeTab === 'sent' || (activeTab === 'rejected' && interest.sender_id === (user?.id || ''))) {
      return interest.receiver
    }
    // accepted or rejected - figure out who the other person is
    return interest.sender_id === (user?.id || '') ? interest.receiver : interest.sender
  }

  const interests = getInterestList()

  const emptyMessages: Record<string, { icon: React.ReactNode, title: string, desc: string, action: string, onAction: () => void }> = {
    received: { icon: <Heart size={48} />, title: 'No interests received yet', desc: 'Complete your profile to attract more matches!', action: 'Complete Profile', onAction: () => navigate('/complete-profile') },
    sent: { icon: <Send size={48} />, title: "You haven't sent any interests", desc: 'Browse profiles and start connecting!', action: 'Browse Profiles', onAction: () => navigate('/search') },
    accepted: { icon: <MessageCircle size={48} />, title: 'No accepted interests yet', desc: 'Once someone accepts your interest, they appear here.', action: 'View Received', onAction: () => setActiveTab('received') },
    rejected: { icon: <XCircle size={48} />, title: 'No rejected interests', desc: 'Declined interests from both sides appear here.', action: 'Browse Profiles', onAction: () => navigate('/search') }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900 flex items-center gap-2">
          Interests <Heart className="text-primary fill-primary" size={24} />
        </h1>
        <p className="text-gray-500 text-sm">Manage your connections and interests</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label} <span className={`ml-0.5 ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="mt-4">
        {interests.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {interests.map((interest: any) => {
              const person = getPersonFromInterest(interest)
              if (!person) return null
              return (
                <InterestCard 
                  key={interest.id} 
                  person={person} 
                  interest={interest} 
                  type={activeTab as any}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState 
            icon={emptyMessages[activeTab].icon} 
            title={emptyMessages[activeTab].title} 
            description={emptyMessages[activeTab].desc} 
            actionLabel={emptyMessages[activeTab].action}
            onAction={emptyMessages[activeTab].onAction}
          />
        )}
      </div>

      <ConfirmDialog 
        isOpen={!!showConfirm}
        title={showConfirm?.type === 'decline' ? 'Decline Interest' : 'Cancel Interest'}
        message={showConfirm?.type === 'decline' ? 'Are you sure you want to decline this interest?' : 'Are you sure you want to cancel this interest?'}
        onConfirm={showConfirm?.type === 'decline' ? handleDecline : handleCancel}
        onClose={() => setShowConfirm(null)}
      />
    </div>
  )
}
