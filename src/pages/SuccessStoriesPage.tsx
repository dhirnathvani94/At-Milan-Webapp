import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ChevronRight, X, Camera, Upload, ChevronLeft, MapPin, Calendar } from 'lucide-react';
import { useMasterData } from '../store/masterDataStore';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { useSocketStore } from '../store/socketStore';
import { apiUrl } from '../lib/api';

// --- Photo Slideshow for a single story card ---
function StoryPhotoSlideshow({ photos, groom, bride }: { photos: string[], groom: string, bride: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % photos.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [photos.length]);

  return (
    <div className="relative h-32 md:h-48 overflow-hidden">
      {photos.map((photo, idx) => (
        <img
          key={idx}
          src={photo}
          alt={`${groom} and ${bride}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 group-hover:scale-105 ${idx === current ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-secondary w-3' : 'bg-white/60'}`}
            />
          ))}
        </div>
      )}
      <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 z-10">
        <h3 className="text-secondary font-bold text-sm md:text-xl">{groom} & {bride}</h3>
      </div>
    </div>
  );
}

// --- Share Story Inline Form ---
function ShareStoryForm({ onClose, onSubmitted, siteConfig }: { onClose: () => void, onSubmitted: () => void, siteConfig: string }) {
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [storyText, setStoryText] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [location, setLocation] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-slideshow in preview
  useEffect(() => {
    if (photoPreviews.length <= 1) return;
    const t = setInterval(() => setPreviewIdx(p => (p + 1) % photoPreviews.length), 2500);
    return () => clearInterval(t);
  }, [photoPreviews.length]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) toast.error('Some photos exceeded 5MB and were skipped.');
    const newPhotos = [...photos, ...valid].slice(0, 10);
    setPhotos(newPhotos);
    newPhotos.forEach((file, i) => {
      if (photoPreviews[i]) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => {
          const updated = [...prev];
          updated[i] = reader.result as string;
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    const newPhotos = photos.filter((_, i) => i !== idx);
    const newPreviews = photoPreviews.filter((_, i) => i !== idx);
    setPhotos(newPhotos);
    setPhotoPreviews(newPreviews);
    setPreviewIdx(Math.min(previewIdx, newPreviews.length - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groomName || !brideName || !storyText) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('groomName', groomName);
      formData.append('brideName', brideName);
      formData.append('storyText', storyText);
      formData.append('year', year);
      formData.append('location', location);
      formData.append('submitterName', submitterName);
      formData.append('submitterEmail', submitterEmail);
      photos.forEach(p => formData.append('photos', p));

      const res = await fetch(apiUrl('/api/success-stories/share'), { method: 'POST', body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server error (${res.status})`);
      }
      setShowThankYou(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Professional Thank‑You Popup ──────────────────────────────────────
  if (showThankYou) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{background:'rgba(10,10,30,0.78)', backdropFilter:'blur(8px)'}}>
        <div className="relative bg-white w-full max-w-[420px] rounded-[28px] shadow-[0_32px_80px_-10px_rgba(0,0,0,0.4)] overflow-hidden text-center">

          {/* ── Top gradient banner ── */}
          <div className="relative h-48 flex flex-col items-center justify-center" style={{background:'linear-gradient(135deg,#8B1A1A 0%,#c0392b 50%,#D4AF37 100%)'}}>
            <div className="absolute top-0 left-0 w-36 h-36 rounded-full opacity-10 bg-white" style={{transform:'translate(-40%,-40%)'}} />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full opacity-10 bg-white" style={{transform:'translate(40%,40%)'}} />
            <div className="absolute top-4 right-6 opacity-20">
              <svg viewBox="0 0 60 60" width="50" height="50" fill="none"><circle cx="30" cy="30" r="28" stroke="white" strokeWidth="2.5"/></svg>
            </div>

            {/* Wedding rings */}
            <div className="relative z-10 mb-3">
              <svg viewBox="0 0 90 48" width="90" height="48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="24" r="19" stroke="#FFD700" strokeWidth="5" fill="none" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
                <circle cx="60" cy="24" r="19" stroke="white" strokeWidth="5" fill="none" opacity="0.9" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>
                <circle cx="30" cy="24" r="7" fill="#FFD700" opacity="0.2"/>
                <circle cx="60" cy="24" r="7" fill="white" opacity="0.15"/>
              </svg>
            </div>
            <h2 className="relative z-10 text-white font-heading font-bold text-2xl md:text-[28px] tracking-tight drop-shadow">Thank You! 🎊</h2>
            <p className="relative z-10 text-white/80 text-sm mt-1 font-medium">Story submitted successfully</p>
          </div>

          {/* ── Body ── */}
          <div className="px-6 md:px-8 py-6">

            {/* Site name badge */}
            <div className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm font-semibold mb-4" style={{borderColor:'rgba(139,26,26,0.25)', color:'#8B1A1A', background:'rgba(139,26,26,0.06)'}}>
              <Heart size={13} className="fill-current" />
              {siteConfig}
            </div>

            <p className="text-gray-900 font-bold text-base md:text-lg mb-2 leading-snug">
              Your love story has been received!
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Our team will carefully review it. Once approved, your story will inspire thousands of hearts on this page.
            </p>

            {/* ── 3-step progress tracker ── */}
            <div className="flex items-start justify-center mb-6">
              {/* Step 1 — done */}
              <div className="flex flex-col items-center w-20">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold shadow-lg" style={{background:'linear-gradient(135deg,#8B1A1A,#c0392b)'}}>✓</div>
                <p className="text-[11px] font-bold mt-1.5" style={{color:'#8B1A1A'}}>Submitted</p>
              </div>
              {/* connector */}
              <div className="flex-1 mt-[22px]">
                <div className="h-[2px] w-full" style={{background:'linear-gradient(90deg,#8B1A1A,#D4AF37)'}} />
              </div>
              {/* Step 2 — in review */}
              <div className="flex flex-col items-center w-20">
                <div className="w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center text-white text-base shadow-lg">⏳</div>
                <p className="text-[11px] font-bold mt-1.5 text-amber-600">Under Review</p>
              </div>
              {/* connector */}
              <div className="flex-1 mt-[22px]">
                <div className="h-[2px] w-full bg-gray-200" />
              </div>
              {/* Step 3 — pending */}
              <div className="flex flex-col items-center w-20">
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-base shadow-inner">🌟</div>
                <p className="text-[11px] font-bold mt-1.5 text-gray-400">Published</p>
              </div>
            </div>

            {/* ── Info note ── */}
            <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 text-left">
              <span className="text-amber-500 text-base mt-0.5 flex-shrink-0">ℹ️</span>
              <p className="text-amber-800 text-xs leading-relaxed">
                <strong>What's next?</strong> Our editorial team reviews all submissions within <strong>24–48 hours</strong>. Your story will appear on this page automatically once approved.
              </p>
            </div>

            {/* ── CTA ── */}
            <button
              onClick={() => { setShowThankYou(false); onSubmitted(); }}
              className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 active:scale-95 shadow-lg"
              style={{background:'linear-gradient(135deg,#8B1A1A 0%,#c0392b 55%,#D4AF37 100%)'}}
            >
              Done — Back to Stories ❤️
            </button>
            <p className="text-[11px] text-gray-400 mt-3">Thank you for being part of our community</p>
          </div>
        </div>
      </div>
    );
  }
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-2xl mx-auto p-6 md:p-10 mt-8 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Heart className="text-primary" size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Share Your Story</h3>
            <p className="text-xs text-gray-400">Admin will review before publishing</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Names */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Groom's Name *</label>
            <input
              required
              value={groomName}
              onChange={e => setGroomName(e.target.value)}
              placeholder="Groom's name"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Bride's Name *</label>
            <input
              required
              value={brideName}
              onChange={e => setBrideName(e.target.value)}
              placeholder="Bride's name"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
        </div>

        {/* Year & Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Marriage Year *</label>
            <input
              required
              type="number"
              min={1980}
              max={new Date().getFullYear()}
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="City, State"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
        </div>

        {/* Story Text */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Your Story *</label>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={storyText}
            onChange={e => setStoryText(e.target.value)}
            placeholder="Tell us how you found each other, your journey together, and what made your match special..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition resize-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{storyText.length}/2000</p>
        </div>

        {/* Multiple Photos */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Couple Photos (up to 10)</label>
          {photoPreviews.length > 0 && (
            <div className="relative mb-3 rounded-2xl overflow-hidden h-48 bg-gray-100 shadow">
              {photoPreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`preview-${i}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === previewIdx ? 'opacity-100' : 'opacity-0'}`}
                />
              ))}
              {/* Dots */}
              {photoPreviews.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {photoPreviews.map((_, i) => (
                    <button type="button" key={i} onClick={() => setPreviewIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === previewIdx ? 'bg-secondary w-4' : 'bg-white/70'}`}
                    />
                  ))}
                </div>
              )}
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePhoto(previewIdx)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 z-20"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition"
          >
            <div className="flex justify-center mb-2">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Camera className="text-gray-400" size={20} />
              </div>
            </div>
            <p className="text-sm text-gray-600"><span className="text-primary font-bold">Click to upload</span> photos</p>
            <p className="text-xs text-gray-400 mt-1">PNG, JPG (max 5MB each, up to 10)</p>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
        </div>

        {/* Submitter Info */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your Name (optional)</label>
            <input
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              placeholder="For contact if needed"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={submitterEmail}
              onChange={e => setSubmitterEmail(e.target.value)}
              placeholder="For contact if needed"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-700 transition text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Submitting...</span>
            ) : (
              <><Heart size={16} /> Submit Story</>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400">
          By submitting, you agree we may publish your story and photos. Admin will review before it goes live.
        </p>
      </form>
    </div>
  );
}

// --- Main Page ---
export default function SuccessStoriesPage() {
  const { admin_settings_kv } = useMasterData();
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approvedStories, setApprovedStories] = useState<any[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const { socket } = useSocketStore();

  const siteConfig = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan';

  const fetchStories = async () => {
    try {
      const res = await fetch(
        apiUrl(`/api/success-stories?_t=${Date.now()}`)
      );
      if (res.ok) {
        const data = await res.json();
        setApprovedStories(data.stories || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    } finally {
      setStoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleStoryUpdate = () => {
      fetchStories();
    };
    socket.on('success-story:updated', handleStoryUpdate);
    return () => {
      socket.off('success-story:updated', handleStoryUpdate);
    };
  }, [socket]);

  const safeParseJSON = (jsonString: string, fallback: any) => {
    try { return JSON.parse(jsonString); } catch (e) { return fallback; }
  };

  const defaultStories = safeParseJSON(admin_settings_kv?.find(s => s.key === 'success_page_stories')?.value || '', [
    { groom: 'Aarav', bride: 'Nisha', location: 'Surat, Gujarat', date: 'Dec 2023', text: 'We met on AtMilan and instantly connected over our shared values...', photo: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&q=80' },
    { groom: 'Karan', bride: 'Priya', location: 'Ahmedabad', date: 'Jan 2024', text: 'Thanks to the advanced filters, we found exactly what our families were looking for.', photo: 'https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&q=80' },
    { groom: 'Vikram', bride: 'Anjali', location: 'Mumbai', date: 'Feb 2024', text: 'Our journey from the first message to our wedding day was magical!', photo: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80' }
  ]).map((s: any) => ({
    ...s,
    story: s.text || s.story || '',
    photos: s.photos || (s.photo ? [s.photo] : [])
  }));

  const realStories = approvedStories.map((s: any) => ({
    ...s,
    groom: s.groom_name || s.user?.first_name || s.user_name || 'Groom',
    bride: s.bride_name || s.partner_name || 'Bride',
    story: s.story_text || s.story || '',
    photos: s.photos && s.photos.length > 0
      ? s.photos.map((p: string) => (p.startsWith('http') ? p : apiUrl(p)))
      : [s.photo_url || s.photo].filter(Boolean)
  }));

  const stories = approvedStories.length >= 3 
    ? realStories
    : [...realStories, ...defaultStories].slice(0, 3);

  const handleSubmitted = () => {
    setShowForm(false);
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Our Success Stories ❤️</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">Success Stories</span>
          </nav>
          <p className="mt-6 text-xl text-white/80 max-w-2xl mx-auto">
            Real couples who found love through {siteConfig}
          </p>
        </div>
      </section>

      {/* Stories Grid */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {storiesLoading ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">Loading stories...</p>
            </div>
          ) : stories.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 text-left">
              {stories.map((story: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl shadow-md overflow-hidden relative group hover:shadow-xl transition-all duration-300">
                  {/* Decorative Rings */}
                  <div className="absolute top-4 right-4 text-secondary z-10 drop-shadow-md">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="9" cy="12" r="5" />
                      <circle cx="15" cy="12" r="5" />
                    </svg>
                  </div>

                  <StoryPhotoSlideshow photos={story.photos} groom={story.groom} bride={story.bride} />

                  <div className="p-4 md:p-6">
                    {story.location && (
                      <p className="text-[10px] md:text-xs text-gray-400 mb-2 flex items-center gap-1">
                        <MapPin size={10} /> {story.location}
                        {story.year && <><Calendar size={10} className="ml-2" /> {story.year}</>}
                      </p>
                    )}
                    <p className="text-gray-600 text-xs md:text-sm leading-relaxed mb-2 md:mb-4">
                      "{story.story.substring(0, 110)}..."
                      <button onClick={() => setSelectedStory(story)} className="text-primary font-semibold ml-1 hover:underline">Read more</button>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Heart className="text-gray-300 w-20 h-20 mx-auto" />
              <h3 className="text-2xl font-heading font-bold mt-6 text-gray-900">Stories Coming Soon!</h3>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">
                We're collecting beautiful stories from our happy couples. Be the first to share yours!
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Share Story CTA */}
      <section className="py-16 bg-accent text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold mb-4">Found Your Partner on {siteConfig}?</h2>
          <p className="text-gray-600 text-lg mb-8">Share your love story and inspire others who are on their journey to find love!</p>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-md mx-auto">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Heart className="text-green-500" size={24} />
                </div>
              </div>
              <h3 className="font-bold text-green-800 text-lg">Story Submitted!</h3>
              <p className="text-green-600 text-sm mt-1">Your story is under review. It will appear on this page once approved by admin. Thank you! ❤️</p>
            </div>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-primary-700 transition shadow-lg shadow-primary/20"
            >
              <Heart size={20} /> Share Your Story ❤️
            </button>
          ) : null}
        </div>
      </section>

      {/* Inline Form */}
      {showForm && !submitted && (
        <section className="py-10 bg-gray-50 border-t border-gray-100">
          <div className="max-w-2xl mx-auto px-4">
            <ShareStoryForm onClose={() => setShowForm(false)} onSubmitted={handleSubmitted} siteConfig={siteConfig} />
          </div>
        </section>
      )}

      {/* Story Modal */}
      <Modal
        isOpen={!!selectedStory}
        onClose={() => setSelectedStory(null)}
        title={`${selectedStory?.groom} & ${selectedStory?.bride}'s Story`}
        size="lg"
      >
        {selectedStory && (
          <div className="space-y-6">
            {selectedStory.photos && selectedStory.photos.length > 0 && (
              <div className="relative rounded-2xl overflow-hidden h-64 shadow-lg">
                <StoryPhotoSlideshow photos={selectedStory.photos} groom={selectedStory.groom} bride={selectedStory.bride} />
              </div>
            )}
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>Married in {selectedStory.year} {selectedStory.location && `• ${selectedStory.location}`}</span>
              <span className="flex items-center gap-1 text-primary font-bold">
                <Heart size={16} className="fill-current" /> Success Match
              </span>
            </div>
            <div className="prose prose-primary max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                "{selectedStory.story}"
              </p>
            </div>
            <div className="pt-6 border-t border-gray-100 flex justify-center">
              <Button variant="outline" onClick={() => setSelectedStory(null)}>
                Close Story
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
