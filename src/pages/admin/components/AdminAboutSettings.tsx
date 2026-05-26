import React from 'react';
import Button from '../../../components/ui/Button';

interface AdminAboutSettingsProps {
  settings: any[];
  editedSettings: Record<string, any>;
  handleSettingChange: (key: string, value: string) => void;
  handleSaveSettings: () => void;
  saving: boolean;
}

export default function AdminAboutSettings({ settings, editedSettings, handleSettingChange, handleSaveSettings, saving }: AdminAboutSettingsProps) {
  
  const getSetting = (key: string) => settings.find(s => s.setting_key === key);
  const getValue = (key: string) => editedSettings[key] !== undefined ? editedSettings[key] : (getSetting(key)?.setting_value || '');

  const textSettings = [
    { key: 'mission_title', label: 'Mission Title', type: 'text' },
    { key: 'mission_text_1', label: 'Mission Text Paragraph 1', type: 'textarea' },
    { key: 'mission_text_2', label: 'Mission Text Paragraph 2', type: 'textarea' },
    { key: 'stat_years', label: 'Stat: Years of Trust', type: 'text' },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-2">About Page Content</h3>
        <p className="text-sm text-gray-500 mb-4">Note: Statistics like Active Profiles and Marriages are shared with the Home Page and can be edited there.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {textSettings.map((s) => (
            <div key={s.key} className={s.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{s.label}</label>
              {s.type === 'textarea' ? (
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  rows={4}
                  value={getValue(s.key)}
                  onChange={(e) => handleSettingChange(s.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={getValue(s.key)}
                  onChange={(e) => handleSettingChange(s.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button variant="primary" onClick={handleSaveSettings} loading={saving}>
          Save About Page Settings
        </Button>
      </div>
    </div>
  );
}
