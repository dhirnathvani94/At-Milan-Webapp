import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Check, X, CheckCircle, Download, Clock, Calendar, Crown, Shield, Users, Heart, ArrowRight, Zap, Star, Gem } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { useMasterData } from '../store/masterDataStore';
import { PLAN_DETAILS as WIDGET_PLAN_DETAILS, generateInvoiceHTML } from '../components/credits/MembershipWidget';

import { apiUrl } from '../lib/api';
import { useSocketStore } from '../store/socketStore';

interface DynamicPlan {
  id: string
  name: string
  price: number
  original_price?: number
  duration_months: number
  features: string[]
}

export default function MembershipPage() {
  const { profile } = useAuthStore();
  const { socket } = useSocketStore();
  const { admin_settings_kv } = useMasterData();
  const navigate = useNavigate();
  const location = useLocation();
  const isRenewing = location.state?.fromRenewPopup;
  const [downloading, setDownloading] = useState(false);
  const [dynamicPlans, setDynamicPlans] = useState<DynamicPlan[]>([]);
  const [creditPlans, setCreditPlans] = useState<any[]>([]);

  const fetchPlans = () => {
    const t = Date.now();
    fetch(apiUrl(`/api/plans/membership?t=${t}`))
      .then(res => res.json())
      .then(data => setDynamicPlans(data.plans || data))
      .catch(() => {});
      
    fetch(apiUrl(`/api/plans/credits?t=${t}`))
      .then(res => res.json())
      .then(data => setCreditPlans(data.plans || data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchPlans();
    if (!socket) return;
    const handleUpdate = () => fetchPlans();
    socket.on('plans:updated', handleUpdate);
    return () => {
      socket.off('plans:updated', handleUpdate);
    };
  }, [socket]);

  const invoiceLogoSetting = admin_settings_kv?.find((s: any) => s.key === 'invoice_logo');
  const invoiceLogoUrl = invoiceLogoSetting?.value || '';
  const siteNameValue = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan'
  const emailValue = admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com'

  const isPremium = profile?.is_premium || false;
  const premiumPlan = profile?.premium_plan || null;
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : null;
  const isPremiumActive = isPremium && premiumEnd && premiumEnd > new Date();

  const handleDownloadInvoice = () => {
    if (!profile || !premiumPlan || downloading) return;
    setDownloading(true);
    
    try {
      const html = generateInvoiceHTML(profile, premiumPlan, profile?.premium_end || null, {
        name: siteNameValue,
        email: emailValue,
        logoUrl: invoiceLogoUrl
      });
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = siteNameValue.replace(/\s+/g, '');
      a.download = `${cleanName}_Invoice_${premiumPlan}_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate invoice');
    } finally {
      setDownloading(false);
    }
  };

  const handleCancelMembership = () => {
    toast(`Please contact ${emailValue} to cancel your membership.`, { icon: '📧', duration: 5000 });
  };

  const freePlan = dynamicPlans.find(p => p.price === 0) || dynamicPlans.find(p => p.name.toLowerCase().includes('free'));
  const paidPlans = [...dynamicPlans]
    .filter(p => p.price > 0)
    .sort((a, b) => Number(a.duration_months) - Number(b.duration_months));
  const silverPlan = 
    dynamicPlans.find(p => Number(p.duration_months) === 3) ||
    dynamicPlans.find(p => p.name.toLowerCase().includes('silver')) ||
    paidPlans[0];
  const goldPlan = 
    dynamicPlans.find(p => Number(p.duration_months) === 6) ||
    dynamicPlans.find(p => p.name.toLowerCase().includes('gold')) ||
    paidPlans[1];
  const platinumPlan = 
    dynamicPlans.find(p => Number(p.duration_months) === 12) ||
    dynamicPlans.find(p => p.name.toLowerCase().includes('platinum')) ||
    paidPlans[2];

  const handleChoosePlan = (planName: string, planType: string = 'membership', specificPlanId?: string) => {
    if (!profile) {
      navigate('/register');
      return;
    }
    if (!profile.is_verified) {
      navigate('/pending-approval');
      return;
    }
    
    let planId = specificPlanId;
    if (!planId) {
      if (planType === 'membership') {
        let plan = null;
        if (planName === 'Silver') plan = silverPlan;
        else if (planName === 'Gold') plan = goldPlan;
        else if (planName === 'Platinum') plan = platinumPlan;
        else plan = dynamicPlans.find(p => p.name === planName);
        
        if (plan) planId = plan.id;
      } else {
        const plan = creditPlans.find(p => p.name === planName);
        if (plan) planId = plan.id;
      }
    }

    if (planId) {
      navigate(`/checkout?planId=${planId}&planType=${planType}`);
    } else {
      toast.error('Plan not configured in admin panel');
    }
  };

  const plans = [
    {
      name: freePlan ? freePlan.name : "Free",
      price: "₹0",
      original_price: null,
      period: "/forever",
      color: "text-gray-800",
      borderColor: "border-gray-200",
      features: freePlan?.features && freePlan.features.length > 0 
        ? freePlan.features.map((f: string) => ({ text: f, included: true }))
        : [
        { text: "Create detailed profile", included: true },
        { text: "Browse unlimited profiles", included: true },
        { text: "Basic search filters", included: true },
        { text: "Send 5 interests/day", included: true },
        { text: "View contact details", included: false },
        { text: "Chat with matches", included: false },
        { text: "See who viewed you", included: false }
      ],
      buttonVariant: "outline" as const,
      buttonText: "Current Plan"
    },
    {
      name: silverPlan ? silverPlan.name : "Silver",
      price: silverPlan ? `₹${silverPlan.price.toLocaleString()}` : "₹999",
      original_price: silverPlan?.original_price ? `₹${silverPlan.original_price.toLocaleString()}` : null,
      period: silverPlan ? `/${silverPlan.duration_months} months` : "/3 months",
      color: "text-blue-600",
      borderColor: "border-gray-200",
      features: silverPlan?.features && silverPlan.features.length > 0 
        ? silverPlan.features.map((f: string) => ({ text: f, included: true }))
        : [
        { text: "All Free features", included: true },
        { text: "Send 15 interests/day", included: true },
        { text: "View contact details", included: true },
        { text: "Chat with matches", included: true },
        { text: "Advanced search filters", included: true },
        { text: "Profile highlighter", included: false },
        { text: "Priority in search", included: false }
      ],
      buttonVariant: "outline" as const,
      buttonText: silverPlan ? `Choose ${silverPlan.name}` : "Choose Silver"
    },
    {
      name: goldPlan ? goldPlan.name : "Gold",
      price: goldPlan ? `₹${goldPlan.price.toLocaleString()}` : "₹1,999",
      original_price: goldPlan?.original_price ? `₹${goldPlan.original_price.toLocaleString()}` : null,
      period: goldPlan ? `/${goldPlan.duration_months} months` : "/6 months",
      color: "text-primary",
      borderColor: "border-primary",
      highlight: true,
      features: goldPlan?.features && goldPlan.features.length > 0 
        ? goldPlan.features.map((f: string) => ({ text: f, included: true }))
        : [
        { text: "All Silver features", included: true },
        { text: "Unlimited interests", included: true },
        { text: "Profile highlighter", included: true },
        { text: "Priority in search results", included: true },
        { text: "Verified badge", included: true },
        { text: "See who viewed you", included: true },
        { text: "Read receipts in chat", included: true }
      ],
      buttonVariant: "primary" as const,
      buttonText: goldPlan ? `Choose ${goldPlan.name} ⭐` : "Choose Gold ⭐"
    },
    {
      name: platinumPlan ? platinumPlan.name : "Platinum",
      price: platinumPlan ? `₹${platinumPlan.price.toLocaleString()}` : "₹2,999",
      original_price: platinumPlan?.original_price ? `₹${platinumPlan.original_price.toLocaleString()}` : null,
      period: platinumPlan ? `/${platinumPlan.duration_months} months` : "/1 year",
      color: "text-secondary-700",
      borderColor: "border-secondary",
      features: platinumPlan?.features && platinumPlan.features.length > 0 
        ? platinumPlan.features.map((f: string) => ({ text: f, included: true }))
        : [
        { text: "All Gold features", included: true },
        { text: "Personal matchmaker", included: true },
        { text: "Profile boost (3x visibility)", included: true },
        { text: "Featured profile badge", included: true },
        { text: "Priority customer support", included: true },
        { text: "Video call feature", included: true },
        { text: "Exclusive matches", included: true }
      ],
      buttonVariant: "secondary" as const,
      buttonText: platinumPlan ? `Choose ${platinumPlan.name} 👑` : "Choose Platinum 👑"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Membership Plans</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">Membership</span>
          </nav>
        </div>
      </section>

      {/* Premium Active View */}
      {isPremiumActive && premiumPlan && premiumEnd && (
        <section className="py-12 bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Crown className="text-gold" /> My Current Membership
            </h2>
            
            <Card className="p-0 overflow-hidden shadow-lg border border-gray-100 bg-white">
              <div className="flex flex-col md:flex-row items-center justify-between bg-gradient-to-r from-gray-900 to-[#1A0505] p-6 text-white gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center shadow-lg shadow-gold/20">
                    <Crown size={32} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-3xl font-bold">{premiumPlan} Plan</h3>
                      <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-gray-300">Enjoying premium features and prioritized matches</p>
                  </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 flex-1 md:flex-none" onClick={handleCancelMembership}>
                    Cancel Plan
                  </Button>
                  <Button 
                    className="bg-primary hover:bg-primary-600 text-white border-none flex-1 md:flex-none shadow-lg shadow-primary/30"
                    onClick={handleDownloadInvoice}
                    disabled={downloading}
                  >
                    <Download size={18} className="mr-2" />
                    {downloading ? 'Downloading...' : 'Download Invoice'}
                  </Button>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4 col-span-1 md:col-span-2">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Plan Validity</h4>
                  
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="bg-gray-50 rounded-xl p-4 flex-1 border border-gray-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Purchased On</p>
                        <p className="font-bold text-gray-900">
                          {(() => {
                            const pMonths = premiumPlan === 'Silver' ? 3 : premiumPlan === 'Gold' ? 6 : 12;
                            const d = new Date(premiumEnd);
                            d.setMonth(d.getMonth() - pMonths);
                            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          })()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-xl p-4 flex-1 border border-gray-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Expires On</p>
                        <p className="font-bold text-gray-900">
                          {premiumEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-gray-700">Time Remaining</span>
                      <span className="font-bold text-primary">
                        {Math.ceil((premiumEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} Days Left
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      {(() => {
                        const pMonths = premiumPlan === 'Silver' ? 3 : premiumPlan === 'Gold' ? 6 : 12;
                        const start = new Date(premiumEnd);
                        start.setMonth(start.getMonth() - pMonths);
                        const total = premiumEnd.getTime() - start.getTime();
                        const passed = new Date().getTime() - start.getTime();
                        const percent = Math.min(100, Math.max(0, (passed / total) * 100));
                        return (
                          <div className="bg-gradient-to-r from-primary to-gold h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                <div className="border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Included Features</h4>
                  <ul className="space-y-3">
                    {WIDGET_PLAN_DETAILS[premiumPlan]?.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <CheckCircle size={16} className="text-green-500" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Upgrade/Plans Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
              {isPremiumActive && premiumPlan !== 'Platinum' ? 'Upgrade Your Plan' : 'Choose the Perfect Plan'}
            </h2>
            <p className="text-gray-500 mt-2 text-lg">
              {isPremiumActive && premiumPlan !== 'Platinum' 
                ? 'Unlock even more exclusive features by upgrading to a higher tier' 
                : 'Upgrade to connect faster and find your match with premium benefits'}
            </p>
          </div>

          {/* Conditional Layout for Premium Upgrades */}
          {isPremiumActive && premiumPlan !== (platinumPlan ? platinumPlan.name : 'Platinum') && premiumPlan !== 'Platinum' ? (
            <div className="max-w-5xl mx-auto">
              {(() => {
                let currentIndex = plans.findIndex(p => p.name === premiumPlan);
                if (currentIndex === -1) currentIndex = 1; // Default to 'Silver' if renamed
                
                const currentData = plans[currentIndex];
                const nextData = plans[Math.min(currentIndex + 1, plans.length - 1)];
                
                if (!currentData || !nextData) return null;

                return (
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    {/* Current Plan Card (Smaller/Faded) */}
                    <Card className="flex-1 p-8 border-2 border-gray-100 opacity-80 scale-95 shadow-sm transition-all duration-300 hover:scale-100 hover:opacity-100 hover:shadow-lg hover:border-gray-300 cursor-default">
                      <div className="text-center mb-6">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Current Plan</span>
                        <h3 className={`text-2xl font-bold mt-4 ${currentData.color}`}>{currentData.name}</h3>
                        <div className="mt-2 text-gray-500 line-through text-xl">{currentData.price}</div>
                      </div>
                      <ul className="space-y-3 mb-8">
                        {currentData.features.filter(f => f.included).slice(0, 4).map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <Check size={16} className="text-gray-400" /> {f.text}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        variant="outline" 
                        fullWidth 
                        onClick={() => handleChoosePlan(currentData.name)}
                        className="transition-colors"
                        disabled={!isRenewing}
                      >
                        {isRenewing ? 'Renew Current Plan' : 'Active'}
                      </Button>
                    </Card>

                    {/* Arrow */}
                    <div className="hidden md:flex w-12 h-12 bg-primary-50 rounded-full items-center justify-center text-primary flex-shrink-0 z-10 shadow-md">
                      <ArrowRight size={24} />
                    </div>

                    {/* Next Plan Card (Highlighted) */}
                    <Card className={`flex-[1.2] p-8 border-2 shadow-2xl relative ${nextData.borderColor} scale-105 z-10 bg-gradient-to-b from-white to-orange-50/30 transition-all duration-300 hover:scale-[1.08] hover:shadow-[0_20px_50px_rgba(212,175,55,0.15)] cursor-default`}>
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-primary to-gold text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest flex items-center gap-1">
                          <Crown size={14} /> Recommended Upgrade
                        </span>
                      </div>
                      <div className="text-center mb-6 mt-2">
                        <h3 className={`text-3xl font-bold ${nextData.color}`}>{nextData.name}</h3>
                        <div className="mt-3 flex items-baseline justify-center">
                          <span className="text-4xl font-bold text-gray-900">{nextData.price}</span>
                          <span className="ml-1 text-sm text-gray-500">{nextData.period}</span>
                        </div>
                      </div>
                      <hr className="mb-6 border-primary/20" />
                      <div className="mb-8">
                        <p className="text-sm font-bold text-gray-800 mb-4">What you get extra:</p>
                        <ul className="space-y-4">
                          {nextData.features.map((feature, fIndex) => {
                            const isExtra = feature.included && !currentData.features.find(cf => cf.text === feature.text && cf.included);
                            return (
                              <li key={fIndex} className={`flex items-start gap-3 text-sm ${isExtra ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
                                {feature.included ? (
                                  <Check size={18} className={isExtra ? "text-primary flex-shrink-0" : "text-green-500 flex-shrink-0"} />
                                ) : (
                                  <X size={18} className="text-red-400 flex-shrink-0" />
                                )}
                                <span>
                                  {feature.text} {isExtra && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">New</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <Button 
                        variant={nextData.buttonVariant} 
                        fullWidth 
                        onClick={() => handleChoosePlan(nextData.name)}
                        className="py-3 shadow-lg hover:shadow-xl transition-all"
                      >
                        Upgrade to {nextData.name} Now
                      </Button>
                    </Card>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
              {plans.map((plan, index) => (
                <Card 
                  key={index} 
                  className={`p-8 flex flex-col border-2 transition-all hover:shadow-2xl relative ${
                    plan.borderColor
                  } ${plan.highlight ? 'scale-105 z-10 shadow-xl' : 'shadow-md'}`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 right-0">
                      <span className="bg-primary text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-wider">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className={`text-xl font-bold ${plan.color}`}>{plan.name}</h3>
                    <div className="mt-4 flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                      {plan.original_price && (
                        <span className="ml-2 text-lg text-gray-400 line-through">{plan.original_price}</span>
                      )}
                      <span className="ml-1 text-sm text-gray-500">{plan.period}</span>
                    </div>
                  </div>
                  <hr className="mb-6 border-gray-100" />
                  <ul className="space-y-4 flex-1 mb-8">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3 text-sm">
                        {feature.included ? (
                          <Check size={18} className="text-green-500 flex-shrink-0" />
                        ) : (
                          <X size={18} className="text-red-400 flex-shrink-0" />
                        )}
                        <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    variant={plan.buttonVariant} 
                    fullWidth 
                    onClick={() => handleChoosePlan(plan.name)}
                    className="mt-auto"
                    disabled={isPremiumActive && plan.name === premiumPlan && !isRenewing}
                  >
                    {isPremiumActive && plan.name === premiumPlan ? (isRenewing ? 'Renew Current Plan' : 'Current Plan') : plan.buttonText}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-heading font-bold text-center mb-10">Detailed Comparison</h2>
          <div className="overflow-x-auto bg-white rounded-3xl shadow-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-6 font-bold text-gray-900">Features</th>
                  <th className="p-6 font-bold text-gray-800 text-center">Free</th>
                  <th className="p-6 font-bold text-blue-600 text-center">Silver</th>
                  <th className="p-6 font-bold text-primary text-center">Gold</th>
                  <th className="p-6 font-bold text-secondary-700 text-center">Platinum</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "Profile Creation", "Unlimited Browsing", "Basic Search", "Advanced Filters",
                  "Interests/Day", "Contact Details", "Messaging", "Profile Highlighter",
                  "Priority Search", "Verified Badge", "See Who Viewed You", "Read Receipts",
                  "Personal Matchmaker", "Profile Boost", "Video Call"
                ].map((feature, index) => (
                  <tr key={index} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-6 text-sm font-medium text-gray-700">{feature}</td>
                    <td className="p-6 text-center">
                      {index < 3 ? <Check className="mx-auto text-green-500" size={20} /> : 
                       index === 4 ? <span className="text-xs font-bold">5</span> :
                       <X className="mx-auto text-red-300" size={20} />}
                    </td>
                    <td className="p-6 text-center">
                      {index < 7 ? <Check className="mx-auto text-green-500" size={20} /> : 
                       index === 4 ? <span className="text-xs font-bold">15</span> :
                       <X className="mx-auto text-red-300" size={20} />}
                    </td>
                    <td className="p-6 text-center">
                      {index < 12 ? <Check className="mx-auto text-green-500" size={20} /> : 
                       index === 4 ? <span className="text-xs font-bold">Unlimited</span> :
                       <X className="mx-auto text-red-300" size={20} />}
                    </td>
                    <td className="p-6 text-center">
                      {index === 4 ? <span className="text-xs font-bold">Unlimited</span> :
                       <Check className="mx-auto text-green-500" size={20} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Dynamic Admin-Managed Credit Plans */}
      {creditPlans.filter(p => p.price > 0).length > 0 && (
        <section className="py-16 bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-heading font-bold text-gray-900">Credit Plan for Unblock more Profile</h2>
              <p className="text-gray-500 mt-2 text-lg">Purchase credits to unlock contact details and connect instantly</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {creditPlans.filter(p => p.price > 0).map((plan, index) => {
                const Icon = index === 0 ? Star : index === 1 ? Zap : Crown;
                return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative ${
                    plan.credits === 150 
                      ? 'border-primary shadow-xl scale-105 z-10' 
                      : 'border-gray-200 hover:border-primary/50'
                  }`}
                >
                  {plan.credits === 150 && (
                    <div className="absolute top-0 right-0 z-20">
                      <span className="bg-primary text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-wider shadow-sm">
                        MOST POPULAR
                      </span>
                    </div>
                  )}
                  <div className="bg-gradient-to-r from-[#1A0505] to-[#3a1515] p-5 text-center relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Icon size={18} className="text-white" />
                      <span className="text-sm font-bold uppercase tracking-wider text-white">{plan.name}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-bold text-white">₹{plan.price.toLocaleString()}</span>
                      {plan.original_price && plan.original_price > plan.price && (
                        <span className="text-lg text-gray-400 line-through">₹{plan.original_price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-6 text-center bg-gray-50/50">
                    <div className="text-2xl font-bold text-primary mb-2">{plan.credits} Credits</div>
                    <p className="text-sm text-gray-500 mb-6 font-medium">Validity: {plan.expiry_days || 90} Days</p>
                    <ul className="space-y-4 mb-8 text-left max-w-xs mx-auto">
                      <li className="flex items-start gap-3 text-sm text-gray-700">
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={12} className="text-green-600" />
                        </div>
                        <span className="font-medium leading-tight">
                          Get {plan.credits} Contact Detail Email address and Biodata shown
                        </span>
                      </li>
                    </ul>
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleChoosePlan(plan.name, 'credit', plan.id)}
                      className="py-3 shadow-md"
                    >
                      Buy Credits
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-heading font-bold text-center mb-8">Membership FAQ</h2>
          <div className="space-y-6">
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">Can I upgrade my plan later?</h3>
              <p className="text-gray-600">Yes, you can upgrade your plan at any time. The remaining balance of your current plan will be adjusted against the new plan.</p>
            </Card>
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">What happens when my plan expires?</h3>
              <p className="text-gray-600">Your account will automatically revert to the Free plan. All your data will be safe, but you'll lose access to premium features.</p>
            </Card>
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">Is there a refund policy?</h3>
              <p className="text-gray-600">We do not offer refunds once a premium plan is activated. We recommend starting with a shorter duration to test the benefits.</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
