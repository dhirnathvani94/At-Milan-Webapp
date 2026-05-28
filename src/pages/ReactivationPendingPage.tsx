import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import { useMasterData } from '../store/masterDataStore'
import { apiUrl } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/ui/Button'

export default function ReactivationPendingPage() {
  const { profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const { admin_settings_kv } = useMasterData()
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan'

  const [submitting, setSubmitting] = useState(false)
  // Bug 1 fix: requestSent syncs from live profile, not just initial state
  const [requestSent, setRequestSent] = useState(
    profile?.reactivation_status === 'pending'
  )
  const [userMessage, setUserMessage] = useState('')
  // Bug 2 fix: use actual rejection remark from profile, not a hardcoded string
  const [rejectionRemark, setRejectionRemark] = useState<string | null>(
    profile?.reactivation_status === 'rejected'
      ? (profile?.reactivation_rejection_remark || 'Your request was rejected by admin.')
      : null
  )

  // PRIMARY NAVIGATION TRIGGER — reactive, permanent fix.
  // socketStore's global profile:reactivated handler updates profile_status to 'active'.
  // This effect watches that change and navigates immediately — works via socket, polling,
  // or any other profile update mechanism. No race conditions possible.
  useEffect(() => {
    if (profile?.profile_status === 'active' && profile?.reactivation_status === 'approved') {
      toast.success('Your profile has been reactivated! Welcome back!')
      navigate('/dashboard')
      return
    }
    if (profile?.reactivation_status === 'pending') {
      setRequestSent(true)
    } else if (profile?.reactivation_status === 'rejected') {
      setRequestSent(false)
      setRejectionRemark(profile?.reactivation_rejection_remark || 'Your request was rejected by admin.')
    } else if (profile?.reactivation_status === 'none') {
      setRequestSent(false)
    }
  }, [profile?.profile_status, profile?.reactivation_status, profile?.reactivation_rejection_remark, navigate])

  // Socket listener ONLY for rejection remark (not in store by default)
  // profile:reactivated is handled globally in socketStore — no need here
  useEffect(() => {
    let registeredSocket: any = null;

    const handleReactivationRejected = async (data: any) => {
      const remark = data?.remark || 'Request rejected by admin.'
      setRejectionRemark(remark)
      setRequestSent(false)
      toast.error('Your request was rejected. See reason below.')
      await refreshProfile()
    }

    const registerListeners = (socket: any) => {
      if (!socket || socket === registeredSocket) return;
      if (registeredSocket) {
        registeredSocket.off('profile:reactivation-rejected', handleReactivationRejected)
      }
      socket.on('profile:reactivation-rejected', handleReactivationRejected)
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
        registeredSocket.off('profile:reactivation-rejected', handleReactivationRejected)
      }
    };
  }, [refreshProfile])


  const handleRequestReactivation = async () => {
    if (submitting || requestSent) return  // prevent double submit
    setSubmitting(true)
    try {
      const token = localStorage.getItem('atmilan-token') || localStorage.getItem('token') || ''
      const res = await fetch(apiUrl('/api/reactivation/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_message: userMessage })
      })

      // Safely parse response — server might return empty body on error
      let data: any = {}
      try {
        const text = await res.text()
        if (text) data = JSON.parse(text)
      } catch {
        // If response is not JSON, treat as server error
        throw new Error('Server error. Please try again.')
      }
      if (!res.ok) {
        const errorMsg = data.error || data.message ||
          `Request failed (${res.status}). Please restart the server and try again.`
        throw new Error(errorMsg)
      }

      if (data.auto_approved) {
        toast.success('Your profile has been automatically reactivated!')
        await refreshProfile()
        navigate('/dashboard')
      } else {
        toast.success('Request Submitted — Waiting for Admin Approval')
        // Refresh profile to get updated reactivation_status
        setRequestSent(true)
        await refreshProfile()
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Determine UI based on status
  const status = profile?.profile_status || 'yellow'
  const reactivationStatus = profile?.reactivation_status

  // SVG icons — professional, no emoji
  let StatusIcon: React.ReactNode
  let colorClass = 'text-yellow-500'
  let bgColorClass = 'bg-yellow-50'
  let borderColorClass = 'border-yellow-200'
  let title = 'Taking a Break'

  if (status === 'engaged') {
    colorClass = 'text-amber-600'
    bgColorClass = 'bg-amber-50'
    borderColorClass = 'border-amber-200'
    title = 'Engagement Confirmed'
    StatusIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
        <circle cx="12" cy="9" r="2" fill="currentColor" />
      </svg>
    )
  } else if (status === 'married') {
    colorClass = 'text-rose-500'
    bgColorClass = 'bg-rose-50'
    borderColorClass = 'border-rose-200'
    title = 'Marriage Confirmed'
    StatusIcon = (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z" />
      </svg>
    )
  } else if (status === 'red') {
    colorClass = 'text-red-500'
    bgColorClass = 'bg-red-50'
    borderColorClass = 'border-red-200'
    title = 'Profile Paused'
    StatusIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    )
  } else {
    // yellow (default)
    colorClass = 'text-yellow-500'
    bgColorClass = 'bg-yellow-50'
    borderColorClass = 'border-yellow-200'
    title = 'Taking a Break'
    StatusIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9v6m-4.5 0V9M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }

  const isEngagedOrMarried = status === 'engaged' || status === 'married';
  const descriptionText = isEngagedOrMarried
    ? "Message for Admin to active account to continue searching."
    : "Message to admin for Active account again.";
  const buttonText = isEngagedOrMarried
    ? "I want to Search again"
    : "I want to active my account";

  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-rose-50 flex flex-col py-12 min-h-[80vh]">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Professional SVG status icon */}
        <div className={`mb-6 p-4 rounded-2xl ${bgColorClass} border ${borderColorClass} ${colorClass}`}>
          {StatusIcon}
        </div>

        <h1 className="text-3xl sm:text-4xl font-heading font-bold text-center mb-2 text-gray-900">
          {title}
        </h1>

        <p className="text-gray-500 text-center max-w-md text-base mb-10">
          Your profile is currently hidden from search on <strong className="text-primary">{siteName}</strong>.
          {descriptionText}
        </p>

        {/* Rejection card with SVG icon */}
        {(reactivationStatus === 'rejected' || rejectionRemark) && rejectionRemark && (
          <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-red-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Request Rejected
            </h3>
            <p className="text-red-600 text-sm">{rejectionRemark}</p>
            <p className="text-red-400 text-xs mt-2">You can submit a new request below.</p>
          </div>
        )}

        {/* Pending card with SVG icon instead of emoji */}
        {requestSent ? (
          <div className="w-full max-w-md flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-blue-100 rounded-2xl animate-bounce">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
              </div>
              <h3 className="text-blue-800 font-bold text-lg mb-2">Request Sent Successfully!</h3>
              <p className="text-blue-600 text-sm leading-relaxed">
                Your reactivation request has been submitted to the admin.
                Please wait while the admin reviews your request.
                You will be notified <strong>in real-time</strong> as soon as a decision is made — no need to refresh the page.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-blue-500 text-xs">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                Waiting for admin review…
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col gap-4">
            <div className="w-full">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Your Message to Admin (optional)
              </label>
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  isEngagedOrMarried
                    ? "Explain why you want to search again (e.g. engagement was called off)..."
                    : "Tell us why you want to reactivate your profile..."
                }
                className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {userMessage.length}/500
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleRequestReactivation}
              loading={submitting}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : buttonText}
            </Button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-2">
              <p className="text-sm text-gray-500 text-center">
                Your request will be reviewed by admin. You will be notified in real-time.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}