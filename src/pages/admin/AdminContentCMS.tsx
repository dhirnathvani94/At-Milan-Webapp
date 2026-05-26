import React, { useState, useEffect } from 'react';
import { Home, Info, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { getSiteSettings, updateSiteSetting } from '../../lib/actions/adminActions';
import AdminHomeSettings from './components/AdminHomeSettings';
import AdminAboutSettings from './components/AdminAboutSettings';
import Spinner from '../../components/ui/Spinner';
import { PageSkeleton } from '../../components/ui/Skeletons';

const TABS = [
  { id: 'home', label: 'Home Page Content', icon: Home },
  { id: 'about', label: 'About Page Content', icon: Info },
];

export default function AdminContentCMS() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any[]>([]);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('home');

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
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const key in editedSettings) {
        const original = settings.find(s => s.setting_key === key);
        if (original && original.setting_value !== editedSettings[key]) {
          await updateSiteSetting(key, editedSettings[key], (user?.id || ''));
        }
      }
      toast.success('Content saved successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to update content');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
            <LayoutTemplate size={28} className="text-primary" /> Content Management
          </h1>
          <p className="text-gray-500 font-medium text-sm mt-1">Manage web application content sections globally in real-time</p>
        </div>
      </div>

      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 gap-2 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-primary'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'home' ? (
          <AdminHomeSettings 
            settings={settings}
            editedSettings={editedSettings}
            handleSettingChange={handleSettingChange}
            handleSaveSettings={handleSaveSettings}
            saving={saving}
          />
        ) : (
          <AdminAboutSettings 
            settings={settings}
            editedSettings={editedSettings}
            handleSettingChange={handleSettingChange}
            handleSaveSettings={handleSaveSettings}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
