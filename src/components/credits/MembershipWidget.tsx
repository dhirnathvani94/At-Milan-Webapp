import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Calendar, Clock, Download, XCircle, Shield, Lock, Star, ChevronRight, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useMasterData } from '../../store/masterDataStore'
import Card from '../ui/Card'
import Button from '../ui/Button'
import toast from 'react-hot-toast'
import { apiUrl } from '../../lib/api'

export const PLAN_DETAILS: Record<string, { price: string; numericPrice: number; period: string; color: string; features: string[] }> = {
  'Silver': {
    price: '₹999',
    numericPrice: 999,
    period: '3 months',
    color: 'text-blue-600',
    features: ['Send 15 interests/day', 'View contact details', 'Chat with matches', 'Advanced search filters']
  },
  'Gold': {
    price: '₹1,999',
    numericPrice: 1999,
    period: '6 months',
    color: 'text-primary',
    features: ['Unlimited interests', 'Profile highlighter', 'Priority search', 'Verified badge', 'See who viewed you']
  },
  'Platinum': {
    price: '₹2,999',
    numericPrice: 2999,
    period: '1 year',
    color: 'text-secondary-700',
    features: ['Personal matchmaker', 'Profile boost (3x)', 'Featured badge', 'Priority support', 'Video call']
  }
}

export function generateInvoiceHTML(profile: any, planName: string, premiumEnd: string | null, companyInfo?: { name?: string; tagline?: string; email?: string; website?: string; gstin?: string; invoicePrefix?: string; logoUrl?: string }) {
  const plan = PLAN_DETAILS[planName] || PLAN_DETAILS['Gold']
  const endDate = premiumEnd ? new Date(premiumEnd) : new Date()
  const periodMonths = planName === 'Silver' ? 3 : planName === 'Gold' ? 6 : 12
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - periodMonths)
  
  const brand = companyInfo?.name || 'AtMilan'
  const prefix = companyInfo?.invoicePrefix || 'AM'
  const invoiceNo = `${prefix}-${Date.now().toString(36).toUpperCase()}`
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const totalAmount = plan.numericPrice
  const baseAmount = Math.round((totalAmount / 1.18) * 100) / 100
  const gstAmount = Math.round((totalAmount - baseAmount) * 100) / 100

  const logoSection = companyInfo?.logoUrl
    ? `<img src="${companyInfo.logoUrl}" alt="Logo" style="height:48px; object-fit:contain;" />`
    : `<div class="brand-icon">${brand.substring(0, 2).toUpperCase()}</div>`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${brand} - Invoice</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; background: #fff; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8B1A1A; padding-bottom: 24px; margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #8B1A1A, #B22222); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
    .brand-name { font-size: 28px; font-weight: 800; color: #8B1A1A; }
    .brand-tagline { font-size: 11px; color: #999; letter-spacing: 1px; text-transform: uppercase; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 28px; color: #8B1A1A; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-meta p { font-size: 13px; color: #666; margin-top: 4px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .detail-box { background: #faf7f5; border-radius: 12px; padding: 20px; border: 1px solid #f0e8e2; }
    .detail-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 8px; }
    .detail-box p { font-size: 14px; color: #333; line-height: 1.6; }
    .detail-box p strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    thead th { background: #8B1A1A; color: white; padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; text-align: right; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #f0ebe7; font-size: 14px; }
    tbody td:last-child { text-align: right; font-weight: 600; }
    .total-row { background: #faf7f5; }
    .total-row td { font-weight: 700; font-size: 16px; color: #8B1A1A; border-bottom: none; }
    .footer { text-align: center; padding-top: 32px; border-top: 2px solid #f0ebe7; }
    .footer p { font-size: 12px; color: #999; line-height: 1.8; }
    .footer .thanks { font-size: 16px; color: #8B1A1A; font-weight: 700; margin-bottom: 8px; }
    .badge { display: inline-block; background: linear-gradient(135deg, #D4AF37, #C5960A); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .invoice { padding: 20px; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        ${logoSection}
        <div>
          <div class="brand-name">${brand}</div>
          <div class="brand-tagline">Premium Matrimonial Platform</div>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>Invoice</h2>
        <p><strong>No:</strong> ${invoiceNo}</p>
        <p><strong>Date:</strong> ${today}</p>
      </div>
    </div>

    <div class="details-grid">
      <div class="detail-box">
        <h4>Billed To</h4>
        <p><strong>${profile?.first_name || ''} ${profile?.last_name || ''}</strong></p>
        <p>Profile ID: ${profile?.profile_id || profile?.id || 'N/A'}</p>
        <p>Member Since: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'N/A'}</p>
      </div>
      <div class="detail-box">
        <h4>Plan Details</h4>
        <p><strong>${planName} Plan</strong> <span class="badge">${planName}</span></p>
        <p>Valid: ${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
        <p>Duration: ${plan.period}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${brand} ${planName} Membership</strong><br>
            <span style="color: #888; font-size: 12px;">${plan.period} subscription · ${plan.features.join(' · ')}</span>
          </td>
          <td>₹${baseAmount.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td>CGST (9%)</td>
          <td>₹${(gstAmount / 2).toFixed(2)}</td>
        </tr>
        <tr>
          <td>SGST (9%)</td>
          <td>₹${(gstAmount / 2).toFixed(2)}</td>
        </tr>
        <tr style="border-top: 1px solid #ddd;">
          <td>Total GST (18%)</td>
          <td>₹${gstAmount.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Amount Paid (Incl. GST)</td>
          <td>₹${totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p class="thanks">Thank you for choosing ${brand}! 🙏</p>
      <p>This is a computer-generated invoice and does not require a signature.</p>
      <p>For any queries, contact ${companyInfo?.email || 'support@atmilan.com'}</p>
    </div>
  </div>
</body>
</html>`
}

export default function MembershipWidget() {
  const { profile } = useAuthStore()
  const { admin_settings_kv } = useMasterData()
  const [downloading, setDownloading] = useState(false)
  const [activePurchase, setActivePurchase] = useState<any>(null)

  // Fetch the active membership purchase record to get real purchased date
  useEffect(() => {
    if (!profile?.id || !profile?.is_premium) return
    fetch(apiUrl(`/api/profiles/${profile.id}/complete?_t=${Date.now()}`), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.membership_purchases?.length) return
        // Find the most recent active purchase
        const active = data.membership_purchases
          .filter((mp: any) => mp.status === 'active' || !mp.status)
          .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0]
        if (active) setActivePurchase(active)
      })
      .catch(() => {})
  }, [profile?.id, profile?.is_premium])

  // Get admin-configurable invoice logo (fallback: default SM icon)
  const invoiceLogoSetting = admin_settings_kv?.find((s: any) => s.key === 'invoice_logo')
  const invoiceLogoUrl = invoiceLogoSetting?.value || ''
  const siteNameValue = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan'
  const taglineValue = admin_settings_kv?.find((s: any) => s.key === 'company_tagline')?.value || 'Premium Matrimonial Platform'
  const emailValue = admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com'
  const websiteValue = admin_settings_kv?.find((s: any) => s.key === 'company_website')?.value || 'www.atmilan.com'
  const gstinValue = admin_settings_kv?.find((s: any) => s.key === 'company_gstin')?.value || ''
  const prefixValue = admin_settings_kv?.find((s: any) => s.key === 'invoice_prefix')?.value || 'AM'

  const isPremium = profile?.is_premium || false
  const premiumPlan = profile?.premium_plan || null

  // Use fresh data from activePurchase if available, otherwise fallback to profile
  const actualPremiumEnd = activePurchase?.expires_at 
    ? new Date(activePurchase.expires_at) 
    : (profile?.premium_end ? new Date(profile.premium_end) : null)

  const isPremiumActive = isPremium && actualPremiumEnd && actualPremiumEnd > new Date()

  // Calculate remaining days
  let remainingDays = 0
  if (isPremiumActive && actualPremiumEnd) {
    const now = new Date()
    remainingDays = Math.max(0, Math.ceil((actualPremiumEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  // Calculate purchase date — use real DB record if available, else estimate from premium_end
  // periodMonths: use actual purchase record duration, or parse from plan name, or estimate
  let periodMonths: number
  let purchaseDate: Date | null
  let totalDays = 30

  if (activePurchase?.created_at) {
    // Real purchase record — use actual created_at as purchase date
    purchaseDate = new Date(activePurchase.created_at)
    // Calculate period from actual start and end dates
    if (activePurchase.expires_at) {
      const start = new Date(activePurchase.created_at)
      const end = new Date(activePurchase.expires_at)
      periodMonths = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    } else {
      periodMonths = premiumPlan === 'Silver' ? 3 : premiumPlan === 'Gold' ? 6 : 1
      totalDays = periodMonths * 30
    }
  } else {
    // Fallback: estimate from premium_end
    // Try to parse months from plan name like "Custom (1m)", "Custom (3m)"
    const customMatch = premiumPlan?.match(/\((\d+)m\)/)
    periodMonths = customMatch ? parseInt(customMatch[1]) : (premiumPlan === 'Silver' ? 3 : premiumPlan === 'Gold' ? 6 : premiumPlan === 'Platinum' ? 12 : 1)
    totalDays = periodMonths * 30
    purchaseDate = actualPremiumEnd ? new Date(actualPremiumEnd) : null
    if (purchaseDate) {
      purchaseDate = new Date(purchaseDate)
      purchaseDate.setMonth(purchaseDate.getMonth() - periodMonths)
    }
  }

  const planInfo = premiumPlan ? PLAN_DETAILS[premiumPlan] : null

  const handleDownloadReceipt = async () => {
    if (!premiumPlan || !isPremiumActive) return
    setDownloading(true)
    
    try {
      const html = generateInvoiceHTML(profile, premiumPlan, actualPremiumEnd?.toISOString() || null, {
        name: siteNameValue,
        tagline: taglineValue,
        email: emailValue,
        website: websiteValue,
        gstin: gstinValue,
        invoicePrefix: prefixValue,
        logoUrl: invoiceLogoUrl
      })
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cleanName = siteNameValue.replace(/\s+/g, '')
      a.download = `${cleanName}_Invoice_${premiumPlan}_${Date.now()}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Invoice downloaded! Open in browser and print as PDF.')
    } catch (err) {
      toast.error('Failed to download receipt')
    } finally {
      setTimeout(() => setDownloading(false), 1500)
    }
  }

  const handleCancelMembership = () => {
    toast(`Please contact ${emailValue} to cancel your membership.`, { icon: '📧', duration: 5000 })
  }

  // Free user — show Free Plan label with blurred details
  if (!isPremiumActive) {
    return (
      <Card className="bg-white p-0 overflow-hidden shadow-sm border border-gray-200 relative">
        {/* Header */}
        <div className="bg-[#1A0505] p-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Shield className="text-gold" size={20} />
            My Membership
          </h3>
          <span className="bg-gray-600/40 text-gray-300 border border-gray-500/30 text-xs font-bold px-3 py-1 rounded-full">
            Free Plan
          </span>
        </div>

        {/* Blurred content showing what premium looks like */}
        <div className="relative">
          <div className="blur-[3px] pointer-events-none select-none">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="flex-1 p-6 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Current Plan</p>
                <p className="text-2xl font-bold text-gray-900">Gold Plan</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar size={14} /> Purchased: 25 Jan 2025
                </div>
              </div>
              <div className="flex-1 p-6 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Validity</p>
                <p className="text-2xl font-bold text-gray-900">120 Days Left</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={14} /> Expires: 25 Jul 2025
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <div className="h-10 rounded-full bg-gray-200 flex-1"></div>
              <div className="h-10 rounded-full bg-gray-200 w-40"></div>
            </div>
          </div>
        </div>

        {/* Bottom Upgrade Bar */}
        <div className="bg-gray-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Lock size={16} className="text-gray-400" />
            Upgrade to unlock premium features
          </div>
          <Link to="/membership">
            <Button size="sm" className="bg-saffron text-white border-none hover:bg-saffron/90 rounded-full px-5">
              <Star size={14} className="mr-1" /> Explore Plans
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  // Premium active user
  const elapsedDays = totalDays - remainingDays
  const progressPct = Math.min(100, Math.round((elapsedDays / totalDays) * 100))
  const isExpiringSoon = remainingDays <= 15

  return (
    <Card className="bg-white p-0 overflow-hidden shadow-sm border border-gray-200">
      {/* Header */}
      <div className="bg-[#1A0505] p-4 flex justify-between items-center text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Shield className="text-gold" size={20} />
          My Membership
        </h3>
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-gold/30 to-gold/10 text-gold border border-gold/30 text-xs font-bold px-3 py-1 rounded-full">
            {premiumPlan} Plan
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* LEFT — Plan Info */}
        <div className="flex-1 p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Current Plan</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${planInfo?.color || 'text-gray-900'}`}>{premiumPlan}</span>
              <span className="text-sm text-gray-500">· {planInfo?.price || ''}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <Calendar size={14} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Purchased</p>
                <p className="text-sm font-medium text-gray-800">
                  {purchaseDate?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isExpiringSoon ? 'bg-red-50' : 'bg-blue-50'}`}>
                <Clock size={14} className={isExpiringSoon ? 'text-red-600' : 'text-blue-600'} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Expires</p>
                <p className="text-sm font-medium text-gray-800">
                  {actualPremiumEnd?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Remaining Time */}
        <div className="flex-1 p-6 space-y-4 flex flex-col justify-center">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Remaining Time</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${isExpiringSoon ? 'text-red-600' : 'text-gray-900'}`}>
                {remainingDays}
              </span>
              <span className="text-sm text-gray-500">days left</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  isExpiringSoon
                    ? 'bg-gradient-to-r from-red-400 to-red-600'
                    : 'bg-gradient-to-r from-primary to-primary-700'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, 100 - progressPct))}%` }}
              ></div>
            </div>
            {isExpiringSoon && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                ⚠️ Your plan expires soon! Renew to keep premium benefits.
              </p>
            )}
          </div>

          {/* Features pills */}
          {planInfo && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {planInfo.features.slice(0, 3).map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 font-medium">
                  <CheckCircle size={10} /> {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-gray-50 p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={handleCancelMembership}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1.5 font-medium"
        >
          <XCircle size={16} />
          Cancel Membership
        </button>
        
        <div className="flex items-center gap-3">
          {isExpiringSoon && (
            <Link to="/membership">
              <Button size="sm" className="bg-saffron text-white border-none hover:bg-saffron/90 rounded-full px-5">
                Renew Plan
              </Button>
            </Link>
          )}
          <button
            onClick={handleDownloadReceipt}
            disabled={downloading}
            className="group relative inline-flex items-center gap-2 bg-[#8B1A1A] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#7A1515] transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-70 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
            <Download size={16} className={downloading ? 'animate-bounce' : ''} />
            {downloading ? 'Downloading...' : 'Download Receipt'}
          </button>
        </div>
      </div>
    </Card>
  )
}
