import React, { useState, useEffect } from 'react';
import {
  Bell, Send, Users, Tag, Megaphone, Gift, Zap, AlertTriangle,
  CheckCircle, Clock, Trash2, Eye, Filter, RefreshCw, Plus,
  Smartphone, Globe, Star, Info, X, MapPin, User, Code
} from 'lucide-react';
import toast from 'react-hot-toast';
import { State, City } from 'country-state-city';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'offer' | 'promo' | 'update' | 'alert' | 'feature' | 'general';
  target: 'all' | 'premium' | 'free' | 'specific';
  target_user_ids?: string[];
  icon?: string;
  action_url?: string;
  sent_by: string;
  sent_at: string;
  delivery_count: number;
  read_count: number;
  is_active: boolean;
  firebase_message_id?: string;
  platforms: ('web' | 'android' | 'ios')[];
}

interface NotificationTemplate {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  title: string;
  body: string;
  type: Notification['type'];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  '🔔','🎁','🏷️','✨','⚠️','⭐','📢','💌','🎉','🎊',
  '💰','🔥','💎','🚀','❤️','🌟','📣','🎯','💡','🛡️',
  '✅','🎀','🥳','🏆','📱',
];

const NOTIF_VARIABLES = [
  '{{first_name}}','{{last_name}}','{{full_name}}','{{city}}',
  '{{state}}','{{gender}}','{{caste}}','{{age}}','{{profile_id}}','{{app_name}}',
];

const TYPE_COLORS: Record<Notification['type'], string> = {
  offer:   'bg-green-100 text-green-700 border-green-200',
  promo:   'bg-purple-100 text-purple-700 border-purple-200',
  update:  'bg-blue-100 text-blue-700 border-blue-200',
  alert:   'bg-orange-100 text-orange-700 border-orange-200',
  feature: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  general: 'bg-gray-100 text-gray-700 border-gray-200',
};

const TYPE_ICONS: Record<Notification['type'], React.ElementType> = {
  offer:   Gift,
  promo:   Tag,
  update:  Zap,
  alert:   AlertTriangle,
  feature: Star,
  general: Megaphone,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminNotifications() {
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';

  // NOTIFICATION_TEMPLATES is defined inside the component so it can use brandName dynamically
  const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
    {
      id: 'offer',
      label: 'New Offer',
      icon: Gift,
      color: 'bg-green-500',
      title: '🎁 Special Offer Just for You!',
      body: 'Limited time offer! Get 50% off on Premium membership. Use code SAVE50. Hurry, expires soon!',
      type: 'offer',
    },
    {
      id: 'promo',
      label: 'Promo Code',
      icon: Tag,
      color: 'bg-purple-500',
      title: '🏷️ Exclusive Promo Code Inside',
      body: 'Use promo code SHUBH2024 and get 3 months premium free. Valid for the next 48 hours only!',
      type: 'promo',
    },
    {
      id: 'update',
      label: 'App Update',
      icon: Zap,
      color: 'bg-blue-500',
      title: '✨ New Features Available',
      body: 'We\'ve launched exciting new features including AI-powered matchmaking, improved search filters, and more!',
      type: 'update',
    },
    {
      id: 'alert',
      label: 'Alert',
      icon: AlertTriangle,
      color: 'bg-orange-500',
      title: '⚠️ Important Notice',
      body: 'Please complete your profile verification to continue using all features. Verify now to avoid account restrictions.',
      type: 'alert',
    },
    {
      id: 'feature',
      label: 'New Feature',
      icon: Star,
      color: 'bg-yellow-500',
      title: '⭐ Check Out This New Feature',
      body: 'Introducing "Daily Matches" - curated matches delivered to you every day. Tap to explore!',
      type: 'feature',
    },
    {
      id: 'general',
      label: 'General',
      icon: Megaphone,
      color: 'bg-gray-500',
      title: `📢 Message from ${brandName}`,
      body: 'Thank you for being part of our community. We appreciate your trust!',
      type: 'general',
    },
  ];
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | Notification['type']>('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [stats, setStats] = useState({ total: 0, today: 0, totalReach: 0, avgRead: 0 });
  const [fcmConfigured, setFcmConfigured] = useState<boolean | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState(0);

  // Compose form state
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'general' as Notification['type'],
    target: 'all' as Notification['target'],
    action_url: '',
    icon: '🔔',
    platforms: ['web', 'android'] as ('web' | 'android' | 'ios')[],
  });

  // Filter state
  const [filterGender, setFilterGender] = useState('all');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterTaluka, setFilterTaluka] = useState('');
  const [filterPremium, setFilterPremium] = useState('all');
  const [specificUserIds, setSpecificUserIds] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [activeField, setActiveField] = useState<'title'|'body'>('body');

  // Location data
  const indiaStates = State.getStatesOfCountry('IN');
  const selectedStateObj = filterState ? indiaStates.find(s => s.name === filterState) : null;
  const availableCities = selectedStateObj ? City.getCitiesOfState('IN', selectedStateObj.isoCode).map(c => c.name) : [];

  const insertVariable = (v: string) => {
    if (activeField === 'title') setForm(f => ({ ...f, title: f.title + v }));
    else setForm(f => ({ ...f, body: f.body + v }));
    toast.success(`Inserted ${v}`);
  };

  useEffect(() => { fetchNotifications(); checkFcmConfig(); }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(apiUrl('/api/admin/notifications?_t=' + Date.now()), { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setStats(data.stats || { total: 0, today: 0, totalReach: 0, avgRead: 0 });
      }
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkFcmConfig = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const configRes = await fetch(apiUrl('/api/admin/settings/firebase-config'), { signal: controller.signal });
      clearTimeout(timeout);
      if (configRes.ok) {
        const data = await configRes.json();
        setFcmConfigured(!!(data.config && data.config.projectId));
      } else {
        setFcmConfigured(false);
      }
    } catch {
      setFcmConfigured(false);
    }
  };

  const applyTemplate = (tpl: NotificationTemplate) => {
    setForm(f => ({ ...f, title: tpl.title, body: tpl.body, type: tpl.type }));
  };

  const togglePlatform = (p: 'web' | 'android' | 'ios') => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  const handleSend = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim()) { toast.error('Message body is required'); return; }
    if (form.platforms.length === 0) { toast.error('Select at least one platform'); return; }
    if (form.target === 'specific' && !specificUserIds.trim()) { toast.error('Enter at least one User ID for specific targeting'); return; }

    const ids = specificUserIds.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    setSending(true);
    try {
      const payload = {
        ...form,
        filter_gender: filterGender !== 'all' ? filterGender : undefined,
        filter_state: filterState || undefined,
        filter_city: filterCity || undefined,
        filter_taluka: filterTaluka || undefined,
        filter_premium: filterPremium !== 'all' ? filterPremium : undefined,
        specific_user_ids: form.target === 'specific' ? ids : undefined,
      };
      const res = await fetch(apiUrl('/api/admin/notifications/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send notification');
      }
      const data = await res.json();
      toast.success(`✅ Notification sent to ${data.delivered || 0} users in real-time!`);
      setForm({ title: '', body: '', type: 'general', target: 'all', action_url: '', icon: '🔔', platforms: ['web', 'android'] });
      setFilterGender('all'); setFilterState(''); setFilterCity(''); setFilterTaluka(''); setFilterPremium('all'); setSpecificUserIds('');
      fetchNotifications();
    } catch (err: any) {
      toast.error(err.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this notification record?')) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/notifications/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Notification deleted');
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Bell size={28} className="text-primary" /> Push Notifications
          </h1>
          <p className="text-gray-500 mt-1">Send real-time push notifications to users on Web &amp; Android simultaneously</p>
        </div>
        <button onClick={fetchNotifications} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent', value: stats.total, icon: Send, color: 'text-blue-600 bg-blue-50' },
          { label: 'Today', value: stats.today, icon: Clock, color: 'text-green-600 bg-green-50' },
          { label: 'Total Reach', value: stats.totalReach, icon: Users, color: 'text-purple-600 bg-purple-50' },
          { label: 'Avg. Read Rate', value: `${stats.avgRead}%`, icon: Eye, color: 'text-orange-600 bg-orange-50' },
        ].map(s => (
          <Card key={s.label} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── FCM Config Status Banner ── */}
      {fcmConfigured === false && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Firebase FCM not configured</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Notifications will be sent via Socket.IO (web only). For real Android push notifications, 
              <a href="/admin/settings#firebase" className="font-bold underline ml-1 hover:text-amber-900">configure Firebase in General Settings →</a>
            </p>
          </div>
        </div>
      )}
      {fcmConfigured === true && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-800">
          <CheckCircle size={18} className="text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Firebase FCM Active ✅</p>
            <p className="text-xs text-green-700 mt-0.5">Push notifications will be delivered to Web, Android &amp; iOS devices in real-time via FCM</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">

        {/* ── Compose Panel ── */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Compose Notification
            </h2>

            {/* Quick Templates */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Templates</p>
              <div className="grid grid-cols-3 gap-2">
                {NOTIFICATION_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-white text-xs font-semibold ${tpl.color} hover:opacity-90 border-transparent`}
                  >
                    <tpl.icon size={16} />
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon picker + Type row */}
            <div className="flex gap-3 mb-3">
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Icon</label>
                <button
                  type="button"
                  onClick={() => setShowIconPicker(p => !p)}
                  className="w-14 h-10 text-2xl border border-gray-300 rounded-lg hover:border-primary focus:ring-2 focus:ring-primary outline-none flex items-center justify-center"
                >
                  {form.icon}
                </button>
                {showIconPicker && (
                  <div className="absolute top-12 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-5 gap-1 w-44">
                    {ICON_OPTIONS.map(ic => (
                      <button key={ic} onClick={() => { setForm(f => ({ ...f, icon: ic })); setShowIconPicker(false); }}
                        className="text-xl hover:bg-primary/10 rounded-lg w-8 h-8 flex items-center justify-center transition">
                        {ic}
                      </button>
                    ))}
                    <button onClick={() => setShowIconPicker(false)} className="col-span-5 text-xs text-gray-400 mt-1 hover:text-red-500">Close</button>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                >
                  {Object.keys(TYPE_COLORS).map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onFocus={() => setActiveField('title')}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. 🎁 Special Offer for {{first_name}}!"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                maxLength={100}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.title.length}/100</p>
            </div>

            {/* Body */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
              <textarea
                value={form.body}
                onFocus={() => setActiveField('body')}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{first_name}}, here's something special for you in {{city}}..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                maxLength={300}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.body.length}/300</p>
            </div>

            {/* Variables Panel */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setShowVars(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2"
              >
                <Code size={13} /> Insert Variable {showVars ? '▲' : '▼'}
              </button>
              {showVars && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[10px] text-blue-600 mb-2">Click to insert into <strong>{activeField === 'title' ? 'Title' : 'Message'}</strong> (last focused field)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {NOTIF_VARIABLES.map(v => (
                      <button key={v} type="button" onClick={() => insertVariable(v)}
                        className="px-2 py-0.5 text-[11px] font-mono bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-600 hover:text-white transition">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Target Audience */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Target Audience</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { val: 'all', label: '👥 All' },
                  { val: 'premium', label: '👑 Premium' },
                  { val: 'free', label: '🆓 Free' },
                  { val: 'specific', label: '🎯 Specific' },
                ] as const).map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setForm(f => ({ ...f, target: opt.val }))}
                    className={`px-2 py-2 rounded-lg border-2 text-center transition-all text-xs font-semibold ${form.target === opt.val ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specific User IDs */}
            {form.target === 'specific' && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1"><User size={12}/> User IDs (comma or newline separated)</label>
                <textarea
                  value={specificUserIds}
                  onChange={e => setSpecificUserIds(e.target.value)}
                  placeholder="user-123, user-456&#10;SM-2024-0001"
                  rows={3}
                  className="w-full px-3 py-2 border border-amber-200 bg-white rounded-lg focus:ring-2 focus:ring-amber-400 outline-none text-xs font-mono resize-none"
                />
                <p className="text-[10px] text-amber-600 mt-1">{specificUserIds.split(/[,\n]+/).filter(s=>s.trim()).length} user(s) entered</p>
              </div>
            )}

            {/* Audience Filters */}
            <div className="mb-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1"><Filter size={12}/> Audience Filters <span className="text-gray-400 font-normal">(optional, combines with target)</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Gender */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Gender</label>
                    <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-primary">
                      <option value="all">All Genders</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  {/* Premium */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Plan</label>
                    <select value={filterPremium} onChange={e => setFilterPremium(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-primary">
                      <option value="all">All Plans</option>
                      <option value="premium">Premium Only</option>
                      <option value="free">Free Only</option>
                    </select>
                  </div>
                  {/* State */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1 flex items-center gap-1"><MapPin size={10}/> State</label>
                    <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterCity(''); }}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-primary">
                      <option value="">All States</option>
                      {indiaStates.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  {/* City */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">City</label>
                    <select value={filterCity} onChange={e => setFilterCity(e.target.value)} disabled={!filterState}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
                      <option value="">All Cities</option>
                      {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* Taluka */}
                <div className="mt-2">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Taluka / Village (text)</label>
                  <input type="text" value={filterTaluka} onChange={e => setFilterTaluka(e.target.value)}
                    placeholder="e.g. Andheri, Mulund..."
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {(filterGender !== 'all' || filterState || filterCity || filterTaluka || filterPremium !== 'all') && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[10px] text-primary font-semibold">✅ Filters active</p>
                    <button type="button" onClick={() => { setFilterGender('all'); setFilterState(''); setFilterCity(''); setFilterTaluka(''); setFilterPremium('all'); }}
                      className="text-[10px] text-red-500 hover:text-red-700 font-semibold">Clear all</button>
                  </div>
                )}
              </div>
            </div>

            {/* Action URL */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Action URL (optional)</label>
              <input
                type="text"
                value={form.action_url}
                onChange={e => setForm(f => ({ ...f, action_url: e.target.value }))}
                placeholder="https://... or /dashboard"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
              />
            </div>

            {/* Platforms */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Platforms</label>
              <div className="flex gap-2">
                {([
                  { key: 'web' as const, label: 'Web App', icon: Globe, color: 'bg-blue-500' },
                  { key: 'android' as const, label: 'Android', icon: Smartphone, color: 'bg-green-500' },
                  { key: 'ios' as const, label: 'iOS', icon: Smartphone, color: 'bg-gray-700' },
                ]).map(pl => (
                  <button
                    key={pl.key}
                    onClick={() => togglePlatform(pl.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${form.platforms.includes(pl.key) ? `${pl.color} text-white border-transparent` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >
                    <pl.icon size={12} />
                    {pl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={sending || !form.title || !form.body}
              className="w-full justify-center text-base py-3"
            >
              {sending ? (
                <><Spinner size="sm" />&nbsp;Sending...</>
              ) : (
                <><Send size={18} className="mr-2" /> Send Notification Now</>
              )}
            </Button>

            {/* Platform info */}
            <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-600">
                Notifications are delivered instantly via <strong>Socket.IO</strong> (web) and <strong>Firebase FCM</strong> (Android/iOS). Users will see a real-time popup on the web app.
              </p>
            </div>
          </Card>
        </div>

        {/* ── History Panel ── */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-primary" /> Notification History
              </h2>
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value as any)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="all">All Types</option>
                  {Object.keys(TYPE_COLORS).map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Bell size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No notifications sent yet</p>
                <p className="text-xs mt-1">Use the compose panel to send your first notification</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filtered.map(n => {
                  const Icon = TYPE_ICONS[n.type];
                  const readPct = n.delivery_count > 0 ? Math.round((n.read_count / n.delivery_count) * 100) : 0;
                  return (
                    <div
                      key={n.id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-primary/30 hover:bg-primary/2 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[n.type].split(' ').slice(0,1).join(' ')}`}>
                          <Icon size={16} className={TYPE_COLORS[n.type].split(' ')[1]} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-gray-900 truncate">{n.title}</span>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${TYPE_COLORS[n.type]}`}>
                                  {n.type}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => { setSelectedNotif(n); setPreviewOpen(true); }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(n.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {/* Meta row */}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users size={11} />
                              {n.delivery_count} delivered
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={11} />
                              {n.read_count} read ({readPct}%)
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {new Date(n.sent_at).toLocaleString('en-IN')}
                            </span>
                            {/* Platforms */}
                            <div className="flex gap-1">
                              {(n.platforms || ['web']).map(pl => (
                                <span key={pl} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${pl === 'web' ? 'bg-blue-100 text-blue-700' : pl === 'android' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {pl}
                                </span>
                              ))}
                            </div>
                          </div>
                          {/* Read progress bar */}
                          {n.delivery_count > 0 && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${readPct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Preview Modal ── */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Notification Details">
        {selectedNotif && (
          <div className="p-4 space-y-4">
            {/* Phone mockup preview */}
            <div className="bg-gray-900 rounded-2xl p-4 mx-auto max-w-xs">
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">SM</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-900">{brandName}</p>
                      <p className="text-[10px] text-gray-400">now</p>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 mt-0.5">{selectedNotif.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-3">{selectedNotif.body}</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-gray-500 text-[10px] mt-2">Push Notification Preview</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Delivered</p>
                  <p className="text-xl font-bold text-gray-900">{selectedNotif.delivery_count}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Read</p>
                  <p className="text-xl font-bold text-gray-900">{selectedNotif.read_count}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Target</p>
                  <p className="font-bold text-gray-900 capitalize">{selectedNotif.target}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Type</p>
                  <p className="font-bold text-gray-900 capitalize">{selectedNotif.type}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-medium">Sent At</p>
                <p className="font-bold text-gray-900">{new Date(selectedNotif.sent_at).toLocaleString('en-IN')}</p>
              </div>
              {selectedNotif.action_url && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Action URL</p>
                  <p className="font-mono text-xs text-blue-600 break-all">{selectedNotif.action_url}</p>
                </div>
              )}
              {selectedNotif.firebase_message_id && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-medium">Firebase Message ID</p>
                  <p className="font-mono text-xs text-gray-600 break-all">{selectedNotif.firebase_message_id}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
