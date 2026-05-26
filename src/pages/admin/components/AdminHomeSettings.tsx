import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../../components/ui/Button';
import { apiUrl } from '../../../lib/api';

interface AdminHomeSettingsProps {
  settings: any[];
  editedSettings: Record<string, any>;
  handleSettingChange: (key: string, value: string) => void;
  handleSaveSettings: () => void;
  saving: boolean;
}

export default function AdminHomeSettings({ settings, editedSettings, handleSettingChange, handleSaveSettings, saving }: AdminHomeSettingsProps) {
  
  const getSetting = (key: string) => settings.find(s => s.setting_key === key);
  const getValue = (key: string) => editedSettings[key] !== undefined ? editedSettings[key] : (getSetting(key)?.setting_value || '');

  // JSON handlers
  const getParsedArray = (key: string) => {
    try {
      const val = getValue(key);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      return [];
    }
  };

  const updateArray = (key: string, arr: any[]) => {
    handleSettingChange(key, JSON.stringify(arr));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string, index?: number, fieldName?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      toast.loading('Uploading...', { id: 'upload' });
      const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      if (index !== undefined && fieldName) {
        const arr = getParsedArray(key);
        arr[index][fieldName] = data.fileUrl;
        updateArray(key, arr);
      } else {
        handleSettingChange(key, data.fileUrl);
      }
      toast.success('Uploaded successfully', { id: 'upload' });
    } catch (error) {
      toast.error('Failed to upload image', { id: 'upload' });
    }
  };

  const textSettings = [
    { key: 'hero_description', label: 'Hero Description', type: 'textarea' },
    { key: 'stat_profiles', label: 'Stat: Profiles', type: 'text' },
    { key: 'stat_marriages', label: 'Stat: Marriages', type: 'text' },
    { key: 'stat_happy_users', label: 'Stat: Happy Users', type: 'text' },
    { key: 'free_journey_text', label: 'Free Journey Text', type: 'textarea' },
    { key: 'app_store_link', label: 'App Store Link', type: 'text' },
    { key: 'play_store_link', label: 'Play Store Link', type: 'text' },
    { key: 'section_how_it_works_title', label: 'How It Works Title', type: 'text' },
    { key: 'section_love_stories_title', label: 'Love Stories Title', type: 'text' },
    { key: 'section_testimonials_title', label: 'Testimonials Title', type: 'text' },
  ];

  const howItWorks = getParsedArray('how_it_works_items');
  const loveStories = getParsedArray('love_stories_items');
  const testimonials = getParsedArray('testimonials_items');
  const homeBanners = getParsedArray('home_banners');

  return (
    <div className="space-y-8">
      {/* Banner Slider Manager */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Banner Slider</h3>
            <p className="text-xs text-gray-500 mt-0.5">Add promotional banners below the header. Leave empty to hide.</p>
            <p className="text-xs text-primary font-semibold mt-1">📐 Recommended size: 1400 × 400 px (landscape). Use PNG or JPG. Aspect ratio 3.5:1 works best.</p>
          </div>
          <Button size="sm" onClick={() => updateArray('home_banners', [...homeBanners, { url: '', link: '' }])}>
            <Plus size={16} className="mr-1" /> Add Banner
          </Button>
        </div>
        {homeBanners.length === 0 && (
          <p className="text-sm text-gray-400 italic">No banners added. The banner section is hidden on the homepage.</p>
        )}
        <div className="space-y-4">
          {homeBanners.map((banner: any, idx: number) => (
            <div key={idx} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Banner Image</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                      placeholder="Image URL or upload"
                      value={banner.url || ''}
                      onChange={e => { const a = [...homeBanners]; a[idx].url = e.target.value; updateArray('home_banners', a); }}
                    />
                    <label className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md cursor-pointer hover:bg-primary/90">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'home_banners', idx, 'url')} />
                    </label>
                  </div>
                  {banner.url && <img src={banner.url} alt="" className="mt-2 h-20 rounded-md object-cover border" />}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Link URL (optional — opens on click)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="https://..."
                    value={banner.link || ''}
                    onChange={e => { const a = [...homeBanners]; a[idx].link = e.target.value; updateArray('home_banners', a); }}
                  />
                </div>
              </div>
              <button onClick={() => { const a = homeBanners.filter((_: any, i: number) => i !== idx); updateArray('home_banners', a); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Basic Text Settings */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {textSettings.map((s) => (
            <div key={s.key} className={s.type === 'textarea' ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{s.label}</label>
              {s.type === 'textarea' ? (
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  rows={3}
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

      {/* How It Works Manager */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-lg font-bold text-gray-900">How It Works Steps</h3>
          <Button size="sm" onClick={() => updateArray('how_it_works_items', [...howItWorks, { step: howItWorks.length + 1, title: 'New Step', desc: '' }])}>
            <Plus size={16} className="mr-1" /> Add Step
          </Button>
        </div>
        <div className="space-y-4">
          {howItWorks.map((item: any, idx: number) => (
            <div key={idx} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex-1 space-y-3">
                <div className="flex gap-4">
                  <div className="w-20">
                    <label className="block text-xs text-gray-500 mb-1">Step #</label>
                    <input type="number" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.step || ''} onChange={e => { const a = [...howItWorks]; a[idx].step = e.target.value; updateArray('how_it_works_items', a); }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Title</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.title || ''} onChange={e => { const a = [...howItWorks]; a[idx].title = e.target.value; updateArray('how_it_works_items', a); }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" rows={2} value={item.desc || ''} onChange={e => { const a = [...howItWorks]; a[idx].desc = e.target.value; updateArray('how_it_works_items', a); }} />
                </div>
              </div>
              <button onClick={() => updateArray('how_it_works_items', howItWorks.filter((_: any, i: number) => i !== idx))} className="text-red-500 hover:bg-red-50 p-2 rounded-md mt-6">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Love Stories Manager */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-lg font-bold text-gray-900">Love Stories</h3>
          <Button size="sm" onClick={() => updateArray('love_stories_items', [...loveStories, { story: '', groom: '', bride: '', year: '', location: '', photo: '' }])}>
            <Plus size={16} className="mr-1" /> Add Story
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loveStories.map((item: any, idx: number) => (
            <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
              <button onClick={() => updateArray('love_stories_items', loveStories.filter((_: any, i: number) => i !== idx))} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-md">
                <Trash2 size={16} />
              </button>
              <div className="space-y-3 pr-8">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Groom Name</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.groom || ''} onChange={e => { const a = [...loveStories]; a[idx].groom = e.target.value; updateArray('love_stories_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bride Name</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.bride || ''} onChange={e => { const a = [...loveStories]; a[idx].bride = e.target.value; updateArray('love_stories_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Year</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.year || ''} onChange={e => { const a = [...loveStories]; a[idx].year = e.target.value; updateArray('love_stories_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Location</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.location || ''} onChange={e => { const a = [...loveStories]; a[idx].location = e.target.value; updateArray('love_stories_items', a); }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Story Text</label>
                  <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" rows={2} value={item.story || ''} onChange={e => { const a = [...loveStories]; a[idx].story = e.target.value; updateArray('love_stories_items', a); }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Photo Image</label>
                  {item.photo && <img src={item.photo} alt="Story" className="h-16 w-16 object-cover rounded mb-2 border border-gray-300" />}
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'love_stories_items', idx, 'photo')} className="text-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials Manager */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-lg font-bold text-gray-900">Testimonials</h3>
          <Button size="sm" onClick={() => updateArray('testimonials_items', [...testimonials, { name: '', city: '', occupation: '', rating: 5, text: '', photo: '' }])}>
            <Plus size={16} className="mr-1" /> Add Testimonial
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {testimonials.map((item: any, idx: number) => (
            <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
              <button onClick={() => updateArray('testimonials_items', testimonials.filter((_: any, i: number) => i !== idx))} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-md">
                <Trash2 size={16} />
              </button>
              <div className="space-y-3 pr-8">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">User Name</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.name || ''} onChange={e => { const a = [...testimonials]; a[idx].name = e.target.value; updateArray('testimonials_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.city || ''} onChange={e => { const a = [...testimonials]; a[idx].city = e.target.value; updateArray('testimonials_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Occupation</label>
                    <input type="text" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.occupation || ''} onChange={e => { const a = [...testimonials]; a[idx].occupation = e.target.value; updateArray('testimonials_items', a); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Rating (1-5)</label>
                    <input type="number" min="1" max="5" className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" value={item.rating || 5} onChange={e => { const a = [...testimonials]; a[idx].rating = parseInt(e.target.value); updateArray('testimonials_items', a); }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Review Text</label>
                  <textarea className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" rows={2} value={item.text || ''} onChange={e => { const a = [...testimonials]; a[idx].text = e.target.value; updateArray('testimonials_items', a); }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">User Photo</label>
                  {item.photo && <img src={item.photo} alt="User" className="h-10 w-10 object-cover rounded-full mb-2 border border-gray-300" />}
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'testimonials_items', idx, 'photo')} className="text-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button variant="primary" onClick={handleSaveSettings} loading={saving}>
          Save Home Page Settings
        </Button>
      </div>
    </div>
  );
}
