import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail, FileText, Lock, Clock, Info, CheckCircle, Download, X, Eye, Star, CreditCard } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import Card from '../ui/Card'
import Button from '../ui/Button'
import toast from 'react-hot-toast'
import { apiUrl } from '../../lib/api'

interface ContactRevealBoxProps {
  profileId: string;
  contactData: {
    phone?: string;
    email?: string;
    biodata_url?: string;
  } | null;
}

export default function ContactRevealBox({ profileId, contactData }: ContactRevealBoxProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [revealState, setRevealState] = useState<'checking' | 'locked' | 'unlocked' | 'expired'>('checking')
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [revealedInfo, setRevealedInfo] = useState<any>(null)
  const [showBiodataModal, setShowBiodataModal] = useState(false)
  const [showBuyPopup, setShowBuyPopup] = useState(false)

  useEffect(() => {
    // Only check on initial mount or if currently not unlocked
    // Never re-check if we just successfully unlocked (prevents state reset)
    if (contactData && revealState !== 'unlocked') {
      checkSessionStatus()
    }
  }, [profileId, user?.id])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (revealState === 'unlocked' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setRevealState('expired')
            setRevealedInfo(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [revealState, timerSeconds])

  const checkSessionStatus = async () => {
    if (!user) return
    try {
      const res = await fetch(apiUrl(`/api/credits/reveal-contact/check?target_user_id=${profileId}&t=${Date.now()}`))
      const data = await res.json()
      
      if (data.is_unlocked) {
        setRevealState('unlocked')
        setTimerSeconds(data.time_remaining_seconds)
        setRevealedInfo({
          ...(contactData || {}),
          ...(data.contact_info || {}),
          biodata_url: data.contact_info?.biodata_url || contactData?.biodata_url
        })
      } else if (data.is_expired) {
        setRevealState('expired')
      } else {
        setRevealState('locked')
      }
    } catch (e) {
      console.error('Failed to check reveal status', e)
      setRevealState('locked')
    }
  }

  const handleUnlock = async () => {
    if (!user) return
    setLoading(true)
    
    try {
      const res = await fetch(apiUrl('/api/credits/reveal-contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: profileId })
      })
      const data = await res.json()
      
      if (res.status === 402) {
        setShowBuyPopup(true)
      } else if (res.ok && data.success) {
        const info = {
          ...(contactData || {}),
          ...(data.contact_info || {}),
          biodata_url: data.contact_info?.biodata_url || contactData?.biodata_url
        };
        if (!info.phone) info.phone = 'Not available';
        if (!info.email) info.email = 'Not available';
        setRevealedInfo(info)
        setTimerSeconds(data.time_remaining_seconds || 86400)
        setRevealState('unlocked')
        toast.success("Contact Details Unlocked!")
        // Update credits in background — don't await to prevent parent re-render
        if (data.credits) {
          const currentCredits = useAuthStore.getState().credits
          useAuthStore.getState().setCredits({
            ...currentCredits,
            free_views_remaining: data.credits.free_views_remaining,
            paid_views_balance: data.credits.paid_views_balance,
            free_monthly_limit: data.credits.free_monthly_limit,
          } as any)
        }
        // Refresh credits after a delay so component state is stable
        setTimeout(() => { useAuthStore.getState().refreshCredits() }, 2000)
      } else {
        toast.error(data.error || "Failed to unlock contact")
      }
    } catch (e) {
      console.error('Unlock error', e)
      toast.error("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatTimer = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s > 0 ? s + 's' : ''}`
  }

  // ── CREDIT-BASED UNLOCK: Checking state ───────────────
  if (revealState === 'checking') {
    return (
      <Card className="mt-6 border-gray-200 bg-gray-50/50 p-12 flex flex-col justify-center items-center gap-4">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium">Loading contact details...</p>
      </Card>
    )
  }

  // ── CREDIT-BASED UNLOCK: Already revealed (timer-based session) ───────────────
  if (revealState === 'unlocked') {
    const info = {
      ...(contactData || {}),
      ...(revealedInfo || {}),
      biodata_url: revealedInfo?.biodata_url || contactData?.biodata_url
    };
    return (
      <Card className="bg-white border-primary/30 shadow-lg shadow-primary/5 relative overflow-hidden mt-6">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-primary-400"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h3 className="font-heading font-bold text-xl text-gray-900">Contact Details</h3>
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
            <Clock size={16} className="text-amber-600" />
            <span className="text-sm font-semibold tracking-wide">Visible for {formatTimer(timerSeconds)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
              <div className="w-12 h-12 rounded-full bg-green-100 flex justify-center items-center text-green-600 shadow-sm border border-green-200 shrink-0">
                <Phone size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Mobile Number</p>
                <p className="text-lg sm:text-xl font-bold font-mono tracking-wider text-gray-900">{info.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-4 w-full sm:w-auto flex-1 overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex justify-center items-center text-blue-600 shadow-sm border border-blue-200 shrink-0">
                <Mail size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 font-medium mb-1">Email Address</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 truncate">{info.email || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {info.biodata_url && (
             <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
               <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                 <div className="w-12 h-12 rounded-full bg-purple-100 flex justify-center items-center text-purple-600 shadow-sm border border-purple-200 shrink-0">
                   <FileText size={24} />
                 </div>
                 <div>
                   <p className="text-sm text-gray-500 font-medium mb-1">Biodata</p>
                   <p className="text-base sm:text-lg font-bold text-gray-900">Document Available</p>
                 </div>
               </div>
               <button onClick={() => setShowBiodataModal(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 text-white font-bold text-sm bg-gray-900 px-5 py-2.5 rounded-lg hover:bg-gray-800 transition whitespace-nowrap">
                 <Eye size={16} /> Open Preview
               </button>
             </div>
          )}
        </div>

        {/* Biodata Preview Modal */}
        {showBiodataModal && info.biodata_url && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowBiodataModal(false)}>
            <div className="relative w-full max-w-4xl h-[85vh] bg-white rounded-xl overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} className="text-primary"/> Biodata Preview</h3>
                 <button onClick={() => setShowBiodataModal(false)} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-red-100 hover:text-red-500 transition"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 flex justify-center items-center p-4">
                {revealedInfo.biodata_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={revealedInfo.biodata_url} className="w-full h-full border-0 rounded bg-white" title="Biodata PDF" />
                ) : (
                  <img src={revealedInfo.biodata_url} alt="Biodata" className="max-w-full max-h-full object-contain shadow-sm" />
                )}
              </div>
              <div className="p-4 bg-white border-t flex justify-end">
                 <a href={revealedInfo.biodata_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white font-bold text-sm bg-primary px-5 py-2.5 rounded-lg hover:bg-primary-700 transition">
                   <Download size={16} /> Download
                 </a>
              </div>
            </div>
          </div>
        )}
      </Card>
    )
  }

  // LOCKED OR EXPIRED STATE
  return (
    <Card className={`mt-6 border overflow-hidden ${revealState === 'expired' ? 'border-red-200 bg-red-50/10' : 'border-gray-200 bg-gray-50/50'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-heading font-bold text-xl text-gray-900 flex items-center gap-2">
          <Lock size={20} className={revealState === 'expired' ? 'text-red-500' : 'text-gray-400'} />
          Contact Details
        </h3>
        {revealState === 'expired' && (
          <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">Session Expired</span>
        )}
      </div>

      <div className="space-y-3 mb-8 opacity-60 pointer-events-none filter select-none">
        <div className="flex items-center gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <Phone className="text-gray-400 shrink-0" size={24} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Mobile Number</p>
            <p className="text-base sm:text-lg font-bold font-mono tracking-widest text-gray-800 blur-[4px]">●●●●●●●●●●</p>
          </div>
          <Lock size={16} className="text-gray-300" />
        </div>
        <div className="flex items-center gap-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <Mail className="text-gray-400 shrink-0" size={24} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Email Address</p>
            <p className="text-base sm:text-lg font-bold font-mono tracking-widest text-gray-800 blur-[4px]">●●●●@●●●●●</p>
          </div>
          <Lock size={16} className="text-gray-300" />
        </div>
        {contactData?.biodata_url && (
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

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex-1 w-full">
           <Button 
             variant="primary" 
             size="lg" 
             className="w-full bg-primary hover:bg-primary-700 border-none shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
             onClick={handleUnlock}
             disabled={loading}
           >
             {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Eye size={20} />}
             Show Contact Detail
           </Button>
        </div>
        <div className="hidden sm:block w-px h-12 bg-gray-200"></div>
        <div className="text-center sm:text-left w-full sm:w-auto">
           <p className="text-sm text-gray-500 leading-relaxed max-w-[250px] mx-auto sm:mx-0 flex items-center justify-center sm:justify-start gap-2">
             <Clock size={16} className="text-primary shrink-0" />
             <span>Available for a limited time after unlocking.</span>
           </p>
        </div>
      </div>

      {showBuyPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden relative">
            <button 
              onClick={() => setShowBuyPopup(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors z-10"
            >
              <X size={18} />
            </button>
            <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 text-center text-white">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 bg-white/20">
                <CreditCard size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-1">Out of Credits</h2>
              <p className="text-white/80 text-sm">You don't have enough credits to view this contact.</p>
            </div>
            <div className="p-6">
              <Button 
                variant="primary" 
                fullWidth 
                className="py-3 shadow-md"
                onClick={() => {
                  setShowBuyPopup(false);
                  navigate('/credits');
                }}
              >
                Buy Credits Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
