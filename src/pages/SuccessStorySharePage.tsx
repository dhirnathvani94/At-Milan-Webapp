import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Upload, X, Camera, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useMasterData } from '../store/masterDataStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import TextArea from '../components/ui/TextArea';
import { apiUrl } from '../lib/api';

export default function SuccessStorySharePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { admin_settings_kv } = useMasterData();
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan';
  const [loading, setLoading] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [storyText, setStoryText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Photo size should be less than 5MB");
        return;
      }
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('userId', (user?.id || ''));
      formData.append('partnerName', partnerName);
      formData.append('storyText', storyText);
      if (photo) {
        formData.append('photo', photo);
      }

      const response = await fetch(apiUrl('/api/success-stories/share'), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to submit story');

      toast.success("Thank you! Your story will be reviewed and published soon.");
      navigate('/success-stories');
    } catch (error: any) {
      toast.error(error.message || "Failed to submit story");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="text-primary" size={32} />
        </div>
        <h1 className="text-3xl font-heading font-bold text-gray-900">Share Your Success Story</h1>
        <p className="text-gray-500 mt-2">Inspire others with your journey of finding love on {siteName}</p>
      </div>

      <Card className="p-8 shadow-xl border-none">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Your Partner's Name *"
            required
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder={`Who did you find on ${siteName}?`}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Couple Photo (Optional)</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                photoPreview ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-gray-50'
              }`}
            >
              {photoPreview ? (
                <div className="relative inline-block">
                  <img src={photoPreview} alt="Preview" className="max-h-64 rounded-xl shadow-md" />
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhoto(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="text-gray-400" size={24} />
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="text-primary font-bold">Click to upload</span> or drag and drop
                  </div>
                  <p className="text-xs text-gray-400">PNG, JPG or JPEG (max. 5MB)</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoChange} 
                className="hidden" 
                accept="image/*" 
              />
            </div>
          </div>

          <TextArea
            label="Your Story *"
            rows={8}
            maxLength={2000}
            required
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            placeholder={`Tell us how you met on ${siteName}, your journey together, and what made your match special...`}
          />

          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              className="shadow-lg shadow-primary/20"
            >
              Submit Story ❤️
            </Button>
            <p className="text-center text-xs text-gray-400 mt-4">
              By submitting, you agree that we may publish your story and photo on our platform.
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
