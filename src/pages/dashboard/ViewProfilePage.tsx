import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { toggleShortlist, isShortlisted, checkInterestStatus, recordProfileView, getSimilarProfiles, blockUser, reportUser } from '../../lib/actions/dashboardActions'
import { sendInterest, acceptInterest, declineInterest } from '../../lib/actions/interestActions'
import { getCompleteProfile } from '../../lib/actions/profileActions'
import { calculateAge, formatHeight, getRelativeTime, formatDate, calculateMatchPercentage } from '../../lib/utils'
import toast from 'react-hot-toast'
import {
  Heart, MapPin, GraduationCap, Briefcase, Calendar, Ruler, User,
  Users, ShieldCheck, Star, MessageCircle, Flag, MoreHorizontal,
  ChevronRight, ChevronLeft, Eye, EyeOff, Phone, Globe, Home, BookOpen, Utensils,
  Wine, Cigarette, Languages, Moon, Clock, X, Send, Check, Ban, XCircle, CheckCircle,
  ArrowLeft, Camera, Info, Lock, FileText
} from 'lucide-react'
import ProfileCard from '../../components/ProfileCard'
import ContactRevealBox from '../../components/profile/ContactRevealBox'
import ReportUserModal from '../../components/ReportUserModal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ProfileDetailSkeleton } from '../../components/ui/Skeletons'
import ProfilePhotoFrame, { ProfileStatus } from '../../components/ProfilePhotoFrame'

export default function ViewProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile: myProfile, refreshCredits , loading: authLoading} = useAuthStore()
  const { isUserOnline } = useSocketStore()
  
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('about')
  const [shortlisted, setShortlisted] = useState(false)
  const [interestStatus, setInterestStatus] = useState<any>(null)
  const [sendingInterest, setSendingInterest] = useState(false)
  const [showInterestModal, setShowInterestModal] = useState(false)
  const [interestMessage, setInterestMessage] = useState('')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState('')
  const [error, setError] = useState('')
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [photoTransition, setPhotoTransition] = useState(true)
  const [similarProfiles, setSimilarProfiles] = useState<any[]>([])
  const [openSection, setOpenSection] = useState<string>('about')
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)

  // Use a ref so socket listeners always call the latest loadProfile
  const loadProfileRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (id && user) {
      loadProfile()
      refreshCredits()
    }
  }, [id, user])

  // Real-time: re-fetch when the viewed profile is updated by its owner
  // Listens to profile:public-updated (broadcast to all clients) filtered by profileId
  useEffect(() => {
    if (!id) return;

    const handleAny = (data: any) => {
      // Only reload if this is the profile currently being viewed
      if (data?.userId === id) loadProfileRef.current();
    };

    let registeredSocket: any = null;
    const registerListeners = (socket: any) => {
      if (!socket || socket === registeredSocket) return;
      if (registeredSocket) {
        registeredSocket.off('profile:public-updated', handleAny);
      }
      socket.on('profile:public-updated', handleAny);
      registeredSocket = socket;
    };

    const currentSocket = useSocketStore.getState().socket;
    if (currentSocket) registerListeners(currentSocket);
    const unsubSocket = useSocketStore.subscribe((state) => {
      if (state.socket) registerListeners(state.socket);
    });

    return () => {
      unsubSocket();
      if (registeredSocket) {
        registeredSocket.off('profile:public-updated', handleAny);
      }
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user?.id) return;
    const handleInterestChange = async (data: any) => {
      const isRelevant =
        data?.sender_id === user?.id ||
        data?.receiver_id === user?.id ||
        data?.sender_id === id ||
        data?.receiver_id === id;
      if (!isRelevant) return;
      const interest = await checkInterestStatus(user?.id || '', id);
      setInterestStatus(interest);
    };
    const currentSocket = useSocketStore.getState().socket;
    if (currentSocket) {
      currentSocket.on('interest:updated', handleInterestChange);
      currentSocket.on('interest:new', handleInterestChange);
    }
    const unsub = useSocketStore.subscribe((state) => {
      if (state.socket) {
        state.socket.off('interest:updated', handleInterestChange);
        state.socket.off('interest:new', handleInterestChange);
        state.socket.on('interest:updated', handleInterestChange);
        state.socket.on('interest:new', handleInterestChange);
      }
    });
    return () => {
      unsub();
      const s = useSocketStore.getState().socket;
      if (s) {
        s.off('interest:updated', handleInterestChange);
        s.off('interest:new', handleInterestChange);
      }
    };
  }, [id, user?.id]);

  // Auto-rotate photos — DISABLED: only show profile photo in main area
  // Additional photos are shown in the Photos tab
  useEffect(() => {
    // No auto-rotation — profile photo section shows only the set profile photo
  }, [profileData])

  async function loadProfile(silent = false) {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError('')
      
      // Redirect to my profile if viewing own
      if (id === user?.id) {
        navigate('/my-profile')
        return
      }

      // Fetch ALL profile data using local API
      const profile = await getCompleteProfile(id!, user?.id)

      if (!profile || (!profile.profile?.is_verified && (user as any)?.role !== 'admin')) {
        if (!silent) setError('Profile not found or is pending verification.')
        return
      }

      setProfileData(profile)

      // Record profile view (only on initial load, not silent refresh)
      if (user?.id && !silent) {
        recordProfileView((user?.id || ''), id!).catch(() => {})
      }

      // Check shortlist and interest status (only on initial load)
      if (user?.id && !silent) {
        const [isShort, interest, similar] = await Promise.all([
          isShortlisted((user?.id || ''), id!),
          checkInterestStatus((user?.id || ''), id!),
          getSimilarProfiles(id!, profile.profile?.gender || profile.gender || '', 4)
        ])
        setShortlisted(isShort)
        setInterestStatus(interest)
        setSimilarProfiles(similar)
      }
    } catch (err: any) {
      console.error('Error loading profile:', err)
      if (!silent) setError('Failed to load profile. Please try again.')
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  // Keep ref always pointing to latest loadProfile so socket listeners don't go stale
  loadProfileRef.current = () => loadProfile(true)

  async function handleSendInterest() {
    if (!user?.id || !id) return
    setSendingInterest(true)
    try {
      await sendInterest((user?.id || ''), id)
      toast.success('Interest sent successfully!', { icon: <Heart className="text-red-500 fill-red-500" /> })
      setShowInterestModal(false)
      setInterestMessage('')
      // Refresh interest status
      const interest = await checkInterestStatus((user?.id || ''), id)
      setInterestStatus(interest)
    } catch (err: any) {
      if (err.code === 'COOLDOWN') {
        toast.error(`⏳ Please wait ${err.hoursLeft} more hour(s) before resending interest to this profile.`, { duration: 5000 })
        setShowInterestModal(false)
        // Refresh to show cooldown state
        const interest = await checkInterestStatus((user?.id || ''), id).catch(() => null)
        if (interest) setInterestStatus(interest)
      } else if (err.code === 'REJECTED') {
        toast.error('This profile has declined your previous interest. You cannot resend.', { duration: 5000 })
        setShowInterestModal(false)
        const interest = await checkInterestStatus((user?.id || ''), id).catch(() => null)
        if (interest) setInterestStatus(interest)
      } else {
        toast.error(err.message || 'Failed to send interest')
      }
    } finally {
      setSendingInterest(false)
    }
  }

  async function handleToggleShortlist() {
    if (!user?.id || !id) return
    try {
      const result = await toggleShortlist((user?.id || ''), id)
      setShortlisted(result)
      toast.success(result ? 'Profile shortlisted!' : 'Removed from shortlist', { icon: result ? <Star className="text-yellow-500 fill-yellow-500" /> : <XCircle className="text-gray-500" /> })
    } catch (err) {
      toast.error('Failed to update shortlist')
    }
  }

  async function handleBlock() {
    if (!user?.id || !id) return
    
    try {
      await blockUser((user?.id || ''), id)
      toast.success('User blocked successfully', { icon: <Ban className="text-red-500" /> })
      navigate('/dashboard/search') // Redirect away from blocked profile
    } catch (err) {
      toast.error('Failed to block user')
    }
  }

  async function handleReportSubmit(reason: string, note: string) {
    if (!user?.id || !id) return
    try {
      await reportUser((user?.id || ''), id, reason, note, 'profile')
      toast.success('User reported successfully. Our team will review it shortly.', { icon: <Flag className="text-orange-500 fill-orange-500" /> })
      setShowReportModal(false)
      navigate('/dashboard/search') // Redirect away from reported profile as they are now blocked
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report')
      throw err // Re-throw to be handled by modal
    }
  }

  // LOADING STATE
  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <ProfileDetailSkeleton />
      </div>
    )
  }
  if (!user) return null

  // ERROR STATE
  if (error || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <User className="mx-auto text-gray-300" size={64} />
          <h2 className="text-xl font-bold text-gray-800 mt-4">Profile Not Found</h2>
          <p className="text-gray-500 mt-2">{error || 'This profile does not exist or has been deactivated.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const p = profileData.profile || profileData
  const edu = profileData.education || p.education_career
  const fam = profileData.family || p.family_details
  const life = profileData.lifestyle || p.lifestyle
  const horo = profileData.horoscope || p.horoscope_details
  const prefs = profileData.preferences || p.partner_preferences
  const photos = profileData.photos || p.photos || []
  const age = p.date_of_birth ? calculateAge(p.date_of_birth) : null
  const height = p.height_cm ? formatHeight(p.height_cm) : null
  
  const biodataDoc = profileData.verification_documents?.find((d: any) => d.document_type === 'biodata')
  const biodataUrl = biodataDoc ? biodataDoc.file_url : p.biodata_url
  
  // Fallbacks for test users
  const location = [edu?.working_city, edu?.working_state].filter(Boolean).join(', ') || fam?.family_city || 'Location Not Specified'
  const firstName = p.first_name || 'Test'
  const lastName = p.last_name || 'User'
  const profileId = p.profile_id || `USER-${p.id?.substring(0, 6).toUpperCase()}`
  const isOwnProfile = user?.id === id
  const isAdmin = (user as any)?.role === 'admin'
  // Contact reveal requires the viewer to have SENT an interest that was ACCEPTED,
  // OR to have RECEIVED an accepted interest (i.e., the profile owner sent interest to viewer and viewer accepted it).
  // In both cases the viewer must still manually click and pay 1 credit.
  const isSenderAccepted = interestStatus?.sent?.status === 'accepted'
  const isReceiverAccepted = interestStatus?.received?.status === 'accepted'
  const canRevealContact = isSenderAccepted || isReceiverAccepted
  // Only blur when profile owner set photo_privacy to 'accepted' and no mutual interest
  const isPrivacyLocked = p.photo_privacy === 'accepted' && !canRevealContact
  const isPhotoBlurred = !isOwnProfile && !isAdmin && isPrivacyLocked

  // Info Card Component for Professional Layout
  const InfoCard = ({ title, icon: Icon, children }: { title: string, icon?: any, children: React.ReactNode }) => (
    <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5">
        {Icon && <div className="p-1.5 bg-white rounded-lg shadow-sm"><Icon size={16} className="text-primary-600" /></div>}
        <h3 className="text-[15px] font-bold text-gray-800 tracking-wide">{title}</h3>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {children}
      </div>
    </div>
  );

  // Detail Item component for Grid
  const DetailItem = ({ label, value, icon: Icon }: { label: string, value: any, icon?: any }) => {
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    const displayValue = isEmpty ? 'Not specified' : (Array.isArray(value) ? value.join(', ') : String(value));
    
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[13px] text-gray-500 font-medium">
          {Icon && <Icon size={14} className="text-gray-400" />}
          {label}
        </div>
        <div className={`text-[15px] font-medium leading-relaxed ${isEmpty ? 'text-gray-400 italic' : 'text-gray-900'}`}>{displayValue}</div>
      </div>
    );
  };

  // Interest button render
  const renderInterestButton = () => {
    // CASE: We received an interest and already accepted it
    if (interestStatus?.received?.status === 'accepted') {
      return (
        <Link to="/messages" className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2">
          <MessageCircle size={18} /> Message
        </Link>
      )
    }

    // CASE: We received an interest and declined it
    if (interestStatus?.received?.status === 'declined') {
      return (
        <span className="bg-red-50 text-red-700 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2">
          <X size={18} /> Interest Declined
        </span>
      )
    }

    // If they sent an interest to us and it's pending, show Accept/Decline
    if (interestStatus?.received?.status === 'pending') {
      return (
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await acceptInterest(interestStatus.received.id, interestStatus.received.sender_id, myProfile?.first_name || '')
              toast.success('Interest accepted!', { icon: <CheckCircle className="text-green-500 fill-green-500" /> })
              loadProfile(true)
            }}
            className="bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-600 transition flex items-center gap-2"
          >
            <Check size={18} /> Accept
          </button>
          <button
            onClick={async () => {
              await declineInterest(interestStatus.received.id, interestStatus.received.sender_id, myProfile?.first_name || '')
              toast.success('Interest declined', { icon: <XCircle className="text-gray-500" /> })
              loadProfile(true)
            }}
            className="border border-red-300 text-red-600 px-5 py-2.5 rounded-lg font-medium hover:bg-red-50 transition"
          >
            Decline
          </button>
        </div>
      )
    }

    // If EITHER direction is accepted, they are connected. Show Message button.
    if (interestStatus?.sent?.status === 'accepted' || interestStatus?.received?.status === 'accepted') {
      return (
        <Link to="/messages" className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2">
          <MessageCircle size={18} /> Message
        </Link>
      )
    }

    // Now handle the interest WE sent to them
    if (!interestStatus?.sent) {
      return (
        <button
          onClick={() => setShowInterestModal(true)}
          className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2"
        >
          <Heart size={18} /> Send Interest
        </button>
      )
    }

    switch (interestStatus.sent.status) {
      case 'pending':
        return <span className="bg-green-50 text-green-700 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"><Check size={18} /> Interest Sent</span>
      case 'declined':
        return <span className="bg-red-50 text-red-700 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"><X size={18} /> Interest Declined</span>
      case 'cancelled': {
        if (interestStatus.sent.cancelled_at) {
          const cancelledAt = new Date(interestStatus.sent.cancelled_at).getTime();
          const hoursPassed = (Date.now() - cancelledAt) / (1000 * 60 * 60);
          const hoursLeft = Math.ceil(48 - hoursPassed);
          if (hoursLeft > 0) {
            return <span className="bg-gray-50 text-gray-500 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"><Clock size={18} /> Resend in {hoursLeft}h</span>
          }
        }
        // Cooldown over — allow resend
        return (
          <button
            onClick={() => setShowInterestModal(true)}
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2"
          >
            <Heart size={18} /> Send Interest
          </button>
        )
      }
      default:
        return null
    }
  }

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'education', label: 'Education & Career' },
    { id: 'family', label: 'Family' },
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'preferences', label: 'Partner Pref.' },
    { id: 'photos', label: `Photos (${photos.length})` }
  ]


  function getAllPhotos() {
    if (!profileData) return []
    
    const defaultPhoto = p.gender === 'Female'
      ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
      : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
    
    // Only show the profile photo in the main photo area
    // Additional photos are displayed in the Photos tab
    if (p.profile_photo_url) {
      return [p.profile_photo_url]
    }
    
    return [defaultPhoto]
  }

  const allPhotos = getAllPhotos()
  const currentPhoto = allPhotos[currentPhotoIndex % allPhotos.length] || allPhotos[0]

  // Render tab content as a plain function (NOT a component)
  function renderTabContent(tabId: string) {
    if (tabId === 'about') return (
      <div className="pt-2">
        {p.about_me && (
          <div className="mb-8 bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <User size={100} />
            </div>
            <div className="flex items-center gap-2.5 mb-3 relative z-10">
              <div className="p-1.5 bg-primary-100 rounded-lg text-primary-600"><Info size={18} /></div>
              <h3 className="text-[16px] font-bold text-gray-800">About Me</h3>
            </div>
            <p className="text-gray-700 text-[15px] leading-relaxed relative z-10">{p.about_me}</p>
          </div>
        )}
        
        <InfoCard title="Basic Details" icon={User}>
          <DetailItem label="Profile For" value={p.profile_for} />
          <DetailItem label="Gender" value={p.gender} />
          <DetailItem label="Date of Birth" value={p.date_of_birth ? formatDate(p.date_of_birth) : null} />
          <DetailItem label="Age" value={age ? `${age} Years` : null} />
          <DetailItem label="Marital Status" value={p.marital_status} />
        </InfoCard>

        <InfoCard title="Physical Attributes" icon={Ruler}>
          <DetailItem label="Height" value={height} />
          <DetailItem label="Weight" value={p.weight_kg ? `${p.weight_kg} kg` : null} />
          <DetailItem label="Body Type" value={p.body_type} />
          <DetailItem label="Complexion" value={p.complexion} />
          <DetailItem label="Blood Group" value={p.blood_group} />
        </InfoCard>

        <InfoCard title="Background Details" icon={BookOpen}>
          <DetailItem label="Religion" value={p.religion} />
          <DetailItem label="Caste" value={p.caste} />
          <DetailItem label="Sub Caste" value={p.sub_caste} />
          <DetailItem label="Gotra" value={p.gotra} />
          <DetailItem label="Mother Tongue" value={p.mother_tongue} />
        </InfoCard>
      </div>
    )
    if (tabId === 'education') return (
      <div className="pt-2">
        {edu ? (
          <>
            <InfoCard title="Education Details" icon={GraduationCap}>
              <DetailItem label="Highest Education" value={edu.highest_education} />
              <DetailItem label="Specialization" value={edu.education_field} />
              <DetailItem label="College/University" value={edu.college_name} />
            </InfoCard>
            <InfoCard title="Career Details" icon={Briefcase}>
              <DetailItem label="Occupation" value={edu.occupation} />
              <DetailItem label="Company" value={edu.company_name} />
              <DetailItem label="Designation" value={edu.designation} />
              <DetailItem label="Annual Income" value={edu.annual_income} />
            </InfoCard>
            <InfoCard title="Location" icon={MapPin}>
              <DetailItem label="Working City" value={edu.working_city} />
              <DetailItem label="Working State" value={edu.working_state} />
              <DetailItem label="Country" value={edu.working_country} />
            </InfoCard>
          </>
        ) : <p className="text-gray-400 text-[15px] py-10 text-center flex flex-col items-center gap-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><Briefcase size={32} className="text-gray-300" /> No education & career details provided.</p>}
      </div>
    )
    if (tabId === 'family') return (
      <div className="pt-2">
        {fam ? (
          <>
            {fam.about_family && (
              <div className="mb-8 bg-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Home size={100} /></div>
                <div className="flex items-center gap-2.5 mb-3 relative z-10">
                  <div className="p-1.5 bg-white shadow-sm rounded-lg text-gray-600"><Info size={18} /></div>
                  <h3 className="text-[16px] font-bold text-gray-800">About Family</h3>
                </div>
                <p className="text-gray-700 text-[15px] leading-relaxed relative z-10">{fam.about_family}</p>
              </div>
            )}
            <InfoCard title="Parents" icon={Users}>
              <DetailItem label="Father's Name" value={fam.father_name} />
              <DetailItem label="Father's Occupation" value={fam.father_occupation} />
              <DetailItem label="Mother's Name" value={fam.mother_name} />
              <DetailItem label="Mother's Occupation" value={fam.mother_occupation} />
            </InfoCard>
            <InfoCard title="Siblings" icon={Users}>
              <DetailItem label="Brothers" value={fam.num_brothers != null ? `${fam.num_brothers} (${fam.brothers_married || 0} married)` : null} />
              <DetailItem label="Sisters" value={fam.num_sisters != null ? `${fam.num_sisters} (${fam.sisters_married || 0} married)` : null} />
            </InfoCard>
            {p.children_count > 0 && (
              <InfoCard title="Children Details" icon={Users}>
                <DetailItem label="Number of Children" value={p.children_count} />
                {p.children && p.children.map((child: any, idx: number) => (
                  <DetailItem key={idx} label={`Child ${idx + 1}`} value={`${child.name} (${child.gender}, ${child.age} yrs)`} />
                ))}
              </InfoCard>
            )}
            <InfoCard title="Family Background" icon={Home}>
              <DetailItem label="Family Type" value={fam.family_type} />
              <DetailItem label="Family Status" value={fam.family_status} />
              <DetailItem label="Native Place" value={fam.native_place} />
              <DetailItem label="Family Location" value={[fam.family_city, fam.family_state].filter(Boolean).join(', ') || null} />
            </InfoCard>
            <InfoCard title="Mosal (Maternal) Details" icon={Users}>
              <DetailItem label="Mosal Name" value={fam.mosal_name} />
              <DetailItem label="Mosal Address" value={[fam.mosal_address, fam.mosal_city, fam.mosal_state].filter(Boolean).join(', ') || null} />
            </InfoCard>
          </>
        ) : <p className="text-gray-400 text-[15px] py-10 text-center flex flex-col items-center gap-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><Home size={32} className="text-gray-300" /> No family details provided.</p>}
      </div>
    )
    if (tabId === 'lifestyle') return (
      <div className="pt-2">
        {life || horo ? (
          <>
            {life && (
              <>
                <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm"><Utensils size={16} className="text-primary-600" /></div>
                    <h3 className="text-[15px] font-bold text-gray-800 tracking-wide">Habits & Lifestyle</h3>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-4">
                    {[{icon: Utensils, label: 'Diet', value: life.diet, color: 'text-green-600', bg: 'bg-green-50'},
                      {icon: Cigarette, label: 'Smoking', value: life.smoking, color: life.smoking==='No'?'text-green-600':life.smoking==='Yes'?'text-red-500':'text-yellow-500', bg: life.smoking==='No'?'bg-green-50':life.smoking==='Yes'?'bg-red-50':'bg-yellow-50'},
                      {icon: Wine, label: 'Drinking', value: life.drinking, color: life.drinking==='No'?'text-green-600':life.drinking==='Yes'?'text-red-500':'text-yellow-500', bg: life.drinking==='No'?'bg-green-50':life.drinking==='Yes'?'bg-red-50':'bg-yellow-50'}
                    ].map(({icon: Icon, label, value, color, bg}) => (
                      <div key={label} className={`${bg} rounded-xl p-4 flex flex-col items-center justify-center text-center transition-transform hover:-translate-y-1`}>
                        <Icon size={24} className={`mb-2 ${color}`} />
                        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</span>
                        <span className="text-[15px] font-bold text-gray-900">{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(life.hobbies?.length > 0 || life.languages_known?.length > 0) && (
                  <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                    <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2.5">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm"><Star size={16} className="text-primary-600" /></div>
                      <h3 className="text-[15px] font-bold text-gray-800 tracking-wide">Interests & Languages</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      {life.hobbies?.length > 0 && (
                        <div>
                          <p className="text-[13px] text-gray-500 font-bold uppercase tracking-wider mb-3">Hobbies & Interests</p>
                          <div className="flex flex-wrap gap-2">
                            {life.hobbies.map((h:string,i:number)=>(
                              <span key={i} className="bg-primary-50 text-primary-700 border border-primary-100 px-3.5 py-1.5 rounded-full text-[13.5px] font-medium shadow-sm">{h}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {life.languages_known?.length > 0 && (
                        <div>
                          <p className="text-[13px] text-gray-500 font-bold uppercase tracking-wider mb-3">Languages Known</p>
                          <div className="flex flex-wrap gap-2">
                            {life.languages_known.map((l:string,i:number)=>(
                              <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 px-3.5 py-1.5 rounded-full text-[13.5px] font-medium shadow-sm">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {horo && (
              <InfoCard title="Horoscope Details" icon={Moon}>
                <DetailItem label="Manglik" value={horo.manglik} />
                <DetailItem label="Rashi" value={horo.rashi} />
                <DetailItem label="Nakshatra" value={horo.nakshatra} />
                <DetailItem label="Birth Time" value={horo.birth_time} />
                <DetailItem label="Birth Place" value={horo.birth_place} />
              </InfoCard>
            )}
          </>
        ) : <p className="text-gray-400 text-[15px] py-10 text-center flex flex-col items-center gap-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><Star size={32} className="text-gray-300" /> No lifestyle details provided.</p>}
      </div>
    )
    if (tabId === 'preferences') return (
      <div className="pt-2">
        {prefs ? (
          <>
            {prefs.about_partner && (
              <div className="mb-8 bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Heart size={100} /></div>
                <div className="flex items-center gap-2.5 mb-3 relative z-10">
                  <div className="p-1.5 bg-primary-100 rounded-lg text-primary-600"><Info size={18} /></div>
                  <h3 className="text-[16px] font-bold text-gray-800">About Ideal Partner</h3>
                </div>
                <p className="text-gray-700 text-[15px] leading-relaxed relative z-10">{prefs.about_partner}</p>
              </div>
            )}
            
            <InfoCard title="Basic Preferences" icon={Heart}>
              <DetailItem label="Age Range" value={prefs.age_from && prefs.age_to ? `${prefs.age_from} to ${prefs.age_to} Years` : null} />
              <DetailItem label="Height Range" value={prefs.height_from_cm && prefs.height_to_cm ? `${formatHeight(prefs.height_from_cm)} to ${formatHeight(prefs.height_to_cm)}` : null} />
              <DetailItem label="Marital Status" value={prefs.marital_status_pref?.length > 0 ? prefs.marital_status_pref : null} />
            </InfoCard>

            <InfoCard title="Background Preferences" icon={BookOpen}>
              <DetailItem label="Religion" value={prefs.religion_pref?.length > 0 ? prefs.religion_pref : null} />
              <DetailItem label="Caste" value={prefs.caste_pref?.length > 0 ? prefs.caste_pref : null} />
              <DetailItem label="Mother Tongue" value={prefs.mother_tongue_pref?.length > 0 ? prefs.mother_tongue_pref : null} />
              <DetailItem label="Manglik" value={prefs.manglik_pref} />
            </InfoCard>

            <InfoCard title="Lifestyle Preferences" icon={Utensils}>
              <DetailItem label="Diet" value={prefs.diet_pref?.length > 0 ? prefs.diet_pref : null} />
              <DetailItem label="Smoking" value={prefs.smoking_pref} />
              <DetailItem label="Drinking" value={prefs.drinking_pref} />
            </InfoCard>
          </>
        ) : <p className="text-gray-400 text-[15px] py-10 text-center flex flex-col items-center gap-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><Heart size={32} className="text-gray-300" /> No partner preferences provided.</p>}
      </div>
    )
    if (tabId === 'photos') return (
      <div className="pt-2">
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {photos.map((photo: any) => (
              <div key={photo.id} className="relative rounded-2xl overflow-hidden cursor-pointer aspect-square bg-gray-100 shadow-sm transition-transform hover:scale-[1.02] hover:shadow-md" onClick={() => { 
                if (!isPhotoBlurred) {
                  setSelectedPhoto(photo.photo_url); 
                  setShowPhotoModal(true) 
                }
              }}>
                <img src={photo.photo_url} alt="" className={`w-full h-full object-cover transition-transform duration-500 ${isPhotoBlurred ? 'blur-xl scale-110 pointer-events-none' : ''}`} />
                {!isPhotoBlurred && <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2">
                  <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm"><Eye size={24} className="text-white" /></div>
                  <span className="text-white text-sm font-medium">View Full Size</span>
                </div>}
                {isPhotoBlurred && <div className="absolute inset-0 bg-black/10 flex flex-col items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg mb-2"><Lock size={24} className="text-gray-600" /></div>
                  <span className="text-xs font-bold text-white bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm uppercase tracking-wider">Photo Hidden</span>
                </div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-3">
              <Camera size={36} className="text-gray-400" />
            </div>
            <h3 className="text-gray-800 font-semibold mb-1">No Photos Uploaded</h3>
            <p className="text-gray-500 text-sm">This user hasn't uploaded any additional photos.</p>
          </div>
        )}
      </div>
    )
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden group relative">
        <div className="h-36 bg-gradient-to-r from-primary-800 via-primary to-primary-600 relative"></div>
        <div className="px-6 pb-6 -mt-16">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Profile Photo with Auto-Rotate */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-4 border-white shadow-lg relative">
                <div
                  className={`w-full h-full cursor-pointer transition-opacity duration-500 ${
                    photoTransition ? 'opacity-100' : 'opacity-0'
                  }`}
                  onClick={() => {
                    if (!isPhotoBlurred) {
                      setSelectedPhoto(currentPhoto)
                      setShowPhotoModal(true)
                    }
                  }}
                >
                  {isPhotoBlurred ? (
                    <img
                      src={currentPhoto}
                      alt={p.first_name}
                      className="w-full h-full object-cover blur-xl scale-110 select-none pointer-events-none"
                    />
                  ) : (
                    <ProfilePhotoFrame
                      photoUrl={currentPhoto}
                      status={(p.profile_status as ProfileStatus) || "active"}
                      size={144}
                      alt={p.first_name}
                    />
                  )}
                </div>
                
                {/* Overlay for Blurred Photo */}
                {isPhotoBlurred && (
                  <div className="absolute inset-0 bg-black/10 flex flex-col items-center justify-center pointer-events-none rounded-2xl z-10">
                    <div className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-lg mb-2">
                      <EyeOff size={20} className="text-gray-600" />
                    </div>
                    <span className="text-xs font-bold text-white bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm uppercase tracking-wider">Photo Hidden</span>
                  </div>
                )}
                
                {/* Photo counter dots (if multiple photos) */}
                {allPhotos.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCurrentPhotoIndex(idx)
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentPhotoIndex % allPhotos.length
                            ? 'bg-white w-4'
                            : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Navigation arrows (if multiple photos) */}
                {allPhotos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotoTransition(false)
                        setTimeout(() => {
                          setCurrentPhotoIndex(prev => prev === 0 ? allPhotos.length - 1 : prev - 1)
                          setPhotoTransition(true)
                        }, 200)
                      }}
                      className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPhotoTransition(false)
                        setTimeout(() => {
                          setCurrentPhotoIndex(prev => (prev + 1) % allPhotos.length)
                          setPhotoTransition(true)
                        }, 200)
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>

              {/* Photo count badge */}
              {allPhotos.length > 1 && (
                <div className="absolute -bottom-2 -right-2 bg-primary text-white text-xs rounded-full px-2 py-0.5 shadow flex items-center gap-1">
                  <Camera size={10} />
                  {allPhotos.length}
                </div>
              )}

              {/* Verified badge */}
              {p.is_verified && (
                <div className="absolute -bottom-2 -left-2 bg-blue-500 text-white rounded-full p-1.5 shadow">
                  <ShieldCheck size={14} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-16 sm:pt-20 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 w-full">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">{firstName} {lastName}</h1>
                    {id && isUserOnline(id) && <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold whitespace-nowrap"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Online</span>}
                    {p.is_verified && <span className="bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold whitespace-nowrap"><ShieldCheck size={12} /> Verified</span>}
                    {p.is_premium && <span className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold shadow-sm whitespace-nowrap"><Star size={12} className="text-yellow-600" /> Premium</span>}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-3 text-sm text-gray-500 font-medium mb-3">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 whitespace-nowrap">ID: {profileId}</span>
                    <span className="flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 break-words"><MapPin size={14} className="text-gray-400 shrink-0"/> {location}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                    {age && <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar size={14} className="text-gray-400" /> {age} yrs</span>}
                    {height && <span className="flex items-center gap-1.5 whitespace-nowrap"><Ruler size={14} className="text-gray-400" /> {height}</span>}
                    {p.religion && <span className="flex items-center gap-1.5 whitespace-nowrap"><BookOpen size={14} className="text-gray-400" /> {p.religion}{p.caste ? `, ${p.caste}` : ''}{p.sub_caste ? ` (${p.sub_caste})` : ''}</span>}
                    {edu?.highest_education && <span className="flex items-center gap-1.5 whitespace-nowrap"><GraduationCap size={14} className="text-gray-400" /> {edu.highest_education}</span>}
                    {edu?.occupation && <span className="flex items-center gap-1.5 whitespace-nowrap"><Briefcase size={14} className="text-gray-400" /> {edu.occupation}</span>}
                  </div>
                </div>

                {/* Match Score (Professional Circular Progress) */}
                <div className="flex flex-col items-center justify-center shrink-0 absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 bg-white/90 backdrop-blur-md sm:bg-transparent p-2.5 rounded-2xl border sm:border-0 border-gray-100 shadow-sm sm:shadow-none z-10">
                  <div className="relative w-14 h-14">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="text-primary"
                        strokeDasharray={`${calculateMatchPercentage(myProfile, p)}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-gray-900">{calculateMatchPercentage(myProfile, p)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-primary">
                    <Heart size={10} className="fill-primary" />
                    <span className="text-[10px] font-bold tracking-wider uppercase sm:text-gray-500">Match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            {renderInterestButton()}
            <button
              onClick={handleToggleShortlist}
              className={`px-5 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 border flex-1 sm:flex-none ${
                shortlisted ? 'bg-red-50 text-red-600 border-red-200' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Heart size={18} className={shortlisted ? 'fill-red-500 text-red-500' : ''} />
              {shortlisted ? 'Shortlisted' : 'Shortlist'}
            </button>
            
            <div className="w-full sm:flex-1 hidden sm:block"></div>
            
            <button onClick={() => setShowBlockConfirm(true)} className="px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 text-gray-600 hover:text-red-600 border border-gray-200 hover:bg-red-50 hover:border-red-200 flex-1 sm:flex-none" title="Block User">
              <Ban size={18} /> <span className="font-semibold">Block</span>
            </button>
            <button onClick={() => setShowReportModal(true)} className="px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 text-gray-600 hover:text-red-600 border border-gray-200 hover:bg-red-50 hover:border-red-200 flex-1 sm:flex-none" title="Report User">
              <Flag size={18} /> <span className="font-semibold">Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contact Reveal Section */}
      {(isOwnProfile || isAdmin || canRevealContact) ? (
        <ContactRevealBox 
          profileId={p.id}
          contactData={{
             phone: p.phone,
             email: p.email,
             biodata_url: biodataUrl
          }}
        />
      ) : (
        <div className="mt-6 border border-gray-200 bg-gray-50/50 rounded-2xl overflow-hidden p-5 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading font-bold text-xl text-gray-900 flex items-center gap-2">
              <Lock size={20} className="text-gray-400" />
              Contact Details
            </h3>
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full flex items-center gap-1"><Lock size={10} /> Restricted</span>
          </div>

          <div className="space-y-3 mb-8 opacity-60 pointer-events-none select-none">
            <div className="flex items-center gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
              <Phone className="text-gray-400 shrink-0" size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Mobile Number</p>
                <p className="text-base sm:text-lg font-bold font-mono tracking-widest text-gray-800 blur-[4px]">●●●●●●●●●●</p>
              </div>
              <Lock size={16} className="text-gray-300" />
            </div>
            <div className="flex items-center gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
              <Globe className="text-gray-400 shrink-0" size={24} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Email Address</p>
                <p className="text-base sm:text-lg font-bold font-mono tracking-widest text-gray-800 blur-[4px]">●●●●@●●●●●</p>
              </div>
              <Lock size={16} className="text-gray-300" />
            </div>
            {biodataUrl && (
              <div className="flex items-center gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
                <FileText className="text-gray-400 shrink-0" size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Biodata</p>
                  <p className="text-base sm:text-lg font-bold text-gray-800 blur-[4px]">Document locked</p>
                </div>
                <Lock size={16} className="text-gray-300" />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl border border-amber-200 shadow-sm text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
              <Lock size={24} className="text-amber-500" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-base mb-1">Interest Approval Required</h4>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                {interestStatus?.received?.status === 'pending'
                  ? 'This user has sent you an interest. Accept it to unlock the ability to reveal contact details.'
                  : 'Send an interest and wait for approval to unlock contact details.'}
              </p>
            </div>
            {!interestStatus?.sent && !interestStatus?.received && (
              <button
                onClick={() => setShowInterestModal(true)}
                className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center gap-2 shadow-md shadow-primary/20"
              >
                <Heart size={16} /> Send Interest First
              </button>
            )}
            {interestStatus?.sent?.status === 'pending' && (
              <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5 bg-amber-50 px-4 py-2 rounded-full border border-amber-200">
                <Clock size={14} /> Waiting for approval...
              </span>
            )}
            {interestStatus?.received?.status === 'pending' && (
              <span className="text-sm text-blue-600 font-medium flex items-center gap-1.5 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                <Heart size={14} /> They sent you an interest — accept it to unlock contact reveal!
              </span>
            )}
          </div>
        </div>
      )}

      {/* â”€â”€ MOBILE ACCORDION VIEW (below md) â”€â”€ */}
      <div className="mt-4 md:hidden space-y-3">
        {tabs.map(tab => (
          <div key={tab.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === tab.id ? '' : tab.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-gray-800"
            >
              <span>{tab.label}</span>
              <ChevronRight size={16} className={`text-gray-400 transition-transform ${openSection === tab.id ? 'rotate-90' : ''}`} />
            </button>
            {openSection === tab.id && (
              <div className="px-4 pb-4 border-t border-gray-50">
                {renderTabContent(tab.id)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* â”€â”€ DESKTOP TAB VIEW (md and above) â”€â”€ */}
      <div className="mt-6 bg-white rounded-2xl shadow-md overflow-hidden hidden md:block">
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.id
                    ? 'text-primary border-primary bg-primary-50/50'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Render active tab */}
          {renderTabContent(activeTab)}
        </div>
      </div>

      {/* OLD TAB CONTENT REMOVED - now using TabContent function */}

      {/* Similar Profiles */}
      {similarProfiles.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Similar Profiles</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {similarProfiles.map(profile => (
              <ProfileCard key={(profile?.id || '')} profile={profile} currentUserId={user?.id || ''} />
            ))}
          </div>
        </div>
      )}


      {/* Send Interest Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Send Interest to {p.first_name}</h3>
              <button onClick={() => setShowInterestModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <textarea
              value={interestMessage}
              onChange={(e) => setInterestMessage(e.target.value)}
              placeholder="Write a personal message (optional)..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none resize-none"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 text-right mt-1">{interestMessage.length}/500</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSendInterest}
                disabled={sendingInterest}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingInterest ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Heart size={18} />}
                {sendingInterest ? 'Sending...' : 'Send Interest'}
              </button>
              <button onClick={() => setShowInterestModal(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <button onClick={() => setShowPhotoModal(false)} className="absolute -top-10 right-0 text-white hover:text-gray-300"><X size={28} /></button>
            <img src={selectedPhoto} alt="Full size" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* Report Modal */}
      <ReportUserModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
        reportedUserName={firstName}
      />

      <ConfirmDialog 
        isOpen={showBlockConfirm}
        title="Block User"
        message="Are you sure you want to block this profile? You will no longer see each other."
        confirmText="Block"
        variant="danger"
        onConfirm={handleBlock}
        onClose={() => setShowBlockConfirm(false)}
      />
    </div>
  )
}
