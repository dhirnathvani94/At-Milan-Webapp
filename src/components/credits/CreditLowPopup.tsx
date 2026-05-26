import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, Star, Clock, CreditCard } from 'lucide-react';
import Button from '../ui/Button';
import { useMasterData } from '../../store/masterDataStore';
import { useAuthStore } from '../../store/authStore';

export default function CreditLowPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { admin_settings_kv } = useMasterData();
  const { profile, user, credits } = useAuthStore();

  useEffect(() => {
    // Only show once per session for everyone
    const hasSeenPopup = sessionStorage.getItem('hasSeenCreditLowPopup');
    if (hasSeenPopup) return;

    if (!user || !profile || !credits) return;

    const isTestUser = user?.email?.toLowerCase().includes('test') || user?.id?.includes('test');
    
    // Get the admin-configured threshold, default to 10% (meaning show when 90% is used)
    const popupPercentSetting = admin_settings_kv?.find(s => s.key === 'credit_low_popup_threshold_percent');
    const popupThresholdPercent = popupPercentSetting ? parseInt(popupPercentSetting.value) : 10;
    
    const hasPurchasedBefore = credits.paid_credits_purchased > 0;
    const isPremium = profile?.is_premium;
    
    let availablePercent = 100;
    if (hasPurchasedBefore) {
      availablePercent = (credits.paid_views_balance / credits.paid_credits_purchased) * 100;
    }

    if (isTestUser || (!isPremium && hasPurchasedBefore && availablePercent <= popupThresholdPercent)) {
      setIsOpen(true);
      sessionStorage.setItem('hasSeenCreditLowPopup', 'true');
    }
  }, [user, profile, credits, admin_settings_kv]);

  if (!isOpen) return null;

  // Dummy values for test user if they don't actually have credits
  const leftCredits = credits?.paid_views_balance || 0;
  const expiryDate = credits?.paid_credits_expiry ? new Date(credits.paid_credits_expiry) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300 border-2 border-[#D4AF37]/30">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="bg-gradient-to-br from-[#8B1A1A] to-[#500000] p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <Star size={140} className="transform translate-x-8 -translate-y-8 text-[#D4AF37]" />
          </div>
          
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-[#D4AF37] to-yellow-600 shadow-[0_0_20px_rgba(212,175,55,0.4)] border-2 border-white/20">
            <CreditCard size={32} className="text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold font-heading mb-2 text-[#D4AF37]">Credits Running Low</h2>
          <p className="text-white/80 text-sm">You are running out of credits. Buy more credits to keep viewing contact details!</p>
        </div>

        <div className="p-8">
          <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Left Credits</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Star size={16} className="text-[#D4AF37] fill-[#D4AF37]" /> {leftCredits} Credits
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Credit Validity Left</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar size={16} className="text-gray-400" /> 
                {expiryDate ? expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              variant="primary" 
              fullWidth 
              className="py-4 text-lg shadow-lg shadow-primary/30"
              onClick={() => {
                setIsOpen(false);
                navigate('/buy-credits');
              }}
            >
              Buy More Credits
            </Button>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
