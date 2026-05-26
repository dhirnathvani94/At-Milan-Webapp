import React, { useState, useEffect } from 'react';
import { Settings, Save, MessageSquare, Plus, Edit2, Trash2, CheckCircle, XCircle, Send, Eye, EyeOff, Zap, AlertCircle, Flame, Key, RefreshCw, Copy, Globe, Smartphone, Building2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getSiteSettings, updateSiteSetting, adminTestSMS } from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

// Default built-in test SMS provider
const TEST_PROVIDER_DEFAULT = {
  id: 'test-builtin',
  name: 'Test SMS (Development)',
  url: 'https://api.textlocal.in/send/',
  api_key: '',
  type: 'test' as const,
  is_active: false,
  created_at: new Date().toISOString(),
  description: 'Use this for development. Replace with real provider for production.',
};

interface SmsProvider {
  id: string;
  name: string;
  url: string;
  api_key: string;
  type: 'test' | 'production';
  is_active: boolean;
  created_at: string;
  description?: string;
}

export default function AdminSettings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});

  // Change admin password state
  const [adminCurrentPw, setAdminCurrentPw] = useState('');
  const [adminNewPw, setAdminNewPw]         = useState('');
  const [adminConfirmPw, setAdminConfirmPw] = useState('');
  const [changingPw, setChangingPw]         = useState(false);

  // SMS state
  const [smsProviders, setSmsProviders] = useState<SmsProvider[]>([]);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SmsProvider | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Test SMS from AtMilan Admin Panel');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [smsForm, setSmsForm] = useState({ name: '', url: '', api_key: '', type: 'test' as 'test' | 'production', description: '' });

  // Firebase API state
  interface FirebaseApi {
    id: string;
    name: string;
    project_id: string;
    server_key: string;
    sender_id: string;
    vapid_key: string;
    api_key?: string;
    auth_domain?: string;
    storage_bucket?: string;
    app_id?: string;
    type: 'test' | 'production';
    is_active: boolean;
    created_at: string;
    description?: string;
  }
  const [firebaseApis, setFirebaseApis] = useState<FirebaseApi[]>([]);
  const [fbModalOpen, setFbModalOpen] = useState(false);
  const [editingFb, setEditingFb] = useState<FirebaseApi | null>(null);
  const [showFbKey, setShowFbKey] = useState<Record<string, boolean>>({});
  const [testingFb, setTestingFb] = useState<string | null>(null);
  const [fbForm, setFbForm] = useState({ name: '', project_id: '', server_key: '', sender_id: '', vapid_key: '', api_key: '', auth_domain: '', storage_bucket: '', app_id: '', type: 'test' as 'test' | 'production', description: '' });

  const cmsKeys = [
    'hero_description', 'stat_profiles', 'stat_marriages', 'stat_happy_users',
    'free_journey_text', 'app_store_link', 'play_store_link',
    'section_how_it_works_title', 'section_love_stories_title', 'section_testimonials_title',
    'mission_title', 'mission_text_1', 'mission_text_2', 'stat_years',
    'how_it_works_items', 'love_stories_items', 'testimonials_items',
    'faq_data', 'privacy_policy_data', 'terms_data', 'sms_providers',
    // SMS keys managed by SMS Gateway section below
    'sms_api_url', 'sms_api_key', 'sms_provider_name',
    // Firebase keys managed by Firebase API section below
    'firebase_server_key', 'firebase_sender_id', 'firebase_vapid_key', 'firebase_project_id', 'firebase_apis',
    // SEO & Marketing keys (managed in AdminSEOMarketing)
    'seo_meta_title', 'seo_meta_description', 'seo_meta_keywords', 'seo_og_image',
    'seo_google_site_verification', 'seo_bing_site_verification', 'robots_txt_content',
    'marketing_gtm_id', 'marketing_ga4_id', 'marketing_fb_pixel', 'marketing_twitter_pixel', 
    'marketing_linkedin_insight', 'marketing_custom_head_script',
    'app_android_package', 'app_firebase_indexing_url', 'app_seo_title', 'app_seo_description', 'app_seo_keywords',
    'cloudflare_turnstile_sitekey', 'cloudflare_web_analytics_token', 'gdpr_cookie_notice', 'gdpr_cookie_text',
    'posthog_host', 'posthog_api_key',
    'status_yellow_days', 'status_red_days', 'inactivity_email_day_1', 'inactivity_email_day_2', 'inactivity_email_day_3', 'auto_green_limit'
  ];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(data);
      const initialEdits: Record<string, any> = {};
      data.forEach((s: any) => { initialEdits[s.setting_key] = s.setting_value; });
      setEditedSettings(initialEdits);

      // Load SMS providers from settings
      const smsSetting = data.find((s: any) => s.setting_key === 'sms_providers');
      if (smsSetting?.setting_value) {
        try {
          const parsed = JSON.parse(smsSetting.setting_value);
          setSmsProviders(Array.isArray(parsed) ? parsed : []);
        } catch { setSmsProviders([]); }
      } else {
        // Seed from existing sms_api_url / sms_api_key keys if they exist
        const existingUrl = data.find((s: any) => s.setting_key === 'sms_api_url')?.setting_value;
        const existingKey = data.find((s: any) => s.setting_key === 'sms_api_key')?.setting_value;
        const existingName = data.find((s: any) => s.setting_key === 'sms_provider_name')?.setting_value;
        if (existingUrl) {
          const seeded: SmsProvider = {
            id: 'seeded-existing',
            name: existingName || 'Existing SMS Provider',
            url: existingUrl,
            api_key: existingKey || '',
            type: 'production',
            is_active: true,
            created_at: new Date().toISOString(),
            description: 'Imported from existing settings',
          };
          setSmsProviders([seeded]);
        } else {
          setSmsProviders([TEST_PROVIDER_DEFAULT]);
        }
      }

      // Load Firebase APIs from settings
      const fbSetting = data.find((s: any) => s.setting_key === 'firebase_apis');
      if (fbSetting?.setting_value) {
        try {
          const parsed = JSON.parse(fbSetting.setting_value);
          setFirebaseApis(Array.isArray(parsed) ? parsed : []);
        } catch { setFirebaseApis([]); }
      }
    } catch (error) {
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSmsProviders = async (providers: SmsProvider[]) => {
    if (!user) return;
    // Save the full providers list
    await updateSiteSetting('sms_providers', JSON.stringify(providers), user.id);
    setSmsProviders(providers);
    // Sync active provider to sms_api_url / sms_api_key so OTP backend uses them
    const active = providers.find(p => p.is_active);
    if (active) {
      await updateSiteSetting('sms_api_url', active.url, user.id);
      await updateSiteSetting('sms_api_key', active.api_key, user.id);
      await updateSiteSetting('sms_provider_name', active.name, user.id);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const savePromises: Promise<any>[] = [];
      for (const key in editedSettings) {
        const original = settings.find((s: any) => s.setting_key === key);
        const originalValue = original?.setting_value ?? null;
        const newValue = String(editedSettings[key] ?? '');
        if (originalValue !== newValue) {
          savePromises.push(
            fetch(apiUrl(`/api/admin/settings/${key}`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('atmilan-token')}`
              },
              body: JSON.stringify({ value: newValue, adminId: user.id })
            })
          );
        }
      }
      if (savePromises.length === 0) {
        toast('No changes to save');
        setSaving(false);
        return;
      }
      await Promise.all(savePromises);
      toast.success(`Settings saved successfully`);
      fetchData();
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompanyInfo = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const companyKeys = [
        'platform_name', 'company_tagline', 'contact_email', 'contact_phone',
        'support_whatsapp', 'contact_address', 'company_website', 'company_gstin',
        'invoice_prefix', 'invoice_logo', 'smtp_from_name', 'community_name'
      ];
      const savePromises = companyKeys
        .filter(key => editedSettings[key] !== undefined)
        .map(key => {
          const original = settings.find((s: any) => s.setting_key === key);
          const originalValue = original?.setting_value ?? null;
          const newValue = String(editedSettings[key] ?? '');
          if (originalValue !== newValue) {
            return fetch(apiUrl(`/api/admin/settings/${key}`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('atmilan-token')}`
              },
              body: JSON.stringify({ value: newValue, adminId: user.id })
            });
          }
          return Promise.resolve(null);
        })
        .filter(Boolean);

      if (savePromises.length === 0) {
        toast('No changes detected');
        setSaving(false);
        return;
      }

      await Promise.all(savePromises);
      toast.success('Company information saved successfully!');
      fetchData();
    } catch (error) {
      console.error('Save company info error:', error);
      toast.error('Failed to save. Check browser console for details.');
    } finally {
      setSaving(false);
    }
  };

  // Change admin password handler
  const handleChangeAdminPassword = async () => {
    if (!adminCurrentPw || !adminNewPw || !adminConfirmPw) {
      return toast.error('Please fill in all password fields.');
    }
    if (adminNewPw !== adminConfirmPw) {
      return toast.error('New passwords do not match.');
    }
    if (adminNewPw.length < 8) {
      return toast.error('New password must be at least 8 characters.');
    }
    setChangingPw(true);
    try {
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl('/api/admin/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: adminCurrentPw, newPassword: adminNewPw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      toast.success('Admin password changed successfully!');
      setAdminCurrentPw('');
      setAdminNewPw('');
      setAdminConfirmPw('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  // SMS CRUD
  const openAddModal = () => {
    setEditingProvider(null);
    setSmsForm({ name: '', url: '', api_key: '', type: 'test', description: '' });
    setSmsModalOpen(true);
  };

  const openEditModal = (p: SmsProvider) => {
    setEditingProvider(p);
    setSmsForm({ name: p.name, url: p.url, api_key: p.api_key, type: p.type, description: p.description || '' });
    setSmsModalOpen(true);
  };

  const handleSaveSmsProvider = async () => {
    if (!smsForm.name.trim() || !smsForm.url.trim()) {
      toast.error('Provider name and URL are required');
      return;
    }
    try {
      let updated: SmsProvider[];
      if (editingProvider) {
        updated = smsProviders.map(p => p.id === editingProvider.id ? { ...p, ...smsForm } : p);
      } else {
        const newP: SmsProvider = {
          id: `sms-${Date.now()}`,
          ...smsForm,
          is_active: smsProviders.length === 0,
          created_at: new Date().toISOString(),
        };
        updated = [...smsProviders, newP];
      }
      await saveSmsProviders(updated);
      toast.success(editingProvider ? 'Provider updated' : 'Provider added');
      setSmsModalOpen(false);
    } catch {
      toast.error('Failed to save provider');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!window.confirm('Delete this SMS provider?')) return;
    const updated = smsProviders.filter(p => p.id !== id);
    await saveSmsProviders(updated);
    toast.success('Provider deleted');
  };

  const handleSetActive = async (id: string) => {
    const updated = smsProviders.map(p => ({ ...p, is_active: p.id === id }));
    await saveSmsProviders(updated);
    toast.success('Active SMS provider updated');
  };

  const handleDeactivate = async (id: string) => {
    const updated = smsProviders.map(p => p.id === id ? { ...p, is_active: false } : p);
    await saveSmsProviders(updated);
    toast.success('Provider deactivated');
  };

  const handleTestSMS = async (provider: SmsProvider) => {
    if (!testPhone.trim()) { toast.error('Enter a phone number to test'); return; }
    setTestingProvider(provider.id);
    try {
      await adminTestSMS(testPhone, testMessage, provider);
      toast.success(`Test SMS sent via "${provider.name}"!`);
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTestingProvider(null);
    }
  };

  // ── Firebase API CRUD ──
  const saveFirebaseApis = async (apis: FirebaseApi[]) => {
    if (!user) return;
    await updateSiteSetting('firebase_apis', JSON.stringify(apis), user.id);
    setFirebaseApis(apis);
    // Sync active API keys to flat settings for server use
    const active = apis.find(a => a.is_active);
    if (active) {
      await updateSiteSetting('firebase_server_key', active.server_key, user.id);
      await updateSiteSetting('firebase_sender_id', active.sender_id, user.id);
      await updateSiteSetting('firebase_vapid_key', active.vapid_key, user.id);
      await updateSiteSetting('firebase_project_id', active.project_id, user.id);
    }
  };

  const openAddFb = () => {
    setEditingFb(null);
    setFbForm({ name: '', project_id: '', server_key: '', sender_id: '', vapid_key: '', api_key: '', auth_domain: '', storage_bucket: '', app_id: '', type: 'test', description: '' });
    setFbModalOpen(true);
  };

  const openEditFb = (a: FirebaseApi) => {
    setEditingFb(a);
    setFbForm({ name: a.name, project_id: a.project_id, server_key: a.server_key, sender_id: a.sender_id, vapid_key: a.vapid_key, api_key: a.api_key || '', auth_domain: a.auth_domain || '', storage_bucket: a.storage_bucket || '', app_id: a.app_id || '', type: a.type, description: a.description || '' });
    setFbModalOpen(true);
  };

  const handleSaveFb = async () => {
    if (!fbForm.name.trim() || !fbForm.project_id.trim()) {
      toast.error('API Name and Project ID are required');
      return;
    }
    try {
      let updated: FirebaseApi[];
      if (editingFb) {
        updated = firebaseApis.map(a => a.id === editingFb.id ? { ...a, ...fbForm } : a);
      } else {
        const newA: FirebaseApi = {
          id: `fb-${Date.now()}`,
          ...fbForm,
          is_active: firebaseApis.length === 0,
          created_at: new Date().toISOString(),
        };
        updated = [...firebaseApis, newA];
      }
      await saveFirebaseApis(updated);
      toast.success(editingFb ? 'Firebase API updated' : 'Firebase API added');
      setFbModalOpen(false);
    } catch { toast.error('Failed to save Firebase API'); }
  };

  const handleDeleteFb = async (id: string) => {
    if (!window.confirm('Delete this Firebase API configuration?')) return;
    const updated = firebaseApis.filter(a => a.id !== id);
    await saveFirebaseApis(updated);
    toast.success('Firebase API deleted');
  };

  const handleSetActiveFb = async (id: string) => {
    const updated = firebaseApis.map(a => ({ ...a, is_active: a.id === id }));
    await saveFirebaseApis(updated);
    toast.success('Active Firebase API updated');
  };

  const handleDeactivateFb = async (id: string) => {
    const updated = firebaseApis.map(a => a.id === id ? { ...a, is_active: false } : a);
    await saveFirebaseApis(updated);
    toast.success('Firebase API deactivated');
  };

  const handleTestFb = async (api: FirebaseApi) => {
    setTestingFb(api.id);
    try {
      const res = await fetch(apiUrl('/api/admin/test-firebase'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_key: api.server_key, project_id: api.project_id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Test failed');
      toast.success(`✅ Firebase API "${api.name}" is working!`);
    } catch (err: any) {
      toast.error(`Firebase test failed: ${err.message}`);
    } finally {
      setTestingFb(null);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  const orderedKeys = [
    // Site config
    'site_name',
    'community_name',
    'site_logo',
    'site_favicon',
    'contact_unlock_duration_hours',
    'master_otp'
  ];

  const generalSettings = settings
    .filter(s => s.setting_type !== 'json' && !cmsKeys.includes(s.setting_key))
    .sort((a, b) => {
      const idxA = orderedKeys.indexOf(a.setting_key);
      const idxB = orderedKeys.indexOf(b.setting_key);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  const activeProvider = smsProviders.find(p => p.is_active);
  const activeFbApi = firebaseApis.find(a => a.is_active);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
          <Settings size={28} className="text-primary" /> General Settings
        </h1>
        <p className="text-gray-500">Manage site name, branding, SMS gateways, and global configurations</p>
      </div>

      {/* ── COMPANY INFORMATION ── */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Building2 size={20} className="text-primary" /> Company Information
        </h2>
        <p className="text-sm text-gray-500 mb-4">These details appear on every page, every email, every invoice and every notification. Changing the App Name here instantly rebrands the entire app — including all emails, invoices, reports and notifications. When you deploy a fresh copy for a new community, the new admin simply changes these fields.</p>

        {/* White Label Guide info box */}
        <div className="mb-6 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>White Label Guide:</strong> To launch this app for a new community — take a fresh copy of the code, deploy it, log in as admin, and change the App / Brand Name field above. Every page, email, invoice and notification will instantly show the new brand name. No code changes needed.
          </p>
        </div>

        <div className="space-y-6">
          {[
            { key: 'platform_name', label: 'App / Brand Name', desc: 'Main name shown everywhere. Change this to instantly rebrand the entire app.', type: 'text', placeholder: 'e.g. AtMilan' },
            { key: 'company_tagline', label: 'Company Tagline', desc: 'Short tagline shown below brand name on invoices', type: 'text', placeholder: 'e.g. Premium Matrimonial Platform' },
            { key: 'contact_email', label: 'Support Email', desc: 'Shown on invoices, checkout page and contact page', type: 'text', placeholder: 'e.g. support@atmilan.com' },
            { key: 'contact_phone', label: 'Support Phone', desc: 'Shown on contact page and checkout page', type: 'text', placeholder: 'e.g. +91 98765 43210' },
            { key: 'support_whatsapp', label: 'WhatsApp Number', desc: 'WhatsApp support number including country code', type: 'text', placeholder: 'e.g. +919876543210' },
            { key: 'contact_address', label: 'Company Address', desc: 'Full address shown on invoices and contact page', type: 'textarea', placeholder: 'e.g. 123 Matrimony Tower, Mumbai 400001' },
            { key: 'company_website', label: 'Company Website', desc: 'Shown on invoices and footer', type: 'text', placeholder: 'e.g. www.atmilan.com' },
            { key: 'company_gstin', label: 'GST Number', desc: 'GSTIN shown on invoices — leave blank if not GST registered', type: 'text', placeholder: 'e.g. 27AABCS1429B1Z5' },
            { key: 'invoice_prefix', label: 'Invoice Number Prefix', desc: 'Prefix for invoice numbers. AM gives AM-XYZ123. Use your brand initials.', type: 'text', placeholder: 'e.g. AM' },
            { key: 'invoice_logo', label: 'Invoice Logo', desc: 'Logo shown on invoices — upload PNG or JPG image', type: 'image', placeholder: '' },
            { key: 'smtp_from_name', label: 'Email Sender Name', desc: 'Name users see as sender in all emails. Change when you rebrand.', type: 'text', placeholder: 'e.g. AtMilan' },
            { key: 'community_name', label: 'Primary Community', desc: 'Default community shown in registration and profile forms', type: 'text', placeholder: 'e.g. Lohana' },
          ].map((field) => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-900">{field.label}</label>
                <p className="text-xs text-gray-500 mt-1">{field.desc}</p>
              </div>
              <div className="md:col-span-2">
                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all min-h-[100px]"
                    value={editedSettings[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => handleSettingChange(field.key, e.target.value)}
                  />
                ) : field.type === 'image' ? (
                  <div className="space-y-3">
                    {editedSettings[field.key] && (
                      <div className="relative inline-block">
                        <img src={editedSettings[field.key]} alt="Preview" className="h-16 object-contain border border-gray-200 rounded p-1 bg-gray-50" />
                        <button onClick={() => handleSettingChange(field.key, '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">×</button>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const formData = new FormData(); formData.append('file', file);
                      try {
                        toast.loading('Uploading...', { id: 'upload' });
                        const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
                        if (!res.ok) throw new Error();
                        const data = await res.json();
                        handleSettingChange(field.key, data.fileUrl);
                        toast.success('Uploaded', { id: 'upload' });
                      } catch { toast.error('Upload failed', { id: 'upload' }); }
                    }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                  </div>
                ) : (
                  <input
                    type="text"
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={editedSettings[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => handleSettingChange(field.key, e.target.value)}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Header Logo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-gray-900">Header Logo</label>
              <p className="text-xs text-gray-500 mt-1">Shown in the navigation bar. Leave empty to show text logo with brand name.</p>
            </div>
            <div className="md:col-span-2">
              {editedSettings['site_logo_image'] && (
                <div className="mb-2 flex items-center gap-3">
                  <img src={editedSettings['site_logo_image']} alt="Header Logo" className="h-10 w-auto object-contain rounded-lg border border-gray-200" />
                  <button onClick={() => handleSettingChange('site_logo_image', '')} className="text-xs text-red-500 hover:underline">Remove logo</button>
                </div>
              )}
              <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => handleSettingChange('site_logo_image', reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <p className="text-xs text-gray-400 mt-1">Supports square and rounded images. PNG or JPG recommended.</p>
            </div>
          </div>

          {/* Footer Logo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-gray-900">Footer Logo</label>
              <p className="text-xs text-gray-500 mt-1">Shown in the footer section. Leave empty to show text logo with brand name.</p>
            </div>
            <div className="md:col-span-2">
              {editedSettings['footer_logo_image'] && (
                <div className="mb-2 flex items-center gap-3">
                  <img src={editedSettings['footer_logo_image']} alt="Footer Logo" className="h-10 w-auto object-contain rounded-lg border border-gray-200 bg-gray-800 p-1" />
                  <button onClick={() => handleSettingChange('footer_logo_image', '')} className="text-xs text-red-500 hover:underline">Remove logo</button>
                </div>
              )}
              <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => handleSettingChange('footer_logo_image', reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <p className="text-xs text-gray-400 mt-1">Shown on dark footer background. PNG with transparent background works best.</p>
            </div>
          </div>

          {/* Favicon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-gray-900">Favicon (Browser Tab Icon)</label>
              <p className="text-xs text-gray-500 mt-1">Small icon shown in browser tab. Works as square or rounded icon.</p>
            </div>
            <div className="md:col-span-2">
              {editedSettings['site_favicon'] && (
                <div className="mb-2 flex items-center gap-3">
                  <img src={editedSettings['site_favicon']} alt="Favicon" className="h-8 w-8 object-contain rounded border border-gray-200" />
                  <button onClick={() => handleSettingChange('site_favicon', '')} className="text-xs text-red-500 hover:underline">Remove favicon</button>
                </div>
              )}
              <input type="file" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => handleSettingChange('site_favicon', reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
              <p className="text-xs text-gray-400 mt-1">Recommended: 32x32px or 64x64px PNG. Square images work best as browser tab icons.</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSaveCompanyInfo} disabled={saving} className="min-w-[120px]">
              {saving ? <Spinner size="sm" /> : <><Save size={18} className="mr-2" /> Save Company Info</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── PROFILE STATUS & MAIL SETTINGS ── */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <AlertCircle size={20} className="text-primary" /> Profile Status & Mail Settings
        </h2>
        <p className="text-sm text-gray-500 mb-6">Manage when a profile turns yellow or red due to inactivity, and when to send match confirmation emails.</p>

        <div className="space-y-6">
          {[
            { key: 'status_yellow_days', label: 'Yellow Status Days', desc: 'Days of inactivity before showing YELLOW taking-a-break frame.', type: 'number', placeholder: 'e.g. 15' },
            { key: 'status_red_days', label: 'Red Status Days', desc: 'Days of inactivity before showing RED paused frame.', type: 'number', placeholder: 'e.g. 30' },
            { key: 'inactivity_email_day_1', label: 'Match Mail Day 1', desc: 'Send first reminder email after these many days.', type: 'number', placeholder: 'e.g. 60' },
            { key: 'inactivity_email_day_2', label: 'Match Mail Day 2', desc: 'Send second reminder email after these many days.', type: 'number', placeholder: 'e.g. 75' },
            { key: 'inactivity_email_day_3', label: 'Match Mail Day 3', desc: 'Send third reminder email after these many days.', type: 'number', placeholder: 'e.g. 90' },
            { key: 'auto_green_limit', label: 'Auto-Green Limit', desc: 'Max times a yellow/red user can auto-reactivate without admin approval.', type: 'number', placeholder: 'e.g. 10' },
          ].map((field) => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-900">{field.label}</label>
                <p className="text-xs text-gray-500 mt-1">{field.desc}</p>
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={editedSettings[field.key] || ''}
                  placeholder={field.placeholder}
                  onChange={(e) => handleSettingChange(field.key, e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} className="min-w-[120px]">
              {saving ? <Spinner size="sm" /> : <><Save size={18} className="mr-2" /> Save Status Settings</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── SITE CONFIGURATION (General Settings) ── */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Settings size={20} className="text-primary" /> Site Configuration
        </h2>
        <div className="space-y-6">
          {generalSettings.map((setting) => (
            <div key={setting.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
              <div className="md:col-span-1">
                <label className="block text-sm font-bold text-gray-900">{setting.setting_key.replace(/_/g, ' ').toUpperCase()}</label>
                <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
              </div>
              <div className="md:col-span-2">
                {setting.setting_type === 'boolean' ? (
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={editedSettings[setting.setting_key] === 'true'}
                        onChange={(e) => handleSettingChange(setting.setting_key, e.target.checked ? 'true' : 'false')} />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <span className="text-sm font-medium text-gray-700">{editedSettings[setting.setting_key] === 'true' ? 'Enabled' : 'Disabled'}</span>
                  </div>
                ) : setting.setting_type === 'number' ? (
                  <input type="number" className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={editedSettings[setting.setting_key] || ''} onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)} />
                ) : setting.setting_type === 'image' ? (
                  <div className="space-y-3">
                    {editedSettings[setting.setting_key] && (
                      <div className="relative inline-block">
                        <img src={editedSettings[setting.setting_key]} alt="Preview" className="h-16 object-contain border border-gray-200 rounded p-1 bg-gray-50" />
                        <button onClick={() => handleSettingChange(setting.setting_key, '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">×</button>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const formData = new FormData(); formData.append('file', file);
                      try {
                        toast.loading('Uploading...', { id: 'upload' });
                        const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
                        if (!res.ok) throw new Error();
                        const data = await res.json();
                        handleSettingChange(setting.setting_key, data.fileUrl);
                        toast.success('Uploaded', { id: 'upload' });
                      } catch { toast.error('Upload failed', { id: 'upload' }); }
                    }} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                  </div>
                ) : setting.setting_type === 'password' ? (
                  <input type="password" className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono"
                    value={editedSettings[setting.setting_key] || ''} placeholder="Enter password / key"
                    onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)} />
                ) : setting.setting_type === 'textarea' ? (
                  <textarea className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all min-h-[100px]"
                    value={editedSettings[setting.setting_key] || ''} onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)} />
                ) : (
                  <input type="text" className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={editedSettings[setting.setting_key] || ''} onChange={(e) => handleSettingChange(setting.setting_key, e.target.value)} />
                )}
              </div>
            </div>
          ))}
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving} className="min-w-[120px]">
              {saving ? <Spinner size="sm" /> : <><Save size={18} className="mr-2" /> Save Settings</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── SMS GATEWAY MANAGEMENT ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" /> SMS Gateway Management
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Manages <strong>sms_api_url</strong> &amp; <strong>sms_api_key</strong> used by the OTP system. Setting a provider active updates these fields automatically.
            </p>
          </div>
          <Button onClick={openAddModal} className="flex items-center gap-2">
            <Plus size={16} /> Add Provider
          </Button>
        </div>

        {/* Active provider banner */}
        {activeProvider ? (
          <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle size={18} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800">Active: {activeProvider.name}</p>
              <p className="text-xs text-green-600">{activeProvider.url}</p>
            </div>
            <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${activeProvider.type === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {activeProvider.type}
            </span>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">No active SMS provider. OTP / notifications will not be sent.</p>
          </div>
        )}

        {/* Provider list */}
        <div className="space-y-4">
          {smsProviders.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No SMS providers yet. Add one to get started.</p>
            </div>
          ) : smsProviders.map(p => (
            <div key={p.id} className={`border rounded-xl p-4 transition-all ${p.is_active ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-sm">{p.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.type === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.type}
                    </span>
                    {p.is_active && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle size={9} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 break-all">{p.url}</p>
                  {p.description && <p className="text-xs text-gray-400 mt-0.5 italic">{p.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500 font-medium">API Key:</span>
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {showApiKey[p.id] ? (p.api_key || '(not set)') : '••••••••••••••••'}
                    </span>
                    <button onClick={() => setShowApiKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))} className="text-gray-400 hover:text-gray-600">
                      {showApiKey[p.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!p.is_active && (
                    <button onClick={() => handleSetActive(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1">
                      <Zap size={12} /> Set Active
                    </button>
                  )}
                  {p.is_active && (
                    <button onClick={() => handleDeactivate(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center gap-1">
                      <XCircle size={12} /> Deactivate
                    </button>
                  )}
                  <button onClick={() => openEditModal(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1">
                    <Edit2 size={12} /> Edit
                  </button>
                  <button onClick={() => handleDeleteProvider(p.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
              {/* Test SMS inline */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <input type="tel" placeholder="Phone to test (e.g. 9876543210)" value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="flex-1 min-w-[180px] text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                <input type="text" placeholder="Test message" value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="flex-1 min-w-[180px] text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                <button onClick={() => handleTestSMS(p)} disabled={testingProvider === p.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60">
                  {testingProvider === p.id ? <Spinner size="sm" /> : <Send size={12} />} Send Test SMS
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── FIREBASE API MANAGEMENT ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Flame size={20} className="text-orange-500" /> Firebase API Management
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage Firebase Cloud Messaging (FCM) keys used for real-time push notifications on Web &amp; Android.
            </p>
          </div>
          <Button onClick={openAddFb} className="flex items-center gap-2">
            <Plus size={16} /> Add Firebase API
          </Button>
        </div>

        {/* Active API banner */}
        {activeFbApi ? (
          <div className="mb-5 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <Flame size={18} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-orange-800">Active: {activeFbApi.name}</p>
              <p className="text-xs text-orange-600">Project: {activeFbApi.project_id}</p>
            </div>
            <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${activeFbApi.type === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
              {activeFbApi.type}
            </span>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">No active Firebase API. Push notifications will not be delivered.</p>
          </div>
        )}

        {/* API list */}
        <div className="space-y-4">
          {firebaseApis.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Flame size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Firebase APIs configured. Add one to enable push notifications.</p>
              <p className="text-xs mt-1 text-gray-400">Get your keys from <span className="text-orange-500 font-mono">console.firebase.google.com</span></p>
            </div>
          ) : firebaseApis.map(api => (
            <div key={api.id} className={`border rounded-xl p-4 transition-all ${api.is_active ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-sm">{api.name}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${api.type === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {api.type}
                    </span>
                    {api.is_active && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                        <CheckCircle size={9} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Project ID: <span className="font-mono">{api.project_id}</span></p>
                  {api.description && <p className="text-xs text-gray-400 mt-0.5 italic">{api.description}</p>}
                  {/* Key fields */}
                  {[
                    { label: 'Server Key', value: api.server_key, field: `server_${api.id}` },
                    { label: 'Sender ID', value: api.sender_id, field: `sender_${api.id}` },
                    { label: 'VAPID Key', value: api.vapid_key, field: `vapid_${api.id}` },
                  ].map(({ label, value, field }) => (
                    <div key={field} className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-500 font-medium w-20 shrink-0">{label}:</span>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded flex-1 truncate">
                        {showFbKey[field] ? (value || '(not set)') : '••••••••••••••••'}
                      </span>
                      <button onClick={() => setShowFbKey(prev => ({ ...prev, [field]: !prev[field] }))} className="text-gray-400 hover:text-gray-600 shrink-0">
                        {showFbKey[field] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      {value && (
                        <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied!'); }} className="text-gray-400 hover:text-blue-600 shrink-0">
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  {!api.is_active && (
                    <button onClick={() => handleSetActiveFb(api.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1">
                      <Zap size={12} /> Set Active
                    </button>
                  )}
                  {api.is_active && (
                    <button onClick={() => handleDeactivateFb(api.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center gap-1">
                      <XCircle size={12} /> Deactivate
                    </button>
                  )}
                  <button onClick={() => handleTestFb(api)} disabled={testingFb === api.id} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center gap-1 disabled:opacity-60">
                    {testingFb === api.id ? <Spinner size="sm" /> : <RefreshCw size={12} />} Test API
                  </button>
                  <button onClick={() => openEditFb(api)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1">
                    <Edit2 size={12} /> Edit
                  </button>
                  <button onClick={() => handleDeleteFb(api.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Firebase setup guide */}
        <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5"><Key size={12} /> How to get Firebase keys</h4>
          <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
            <li>Go to <span className="text-orange-500 font-mono">console.firebase.google.com</span> → Your Project → Project Settings</li>
            <li>Under <strong>Cloud Messaging</strong> tab → copy <strong>Server Key</strong> &amp; <strong>Sender ID</strong></li>
            <li>Under <strong>General</strong> tab → Web App config → copy <strong>VAPID Key</strong> from Web Push certificates</li>
            <li>Add these to the form above and set as <strong>Active</strong></li>
          </ol>
        </div>
      </Card>

      {/* Add / Edit Firebase API Modal */}
      <Modal isOpen={fbModalOpen} onClose={() => setFbModalOpen(false)} title={editingFb ? 'Edit Firebase API' : 'Add Firebase API'}>
        <div className="space-y-4 p-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">API Name *</label>
              <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                placeholder="e.g. Firebase Production, Dev FCM" value={fbForm.name}
                onChange={e => setFbForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
              <div className="flex gap-3">
                {(['test', 'production'] as const).map(t => (
                  <button key={t} onClick={() => setFbForm(p => ({ ...p, type: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${fbForm.type === t ? (t === 'test' ? 'bg-orange-500 text-white border-orange-500' : 'bg-blue-600 text-white border-blue-600') : 'bg-white border-gray-300 text-gray-600'}`}>
                    {t === 'test' ? '🧪 Test / Dev' : '🚀 Production'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Server-side keys (for FCM backend delivery) */}
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
            <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">🔥 Server-Side Keys (Cloud Messaging)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Project ID *</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="your-firebase-project-id" value={fbForm.project_id}
                  onChange={e => setFbForm(p => ({ ...p, project_id: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Server Key (FCM Legacy)</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="AAAA...your FCM server key" value={fbForm.server_key}
                  onChange={e => setFbForm(p => ({ ...p, server_key: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Sender ID</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="123456789012" value={fbForm.sender_id}
                  onChange={e => setFbForm(p => ({ ...p, sender_id: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Client-side Web SDK config (for browser push) */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">🌐 Web SDK Config (Browser Push Notifications)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">API Key</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="AIzaSy...your web API key" value={fbForm.api_key}
                  onChange={e => setFbForm(p => ({ ...p, api_key: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">App ID</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="1:123456789012:web:abc123..." value={fbForm.app_id}
                  onChange={e => setFbForm(p => ({ ...p, app_id: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">VAPID Key (Web Push Certificate)</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
                  placeholder="BNtV...your VAPID public key" value={fbForm.vapid_key}
                  onChange={e => setFbForm(p => ({ ...p, vapid_key: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
            <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
              placeholder="e.g. Production FCM for Android + Web" value={fbForm.description}
              onChange={e => setFbForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Setup guide */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 space-y-1">
            <p className="font-bold text-gray-700">📋 How to get these keys:</p>
            <p>1. Go to <span className="font-mono text-orange-500">console.firebase.google.com</span> → Your Project → Project Settings</p>
            <p>2. <strong>Server Key & Sender ID</strong>: Cloud Messaging tab</p>
            <p>3. <strong>API Key, App ID</strong>: General tab → Your apps → Web App config</p>
            <p>4. <strong>VAPID Key</strong>: Cloud Messaging tab → Web Push certificates → Generate key pair</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSaveFb} className="flex-1">
              <Save size={16} className="mr-2" /> {editingFb ? 'Update API' : 'Add Firebase API'}
            </Button>
            <Button variant="outline" onClick={() => setFbModalOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={smsModalOpen} onClose={() => setSmsModalOpen(false)} title={editingProvider ? 'Edit SMS Provider' : 'Add SMS Provider'}>
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Provider Name *</label>
            <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              placeholder="e.g. Textlocal, MSG91, Fast2SMS" value={smsForm.name}
              onChange={e => setSmsForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
            <div className="flex gap-3">
              {(['test', 'production'] as const).map(t => (
                <button key={t} onClick={() => setSmsForm(p => ({ ...p, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${smsForm.type === t ? (t === 'test' ? 'bg-orange-500 text-white border-orange-500' : 'bg-blue-600 text-white border-blue-600') : 'bg-white border-gray-300 text-gray-600'}`}>
                  {t === 'test' ? '🧪 Test / Dev' : '🚀 Production'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">API URL *</label>
            <input type="url" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
              placeholder="https://api.provider.com/send/" value={smsForm.url}
              onChange={e => setSmsForm(p => ({ ...p, url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">API Key</label>
            <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none font-mono text-sm"
              placeholder="Your SMS provider API key" value={smsForm.api_key}
              onChange={e => setSmsForm(p => ({ ...p, api_key: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
            <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
              placeholder="e.g. Textlocal transactional route" value={smsForm.description}
              onChange={e => setSmsForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSaveSmsProvider} className="flex-1">
              <Save size={16} className="mr-2" /> {editingProvider ? 'Update Provider' : 'Add Provider'}
            </Button>
            <Button variant="outline" onClick={() => setSmsModalOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── Change Admin Password ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 border-l-4 border-l-red-500">
        <div className="flex items-center gap-3 mb-2">
          <Shield size={22} className="text-red-600" />
          <h2 className="text-lg font-bold text-gray-900">Change Admin Password</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">Change your admin panel login password. You will stay logged in after changing. Password is saved securely to the database immediately.</p>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="Enter your current password" value={adminCurrentPw} onChange={(e) => setAdminCurrentPw(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="Minimum 8 characters" value={adminNewPw} onChange={(e) => setAdminNewPw(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="Repeat new password" value={adminConfirmPw} onChange={(e) => setAdminConfirmPw(e.target.value)} />
          </div>
          <Button onClick={handleChangeAdminPassword} disabled={changingPw} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {changingPw ? 'Changing...' : '🔒 Update Admin Password'}
          </Button>
        </div>
      </div>

    </div>
  );
}
