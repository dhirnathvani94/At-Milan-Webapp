import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, Star, Clock } from 'lucide-react';
import Button from '../ui/Button';
import { useMasterData } from '../../store/masterDataStore';

export default function MembershipExpiryPopup({ profile, user }: { profile: any, user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { admin_settings_kv } = useMasterData();

  useEffect(() => {
    // Only show once per session for everyone
    const hasSeenPopup = sessionStorage.getItem('hasSeenExpiryPopup');
    if (hasSeenPopup) return;

    const isTestUser = user?.email?.toLowerCase().includes('test') || user?.id?.includes('test');
    
    // Get the admin-configured threshold, default to 30 days if not set
    const popupDaysSetting = admin_settings_kv?.find(s => s.key === 'popup_show_days_before_expiry');
    const popupThreshold = popupDaysSetting ? parseInt(popupDaysSetting.value) : 30;
    
    let daysLeft = 999;
    if (profile?.premium_end) {
      const end = new Date(profile.premium_end).getTime();
      const now = new Date().getTime();
      daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    }

    if (isTestUser || (profile?.is_premium && daysLeft >= 0 && daysLeft <= popupThreshold)) {
      setIsOpen(true);
      sessionStorage.setItem('hasSeenExpiryPopup', 'true');
    }
  }, [user, profile, admin_settings_kv]);

  if (!isOpen) return null;

  // Dummy values for test user if they don't actually have a plan
  const planName = profile?.premium_plan || 'Premium Heritage';
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  
  const end = premiumEnd.getTime();
  const now = new Date().getTime();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

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
            <Clock size={32} className="text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold font-heading mb-2 text-[#D4AF37]">Membership Ending Soon</h2>
          <p className="text-white/80 text-sm">Don't lose your premium benefits. Renew now to stay on top of matches!</p>
        </div>

        <div className="p-8">
          <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Current Plan</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Star size={16} className="text-[#D4AF37] fill-[#D4AF37]" /> {planName}
              </span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">Expiry Date</span>
              <span className="font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar size={16} className="text-gray-400" /> 
                {premiumEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-orange-100">
              <span className="text-gray-500 font-medium">Time Remaining</span>
              <span className="font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-200">
                {daysLeft} Days Left
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
                navigate('/membership', { state: { fromRenewPopup: true } });
              }}
            >
              Renew Membership Now
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
