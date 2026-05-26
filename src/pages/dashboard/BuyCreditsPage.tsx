import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  Crown, Zap, Check, X, Star, ShieldCheck,
  CreditCard, TrendingUp, ArrowRight, Loader2,
  MessageCircle, Eye, Heart, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { PlansSkeleton } from '../../components/ui/Skeletons'
import { apiUrl } from '../../lib/api'
import { useSocketStore } from '../../store/socketStore'

interface CreditPlan {
  id: string
  name: string
  credits: number
  price: number
  original_price?: number
  expiry_days?: number
  popular?: boolean
}

interface MembershipPlan {
  id: string
  name: string
  price: number
  original_price?: number
  duration_months: number
  features: string[]
}

export default function BuyCreditsPage() {
  const { profile, credits, refreshProfile, refreshCredits } = useAuthStore()
  const { socket } = useSocketStore()
  const [creditPlans, setCreditPlans] = useState<CreditPlan[]>([])
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const isRenewing = location.state?.fromRenewPopup

  const isPremium = profile?.is_premium || false
  const premiumEnd = profile?.premium_end ? new Date(profile.premium_end) : null
  const isPremiumActive = isPremium && premiumEnd && premiumEnd > new Date()

  // Use real-time credits from the authStore (populated from /api/credits/:userId)
  const freeCredits = credits?.free_views_remaining ?? profile?.free_views_remaining ?? 10
  const freeMonthlyLimit = credits?.free_monthly_limit ?? 10
  const paidCredits = credits?.paid_views_balance ?? profile?.paid_credits ?? 0
  const paidCreditsExpiry = credits?.paid_credits_expiry ? new Date(credits.paid_credits_expiry) : (profile?.paid_credits_expiry ? new Date(profile.paid_credits_expiry) : null)
  const daysToExpiry = paidCreditsExpiry ? Math.ceil((paidCreditsExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  useEffect(() => {
    fetchPlans()
    refreshCredits() // Always fetch fresh credits on page load
    
    if (!socket) return
    const handleUpdate = () => fetchPlans()
    socket.on('plans:updated', handleUpdate)
    return () => {
      socket.off('plans:updated', handleUpdate)
    }
  }, [socket, refreshCredits])

  const fetchPlans = async () => {
    try {
      const t = Date.now()
      const [creditsRes, membershipRes] = await Promise.all([
        fetch(apiUrl(`/api/plans/credits?t=${t}`)),
        fetch(apiUrl(`/api/plans/membership?t=${t}`))
      ])
      setCreditPlans(await creditsRes.json())
      setMembershipPlans(await membershipRes.json())
    } catch (err) {
      console.error('Failed to fetch plans:', err)
    } finally {
      setLoading(false)
    }
  }


  const handleBuyCredits = (plan: CreditPlan) => {
    if (!profile) {
      navigate('/register')
      return
    }
    if (!profile.is_verified) {
      navigate('/pending-approval')
      return
    }
    navigate(`/checkout?planId=${plan.id}&planType=credit`)
  }

  const handleBuyMembership = (plan: any) => {
    if (!profile) {
      navigate('/register')
      return
    }
    if (!profile.is_verified) {
      navigate('/pending-approval')
      return
    }
    if (plan.id === 'free') return

    const dynamicPlan = membershipPlans.find(p => p.id === plan.id || p.name.toLowerCase() === plan.name.toLowerCase())
    const planIdToPurchase = dynamicPlan ? dynamicPlan.id : plan.id

    navigate(`/checkout?planId=${planIdToPurchase}&planType=membership`)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PlansSkeleton />
      </div>
    )
  }
  const freePlan = membershipPlans.find(p => p.price === 0) || membershipPlans.find(p => p.name.toLowerCase().includes('free'));
  const paidPlans = [...membershipPlans]
    .filter(p => p.price > 0)
    .sort((a, b) => Number(a.duration_months) - Number(b.duration_months));
  const silverPlan = 
    membershipPlans.find(p => Number(p.duration_months) === 3) ||
    membershipPlans.find(p => p.name.toLowerCase().includes('silver')) ||
    paidPlans[0];
  const goldPlan = 
    membershipPlans.find(p => Number(p.duration_months) === 6) ||
    membershipPlans.find(p => p.name.toLowerCase().includes('gold')) ||
    paidPlans[1];
  const platinumPlan = 
    membershipPlans.find(p => Number(p.duration_months) === 12) ||
    membershipPlans.find(p => p.name.toLowerCase().includes('platinum')) ||
    paidPlans[2];

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
      id: silverPlan?.id,
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
      id: goldPlan?.id,
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
      id: platinumPlan?.id,
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
      {/* Hero Section - same as MembershipPage */}
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Buy Credits & Membership</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-white">Buy Credits</span>
          </nav>
        </div>
      </section>

      {/* Current Balance Section */}
      <section className="py-12 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <CreditCard className="text-primary" /> My Credit Balance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Credits Card */}
            <Card className="p-0 overflow-hidden shadow-lg border border-gray-100 bg-white">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/80 mb-1">Free Monthly Credits</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">{freeCredits}</span>
                  <span className="text-white/70 text-sm">/ {freeMonthlyLimit} this month</span>
                </div>
              </div>
              <div className="p-6">
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000 rounded-full"
                    style={{ width: `${Math.min(100, (freeCredits / freeMonthlyLimit) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400">Resets every month automatically</p>
              </div>
            </Card>

            {/* Paid Credits Card */}
            <Card className="p-0 overflow-hidden shadow-lg border border-gray-100 bg-white">
              <div className="bg-gradient-to-r from-gray-900 to-[#1A0505] p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/80 mb-1">Paid Credits</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">{paidCredits}</span>
                  <span className="text-white/70 text-sm">credits remaining</span>
                </div>
              </div>
              <div className="p-6">
                {isPremiumActive ? (
                  <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-green-100">
                    <Crown size={14} className="text-gold" /> Premium Active — No Expiry
                  </div>
                ) : paidCredits === 0 ? (
                  <p className="text-sm text-gray-500">No credits yet — buy a pack below to get started</p>
                ) : paidCreditsExpiry && daysToExpiry > 0 ? (
                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-orange-100 mb-2">
                      <Clock size={14} className="text-orange-500" /> Expires in {daysToExpiry} days
                    </div>
                    <p className="text-sm text-gray-500">Valid until {paidCreditsExpiry.toLocaleDateString()}</p>
                  </div>
                ) : paidCreditsExpiry && daysToExpiry <= 0 ? (
                  <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-red-100">
                    <X size={14} className="text-red-500" /> Credits Expired
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Credits available to use anytime.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Credit Plans Section - same Card layout as MembershipPage plans */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
              Credit Packs
            </h2>
            <p className="text-gray-500 mt-2 text-lg">
              Buy credits to unlock profiles, view contact details & send messages
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {creditPlans
              .filter(plan => Number(plan.price) > 0)
              .slice(0, 3)
              .map((plan) => (
              <Card 
                key={plan.id}
                className={`p-8 flex flex-col border-2 transition-all hover:shadow-2xl relative ${
                  plan.popular 
                    ? 'border-primary scale-105 z-10 shadow-xl' 
                    : 'border-gray-200 shadow-md'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <span className="bg-primary text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold uppercase tracking-wider">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`text-xl font-bold ${plan.popular ? 'text-primary' : 'text-gray-800'}`}>
                    {plan.name}
                  </h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">₹{plan.price.toLocaleString()}</span>
                    {plan.original_price && plan.original_price > plan.price && (
                      <span className="ml-2 text-lg text-gray-400 line-through">₹{plan.original_price.toLocaleString()}</span>
                    )}
                  </div>
                  {plan.original_price && plan.original_price > plan.price && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-100">
                      <TrendingUp size={12} /> Save {Math.round(((plan.original_price - plan.price) / plan.original_price) * 100)}%
                    </div>
                  )}
                  <div className="mt-3 bg-gray-50 rounded-xl p-3 text-center border border-gray-100 flex flex-col items-center gap-1">
                    <div>
                      <span className="text-2xl font-bold text-primary">{plan.credits}</span>
                      <span className="text-sm text-gray-500 ml-1">Credits</span>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                      Validity: {plan.expiry_days || 90} Days
                    </div>
                  </div>
                </div>
                <hr className="mb-6 border-gray-100" />
                <ul className="space-y-4 flex-1 mb-8">
                  <li className="flex items-start gap-3 text-sm">
                    <Check size={18} className="text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">
                      {plan.credits} Contact Detail Email address and Biodata shown
                    </span>
                  </li>
                </ul>
                <Button 
                  variant={plan.popular ? "primary" : "outline"}
                  fullWidth 
                  onClick={() => handleBuyCredits(plan)}
                  className="mt-auto"
                >
                  {`Buy ${plan.name}`}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Membership Plans Section */}
      {membershipPlans.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
                {isPremiumActive ? 'Upgrade Your Membership' : 'Membership Plans'}
              </h2>
            </div>

            {/* Conditional Layout for Premium Upgrades */}
            {isPremiumActive && (profile as any)?.premium_plan !== 'Platinum' ? (
              <div className="max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <Card className="flex-1 p-8 border-2 border-gray-100 opacity-80 scale-95 shadow-sm">
                    <div className="text-center mb-6">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">Current Plan</span>
                      <h3 className="text-2xl font-bold mt-4">{(profile as any)?.premium_plan}</h3>
                    </div>
                    <Button variant="outline" fullWidth disabled>Active</Button>
                  </Card>
                  <div className="hidden md:flex w-12 h-12 bg-primary-50 rounded-full items-center justify-center text-primary flex-shrink-0 z-10 shadow-md">
                    <ArrowRight size={24} />
                  </div>
                  <Card className="flex-[1.2] p-8 border-2 border-primary shadow-2xl relative scale-105">
                     <div className="text-center mb-6">
                        <h3 className="text-3xl font-bold text-primary">Upgrade Now</h3>
                     </div>
                     <Button variant="primary" fullWidth onClick={() => navigate('/upgrade')}>View Upgrade Options</Button>
                  </Card>
                </div>
              </div>
            ) : isPremiumActive && (profile as any)?.premium_plan === 'Platinum' ? (
              <div className="max-w-5xl mx-auto">
                <Card className="max-w-2xl mx-auto p-8 border-2 border-primary shadow-xl text-center">
                  <h3 className="text-2xl font-bold text-primary mb-2">You are on the Platinum Plan</h3>
                  <p className="text-gray-600 mb-6">You already have the highest tier membership.</p>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
                {plans.map((plan, i) => (
                  <div key={i} className={`bg-white border-2 rounded-2xl p-6 flex flex-col ${plan.borderColor} ${plan.highlight ? 'scale-105 shadow-xl' : ''}`}>
                    <h3 className={`text-xl font-bold mb-1 ${plan.color}`}>{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-500 text-sm">{plan.period}</span>
                    </div>
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                          <Check size={16} className="text-green-500" /> {f.text}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      variant={plan.buttonVariant} 
                      fullWidth 
                      onClick={() => plan.id && handleBuyMembership({id: plan.id, name: plan.name})}
                      disabled={plan.name === 'Free'}
                    >
                      {plan.buttonText}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Benefits Section - same FAQ style as MembershipPage */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-heading font-bold text-center mb-8">Credits & Membership FAQ</h2>
          <div className="space-y-6">
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">What can I do with credits?</h3>
              <p className="text-gray-600">Credits allow you to unlock contact details, view full profiles, send direct messages, and more. Each action costs a certain number of credits.</p>
            </Card>
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">Do credits expire?</h3>
              <p className="text-gray-600">No! Paid credits never expire. Free monthly credits reset at the beginning of each month, but your purchased credits stay forever.</p>
            </Card>
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">What's the difference between credits and membership?</h3>
              <p className="text-gray-600">Credits are pay-per-use — you spend them on individual actions. Membership gives you unlimited access to all premium features for the duration of your plan.</p>
            </Card>
            <Card className="p-6 border-none bg-gray-50">
              <h3 className="font-bold text-lg mb-2">Can I buy both credits and a membership?</h3>
              <p className="text-gray-600">Yes! You can have an active membership and also purchase credit packs. Membership benefits apply on top of your credit balance.</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
