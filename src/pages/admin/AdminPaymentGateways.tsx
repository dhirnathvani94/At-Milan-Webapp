import React, { useState, useEffect } from 'react';
import {
  CreditCard, Plus, Edit2, Trash2, Check, X, Lock,
  Power, PowerOff, ChevronDown, Eye, EyeOff, AlertCircle, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

interface PaymentGateway {
  id: string;
  name: string;
  provider: string;           // free-text — admin picks preset or types custom
  key_id: string;
  key_secret: string;
  is_active: boolean;
  created_at: string;
  webhook_secret?: string;    // optional extra field
  extra_notes?: string;       // admin notes
}

const PRESET_PROVIDERS = [
  { value: 'razorpay',  label: 'Razorpay',   color: '#072654', logo: '⚡' },
  { value: 'stripe',    label: 'Stripe',      color: '#635BFF', logo: '💳' },
  { value: 'paypal',    label: 'PayPal',      color: '#003087', logo: '🅿' },
  { value: 'ccavenue',  label: 'CCAvenue',    color: '#E91E8C', logo: '💰' },
  { value: 'payu',      label: 'PayU',        color: '#FF6B00', logo: '🔑' },
  { value: 'cashfree',  label: 'Cashfree',    color: '#1A73E8', logo: '💸' },
  { value: 'custom',    label: 'Custom / Other', color: '#6B7280', logo: '🔧' },
];

const providerBadge = (provider: string) => {
  const preset = PRESET_PROVIDERS.find(p => p.value === provider.toLowerCase());
  return {
    logo: preset?.logo || '🔧',
    color: preset?.color || '#6B7280',
    label: preset?.label || provider,
  };
};

const EMPTY_FORM = {
  name: '',
  provider: 'razorpay',
  custom_provider: '',        // used when provider === 'custom'
  key_id: '',
  key_secret: '',
  webhook_secret: '',
  extra_notes: '',
  is_active: false,
};

export default function AdminPaymentGateways() {
  const { profile, user } = useAuthStore();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [activating, setActivating] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => { fetchGateways(); }, []);

  const token = () => localStorage.getItem('atmilan-token');

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/admin/payment-gateways'), {
        headers: { 'Authorization': `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGateways(data.gateways || []);
      }
    } catch { toast.error('Failed to load gateways'); }
    finally { setLoading(false); }
  };

  const resolvedProvider = (fd: typeof EMPTY_FORM) =>
    fd.provider === 'custom' ? (fd.custom_provider.trim() || 'custom') : fd.provider;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      provider: resolvedProvider(formData),
      key_id: formData.key_id.trim(),
      key_secret: formData.key_secret.trim(),
      webhook_secret: formData.webhook_secret.trim(),
      extra_notes: formData.extra_notes.trim(),
      is_active: formData.is_active,
    };

    if (!payload.name || !payload.key_id || !payload.key_secret) {
      toast.error('Name, Key ID and Secret Key are required');
      return;
    }

    try {
      const url = editingId
        ? `/api/admin/payment-gateways/${editingId}`
        : '/api/admin/payment-gateways';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(editingId ? 'Gateway updated!' : 'Gateway added!');
      closeForm();
      fetchGateways();
    } catch { toast.error('Failed to save gateway'); }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  };

  const handleEdit = (g: PaymentGateway) => {
    const isPreset = PRESET_PROVIDERS.some(p => p.value === g.provider.toLowerCase() && p.value !== 'custom');
    setFormData({
      name: g.name,
      provider: isPreset ? g.provider.toLowerCase() : 'custom',
      custom_provider: isPreset ? '' : g.provider,
      key_id: g.key_id,
      key_secret: g.key_secret,
      webhook_secret: (g as any).webhook_secret || '',
      extra_notes: (g as any).extra_notes || '',
      is_active: g.is_active,
    });
    setEditingId(g.id);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const handleDelete = async (g: PaymentGateway) => {
    if (!confirm(`Delete "${g.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/payment-gateways/${g.id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      toast.success('Gateway deleted');
      fetchGateways();
    } catch { toast.error('Failed to delete'); }
  };

  // Toggle active — if already active → deactivate; else → activate (deactivates others)
  const handleToggleActive = async (g: PaymentGateway) => {
    if (activating) return;
    const newState = !g.is_active;
    if (newState && !confirm(`Activate "${g.name}" as the payment gateway? This will deactivate all other gateways.`)) return;
    setActivating(g.id);
    try {
      const res = await fetch(apiUrl(`/api/admin/payment-gateways/${g.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token()}` },
        body: JSON.stringify({ ...g, is_active: newState }),
      });
      if (!res.ok) throw new Error();
      toast.success(newState ? `"${g.name}" is now the active gateway` : `"${g.name}" has been deactivated`);
      fetchGateways();
    } catch { toast.error('Failed to update status'); }
    finally { setActivating(null); }
  };

  const activeGateway = gateways.find(g => g.is_active);

  if (user?.role !== 'admin' && profile?.role !== 'admin') {
    return <p>Access denied.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="text-primary" size={24} />
            Payment Gateways
          </h1>
          <p className="text-gray-500 mt-1">
            Add and manage payment processors. Only <strong>one gateway can be active</strong> at a time.
          </p>
        </div>
        <Button
          onClick={() => { if (showForm && !editingId) { closeForm(); } else { closeForm(); setShowForm(true); } }}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          {showForm && !editingId ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Gateway</>}
        </Button>
      </div>

      {/* Active gateway banner */}
      {activeGateway && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-lg">
            {providerBadge(activeGateway.provider).logo}
          </div>
          <div>
            <p className="text-green-800 font-semibold text-sm">{activeGateway.name} is your active checkout gateway</p>
            <p className="text-green-600 text-xs capitalize">{providerBadge(activeGateway.provider).label} · Payments go through this gateway</p>
          </div>
          <Zap size={18} className="text-green-500 ml-auto" />
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <Card className="p-6 border-2 border-primary/20 shadow-lg">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2 text-gray-800">
            <Lock size={18} className="text-primary" />
            {editingId ? 'Edit Gateway' : 'Add New Payment Gateway'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: Display Name + Provider */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm"
                  placeholder="e.g. Razorpay India"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Provider Type <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={formData.provider}
                    onChange={e => setFormData({ ...formData, provider: e.target.value, custom_provider: '' })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm bg-white pr-10"
                  >
                    {PRESET_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.logo} {p.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Custom provider name field */}
            {formData.provider === 'custom' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Custom Provider Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.custom_provider}
                  onChange={e => setFormData({ ...formData, custom_provider: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-sm"
                  placeholder="e.g. Paytm, Airpay, MyProvider"
                  required
                />
              </div>
            )}

            {/* Row 2: Key ID + Secret */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  API Key ID / Publishable Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.key_id}
                  onChange={e => setFormData({ ...formData, key_id: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="rzp_live_xxxxxxxx"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  API Secret Key <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-400 inline-flex items-center gap-1">
                    <Lock size={10} /> Never shown to users
                  </span>
                </label>
                <input
                  type="password"
                  value={formData.key_secret}
                  onChange={e => setFormData({ ...formData, key_secret: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="••••••••••••••••"
                  required
                />
              </div>
            </div>

            {/* Row 3: Webhook Secret (optional) + Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Webhook Secret <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  value={formData.webhook_secret}
                  onChange={e => setFormData({ ...formData, webhook_secret: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="whsec_xxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Admin Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.extra_notes}
                  onChange={e => setFormData({ ...formData, extra_notes: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  placeholder="e.g. Used for test mode"
                />
              </div>
            </div>

            {/* Set as active toggle */}
            <label className="flex items-center gap-3 cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 hover:bg-primary/5 transition-colors">
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${formData.is_active ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Set as Active Gateway</p>
                <p className="text-xs text-gray-500">Activating this will automatically deactivate all other gateways</p>
              </div>
              {formData.is_active && <Check size={16} className="ml-auto text-green-500" />}
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit">{editingId ? 'Update Gateway' : 'Save Gateway'}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Gateway List */}
      {loading ? (
        <PageSkeleton />
      ) : gateways.length === 0 ? (
        <Card className="p-14 text-center">
          <CreditCard size={52} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">No Payment Gateways Yet</h3>
          <p className="text-gray-400 text-sm mb-5">Add your first payment gateway to start accepting payments.</p>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2 mx-auto">
            <Plus size={16} /> Add Your First Gateway
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {gateways.map(g => {
            const badge = providerBadge(g.provider);
            const isActivating = activating === g.id;
            const secretVisible = showSecret[g.id];
            return (
              <Card
                key={g.id}
                className={`overflow-hidden border-2 transition-all ${
                  g.is_active
                    ? 'border-green-400 shadow-md shadow-green-100'
                    : 'border-gray-200'
                }`}
              >
                {/* Top banner */}
                <div
                  className="h-2 w-full"
                  style={{ background: g.is_active ? '#22c55e' : badge.color + '33' }}
                />

                <div className="p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                        style={{ background: badge.color + '15', border: `1.5px solid ${badge.color}25` }}
                      >
                        {badge.logo}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base leading-tight">{g.name}</h3>
                        <span className="inline-block mt-0.5 text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: badge.color }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Active badge */}
                    {g.is_active && (
                      <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full">
                        <Check size={11} /> ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Key ID */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-gray-400 font-semibold mb-0.5">KEY ID</p>
                    <p className="font-mono text-xs text-gray-700 break-all">{g.key_id}</p>
                  </div>

                  {/* Secret (masked by default) */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-xs text-gray-400 font-semibold">SECRET KEY</p>
                      <button
                        onClick={() => setShowSecret(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                        className="text-xs text-primary flex items-center gap-1"
                      >
                        {secretVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                        {secretVisible ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-gray-700 break-all">
                      {secretVisible ? g.key_secret : '••••••••••••••••••••••••••••••'}
                    </p>
                  </div>

                  {(g as any).extra_notes && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                      <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">{(g as any).extra_notes}</p>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    {/* Activate / Deactivate toggle */}
                    <button
                      onClick={() => handleToggleActive(g)}
                      disabled={!!activating}
                      className={`flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${
                        g.is_active
                          ? 'text-red-600 bg-red-50 hover:bg-red-100'
                          : 'text-green-700 bg-green-50 hover:bg-green-100'
                      } disabled:opacity-50`}
                    >
                      {isActivating ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : g.is_active ? (
                        <><PowerOff size={14} /> Deactivate</>
                      ) : (
                        <><Power size={14} /> Set Active</>
                      )}
                    </button>

                    {/* Edit + Delete */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(g)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(g)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info note */}
      {gateways.length > 0 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Only one payment gateway can be active at a time. The active gateway is used by the checkout page to process all payments. Secret keys are never exposed to users.
          </p>
        </div>
      )}
    </div>
  );
}
