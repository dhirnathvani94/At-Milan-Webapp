import React, { useState, useEffect } from 'react';
import { getSiteSettings } from '../../lib/actions/adminActions';
import Button from './Button';
import { Info, X } from 'lucide-react';

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user already accepted
    const accepted = localStorage.getItem('cookie_consent_accepted');
    if (accepted === 'true') {
      setLoading(false);
      return;
    }

    const checkSettings = async () => {
      try {
        const settings = await getSiteSettings();
        const enableConsent = settings.find((s: any) => s.setting_key === 'gdpr_cookie_notice')?.setting_value === 'true';
        const consentText = settings.find((s: any) => s.setting_key === 'gdpr_cookie_text')?.setting_value || 'We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.';
        
        if (enableConsent) {
          setText(consentText);
          setShow(true);
        }
      } catch (err) {
        console.error('Failed to load cookie consent settings');
      } finally {
        setLoading(false);
      }
    };
    checkSettings();
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent_accepted', 'true');
    setShow(false);
  };

  if (loading || !show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 pointer-events-none">
      <div className="max-w-5xl mx-auto bg-white/95 backdrop-blur-md border border-gray-200/60 shadow-2xl rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-8 pointer-events-auto ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-500">
        <div className="flex gap-4">
          <div className="hidden sm:flex bg-primary/10 text-primary w-12 h-12 rounded-full items-center justify-center shrink-0">
            <Info size={24} />
          </div>
          <div>
            <h3 className="text-gray-900 font-bold mb-1">Cookie Preferences</h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
              {text}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <button 
            onClick={() => setShow(false)} 
            className="text-gray-400 hover:text-gray-600 p-2 sm:hidden absolute top-2 right-2"
          >
            <X size={20} />
          </button>
          <Button variant="outline" onClick={() => setShow(false)} className="w-full sm:w-auto text-xs py-2 whitespace-nowrap bg-white">
            Decline
          </Button>
          <Button onClick={handleAccept} className="w-full sm:w-auto text-xs py-2 whitespace-nowrap px-6">
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
