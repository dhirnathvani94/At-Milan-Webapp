import { useState, useEffect } from 'react'
import { 
  CreditCard, Crown, Plus, Pencil, Trash2, Save, X, 
  Zap, Loader2, CheckCircle, AlertTriangle 
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiUrl } from '../../lib/api'
import { AdminTableSkeleton } from '../../components/ui/Skeletons'

import { useSocketStore } from '../../store/socketStore'

interface CreditPlan {
  id: string
  name: string
  credits: number
  price: number
  original_price?: number
  expiry_days?: number
  popular?: boolean
}

interface MembershipPlan {
  id: string
  name: string
  price: number
  original_price?: number
  duration_months: number
  features: string[]
}

export default function AdminPlans() {
  const [creditPlans, setCreditPlans] = useState<CreditPlan[]>([])
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'credits' | 'membership'>('credits')
  const { socket } = useSocketStore()

  // Credit plan form
  const [editingCredit, setEditingCredit] = useState<CreditPlan | null>(null)
  const [showCreditForm, setShowCreditForm] = useState(false)
  const [creditForm, setCreditForm] = useState({ name: '', credits: 0, price: 0, original_price: 0, expiry_days: 90, popular: false })

  // Membership plan form
  const [editingMembership, setEditingMembership] = useState<MembershipPlan | null>(null)
  const [showMembershipForm, setShowMembershipForm] = useState(false)
  const [membershipForm, setMembershipForm] = useState({ name: '', price: 0, original_price: 0, duration_months: 1, features: '' })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPlans()
    if (!socket) return
    const handleUpdate = () => fetchPlans()
    socket.on('plans:updated', handleUpdate)
    return () => {
      socket.off('plans:updated', handleUpdate)
    }
  }, [socket])

  const fetchPlans = async () => {
    try {
      const t = Date.now()
      const [creditsRes, membershipRes] = await Promise.all([
        fetch(apiUrl(`/api/plans/credits?t=${t}`)),
        fetch(apiUrl(`/api/plans/membership?t=${t}`))
      ])
      setCreditPlans(await creditsRes.json())
      setMembershipPlans(await membershipRes.json())
    } catch (err) {
      console.error(err)
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  // ─── CREDIT PLAN CRUD ───
  const openCreditForm = (plan?: CreditPlan) => {
    if (plan) {
      setEditingCredit(plan)
      setCreditForm({ 
        name: plan.name, credits: plan.credits, price: plan.price, 
        original_price: plan.original_price || 0, expiry_days: plan.expiry_days || 90, popular: plan.popular || false 
      })
    } else {
      setEditingCredit(null)
      setCreditForm({ name: '', credits: 0, price: 0, original_price: 0, expiry_days: 90, popular: false })
    }
    setShowCreditForm(true)
  }

  const saveCreditPlan = async () => {
    if (!creditForm.name || !creditForm.credits || !creditForm.price) {
      return toast.error('Please fill all required fields')
    }
    setSaving(true)
    try {
      const url = editingCredit 
        ? apiUrl(`/api/plans/credits/${editingCredit.id}`)
        : apiUrl('/api/plans/credits')
      const method = editingCredit ? 'PUT' : 'POST'
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creditForm)
      })
      toast.success(editingCredit ? 'Credit plan updated!' : 'Credit plan created!')
      setShowCreditForm(false)
      fetchPlans()
    } catch {
      toast.error('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const deleteCreditPlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credit plan?')) return
    try {
      await fetch(apiUrl(`/api/plans/credits/${id}`), { method: 'DELETE' })
      toast.success('Credit plan deleted')
      fetchPlans()
    } catch {
      toast.error('Failed to delete')
    }
  }

  // ─── MEMBERSHIP PLAN CRUD ───
  const openMembershipForm = (plan?: MembershipPlan) => {
    if (plan) {
      setEditingMembership(plan)
      setMembershipForm({ 
        name: plan.name, price: plan.price, 
        original_price: plan.original_price || 0, 
        duration_months: plan.duration_months,
        features: (plan.features || []).join('\n')
      })
    } else {
      setEditingMembership(null)
      setMembershipForm({ name: '', price: 0, original_price: 0, duration_months: 1, features: '' })
    }
    setShowMembershipForm(true)
  }

  const saveMembershipPlan = async () => {
    if (!membershipForm.name || !membershipForm.price) {
      return toast.error('Please fill all required fields')
    }
    setSaving(true)
    try {
      const url = editingMembership 
        ? apiUrl(`/api/plans/membership/${editingMembership.id}`)
        : apiUrl('/api/plans/membership')
      const method = editingMembership ? 'PUT' : 'POST'
      
      const body = {
        ...membershipForm,
        features: membershipForm.features.split('\n').map(f => f.trim()).filter(Boolean)
      }
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      toast.success(editingMembership ? 'Membership plan updated!' : 'Membership plan created!')
      setShowMembershipForm(false)
      fetchPlans()
    } catch {
      toast.error('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const deleteMembershipPlan = async (id: string) => {
    if (!confirm('Are you sure you want to delete this membership plan?')) return
    try {
      await fetch(apiUrl(`/api/plans/membership/${id}`), { method: 'DELETE' })
      toast.success('Membership plan deleted')
      fetchPlans()
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) {
    return <AdminTableSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={24} className="text-primary" />
            Plans Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage credit packs and membership plans. Changes appear instantly on the Buy Credits & Membership pages.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('credits')}
            className={`flex-1 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === 'credits'
                ? 'text-[#8B1A1A] border-b-2 border-[#8B1A1A] bg-red-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Zap size={16} /> Credit Plans ({creditPlans.length})
          </button>
          <button
            onClick={() => setActiveTab('membership')}
            className={`flex-1 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === 'membership'
                ? 'text-[#D4AF37] border-b-2 border-[#D4AF37] bg-yellow-50/30'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Crown size={16} /> Membership Plans ({membershipPlans.length})
          </button>
        </div>

        <div className="p-6">
          {/* ─── CREDIT PLANS TAB ─── */}
          {activeTab === 'credits' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => openCreditForm()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#8B1A1A] text-white rounded-lg hover:bg-[#721616] transition text-sm font-medium"
                >
                  <Plus size={16} /> Add Credit Plan
                </button>
              </div>

              {/* Credit Plans Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-3 px-4 font-semibold">Plan Name</th>
                      <th className="py-3 px-4 font-semibold">Credits</th>
                      <th className="py-3 px-4 font-semibold">Price</th>
                      <th className="py-3 px-4 font-semibold">Original Price</th>
                      <th className="py-3 px-4 font-semibold">Expiry (Days)</th>
                      <th className="py-3 px-4 font-semibold">Popular</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {creditPlans.map(plan => (
                      <tr key={plan.id} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-medium text-gray-900">{plan.name}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <Zap size={12} /> {plan.credits}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">₹{plan.price.toLocaleString()}</td>
                        <td className="py-3 px-4 text-gray-400 line-through">
                          {plan.original_price ? `₹${plan.original_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {plan.expiry_days || 90}
                        </td>
                        <td className="py-3 px-4">
                          {plan.popular ? (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              <CheckCircle size={12} /> Yes
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openCreditForm(plan)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteCreditPlan(plan.id)}
                              className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {creditPlans.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-400 py-12">
                          No credit plans yet. Click "Add Credit Plan" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Credit Plan Form Modal */}
              {showCreditForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                      <h3 className="font-bold text-lg text-gray-900">
                        {editingCredit ? 'Edit Credit Plan' : 'Add Credit Plan'}
                      </h3>
                      <button onClick={() => setShowCreditForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                        <input
                          value={creditForm.name}
                          onChange={e => setCreditForm({...creditForm, name: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none"
                          placeholder="e.g. Basic Pack"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Credits *</label>
                          <input
                            type="number"
                            value={creditForm.credits || ''}
                            onChange={e => setCreditForm({...creditForm, credits: Number(e.target.value)})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none"
                            placeholder="50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                          <input
                            type="number"
                            value={creditForm.price || ''}
                            onChange={e => setCreditForm({...creditForm, price: Number(e.target.value)})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none"
                            placeholder="499"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Original Price (₹)</label>
                        <input
                          type="number"
                          value={creditForm.original_price || ''}
                          onChange={e => setCreditForm({...creditForm, original_price: Number(e.target.value)})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none"
                          placeholder="999 (shown as strikethrough)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (Days)</label>
                        <input
                          type="number"
                          value={creditForm.expiry_days || ''}
                          onChange={e => setCreditForm({...creditForm, expiry_days: Number(e.target.value)})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none"
                          placeholder="90"
                        />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditForm.popular}
                          onChange={e => setCreditForm({...creditForm, popular: e.target.checked})}
                          className="w-4 h-4 rounded border-gray-300 text-[#8B1A1A] focus:ring-[#8B1A1A]"
                        />
                        <span className="text-sm text-gray-700">Mark as Popular</span>
                      </label>
                    </div>
                    <div className="flex gap-3 p-5 border-t border-gray-100">
                      <button
                        onClick={() => setShowCreditForm(false)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveCreditPlan}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-[#8B1A1A] text-white rounded-lg hover:bg-[#721616] transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {editingCredit ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── MEMBERSHIP PLANS TAB ─── */}
          {activeTab === 'membership' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => openMembershipForm()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#b8962e] transition text-sm font-medium"
                >
                  <Plus size={16} /> Add Membership Plan
                </button>
              </div>

              {/* Membership Plans Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="py-3 px-4 font-semibold">Plan Name</th>
                      <th className="py-3 px-4 font-semibold">Price</th>
                      <th className="py-3 px-4 font-semibold">Duration</th>
                      <th className="py-3 px-4 font-semibold">Features</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {membershipPlans.map(plan => (
                      <tr key={plan.id} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Crown size={14} className="text-[#D4AF37]" />
                            <span className="font-medium text-gray-900">{plan.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-gray-900">
                          {plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString()}`}
                          {plan.original_price && plan.original_price > plan.price && (
                            <span className="text-gray-400 line-through text-xs ml-2">₹{plan.original_price.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {plan.duration_months === 0 ? 'Forever' : `${plan.duration_months} months`}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(plan.features || []).slice(0, 3).map((f, i) => (
                              <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                {f}
                              </span>
                            ))}
                            {(plan.features || []).length > 3 && (
                              <span className="text-xs text-gray-400">+{plan.features.length - 3} more</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openMembershipForm(plan)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteMembershipPlan(plan.id)}
                              className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {membershipPlans.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-gray-400 py-12">
                          No membership plans yet. Click "Add Membership Plan" to create one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Membership Plan Form Modal */}
              {showMembershipForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                      <h3 className="font-bold text-lg text-gray-900">
                        {editingMembership ? 'Edit Membership Plan' : 'Add Membership Plan'}
                      </h3>
                      <button onClick={() => setShowMembershipForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                        <input
                          value={membershipForm.name}
                          onChange={e => setMembershipForm({...membershipForm, name: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none"
                          placeholder="e.g. Gold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                          <input
                            type="number"
                            value={membershipForm.price || ''}
                            onChange={e => setMembershipForm({...membershipForm, price: Number(e.target.value)})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none"
                            placeholder="1999"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months) *</label>
                          <input
                            type="number"
                            value={membershipForm.duration_months || ''}
                            onChange={e => setMembershipForm({...membershipForm, duration_months: Number(e.target.value)})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none"
                            placeholder="3"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Original Price (₹)</label>
                        <input
                          type="number"
                          value={membershipForm.original_price || ''}
                          onChange={e => setMembershipForm({...membershipForm, original_price: Number(e.target.value)})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none"
                          placeholder="2999 (shown as strikethrough)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
                        <textarea
                          value={membershipForm.features}
                          onChange={e => setMembershipForm({...membershipForm, features: e.target.value})}
                          rows={5}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] outline-none resize-none"
                          placeholder={"Unlimited Messages\nView Contact Details\nPriority Support"}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 p-5 border-t border-gray-100">
                      <button
                        onClick={() => setShowMembershipForm(false)}
                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveMembershipPlan}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-[#D4AF37] text-white rounded-lg hover:bg-[#b8962e] transition text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {editingMembership ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold">How it works</p>
          <p className="mt-1">
            Changes you make here are instantly reflected on the <strong>Buy Credits</strong> page and the <strong>Membership</strong> page. 
            When a user buys a credit plan, the credits are automatically added to their paid balance. 
            When they buy a membership plan, their premium membership is activated immediately.
          </p>
        </div>
      </div>
    </div>
  )
}
