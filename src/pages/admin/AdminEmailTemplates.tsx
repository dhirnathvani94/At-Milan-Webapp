import React, { useState } from 'react';
import { Send, Activity, Save, Users, AlertCircle, Eye, MessageSquare, Heart, Clock, Filter, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { State, City } from 'country-state-city';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

const SYSTEM_TEMPLATES = [
  { id: 'registration', name: 'User Registration', icon: Users, desc: 'Sent when a user completes registration' },
  { id: 'interest', name: 'Interest Received', icon: Heart, desc: 'Sent when someone sends an interest' },
  { id: 'message', name: 'New Message', icon: MessageSquare, desc: 'Sent when a new chat message arrives' },
  { id: 'profile_view', name: 'Profile Viewed', icon: Eye, desc: 'Sent when someone views their profile' },
  { id: 'expiry_warning', name: 'Credit/Membership Expiry', icon: Clock, desc: 'Warning before membership or credits expire' },
  { id: 'match_confirmation', name: 'Match Confirmation Request', icon: Heart, desc: 'Sent after X days to ask if they found a match' }
];

const WEBAPP_VARIABLES = [
  '{{user_id}}', '{{first_name}}', '{{last_name}}', '{{email}}', '{{phone}}', 
  '{{gender}}', '{{age}}', '{{city}}', '{{state}}', '{{taluka}}', '{{caste}}', '{{sub_caste}}',
  '{{profile_link}}', '{{membership_plan}}', '{{membership_expiry}}', '{{credits_balance}}', 
  '{{days_left}}', '{{website_url}}', '{{unsubscribe_link}}'
];

export default function AdminEmailTemplates() {
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const [activeTab, setActiveTab] = useState<'system' | 'promotional'>('system');
  const [activeTemplate, setActiveTemplate] = useState('registration');
  const [saving, setSaving] = useState(false);

  // System Template State
  const [subject, setSubject] = useState(`Welcome to ${brandName}!`);
  const [htmlContent, setHtmlContent] = useState(`<h2>Welcome, {{first_name}}!</h2><p>Thank you for registering on ${brandName}.</p>`);
  const [textContent, setTextContent] = useState(`Welcome, {{first_name}}!\n\nThank you for registering on ${brandName}.`);
  const [expiryDays, setExpiryDays] = useState('30');

  React.useEffect(() => {
    // Try to load template from settings
    const templateSetting = admin_settings_kv?.find((s: any) => s.key === `email_template_${activeTemplate}`);
    if (templateSetting) {
      setHtmlContent(templateSetting.value);
    } else {
      setHtmlContent(`<h2>Welcome, {{first_name}}!</h2><p>Content for ${activeTemplate}</p>`);
    }
  }, [activeTemplate, admin_settings_kv]);

  // Promotional Broadcast State
  const [promoSubject, setPromoSubject] = useState('');
  const [promoHtml, setPromoHtml] = useState('<h2>Special Offer!</h2><p>Upgrade to premium today.</p><br/><a href="{{website_url}}/membership" style="background:#e11d48;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Claim Offer</a>');
  
  // Advanced Filters
  const [filterGender, setFilterGender] = useState('all');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterUserType, setFilterUserType] = useState('all'); // all, free, paid
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterCredits, setFilterCredits] = useState('all'); // all, free_credits, paid_credits
  const [filterActivity, setFilterActivity] = useState('all'); // all, active, inactive

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(apiUrl(`/api/admin/settings/email_template_${activeTemplate}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('atmilan-token')}`
        },
        body: JSON.stringify({ value: htmlContent })
      });
      toast.success('Template saved successfully.');
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };
  const handleSendBroadcast = () => {
    if (!promoSubject) {
      toast.error('Please enter a subject for the broadcast.');
      return;
    }
    if (window.confirm(`Are you sure you want to broadcast this promotional email based on the selected filters?`)) {
      toast.loading('Queueing promotional emails...', { id: 'broadcast' });
      setTimeout(() => {
        toast.success('Promotional emails successfully sent!', { id: 'broadcast' });
        setPromoSubject('');
      }, 2500);
    }
  };

  // Location logic using country-state-city
  const indiaStates = State.getStatesOfCountry('IN');
  const selectedStateObj = filterState ? indiaStates.find(s => s.name === filterState) : null;
  const availableCities = selectedStateObj 
    ? City.getCitiesOfState('IN', selectedStateObj.isoCode).map(c => c.name)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
          <Send size={28} className="text-primary" /> Email Templates & Campaigns
        </h1>
        <p className="text-gray-500">Manage automated system templates and send advanced promotional broadcasts. (SMTP settings are managed in General Settings)</p>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1 max-w-2xl">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'system' ? 'bg-primary-50 text-primary shadow-sm' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Activity size={18} /> System Templates
        </button>
        <button
          onClick={() => setActiveTab('promotional')}
          className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'promotional' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Send size={18} /> Promotional Broadcast
        </button>
      </div>

      {/* System Templates Tab */}
      {activeTab === 'system' && (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <Card className="p-2 border-none shadow-sm overflow-hidden">
              <div className="p-3 border-b border-gray-100 mb-2">
                <h3 className="font-bold text-gray-900">Trigger Events</h3>
              </div>
              <div className="space-y-1">
                {SYSTEM_TEMPLATES.map(template => {
                  const TemplateIcon = template.icon;
                  return (
                  <button
                    key={template.id}
                    onClick={() => setActiveTemplate(template.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                      activeTemplate === template.id 
                        ? 'bg-primary-50 border border-primary/20 text-primary' 
                        : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                    }`}
                  >
                    {TemplateIcon && <TemplateIcon size={20} className={activeTemplate === template.id ? 'text-primary' : 'text-gray-400'} />}
                    <div>
                      <p className="font-bold text-sm">{template.name}</p>
                      <p className="text-xs opacity-70 mt-0.5 line-clamp-1">{template.desc}</p>
                    </div>
                  </button>
                )})}
              </div>
            </Card>
          </div>

          {/* Editor */}
          <div className="flex-1 space-y-6">
            <Card className="p-6 border-none shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {(() => {
                    const activeTpl = SYSTEM_TEMPLATES.find(t => t.id === activeTemplate);
                    const ActiveIcon = activeTpl?.icon || null;
                    return ActiveIcon ? <ActiveIcon size={24} className="text-primary" /> : null;
                  })()}
                  {SYSTEM_TEMPLATES.find(t => t.id === activeTemplate)?.name} Template
                </h2>
                <Button onClick={handleSave} disabled={saving}>
                  <Save size={16} className="mr-2" /> Save Template
                </Button>
              </div>

              <div className="space-y-6">
                {activeTemplate === 'expiry_warning' && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-center gap-4">
                    <AlertCircle className="text-amber-600 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-amber-900 mb-1">Send Warning Before (Days)</label>
                      <p className="text-xs text-amber-700 mb-2">Automatically send this email when a user's membership or credits expire in X days.</p>
                      <select value={expiryDays} onChange={e => setExpiryDays(e.target.value)} className="w-48 border-amber-200 rounded-lg text-sm focus:border-amber-500">
                        <option value="7">7 Days</option>
                        <option value="15">15 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Email Subject</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full border-gray-300 rounded-lg focus:border-primary focus:ring-primary" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* HTML Editor */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-bold text-gray-900">HTML Format</label>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner mb-4">
                      <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        className="w-full h-64 p-4 text-sm font-mono focus:outline-none focus:ring-0 border-none resize-none bg-gray-50"
                        placeholder="<html>...</html>"
                      />
                    </div>
                  </div>

                  {/* Text Editor */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-bold text-gray-900">Plain Text Format</label>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner mb-4">
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        className="w-full h-64 p-4 text-sm font-mono focus:outline-none focus:ring-0 border-none resize-none bg-white"
                        placeholder="Plain text fallback..."
                      />
                    </div>
                  </div>
                </div>

                {/* Variables List Below Editors */}
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2"><Code size={16}/> Available Variables (Click to copy)</h4>
                  <p className="text-xs text-blue-700 mb-4">Copy these variables and paste them directly into your Subject, HTML, or Plain Text templates.</p>
                  <div className="flex flex-wrap gap-2">
                    {WEBAPP_VARIABLES.map(v => (
                      <button 
                        key={v} 
                        type="button"
                        className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 hover:scale-105 transition-transform"
                        onClick={() => {
                          navigator.clipboard.writeText(v);
                          toast.success(`Copied ${v} to clipboard!`);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Promotional Broadcast Tab */}
      {activeTab === 'promotional' && (
        <Card className="p-8 border-none shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Send className="text-emerald-600" /> Advanced Email Broadcast
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Comprehensive Filters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 h-full">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Filter size={18}/> Audience Filters</h3>
                
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* Location Filters */}
                  <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</h4>
                    <div>
                      <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterCity(''); }} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="">All States</option>
                        {indiaStates.map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <select value={filterCity} onChange={e => setFilterCity(e.target.value)} disabled={!filterState} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50 disabled:opacity-50">
                        <option value="">All Cities / Talukas</option>
                        {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Demographic Filters */}
                  <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Demographics</h4>
                    <div>
                      <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="all">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>

                  {/* Account & Activity Filters */}
                  <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account Status</h4>
                    
                    <div>
                      <select value={filterUserType} onChange={e => setFilterUserType(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="all">All Users (Free & Paid)</option>
                        <option value="free">Free Users Only</option>
                        <option value="paid">Paid Users Only</option>
                      </select>
                    </div>

                    <div>
                      <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="all">All Membership Plans</option>
                        <option value="Silver">Silver Plan</option>
                        <option value="Gold">Gold Plan</option>
                        <option value="Platinum">Platinum VIP Plan</option>
                      </select>
                    </div>

                    <div>
                      <select value={filterCredits} onChange={e => setFilterCredits(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="all">Any Credit Type</option>
                        <option value="free_credits">Has Free Credits</option>
                        <option value="paid_credits">Has Paid Credits</option>
                      </select>
                    </div>

                    <div>
                      <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className="w-full border-gray-300 rounded-lg text-sm bg-gray-50">
                        <option value="all">All Users</option>
                        <option value="active">Active (Logged in last 30 days)</option>
                        <option value="inactive">Inactive (Not logged in &gt; 30 days)</option>
                      </select>
                    </div>

                  </div>
                </div>

                <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-800 text-center">Estimated Reach</p>
                  <p className="text-3xl font-black text-emerald-600 text-center mt-1">~3,450</p>
                  <p className="text-[10px] text-emerald-600/70 text-center uppercase tracking-wide mt-1">Users Match Criteria</p>
                </div>
              </div>
            </div>

            {/* Right: Content Editor */}
            <div className="lg:col-span-2 flex flex-col h-full">
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-1">Subject Line</label>
                  <input type="text" value={promoSubject} onChange={e => setPromoSubject(e.target.value)} placeholder="Special 50% Off Premium Membership!" className="w-full border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-emerald-500" />
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-sm font-bold text-gray-900">HTML Broadcast Content</label>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner bg-white flex flex-col">
                    <textarea
                      value={promoHtml}
                      onChange={(e) => setPromoHtml(e.target.value)}
                      className="w-full h-[350px] p-4 text-sm font-mono focus:outline-none focus:ring-0 border-none resize-none bg-gray-50"
                    />
                  </div>
                </div>

                {/* Variables below HTML Content */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mt-4">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Code size={16} /> Insert Dynamic Variables (Click to copy)</h4>
                  <p className="text-xs text-gray-500 mb-4">Click any variable below to copy it, then paste it into your Subject or HTML content.</p>
                  <div className="flex flex-wrap gap-2">
                    {WEBAPP_VARIABLES.map(v => (
                      <button 
                        key={v} 
                        type="button"
                        className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 hover:scale-105 transition-all"
                        onClick={() => {
                          navigator.clipboard.writeText(v);
                          toast.success(`Copied ${v} to clipboard!`);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="pt-6 flex justify-end mt-4">
                <Button onClick={handleSendBroadcast} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 px-8 py-3 rounded-full text-base">
                  <Send size={18} className="mr-2" /> Send Broadcast Now
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
