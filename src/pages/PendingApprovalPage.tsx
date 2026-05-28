import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import { useMasterData } from '../store/masterDataStore'
import { Heart, Clock, Mail, Phone, MapPin, CheckCircle, ShieldCheck, LogOut, Upload, FileText, X, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { uploadDocument } from '../lib/actions/authActions'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import { PageSkeleton } from '../components/ui/Skeletons'
import { apiUrl } from '../lib/api'

function getElapsedTime(createdAt: string) {
  const registered = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = now - registered

  const hours   = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

  return { hours, minutes, seconds, diffMs }
}

export default function PendingApprovalPage() {
  const { profile , loading: authLoading} = useAuthStore()
  const navigate = useNavigate()
  const { admin_settings_kv } = useMasterData()
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan'
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0, diffMs: 0 })

  // Document states
  const [documents, setDocuments] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null)
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null)
  const aadhaarFrontRef = useRef<HTMLInputElement>(null)
  const aadhaarBackRef = useRef<HTMLInputElement>(null)

  // Stable ref for profile id - prevents socket listener re-registration
  const profileIdRef = useRef(profile?.id)
  profileIdRef.current = profile?.id

  const fetchDocuments = async (pid: string, isInitial = false) => {
    try {
      const res = await fetch(apiUrl(`/api/documents/${pid}`), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error('Failed to fetch documents', e);
    } finally {
      if (isInitial) setLoadingDocs(false);
    }
  };

  // Load documents when profile is ready
  useEffect(() => {
    if (profile?.id) fetchDocuments(profile.id, true);
    else if (!authLoading) setLoadingDocs(false);
  }, [profile?.id, authLoading]);

  // Approval detection: socket events + 10s polling + immediate check on mount
  // Uses a guard ref to prevent double-redirect if multiple triggers fire at once
  const redirectingRef = useRef(false);

  useEffect(() => {
    const checkApproval = async () => {
      if (redirectingRef.current) return;
      // Fetch fresh profile from server and update the store
      await useAuthStore.getState().refreshProfile();
      const latest = useAuthStore.getState().profile;
      if (latest?.is_verified && !redirectingRef.current) {
        redirectingRef.current = true;
        toast.success('🎉 Your profile has been approved! Redirecting...');
        // Small delay so the toast is visible, then navigate
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    };

    // Socket: profile:updated — server pushes the updated profile directly
    const handleProfileUpdated = (updatedProfile: any) => {
      if (updatedProfile?.id !== profileIdRef.current) return;
      // Immediately update the store with the pushed profile
      useAuthStore.getState().setProfile(updatedProfile);
      if (updatedProfile.is_verified) {
        if (redirectingRef.current) return;
        redirectingRef.current = true;
        toast.success('🎉 Your profile has been approved! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    };

    // Socket: document:status-changed — individual doc approved/rejected
    const handleDocStatusChanged = (data: any) => {
      if (data.userId !== profileIdRef.current) return;
      const pid = profileIdRef.current;
      if (pid) fetchDocuments(pid, false);
      if (data.status === 'rejected') {
        toast.error('A document was rejected. Please re-upload.');
      } else if (data.status === 'approved') {
        toast.success('A document has been approved!');
        // If server also says fully verified, redirect immediately
        if (data.isVerified) {
          if (redirectingRef.current) return;
          redirectingRef.current = true;
          toast.success('🎉 Your profile has been approved! Redirecting...');
          setTimeout(() => navigate('/dashboard'), 1500);
        } else {
          // Not fully verified yet — just re-check
          checkApproval();
        }
      }
    };

    // Register listeners on the socket — use a ref to track registered socket
    // so we don't stack duplicate listeners on re-renders
    let registeredSocket: any = null;

    const registerListeners = (socket: any) => {
      if (!socket || socket === registeredSocket) return;
      if (registeredSocket) {
        registeredSocket.off('profile:updated', handleProfileUpdated);
        registeredSocket.off('document:status-changed', handleDocStatusChanged);
      }
      socket.on('profile:updated', handleProfileUpdated);
      socket.on('document:status-changed', handleDocStatusChanged);
      registeredSocket = socket;
    };

    // Register on currently connected socket if already available
    const currentSocket = useSocketStore.getState().socket;
    if (currentSocket) registerListeners(currentSocket);

    // Subscribe reactively — handles case where socket connects after mount
    const unsubSocket = useSocketStore.subscribe((state) => {
      if (state.socket) registerListeners(state.socket);
    });

    // Check immediately + poll every 10s as fallback
    checkApproval();
    const poll = setInterval(checkApproval, 10000);

    return () => {
      clearInterval(poll);
      unsubSocket();
      if (registeredSocket) {
        registeredSocket.off('profile:updated', handleProfileUpdated);
        registeredSocket.off('document:status-changed', handleDocStatusChanged);
      }
    };
  }, [navigate]);


  useEffect(() => {
    const createdAt = profile?.created_at || new Date().toISOString()
    const tick = () => setElapsed(getElapsedTime(createdAt))
    tick()
    const id = setInterval(tick, 1000) // Update every 1s for real-time countdown
    return () => clearInterval(id)
  }, [profile?.created_at])

  const pad = (n: number) => String(n).padStart(2, '0')

  const frontDoc = documents.find(d => d.document_type === 'aadhaar_front')
  const backDoc = documents.find(d => d.document_type === 'aadhaar_back')

  const isFrontRejected = frontDoc?.verification_status === 'rejected'
  const isBackRejected = backDoc?.verification_status === 'rejected'
  const isAnyRejected = isFrontRejected || isBackRejected

  const steps = [
    { label: 'Profile Submitted', done: true,  icon: CheckCircle },
    { label: 'Under Admin Review', done: true,  icon: ShieldCheck },
    { label: isAnyRejected ? 'Action Required' : 'Approval Pending',   done: false, icon: isAnyRejected ? AlertTriangle : Clock        },
    { label: 'Profile Goes Live',  done: false, icon: Heart        },
  ]

  const handleReupload = async () => {
    const pid = profileIdRef.current;
    if (!pid) return;
    if (isFrontRejected && !aadhaarFront) {
      toast.error('Please select Aadhaar Front image');
      return;
    }
    if (isBackRejected && !aadhaarBack) {
      toast.error('Please select Aadhaar Back image');
      return;
    }

    setUploading(true);
    try {
      if (isFrontRejected && aadhaarFront) {
        await uploadDocument(pid, aadhaarFront, 'aadhaar_front');
      }
      if (isBackRejected && aadhaarBack) {
        await uploadDocument(pid, aadhaarBack, 'aadhaar_back');
      }
      
      toast.success('Documents re-uploaded successfully! They will be reviewed again.');
      setAadhaarFront(null);
      setAadhaarBack(null);
      
      // Refresh documents list
      await fetchDocuments(pid, false);
      
    } catch (error) {
      toast.error('Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loadingDocs) {
    return <PageSkeleton />
  }
  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-rose-50 flex flex-col py-12 min-h-[80vh]">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {!isAnyRejected ? (
          <div className="relative mb-8 flex justify-center">
             <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-28 h-28 text-primary"
                animate={{ rotate: 180 }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut",
                  repeatDelay: 0.5
                }}
              >
                <path d="M5 22h14" />
                <path d="M5 2h14" />
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
                {/* Top sand */}
                <motion.path
                  d="M9 5h6l-3 4.5z"
                  fill="currentColor"
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 0.5 }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 0.5 }}
                />
                {/* Bottom sand */}
                <motion.path
                  d="M9 19h6l-3-4.5z"
                  fill="currentColor"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 0.5 }}
                />
                {/* Falling sand line */}
                <motion.line
                  x1="12" y1="9.5" x2="12" y2="19"
                  strokeWidth="2"
                  stroke="currentColor"
                  initial={{ opacity: 0, strokeDasharray: "0 100" }}
                  animate={{ opacity: 1, strokeDasharray: "100 100" }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear", repeatDelay: 0.5 }}
                />
              </motion.svg>
          </div>
        ) : (
          <div className="relative mb-8 flex justify-center text-red-500">
             <AlertTriangle className="w-28 h-28" strokeWidth={1.5} />
          </div>
        )}

        <h1 className={`text-3xl sm:text-4xl font-heading font-bold text-center mb-2 ${isAnyRejected ? 'text-red-600' : 'text-gray-900'}`}>
          {isAnyRejected ? 'Action Required' : 'Profile Under Review'}
        </h1>
        <p className="text-gray-500 text-center max-w-md text-base mb-10">
          {isAnyRejected 
            ? "There was an issue with your submitted documents. Please check the reason below and re-upload the correct documents."
            : <span>Thank you for registering with <strong className="text-primary">{siteName}</strong>! Your profile has been submitted and is being reviewed by our team. You will get full access once approved.</span>}
        </p>

        {isAnyRejected && (
          <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-2xl p-6 mb-10 shadow-sm">
            <h3 className="text-red-800 font-bold mb-4 flex items-center gap-2">
              <AlertTriangle size={20} />
              Rejection Reasons
            </h3>
            
            <div className="space-y-4">
              {isFrontRejected && (
                <div className="bg-white p-4 rounded-xl border border-red-100">
                  <p className="font-semibold text-sm text-gray-800">Aadhaar Front</p>
                  <p className="text-red-600 text-sm mt-1">{frontDoc?.admin_notes || 'Document was not clear or invalid.'}</p>
                </div>
              )}
              {isBackRejected && (
                <div className="bg-white p-4 rounded-xl border border-red-100">
                  <p className="font-semibold text-sm text-gray-800">Aadhaar Back</p>
                  <p className="text-red-600 text-sm mt-1">{backDoc?.admin_notes || 'Document was not clear or invalid.'}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-gray-800 pt-4 border-t border-red-200">Re-upload Documents</h4>
              <p className="text-xs text-gray-500 mb-4">Please upload clear, readable images of your Aadhaar card.</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                {isFrontRejected && (
                  <div onClick={() => !aadhaarFront && aadhaarFrontRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition relative bg-white ${!aadhaarFront ? 'border-gray-300 hover:border-primary hover:bg-primary-50' : 'border-primary bg-primary-50'}`}>
                    {!aadhaarFront ? <><Upload className="text-gray-400 mx-auto mb-2" size={24} /><span className="text-xs font-medium">Re-upload Front</span></> : <><FileText className="text-primary mx-auto mb-2" size={24}/><span className="text-xs text-green-600 font-bold truncate block">{aadhaarFront.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarFront(null) }}><X size={16}/></button></>}
                    <input ref={aadhaarFrontRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarFront(e.target.files[0]) }} />
                  </div>
                )}
                
                {isBackRejected && (
                  <div onClick={() => !aadhaarBack && aadhaarBackRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition relative bg-white ${!aadhaarBack ? 'border-gray-300 hover:border-primary hover:bg-primary-50' : 'border-primary bg-primary-50'}`}>
                    {!aadhaarBack ? <><Upload className="text-gray-400 mx-auto mb-2" size={24} /><span className="text-xs font-medium">Re-upload Back</span></> : <><FileText className="text-primary mx-auto mb-2" size={24}/><span className="text-xs text-green-600 font-bold truncate block">{aadhaarBack.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarBack(null) }}><X size={16}/></button></>}
                    <input ref={aadhaarBackRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarBack(e.target.files[0]) }} />
                  </div>
                )}
              </div>

              <Button variant="primary" onClick={handleReupload} loading={uploading} className="w-full">
                {uploading ? 'Uploading...' : 'Submit Documents'}
              </Button>
            </div>
          </div>
        )}

        {/* Live Elapsed Counter - Only show if not rejected */}
        {!isAnyRejected && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 px-6 py-6 mb-10 w-full max-w-sm text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Time Since Registration</p>
            <div className="flex items-center justify-center gap-3">
              {/* Hours */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold font-mono shadow-md">
                  {pad(elapsed.hours)}
                </div>
                <span className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider">Hours</span>
              </div>
              <span className="text-primary font-bold text-2xl pb-4 animate-pulse">:</span>
              {/* Minutes */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold font-mono shadow-md">
                  {pad(elapsed.minutes)}
                </div>
                <span className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider">Minutes</span>
              </div>
              <span className="text-primary font-bold text-2xl pb-4 animate-pulse">:</span>
              {/* Seconds */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/80 text-white flex items-center justify-center text-2xl font-bold font-mono shadow-md transition-all">
                  {pad(elapsed.seconds)}
                </div>
                <span className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider">Seconds</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Approvals typically take <strong className="text-gray-600">24-48 working hours</strong></p>
          </div>
        )}

        {/* Progress Steps */}
        <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-lg p-6 mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Approval Steps</p>
          <div className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon
              const isActive = (i === 2 && !isAnyRejected) || (isAnyRejected && i === 2)
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    step.done
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? isAnyRejected ? 'bg-red-500 text-white' : 'bg-primary text-white animate-pulse'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${step.done ? 'text-green-700' : isActive ? (isAnyRejected ? 'text-red-600' : 'text-primary') : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                    {isActive && !isAnyRejected && (
                      <p className="text-xs text-gray-400 mt-0.5">Our team is reviewing your details…</p>
                    )}
                    {isActive && isAnyRejected && (
                      <p className="text-xs text-red-500 mt-0.5">Please check rejection reasons below.</p>
                    )}
                  </div>
                  {step.done && (
                    <CheckCircle size={18} className="text-green-500 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact Details */}
        <div className="w-full max-w-md bg-gradient-to-br from-primary-700 to-primary-900 text-white rounded-3xl shadow-xl p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-white/70 mb-4">Need Help? Contact Us</p>
          <div className="space-y-4">
            <a href="mailto:support@atmilan.com" className="flex items-center gap-4 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Mail size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] text-white/60 uppercase tracking-wider">Email</p>
                <p className="font-semibold text-sm">support@atmilan.com</p>
              </div>
            </a>
            <a href="tel:+919876543210" className="flex items-center gap-4 p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] text-white/60 uppercase tracking-wider">Phone</p>
                <p className="font-semibold text-sm">+91 98765 43210</p>
                <p className="text-[11px] text-white/50">Mon–Sat, 10 AM – 7 PM</p>
              </div>
            </a>
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[11px] text-white/60 uppercase tracking-wider">Office</p>
                <p className="font-semibold text-sm">Community Center, India</p>
                <p className="text-[11px] text-white/50">Headquarters</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-gray-400">
          You registered as: <strong className="text-gray-700">{profile?.first_name} {profile?.last_name}</strong>
        </p>
        <p className="text-xs text-gray-400 mt-1 text-center">
          Registered on: {profile?.created_at ? new Date(profile.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
        </p>

      </main>
    </div>
  )
}
