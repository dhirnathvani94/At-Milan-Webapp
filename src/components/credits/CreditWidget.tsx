import React from 'react'
import { Link } from 'react-router-dom'
import { Crown, Infinity as InfinityIcon, Clock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import Card from '../ui/Card'
import Button from '../ui/Button'
import ProgressBar from '../ui/ProgressBar'

export default function CreditWidget() {
  const { profile, credits, loading } = useAuthStore()

  if (loading) {
    return (
      <Card className="animate-pulse bg-gray-50 border-gray-100">
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        </div>
      </Card>
    )
  }

  const isPremium = profile?.is_premium || false;
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : null;
  const isPremiumActive = isPremium && premiumEnd && premiumEnd > new Date();
  
  const displayCredits = credits || {
    free_views_remaining: 0,
    free_monthly_limit: 10,
    free_views_reset_date: new Date().toISOString(),
    paid_views_balance: 0,
    paid_credits_expiry: null,
  };

  let paidExpiryDays = 0;
  if (!isPremiumActive && displayCredits.paid_credits_expiry) {
    const expiry = new Date(displayCredits.paid_credits_expiry);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    paidExpiryDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const freePercentage = Math.round((displayCredits.free_views_remaining / (displayCredits.free_monthly_limit || 10)) * 100);

  return (
    <Card className="bg-white p-0 overflow-hidden shadow-sm border border-gray-200">
      {/* Header */}
      <div className="bg-[#1A0505] p-4 flex justify-between items-center text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Crown className="text-gold" size={20} />
          My Credits
        </h3>
        <Link to="/credits">
          <Button size="sm" className="bg-saffron text-white border-none hover:bg-saffron/90">
            Buy Credits
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* FREE CREDITS (LEFT) */}
        <div className="flex-1 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Free Monthly</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">{displayCredits.free_views_remaining}</span>
                <span className="text-sm text-gray-500">/ {displayCredits.free_monthly_limit} this month</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary-700 transition-all duration-1000"
                style={{ width: `${Math.max(0, Math.min(100, freePercentage))}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400">
              Resets on {new Date(displayCredits.free_views_reset_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* PAID CREDITS (RIGHT) */}
        <div className="flex-1 p-6 space-y-4 flex flex-col justify-center">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Paid Credits</p>
            <div className="flex items-baseline gap-2 mb-2">
               <span className="text-4xl font-bold text-gray-900">{displayCredits.paid_views_balance}</span>
            </div>
            
            {isPremiumActive ? (
              <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-green-100">
                <InfinityIcon size={14} /> No Expiry — Premium Active
              </div>
            ) : displayCredits.paid_views_balance > 0 && displayCredits.paid_credits_expiry === null ? (
              // Credits exist but no expiry set — membership just ended, scheduler will set expiry soon
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-100">
                <Clock size={14} /> Valid — Expiry being calculated
              </div>
            ) : paidExpiryDays > 0 && paidExpiryDays <= 30 ? (
              <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-100">
                <Clock size={14} /> Expires in {paidExpiryDays} days
              </div>
            ) : displayCredits.paid_views_balance === 0 ? (
              <div className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-500 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200">
                 0 credits — Buy More
              </div>
            ) : displayCredits.paid_credits_expiry ? (
               <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-xs font-medium border border-blue-100">
                 <Clock size={14} /> Expires on {new Date(displayCredits.paid_credits_expiry).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* BOTTOM MEMBERSHIP STATUS */}
      {isPremiumActive ? (
        <div className="bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 p-4 border-t border-gold/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-yellow-800 flex items-center gap-2">
              <Crown size={16} className="text-gold" />
              Premium Member · {profile?.premium_plan || 'Active'} · Active until {premiumEnd?.toLocaleDateString()}
            </p>
            <p className="text-xs text-yellow-700/80 mt-0.5">
              You have {displayCredits.free_monthly_limit} monthly free credits
            </p>
          </div>
          <Link to="/premium">
             <Button variant="outline" size="sm" className="border-gold text-gold hover:bg-gold hover:text-white">View Benefits</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
           <div className="flex items-center gap-2 text-sm text-gray-600">
             <AlertCircle size={16} className="text-gray-400" />
             Get unlimited chat & contact unlocks
           </div>
           <Link to="/membership">
             <Button size="sm" className="bg-saffron text-white border-none hover:bg-saffron/90">
                Upgrade to Premium
             </Button>
           </Link>
        </div>
      )}
    </Card>
  )
}
