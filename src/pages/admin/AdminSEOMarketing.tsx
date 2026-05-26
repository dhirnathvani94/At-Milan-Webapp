import React, { useState, useEffect } from 'react';
import { Search, Globe, Smartphone, BarChart, Save, Code, RefreshCw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getSiteSettings, updateSiteSetting } from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import { PageSkeleton } from '../../components/ui/Skeletons';

const TABS = [
  { id: 'web-seo', label: 'Web SEO', icon: Globe, desc: 'Meta tags, titles, and search engine optimization' },
  { id: 'tracking', label: 'Tag Manager & Analytics', icon: BarChart, desc: 'GTM, GA4, Tracking Pixels & Verification' },
  { id: 'app-ranking', label: 'App SEO & Ranking', icon: Smartphone, desc: 'Google Search App Indexing & Metadata' },
  { id: 'compliance', label: 'Compliance & Security', icon: ShieldCheck, desc: 'GDPR Cookie Consent & Cloudflare configuration' },
];

export default function AdminSEOMarketing() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('web-seo');
  const [settings, setSettings] = useState<any[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getSiteSettings();
      setSettings(data);
      const initialEdits: Record<string, any> = {};
      data.forEach((s: any) => {
        initialEdits[s.setting_key] = s.setting_value;
      });
      setEditedSettings(initialEdits);
    } catch (error) {
      toast.error('Failed to fetch SEO settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const key in editedSettings) {
        const original = settings.find(s => s.setting_key === key);
        if (!original || original.setting_value !== editedSettings[key]) {
          await updateSiteSetting(key, editedSettings[key], user.id);
        }
      }
      toast.success('SEO & Marketing settings saved securely');
      fetchData(); // Reload to get fresh state
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => editedSettings[key] || '';

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
            <Search size={28} className="text-primary" /> SEO & Marketing Manager
          </h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Globally manage search rankings, tracking tags, and app visibility.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="rounded-xl font-bold bg-white">
            <RefreshCw size={16} className="mr-2" /> Discard Changes
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="rounded-xl font-bold shadow-sm">
            {saving ? <Spinner size="sm" className="mr-2" /> : <Save size={16} className="mr-2" />} 
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-start p-4 rounded-2xl border transition-all text-left ${
              activeTab === tab.id 
                ? 'bg-primary border-primary shadow-lg shadow-primary/20 scale-[1.02]' 
                : 'bg-white border-gray-100 hover:border-primary/40 hover:bg-gray-50'
            }`}
          >
            <div className={`p-2 rounded-xl mb-3 ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
              <tab.icon size={20} />
            </div>
            <p className={`font-bold text-sm ${activeTab === tab.id ? 'text-white' : 'text-gray-900'}`}>{tab.label}</p>
            <p className={`text-xs mt-1 font-medium ${activeTab === tab.id ? 'text-white/80' : 'text-gray-500'}`}>{tab.desc}</p>
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'web-seo' && (
          <Card className="p-6 border border-gray-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
              <Globe className="text-primary" size={20} />
              <h2 className="text-lg font-black text-gray-900">Global Website SEO</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Default Meta Title (Homepage)</label>
                <input 
                  type="text" 
                  value={getValue('seo_meta_title')} 
                  onChange={(e) => handleChange('seo_meta_title', e.target.value)}
                  placeholder="e.g. AtMilan - Premium Matchmaking Services"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50/50 focus:bg-white transition-all font-medium"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Optimal length: 50-60 characters.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Global Meta Description</label>
                <textarea 
                  value={getValue('seo_meta_description')} 
                  onChange={(e) => handleChange('seo_meta_description', e.target.value)}
                  placeholder="e.g. Find your perfect life partner with our exclusive matchmaking services. Register today to meet verified profiles..."
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50/50 focus:bg-white transition-all font-medium resize-none"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Optimal length: 150-160 characters for best Google indexing.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Global Meta Keywords</label>
                <input 
                  type="text" 
                  value={getValue('seo_meta_keywords')} 
                  onChange={(e) => handleChange('seo_meta_keywords', e.target.value)}
                  placeholder="e.g. matchmaking, matrimony, dating, marriage bureau, AtMilan"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50/50 focus:bg-white transition-all font-medium"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Separate keywords with commas.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Open Graph (OG) Default Image URL</label>
                <input 
                  type="text" 
                  value={getValue('seo_og_image')} 
                  onChange={(e) => handleChange('seo_og_image', e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-gray-50/50 focus:bg-white transition-all font-medium"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Image shown when users share the website on WhatsApp, Facebook, LinkedIn, etc.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Robots.txt Content</label>
                <textarea 
                  value={getValue('robots_txt_content')} 
                  onChange={(e) => handleChange('robots_txt_content', e.target.value)}
                  placeholder="User-agent: *\nAllow: /\nSitemap: /sitemap.xml"
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-mono resize-none shadow-inner"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">Customize rules for web crawlers. Available at /robots.txt.</p>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'tracking' && (
          <Card className="p-6 border border-gray-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
              <BarChart className="text-primary" size={20} />
              <h2 className="text-lg font-black text-gray-900">Tag Manager & Analytics</h2>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-sm font-black text-blue-900 mb-1.5 flex items-center gap-2"><Code size={16}/> Google Tag Manager (GTM)</label>
                <p className="text-xs text-blue-700 font-medium mb-3">Provide your GTM ID to automatically inject the Google Tag Manager scripts into the web app's header and body.</p>
                <input 
                  type="text" 
                  value={getValue('marketing_gtm_id')} 
                  onChange={(e) => handleChange('marketing_gtm_id', e.target.value)}
                  placeholder="e.g. GTM-XXXXXXX"
                  className="w-full p-3 border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono font-bold"
                />
              </div>

              <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                <label className="block text-sm font-black text-orange-900 mb-1.5 flex items-center gap-2"><Code size={16}/> Google Analytics (GA4)</label>
                <p className="text-xs text-orange-700 font-medium mb-3">If you are NOT using GTM, provide your GA4 measurement ID here for direct tracking.</p>
                <input 
                  type="text" 
                  value={getValue('marketing_ga4_id')} 
                  onChange={(e) => handleChange('marketing_ga4_id', e.target.value)}
                  placeholder="e.g. G-XXXXXXXXXX"
                  className="w-full p-3 border border-orange-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Meta (Facebook) Pixel ID</label>
                <input 
                  type="text" 
                  value={getValue('marketing_fb_pixel')} 
                  onChange={(e) => handleChange('marketing_fb_pixel', e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Google Search Console Verification ID</label>
                <input 
                  type="text" 
                  value={getValue('seo_google_site_verification')} 
                  onChange={(e) => handleChange('seo_google_site_verification', e.target.value)}
                  placeholder="e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Bing Webmaster Verification ID</label>
                <input 
                  type="text" 
                  value={getValue('seo_bing_site_verification')} 
                  onChange={(e) => handleChange('seo_bing_site_verification', e.target.value)}
                  placeholder="e.g. 1234567890ABCDEF"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Twitter Pixel ID</label>
                <input 
                  type="text" 
                  value={getValue('marketing_twitter_pixel')} 
                  onChange={(e) => handleChange('marketing_twitter_pixel', e.target.value)}
                  placeholder="e.g. o1a2b"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">LinkedIn Insight Tag ID</label>
                <input 
                  type="text" 
                  value={getValue('marketing_linkedin_insight')} 
                  onChange={(e) => handleChange('marketing_linkedin_insight', e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Custom Header Tracking Script (Advanced)</label>
                <textarea 
                  value={getValue('marketing_custom_head_script')} 
                  onChange={(e) => handleChange('marketing_custom_head_script', e.target.value)}
                  placeholder="<!-- Paste any other tracking code here like Hotjar, Custom Pixels, etc. -->"
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none bg-gray-900 text-green-400 font-mono resize-none shadow-inner"
                />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'app-ranking' && (
          <Card className="p-6 border border-gray-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
              <Smartphone className="text-primary" size={20} />
              <h2 className="text-lg font-black text-gray-900">App SEO & Google Search Ranking</h2>
            </div>
            
            <p className="text-sm text-gray-600 font-medium mb-2">Configure SEO metadata and Deep Linking/App Indexing settings to rank your Android (and iOS) application directly in Google Search results.</p>

            <div className="space-y-5">
              <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                <label className="block text-sm font-bold text-green-900 mb-1.5">Android App Package Name</label>
                <input 
                  type="text" 
                  value={getValue('app_android_package')} 
                  onChange={(e) => handleChange('app_android_package', e.target.value)}
                  placeholder="e.g. com.atmilan.app"
                  className="w-full p-3 border border-green-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white font-medium"
                />
                <p className="text-xs text-green-700 mt-1.5 font-medium">Required for Google App Indexing.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">App SEO Title</label>
                <input 
                  type="text" 
                  value={getValue('app_seo_title')} 
                  onChange={(e) => handleChange('app_seo_title', e.target.value)}
                  placeholder="e.g. AtMilan Matchmaking App"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
                <p className="text-xs text-gray-500 mt-1.5 font-medium">The title that appears in Google App Search results.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">App SEO Description</label>
                <textarea 
                  value={getValue('app_seo_description')} 
                  onChange={(e) => handleChange('app_seo_description', e.target.value)}
                  placeholder="e.g. Download the best matchmaking app for verified profiles..."
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">App Meta Keywords for Ranking</label>
                <input 
                  type="text" 
                  value={getValue('app_seo_keywords')} 
                  onChange={(e) => handleChange('app_seo_keywords', e.target.value)}
                  placeholder="e.g. matchmaking app, dating app, AtMilan app download"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-gray-50/50 focus:bg-white font-medium"
                />
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-900 mb-1.5">Firebase App Indexing URL (Deep Link Base)</label>
                <input 
                  type="url" 
                  value={getValue('app_firebase_indexing_url')} 
                  onChange={(e) => handleChange('app_firebase_indexing_url', e.target.value)}
                  placeholder="android-app://com.atmilan.app/https/atmilan.com/"
                  className="w-full p-3 border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                />
                <p className="text-xs text-blue-700 mt-1.5 font-medium">Helps Google route web search traffic directly into your Android app.</p>
              </div>

            </div>
          </Card>
        )}

        {activeTab === 'compliance' && (
          <Card className="p-6 border border-gray-100 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
              <ShieldCheck className="text-primary" size={20} />
              <h2 className="text-lg font-black text-gray-900">Compliance & Security</h2>
            </div>
            
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-900">Enable GDPR Cookie Consent Banner</label>
                    <p className="text-xs text-gray-500 mt-0.5">Show a consent banner at the bottom of the screen for new users.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={getValue('gdpr_cookie_notice') === 'true'} onChange={(e) => handleChange('gdpr_cookie_notice', e.target.checked ? 'true' : 'false')} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                
                {getValue('gdpr_cookie_notice') === 'true' && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Cookie Notice Text</label>
                    <textarea 
                      value={getValue('gdpr_cookie_text')} 
                      onChange={(e) => handleChange('gdpr_cookie_text', e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none bg-white font-medium resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                <label className="block text-sm font-bold text-orange-900 mb-1.5 flex items-center gap-2"><Globe size={16}/> Cloudflare Web Analytics Token</label>
                <p className="text-xs text-orange-700 font-medium mb-3">Add privacy-first web analytics. Provide your site token here.</p>
                <input 
                  type="text" 
                  value={getValue('cloudflare_web_analytics_token')} 
                  onChange={(e) => handleChange('cloudflare_web_analytics_token', e.target.value)}
                  placeholder="e.g. abc123def456..."
                  className="w-full p-3 border border-orange-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white font-mono font-bold"
                />
              </div>

              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-900 mb-1.5 flex items-center gap-2"><ShieldCheck size={16}/> Cloudflare Turnstile Site Key</label>
                <p className="text-xs text-blue-700 font-medium mb-3">Protect your forms against bots with Cloudflare Turnstile.</p>
                <input 
                  type="text" 
                  value={getValue('cloudflare_turnstile_sitekey')} 
                  onChange={(e) => handleChange('cloudflare_turnstile_sitekey', e.target.value)}
                  placeholder="e.g. 0x4AAAAAAAB..."
                  className="w-full p-3 border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-mono font-bold"
                />
              </div>

            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
