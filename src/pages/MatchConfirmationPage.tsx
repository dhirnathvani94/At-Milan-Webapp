import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useMasterData } from '../store/masterDataStore'
import { useSocketStore } from '../store/socketStore'
import { apiUrl } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'
import { Heart, Search, Gift, Share2, Copy, CheckCircle } from 'lucide-react'
export default function MatchConfirmationPage() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const { admin_settings_kv } = useMasterData()
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan'
  const siteUrl = window.location.origin

  const [step, setStep] = useState<'A' | 'B' | 'C' | 'D' | 'SUCCESS'>('A')
  const [matchType, setMatchType] = useState<'engaged' | 'married'>('engaged')
  const [matchPlatform, setMatchPlatform] = useState<'atmilan' | 'other'>('atmilan')
  const [partnerProfileId, setPartnerProfileId] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [referralCode, setReferralCode] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)

  const [searchParams] = useSearchParams()
  
  // Read email link params — if answer=yes, skip Step A automatically
  useEffect(() => {
    const answer = searchParams.get('answer')
    if (answer === 'yes') {
      setStep('B')
    }
  }, [])

  const handleSubmit = async (overridePlatform?: 'atmilan' | 'other') => {
    const finalPlatform = overridePlatform || matchPlatform;
    if (finalPlatform === 'atmilan' && !partnerProfileId) {
      toast.error('Please enter your partner\'s profile ID')
      return
    }

    setSubmitting(true)
    try {
      const urlUserId = searchParams.get('userId')
      const token = localStorage.getItem('atmilan-token') || localStorage.getItem('token')
      // If userId is in URL, ALWAYS use email endpoint
      // (even if logged in) to confirm for that specific user
      const isFromEmail = !!urlUserId
      
      const endpoint = isFromEmail
        ? apiUrl('/api/match-confirmation-email')
        : apiUrl('/api/match-confirmation')
      
      const body: any = {
        match_type: matchType || 'engagement',
        match_platform: finalPlatform || 'other',
        partner_profile_id: finalPlatform === 'atmilan' ? partnerProfileId : null,
      }
      if (isFromEmail) {
        body.user_id = urlUserId
      }
      
      const headers: any = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
      
      let data: any = {}
      try {
        data = await res.json()
      } catch {
        throw new Error('Server error. Please try again.')
      }
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
      }
        
      setReferralCode(data.referral_code || 'REF1234')
      
      // Update store
      await useAuthStore.getState().refreshProfile()
      
      // Emit socket event to notify other clients (if needed)
      const socket = useSocketStore.getState().socket
      if (socket) {
        socket.emit('profile-status:updated', { userId: profile?.id })
      }

      setShowConfetti(true)
      setStep('SUCCESS')
      
      // Stop confetti after 10s
      setTimeout(() => setShowConfetti(false), 10000)
    } catch (error: any) {
      const msg = error.message || 'Something went wrong. Please try again.'
      toast.error(msg)
      console.error('[MatchConfirmation] Error:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyLink = () => {
    const link = `${siteUrl}/register?ref=${referralCode}`
    navigator.clipboard.writeText(link)
    toast.success('Referral link copied to clipboard!')
  }

  const handleWhatsAppShare = () => {
    const link = `${siteUrl}/register?ref=${referralCode}`
    const text = `I found my match on ${siteName}! Join using my link and get 1 month free premium: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-rose-50 flex flex-col py-12 min-h-[80vh] relative overflow-hidden">
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10 w-full max-w-lg mx-auto">
        
        {step === 'A' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-primary-100 text-center w-full animate-fade-in-up">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
              💝
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Did you find your match?</h1>
            <p className="text-gray-500 mb-8">Have you successfully found your life partner?</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="primary" 
                size="lg" 
                className="flex-1 bg-green-500 hover:bg-green-600 border-none text-lg shadow-lg shadow-green-500/30"
                onClick={() => setStep('B')}
              >
                YES, I Did!
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 text-lg"
                onClick={() => {
                  toast.success('Thank you for letting us know!')
                  navigate('/dashboard')
                }}
              >
                Not Yet
              </Button>
            </div>
          </div>
        )}

        {step === 'B' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-primary-100 text-center w-full animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What was confirmed?</h2>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => { setMatchType('engaged'); setStep('C') }}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all group"
              >
                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">💍</span>
                <span className="font-bold text-gray-800 text-lg">Engagement Fixed</span>
              </button>
              
              <button 
                onClick={() => { setMatchType('married'); setStep('C') }}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-rose-400 hover:bg-rose-50 transition-all group"
              >
                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">💛</span>
                <span className="font-bold text-gray-800 text-lg">Marriage Fixed</span>
              </button>
            </div>
            
            <button onClick={() => setStep('A')} className="mt-6 text-sm text-gray-400 hover:text-gray-600">← Back</button>
          </div>
        )}

        {step === 'C' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-primary-100 text-center w-full animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Where did you meet?</h2>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => { setMatchPlatform('atmilan'); setStep('D') }}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-primary hover:bg-primary-50 transition-all group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <Search size={24} className="text-primary" />
                </div>
                <span className="font-bold text-gray-800 text-lg">Through {siteName}</span>
              </button>
              
              <button 
                onClick={() => { 
                  setMatchPlatform('other'); 
                  handleSubmit('other'); 
                }}
                className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all group"
              >
                <span className="text-4xl mb-3">🌍</span>
                <span className="font-bold text-gray-800 text-lg">Somewhere Else</span>
              </button>
            </div>
            
            <button onClick={() => setStep('B')} className="mt-6 text-sm text-gray-400 hover:text-gray-600">← Back</button>
          </div>
        )}

        {step === 'D' && matchPlatform === 'atmilan' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-primary-100 text-center w-full animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Partner's Profile ID</h2>
            <p className="text-gray-500 mb-6 text-sm">Please enter the profile ID of your match on {siteName}</p>
            
            <div className="mb-8">
              <input 
                type="text" 
                placeholder="e.g. AM123456" 
                value={partnerProfileId}
                onChange={(e) => setPartnerProfileId(e.target.value.toUpperCase())}
                className="w-full text-center text-2xl tracking-widest font-mono font-bold border-2 border-gray-200 rounded-xl py-4 focus:border-primary focus:ring-0 uppercase transition-colors"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('C')} className="flex-1">Back</Button>
              <Button variant="primary" onClick={() => handleSubmit('atmilan')} loading={submitting} className="flex-[2]">
                Submit & Confirm
              </Button>
            </div>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-primary-100 text-center w-full animate-fade-in-up relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-rose-400 to-primary"></div>
            
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <CheckCircle size={48} className="text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Congratulations! 🎉</h1>
            <p className="text-lg text-gray-600 mb-8 font-medium">
              Your {matchType === 'engaged' ? 'engagement' : 'marriage'} has been successfully confirmed.
            </p>
            
            <div className="bg-gradient-to-b from-rose-50 to-white border border-rose-100 rounded-2xl p-6 mb-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Gift size={12} /> A Gift For You
              </div>
              
              <p className="text-sm font-semibold text-gray-800 mb-4 mt-2">
                Share this link with friends. They get 1 month free premium when they register!
              </p>
              
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex items-center justify-between shadow-inner">
                <span className="font-mono text-sm text-gray-600 truncate mr-3">
                  {siteUrl}/register?ref={referralCode}
                </span>
                <button 
                  onClick={handleCopyLink}
                  className="p-2 text-gray-400 hover:text-primary hover:bg-primary-50 rounded-lg transition-colors shrink-0"
                  title="Copy Link"
                >
                  <Copy size={18} />
                </button>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleWhatsAppShare}
                className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white border-none shadow-md shadow-[#25D366]/20 font-bold"
              >
                <Share2 size={18} className="mr-2" /> Share on WhatsApp
              </Button>
            </div>
            
            <Button 
              variant="primary" 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </div>
        )}
        
      </main>
    </div>
  )
}
