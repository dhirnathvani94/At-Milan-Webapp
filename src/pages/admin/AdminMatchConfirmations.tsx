import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { useSocketStore } from '../../store/socketStore'
import { useMasterData } from '../../store/masterDataStore'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import { 
  Heart, Clock, Gift, Users, CheckCircle, XCircle, 
  Copy, Link as LinkIcon, ExternalLink, ChevronRight,
  ShieldCheck, AlertCircle
} from 'lucide-react'

// Custom Ring Icon since Lucide doesn't have a specific engagement ring
const RingIcon = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
    <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
  </svg>
)

// ── Types ────────────────────────────────────────────────────────────────────
type MatchConfirmation = {
  id: string; user_id: string; match_type: 'engagement' | 'marriage'
  match_platform: 'atmilan' | 'other'; partner_profile_id: string | null
  referral_code: string | null; created_at: string
  user: { first_name: string; last_name: string; profile_id: string; profile_photo_url?: string; gender?: string }
}
type ReactivationRequest = {
  id: string; user_id: string; profile_status: string
  user_message: string | null; status: 'pending' | 'approved' | 'rejected'
  rejection_remark: string | null; created_at: string
  user: { first_name: string; last_name: string; profile_id: string; profile_status: string; profile_photo_url: string | null; gender?: string }
}
type ReferralLink = {
  id: string; user_id: string; code: string; type: string
  status: 'active' | 'used' | 'expired'; used_by: string | null
  used_at: string | null; created_at: string; premium_months?: number
  user: { first_name: string; last_name: string; profile_id: string; profile_photo_url?: string; gender?: string } | null
}

// ── Status helper ─────────────────────────────────────────────────────────────
const profileStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    yellow: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    engaged: 'bg-yellow-100 text-yellow-800',
    married: 'bg-rose-100 text-rose-800',
    active: 'bg-emerald-100 text-emerald-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

// ── Rejection Modal ───────────────────────────────────────────────────────────
function RejectModal({ open, onClose, onConfirm, loading }: {
  open: boolean; onClose: () => void
  onConfirm: (remark: string) => void; loading: boolean
}) {
  const [remark, setRemark] = useState('')
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 opacity-100">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Reject Request</h3>
            <p className="text-sm text-gray-500 mt-1">Please provide a clear reason so the user understands why their request was denied.</p>
          </div>
        </div>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none transition-shadow"
          rows={4}
          placeholder="e.g., We need more details about your situation before reactivating..."
          value={remark}
          onChange={e => setRemark(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            className="flex-1 bg-red-600 hover:bg-red-700 border-transparent text-white" 
            onClick={() => { if (remark.trim()) { onConfirm(remark.trim()); setRemark('') } else toast.error('Please enter a rejection reason') }}
            disabled={loading || !remark.trim()}
            loading={loading}
          >
            Confirm Reject
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminMatchConfirmations() {
  const { admin_settings_kv } = useMasterData()
  const platformName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value
    || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan'

  const [activeTab, setActiveTab] = useState<'matches' | 'reactivations' | 'referrals'>('matches')

  const [matches, setMatches] = useState<MatchConfirmation[]>([])
  const [reactivations, setReactivations] = useState<ReactivationRequest[]>([])
  const [referrals, setReferrals] = useState<ReferralLink[]>([])
  const [loading, setLoading] = useState(true)

  const [matchFilter, setMatchFilter] = useState<'All' | 'Engagement' | 'Marriage'>('All')
  const [reactivationFilter, setReactivationFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All')

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchMatches = async () => {
    try {
      const res = await apiFetch(`/api/admin/match-confirmations?_t=${Date.now()}`)
      if (res.ok) { const d = await res.json(); setMatches(Array.isArray(d) ? d : []) }
      else if (res.status === 401 || res.status === 403) toast.error('Admin session expired. Please log in again.')
    } catch (e) { console.error('[AdminMatchConfirmations] fetchMatches error:', e) }
  }
  const fetchReactivations = async () => {
    try {
      const res = await apiFetch(`/api/admin/reactivation-requests?_t=${Date.now()}`)
      if (res.ok) { const d = await res.json(); setReactivations(Array.isArray(d) ? d : []) }
    } catch (e) { console.error('[AdminMatchConfirmations] fetchReactivations error:', e) }
  }
  const fetchReferrals = async () => {
    try {
      const res = await apiFetch(`/api/admin/referral-links?_t=${Date.now()}`)
      if (res.ok) { const d = await res.json(); setReferrals(Array.isArray(d) ? d : []) }
    } catch (e) { console.error('[AdminMatchConfirmations] fetchReferrals error:', e) }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchMatches(), fetchReactivations(), fetchReferrals()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let registeredSocket: any = null
    const handleNewRequest = async () => { await fetchReactivations(); setActiveTab('reactivations') }
    const handleStoryUpdate = () => fetchMatches()
    const handleReferralUpdate = () => fetchReferrals()
    const registerListeners = (socket: any) => {
      if (!socket || socket === registeredSocket) return
      if (registeredSocket) {
        registeredSocket.off('admin:reactivation-request', handleNewRequest)
        registeredSocket.off('success-story:updated', handleStoryUpdate)
        registeredSocket.off('admin:referral-updated', handleReferralUpdate)
      }
      socket.on('admin:reactivation-request', handleNewRequest)
      socket.on('success-story:updated', handleStoryUpdate)
      socket.on('admin:referral-updated', handleReferralUpdate)
      registeredSocket = socket
    }
    const currentSocket = useSocketStore.getState().socket
    if (currentSocket) registerListeners(currentSocket)
    const unsubSocket = useSocketStore.subscribe(state => { if (state.socket) registerListeners(state.socket) })
    const poll = setInterval(() => { fetchReactivations(); fetchReferrals() }, 5000)
    return () => {
      clearInterval(poll); unsubSocket()
      if (registeredSocket) {
        registeredSocket.off('admin:reactivation-request', handleNewRequest)
        registeredSocket.off('success-story:updated', handleStoryUpdate)
        registeredSocket.off('admin:referral-updated', handleReferralUpdate)
      }
    }
  }, [])

  const handleDecision = async (id: string, decision: 'approved' | 'rejected', remark?: string) => {
    if (decision === 'rejected' && !remark) return
    setProcessingId(id)
    try {
      const res = await apiFetch(`/api/admin/reactivation/${id}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, remark })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      toast.success(`Request ${decision} successfully`)
      setRejectId(null)
      await fetchReactivations()
    } catch (error: any) { toast.error(error.message) }
    finally { setProcessingId(null) }
  }

  const filteredMatches = matches.filter(m => {
    if (matchFilter === 'Engagement') return m.match_type === 'engagement'
    if (matchFilter === 'Marriage') return m.match_type === 'marriage'
    return true
  })
  const filteredReactivations = reactivations.filter(r => {
    if (reactivationFilter === 'Pending') return r.status === 'pending'
    if (reactivationFilter === 'Approved') return r.status === 'approved'
    if (reactivationFilter === 'Rejected') return r.status === 'rejected'
    return true
  })

  const pendingCount = reactivations.filter(r => r.status === 'pending').length
  const activeReferrals = referrals.filter(r => r.status === 'active').length
  const usedReferrals = referrals.filter(r => r.status === 'used').length

  const tabs = [
    { key: 'matches', label: 'Match Confirmations', count: matches.length },
    { key: 'reactivations', label: 'Reactivation Requests', count: pendingCount, badge: pendingCount > 0 },
    { key: 'referrals', label: 'Referral Links', count: referrals.length },
  ] as const

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <RejectModal
        open={rejectId !== null}
        onClose={() => setRejectId(null)}
        onConfirm={(remark) => handleDecision(rejectId!, 'rejected', remark)}
        loading={processingId === rejectId}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Platform Activity</h1>
          <p className="text-gray-500 text-sm">Manage real-time match confirmations, reactivations, and referrals.</p>
        </div>
      </div>

      {/* Primary Stat Cards (Matching AdminDashboard style) */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-rose-500 to-rose-600">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <Heart size={22} className="opacity-90" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{matches.length}</p>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80 mt-1">Total Matches</p>
              <p className="text-[10px] opacity-60 mt-0.5">{matches.filter(m => m.match_type === 'engagement').length} engagement · {matches.filter(m => m.match_type === 'marriage').length} marriage</p>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-amber-500 to-amber-600">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <Clock size={22} className="opacity-90" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{pendingCount}</p>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80 mt-1">Pending Reactivations</p>
              <p className="text-[10px] opacity-60 mt-0.5">Awaiting admin action</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-violet-500 to-violet-600">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <Gift size={22} className="opacity-90" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{referrals.length}</p>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80 mt-1">Referral Links</p>
              <p className="text-[10px] opacity-60 mt-0.5">{activeReferrals} active · {usedReferrals} used</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <ShieldCheck size={22} className="opacity-90" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{reactivations.filter(r => r.status === 'approved').length}</p>
              <p className="text-xs font-medium uppercase tracking-wider opacity-80 mt-1">Approved Requests</p>
              <p className="text-[10px] opacity-60 mt-0.5">Successfully processed</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <Card className="p-0 border-none shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 overflow-x-auto hide-scrollbar">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`relative px-6 py-4 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === t.key
                  ? 'text-primary bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {t.badge && t.count > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {t.count}
                </span>
              )}
              {activeTab === t.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* ── MATCHES TAB ── */}
              {activeTab === 'matches' && (
                <div className="space-y-4">
                  {/* Filter pills */}
                  <div className="flex gap-2 mb-2 overflow-x-auto hide-scrollbar">
                    {(['All', 'Engagement', 'Marriage'] as const).map(f => (
                      <button key={f} onClick={() => setMatchFilter(f)}
                        className={`px-3.5 py-1.5 text-[11px] rounded-full font-bold uppercase tracking-wider transition-all ${
                          matchFilter === f ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {filteredMatches.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Heart size={32} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No match confirmations found</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredMatches.map(m => (
                        <Link 
                          key={m.id} 
                          to={`/admin/users/${m.user_id}`}
                          className="group relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="text-primary" size={20} />
                          </div>
                          
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${m.match_type === 'engagement' ? 'bg-yellow-100 text-yellow-600' : 'bg-rose-100 text-rose-600'}`}>
                            {m.match_type === 'engagement' ? <RingIcon className="w-6 h-6" /> : <Heart className="w-6 h-6" />}
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-8">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900 truncate group-hover:text-primary transition-colors">{m.user?.first_name} {m.user?.last_name}</h3>
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{m.user?.profile_id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${m.match_type === 'engagement' ? 'bg-yellow-100 text-yellow-800' : 'bg-rose-100 text-rose-800'}`}>
                                {m.match_type}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 font-medium">
                              <span className="flex items-center gap-1">
                                Platform: <span className={m.match_platform === 'atmilan' ? 'text-primary font-bold' : 'text-gray-700'}>{m.match_platform === 'atmilan' ? platformName : 'External'}</span>
                              </span>
                              {m.partner_profile_id && (
                                <span className="flex items-center gap-1">
                                  Partner: <span className="font-mono text-gray-700">{m.partner_profile_id}</span>
                                </span>
                              )}
                              {m.referral_code && (
                                <span className="flex items-center gap-1 text-violet-600">
                                  <LinkIcon size={12} /> <span className="font-mono">{m.referral_code}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-left sm:text-right flex-shrink-0 sm:pr-8">
                            <p className="text-[11px] font-semibold text-gray-700">{new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── REACTIVATIONS TAB ── */}
              {activeTab === 'reactivations' && (
                <div className="space-y-4">
                  <div className="flex gap-2 mb-2 overflow-x-auto hide-scrollbar">
                    {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(f => (
                      <button key={f} onClick={() => setReactivationFilter(f)}
                        className={`px-3.5 py-1.5 text-[11px] rounded-full font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                          reactivationFilter === f ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {f}
                        {f === 'Pending' && pendingCount > 0 && (
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full">{pendingCount}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {filteredReactivations.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Users size={32} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No reactivation requests</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredReactivations.map(r => (
                        <div key={r.id} className={`group relative flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-white border rounded-xl hover:shadow-md transition-all duration-200 ${r.status === 'pending' ? 'border-amber-200 bg-amber-50/10' : 'border-gray-100'}`}>
                          
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <Link to={`/admin/users/${r.user_id}`} className="block flex-shrink-0">
                              <Avatar src={r.user?.profile_photo_url} fallbackName={`${r.user?.first_name} ${r.user?.last_name}`} size="md" gender={r.user?.gender} />
                            </Link>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <Link to={`/admin/users/${r.user_id}`} className="font-bold text-gray-900 truncate hover:text-primary transition-colors">
                                  {r.user?.first_name} {r.user?.last_name}
                                </Link>
                                <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{r.user?.profile_id}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${profileStatusBadge(r.user?.profile_status || r.profile_status)}`}>
                                  {r.user?.profile_status || r.profile_status}
                                </span>
                                <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                  r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                  r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {r.status === 'pending' && <Clock size={10} />}
                                  {r.status === 'approved' && <CheckCircle size={10} />}
                                  {r.status === 'rejected' && <XCircle size={10} />}
                                  {r.status}
                                </span>
                              </div>

                              {r.user_message && (
                                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2.5 mb-2 line-clamp-2 italic">
                                  "{r.user_message}"
                                </p>
                              )}

                              {r.status === 'rejected' && r.rejection_remark && (
                                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5 mb-2 font-medium">
                                  Reason: {r.rejection_remark}
                                </p>
                              )}

                              <div className="text-[10px] text-gray-400 font-medium">
                                Requested on {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          {r.status === 'pending' && (
                            <div className="flex lg:flex-col gap-2 flex-shrink-0 mt-3 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-4">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={(e) => { e.preventDefault(); handleDecision(r.id, 'approved') }}
                                disabled={processingId !== null}
                                className="flex-1 lg:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 border-transparent shadow-sm"
                                loading={processingId === r.id}
                              >
                                <CheckCircle size={14} className="mr-1.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.preventDefault(); setRejectId(r.id) }}
                                disabled={processingId !== null}
                                className="flex-1 lg:flex-none justify-center text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <XCircle size={14} className="mr-1.5" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── REFERRALS TAB ── */}
              {activeTab === 'referrals' && (
                <div className="space-y-4">
                  {referrals.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Gift size={32} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">No referral links yet</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {referrals.map(r => (
                        <Link 
                          key={r.id} 
                          to={`/admin/users/${r.user_id}`}
                          className="group relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="text-primary" size={20} />
                          </div>

                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === 'active' ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Gift className="w-6 h-6" />
                          </div>

                          <div className="flex-1 min-w-0 pr-8">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-bold text-gray-900 truncate group-hover:text-primary transition-colors">{r.user?.first_name} {r.user?.last_name || ''}</h3>
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{r.user?.profile_id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.type === 'engagement' ? 'bg-yellow-100 text-yellow-800' : 'bg-rose-100 text-rose-800'}`}>
                                {r.type}
                              </span>
                              <span className={`ml-auto sm:ml-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>
                                {r.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-medium text-gray-500">
                              <div className="flex items-center gap-2">
                                Code: 
                                <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-wider">{r.code}</span>
                                <button
                                  onClick={(e) => { e.preventDefault(); navigator.clipboard.writeText(r.code); toast.success('Code copied!') }}
                                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-700 transition-colors"
                                  title="Copy code"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 text-violet-600">
                                <Gift size={12} /> {r.premium_months || 1} Month Premium Bonus
                              </div>

                              {r.used_by && (
                                <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-gray-600 border border-gray-100">
                                  <Users size={12} />
                                  Used by <span className="font-bold text-gray-900">{r.used_by}</span>
                                  {r.used_at && <span className="text-gray-400 font-normal">on {new Date(r.used_at).toLocaleDateString()}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}