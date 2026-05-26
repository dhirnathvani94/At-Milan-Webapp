import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Tag, CheckCircle, CreditCard, Lock, Check, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useMasterData } from '../store/masterDataStore';
import { apiUrl } from '../lib/api';

export default function CheckoutPage() {
  const { admin_settings_kv } = useMasterData();
  const brandName    = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const supportEmail = admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
  const supportPhone = admin_settings_kv?.find((s: any) => s.key === 'contact_phone')?.value || '+91 98765 43210';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, refreshCredits, refreshProfile } = useAuthStore();
  const planId = searchParams.get('planId');
  const planType = searchParams.get('planType');

  const [plan, setPlan] = useState<any>(null);
  const [activeGateway, setActiveGateway] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMockGateway, setShowMockGateway] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // ── Idempotency Key ──────────────────────────────────────────────────────────
  // A unique UUID generated ONCE per checkout session (stable across re-renders,
  // reset on navigation). Sent as X-Idempotency-Key so the server can detect
  // duplicate POSTs from double-clicks or network retries — guaranteeing the
  // user is charged at most once per intentional payment action.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    if (!planId || !planType) {
      toast.error('Invalid checkout request');
      navigate(-1);
      return;
    }

    const fetchPlan = async () => {
      try {
        const endpoint = planType === 'credit' ? '/api/plans/credits' : '/api/plans/membership';
        const res = await fetch(apiUrl(endpoint));
        const plans = await res.json();
        const selectedPlan = plans.find((p: any) => p.id === planId || p.name.toLowerCase() === planId.toLowerCase());
        if (!selectedPlan) {
          toast.error('Plan not found');
          navigate(-1);
          return;
        }
        setPlan(selectedPlan);

        // Fetch active gateway
        const gwRes = await fetch(apiUrl('/api/payment-gateways/active'));
        if (gwRes.ok) {
          const gw = await gwRes.json();
          setActiveGateway(gw);
        }

      } catch (err) {
        toast.error('Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, planType, navigate]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await fetch(apiUrl('/api/coupons/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to validate coupon');
      
      setAppliedCoupon(data.coupon);
      toast.success('Coupon applied successfully!');
    } catch (err: any) {
      toast.error(err.message);
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
  };

  const handleCheckout = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }
    if (!user || !plan) return;
    
    setProcessing(true);

    const finalPayAmount = Math.max(0, plan.price - discountAmount);

    if (finalPayAmount === 0 || !activeGateway) {
      // Direct checkout for free plans or if no gateway is configured
      await finalizePurchase('free_or_mock_payment');
      return;
    }

    if (activeGateway.provider === 'razorpay') {
      // If it's the demo key, show our beautiful mock gateway instead of failing on Razorpay's servers
      if (activeGateway.key_id === 'rzp_test_demoKey123') {
        setShowMockGateway(true);
        return;
      }

      // ── STEP 1: Create a server-side Razorpay order ──
      let razorpayOrderId: string;
      let isMockOrder = false;
      try {
        const orderRes = await fetch(apiUrl('/api/payment/create-order'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKeyRef.current + '-order'
          },
          body: JSON.stringify({ amount: finalPayAmount, currency: 'INR', planId: plan.id, planType })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order');
        razorpayOrderId = orderData.order_id;
        isMockOrder = orderData.is_mock === true;
      } catch (err: any) {
        toast.error(err.message || 'Could not initiate payment. Please try again.');
        setProcessing(false);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onerror = () => {
        toast.error('Failed to load payment gateway');
        setProcessing(false);
      };
      script.onload = () => {
        const options = {
          key: activeGateway.key_id,
          amount: finalPayAmount * 100, // Amount in paise
          currency: 'INR',
          order_id: razorpayOrderId,   // ← Server-created order ID (secure)
          name: brandName,
          description: `${plan.name} Purchase`,
          image: profile?.profile_photo_url || 'https://via.placeholder.com/150',
          handler: async function (response: any) {
            // ── STEP 2: Send signature for server-side verification ──
            await finalizePurchase(
              response.razorpay_payment_id,
              isMockOrder ? undefined : response.razorpay_order_id,
              isMockOrder ? undefined : response.razorpay_signature
            );
          },
          prefill: {
            name: `${profile?.first_name} ${profile?.last_name}`,
            email: user.email,
            contact: profile?.phone || ''
          },
          theme: {
            color: '#8B1A1A'
          },
          modal: {
            ondismiss: function() {
              setProcessing(false);
              toast.error('Payment cancelled. You can try again.');
            }
          }
        };
        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (response: any) {
            setProcessing(false);
            toast.error(response.error.description || 'Payment failed. Please try again.');
          });
          rzp.open();
        } catch (err) {
          setProcessing(false);
          toast.error('Invalid Gateway Configuration.');
        }
      };
      document.body.appendChild(script);
    } else {
      // Mock redirect for Stripe/PayPal
      setShowMockGateway(true);
    }
  };

  const finalizePurchase = async (paymentId: string, razorpayOrderId?: string, razorpaySignature?: string) => {
    try {
      setProcessing(true);
      const res = await fetch(apiUrl('/api/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKeyRef.current
        },
        body: JSON.stringify({
          userId: user?.id,
          planId: plan.id,
          planType,
          couponCode: appliedCoupon?.code || null,
          paymentId,
          razorpay_order_id: razorpayOrderId || null,
          razorpay_signature: razorpaySignature || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      
      setShowMockGateway(false);
      toast.dismiss();
      toast.success('Payment successful! Your account has been upgraded.', { duration: 5000 });
      // Rotate the idempotency key so the next purchase attempt gets a fresh key
      idempotencyKeyRef.current = crypto.randomUUID();
      // Refresh both profile and credits so dashboard & credits page show updated balance
      await refreshProfile();
      await refreshCredits();
      navigate('/dashboard');
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message);
      setProcessing(false);
      setShowMockGateway(false);
    }
  };

  // Mock Gateway UI Handler
  const handleMockPaymentSuccess = () => {
    finalizePurchase(`mock_payment_${Date.now()}`);
  };

  const handleMockPaymentCancel = () => {
    setShowMockGateway(false);
    setProcessing(false);
    toast.error('Payment cancelled. You can try again.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Preparing secure checkout...</p>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  let finalPrice = plan.price;
  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      discountAmount = plan.price * (appliedCoupon.value / 100);
    } else {
      discountAmount = appliedCoupon.value;
    }
    finalPrice = Math.max(0, plan.price - discountAmount);
  }

  const isFreePlan = plan.price === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center text-gray-600 hover:text-primary font-medium transition-colors"
          >
            <ArrowLeft size={18} className="mr-2" /> Back
          </button>
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-full text-sm font-semibold border border-green-200">
            <Lock size={14} /> 256-bit Secure Checkout
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">Complete Your Purchase</h1>
          <p className="text-gray-500 mt-2">You are one step away from premium matrimonial features.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column - Details & Payment */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Account Details */}
            <Card className="p-0 overflow-hidden border-2 border-gray-100 shadow-sm">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
                <h2 className="text-lg font-bold text-gray-900">Account Details</h2>
              </div>
              <div className="p-6 flex items-center gap-5">
                <img 
                  src={profile?.profile_photo_url || 'https://via.placeholder.com/150'} 
                  alt="Profile" 
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-50 shadow-md"
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{profile?.first_name} {profile?.last_name}</h3>
                  <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100">
                    <CheckCircle size={12} /> Profile Verified
                  </div>
                </div>
              </div>
            </Card>

            {/* Plan Details Box */}
            <Card className="p-0 overflow-hidden border-2 border-primary/20 shadow-md">
              <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">2</div>
                  <h2 className="text-lg font-bold text-gray-900">Selected Plan</h2>
                </div>
                <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  {planType === 'membership' ? 'Membership' : 'Credit Pack'}
                </span>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-gray-500 mt-1">
                      {planType === 'membership' 
                        ? `Enjoy premium benefits for ${plan.duration_months} months.` 
                        : `Get ${plan.credits} credits added to your balance instantly.`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">₹{plan.price.toLocaleString()}</div>
                    {plan.original_price && plan.original_price > plan.price && (
                      <div className="text-sm text-gray-400 line-through">₹{plan.original_price.toLocaleString()}</div>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">What's included:</h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {planType === 'membership' && plan.features?.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="font-medium">{feature}</span>
                      </li>
                    ))}
                    {planType === 'credit' && (
                      <li className="flex items-start gap-2 text-sm text-gray-600">
                        <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="font-medium">Unlock up to {plan.credits} contact profiles securely.</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>

            {/* Payment Method Details (Mock) */}
            <Card className="p-0 overflow-hidden border-2 border-gray-100 shadow-sm">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">3</div>
                <h2 className="text-lg font-bold text-gray-900">Payment Method</h2>
              </div>
              <div className="p-6">
                {!isFreePlan ? (
                  <div className="bg-white border-2 border-blue-500 rounded-xl p-4 flex items-center justify-between cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">Selected</div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{activeGateway ? activeGateway.name : 'Credit/Debit Card, UPI'}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {activeGateway 
                            ? `Proceed to secure ${activeGateway.provider} gateway` 
                            : 'No payment gateway configured'}
                        </p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-4 border-blue-500 bg-white flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-4">
                    <CheckCircle className="text-green-600" size={24} />
                    <div>
                      <p className="font-bold">No Payment Required</p>
                      <p className="text-sm">This plan is completely free. Just confirm below.</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-0 sticky top-24 border-2 border-gray-100 shadow-xl overflow-hidden">
              <div className="bg-gray-900 text-white px-6 py-4">
                <h2 className="text-lg font-bold">Order Summary</h2>
              </div>
              
              <div className="p-6">
                {/* Coupon Input */}
                {!isFreePlan && (
                  <div className="mb-6 pb-6 border-b border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Have a promo code?</label>
                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <div className="relative flex-1 shadow-sm rounded-lg">
                          <Tag size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Enter Code" 
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-0 focus:border-primary uppercase placeholder:normal-case font-bold transition-colors"
                          />
                        </div>
                        <Button 
                          onClick={handleApplyCoupon} 
                          disabled={validatingCoupon || !couponCode}
                          variant="outline"
                          className="border-2 font-bold px-6"
                        >
                          {validatingCoupon ? '...' : 'Apply'}
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-green-50 border-2 border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={18} className="text-green-600" />
                          <span className="font-bold tracking-wide">{appliedCoupon.code} applied!</span>
                        </div>
                        <button onClick={handleRemoveCoupon} className="text-sm text-red-600 hover:text-red-800 font-bold uppercase tracking-wider bg-red-50 px-2 py-1 rounded">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Price Calculation */}
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="font-medium">Plan Subtotal</span>
                    <span className="font-bold text-gray-900">₹{plan.price.toLocaleString()}</span>
                  </div>
                  
                  {appliedCoupon && (
                    <div className="flex justify-between items-center text-green-600 bg-green-50/50 p-2 -mx-2 rounded">
                      <span className="font-medium flex items-center gap-1">
                        <Tag size={14} /> Discount ({appliedCoupon.code})
                      </span>
                      <span className="font-bold">-₹{Math.floor(discountAmount).toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="border-t-2 border-dashed border-gray-200 pt-4 flex justify-between items-end mt-2">
                    <div>
                      <span className="block font-bold text-lg text-gray-900">Total Amount</span>
                      <span className="text-xs text-gray-500">Includes all taxes and fees</span>
                    </div>
                    <span className="font-bold text-4xl text-primary tracking-tight">₹{Math.floor(finalPrice).toLocaleString()}</span>
                  </div>
                </div>

                {/* Terms checkbox */}
                <div className="mb-6 flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      id="terms"
                      className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                  </div>
                  <label htmlFor="terms" className="text-sm text-gray-600 cursor-pointer select-none">
                    I agree to the <a href="/terms" target="_blank" className="text-primary font-medium hover:underline">Terms of Service</a> and <a href="/privacy-policy" target="_blank" className="text-primary font-medium hover:underline">Privacy Policy</a>. No refunds after successful activation.
                  </label>
                </div>

                <Button 
                  fullWidth 
                  size="lg" 
                  onClick={handleCheckout} 
                  disabled={processing || !agreedToTerms || (!isFreePlan && !activeGateway)}
                  className={`py-4 shadow-xl text-lg relative overflow-hidden group ${agreedToTerms ? 'hover:-translate-y-1' : ''} transition-all duration-300`}
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  {processing && !showMockGateway ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processing...
                    </span>
                  ) : !isFreePlan && !activeGateway ? (
                    <span className="flex items-center justify-center gap-2 font-bold">
                      <Lock size={18} /> Gateway Offline
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 font-bold tracking-wide">
                      <Lock size={18} /> {isFreePlan ? 'Activate Plan' : `Pay ₹${Math.floor(finalPrice).toLocaleString()}`}
                    </span>
                  )}
                </Button>
                
                <div className="mt-6 flex flex-col items-center justify-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-6">
                  <div className="flex items-center gap-1.5 font-medium text-gray-600">
                    <Shield size={16} className="text-green-600" />
                    <span>Bank-Grade 256-bit SSL Encryption</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="px-3 py-1 bg-gray-100 rounded text-gray-600 font-bold tracking-wider">VISA</div>
                    <div className="px-3 py-1 bg-gray-100 rounded text-gray-600 font-bold tracking-wider">MASTERCARD</div>
                    <div className="px-3 py-1 bg-gray-100 rounded text-gray-600 font-bold tracking-wider">UPI</div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-4">
              <AlertCircle className="text-blue-600 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-blue-900 mb-1">Need help?</h4>
                <p className="text-xs text-blue-700">If you encounter any issues during payment, please contact our support team at <span className="font-bold">{supportEmail}</span> or call <span className="font-bold">{supportPhone}</span>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Professional Mock Payment Gateway Modal */}
      {showMockGateway && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-slide-up">
            <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Secure Payment</h3>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Test Environment</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Amount to pay</p>
                <p className="text-xl font-bold text-gray-900">₹{Math.floor(Math.max(0, plan.price - (plan.price * ((appliedCoupon?.discount_type === 'percentage' ? appliedCoupon.discount_value : 0) / 100) + (appliedCoupon?.discount_type === 'fixed' ? appliedCoupon.discount_value : 0)))).toLocaleString()}</p>
              </div>
            </div>
            
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <CreditCard size={32} className="text-blue-500" />
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full animate-[spin_3s_linear_infinite] border-t-blue-500"></div>
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Simulated Gateway</h4>
              <p className="text-gray-500 text-sm mb-8">
                You are using a test API key. Click below to simulate a successful payment or cancel to return to checkout.
              </p>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={handleMockPaymentCancel}
                  className="py-3"
                >
                  Cancel
                </Button>
                <Button 
                  fullWidth 
                  onClick={handleMockPaymentSuccess}
                  className="py-3 bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                >
                  Simulate Success
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2 border-t border-gray-100">
              <Lock size={12} /> 256-bit SSL Encrypted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
