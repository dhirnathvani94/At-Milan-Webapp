import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, FileText, BarChart3, TrendingUp, Users,
  Download, Search, ChevronLeft, ChevronRight, Calendar,
  Receipt, Crown, ArrowUpRight, IndianRupee, Printer, User, X, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../lib/utils';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

// ── Date preset helpers ─────────────────────────────────────────────────────
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());
const startOf = (d: Date) => { const r = new Date(d); r.setDate(1); return fmt(r); };
const DATE_PRESETS = [
  { label: 'Today',       from: () => today(),                              to: () => today() },
  { label: 'This Week',   from: () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return fmt(d); }, to: () => today() },
  { label: 'This Month',  from: () => startOf(new Date()),                  to: () => today() },
  { label: 'Last Month',  from: () => { const d=new Date(); d.setMonth(d.getMonth()-1); return startOf(d); },
                          to: () => { const d=new Date(); d.setDate(0); return fmt(d); } },
  { label: 'This Quarter',from: () => { const d=new Date(); const q=Math.floor(d.getMonth()/3); const s=new Date(d.getFullYear(),q*3,1); return fmt(s); }, to: () => today() },
  { label: 'This Year',   from: () => `${new Date().getFullYear()}-01-01`,  to: () => today() },
  { label: 'All Time',    from: () => '',                                   to: () => '' },
];

type FinancialTab = 'analytics' | 'users' | 'subscriptions' | 'transactions' | 'invoices';

export default function AdminFinancials() {
  const { admin_settings_kv } = useMasterData();
  const getSetting = (key: string, fallback: string) =>
    admin_settings_kv?.find((s: any) => s.key === key)?.value || fallback;
  const brandName    = getSetting('platform_name',   'AtMilan');
  const brandTagline = getSetting('company_tagline', 'Premium Matrimonial Platform');
  const brandEmail   = getSetting('contact_email',   'support@atmilan.com');
  const brandWebsite = getSetting('company_website', 'www.atmilan.com');
  const brandGSTIN   = getSetting('company_gstin',   '');
  const brandPrefix  = getSetting('invoice_prefix',  'AM');
  const brandLogo    = getSetting('invoice_logo',     '');
  const brandInitials = brandName.substring(0, 2).toUpperCase();
  const [activeTab, setActiveTab] = useState<FinancialTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsFromDate, setAnalyticsFromDate] = useState('');
  const [analyticsToDate, setAnalyticsToDate] = useState('');

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subTotalCount, setSubTotalCount] = useState(0);
  const [subStatusFilter, setSubStatusFilter] = useState('');

  const [transactions, setTransactions] = useState<any[]>([]);
  const [txnTotalCount, setTxnTotalCount] = useState(0);
  const [txnTypeFilter, setTxnTypeFilter] = useState('');
  const [txnStatusFilter, setTxnStatusFilter] = useState('');
  const [txnFromDate, setTxnFromDate] = useState('');
  const [txnToDate, setTxnToDate] = useState('');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [invTotalCount, setInvTotalCount] = useState(0);
  const [invFromDate, setInvFromDate] = useState('');
  const [invToDate, setInvToDate] = useState('');

  const [userSummaries, setUserSummaries] = useState<any[]>([]);
  const [userTotalCount, setUserTotalCount] = useState(0);
  const [userSearch, setUserSearch] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedUserPayments, setSelectedUserPayments] = useState<string | null>(null);
  const [userPaymentLoading, setUserPaymentLoading] = useState(false);
  const [userPaymentData, setUserPaymentData] = useState<any>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (analyticsFromDate) params.set('from_date', analyticsFromDate);
      if (analyticsToDate) params.set('to_date', analyticsToDate);
      const res = await fetch(apiUrl(`/api/admin/financial/analytics?${params.toString()}`));
      if (!res.ok) throw new Error('Failed');
      setAnalytics(await res.json());
    } catch (e) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [analyticsFromDate, analyticsToDate]);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (subStatusFilter) params.set('status', subStatusFilter);
      const res = await fetch(apiUrl(`/api/admin/financial/subscriptions?${params.toString()}`));
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSubscriptions(data.subscriptions);
      setSubTotalCount(data.totalCount);
    } catch (e) {
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [page, subStatusFilter]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (txnTypeFilter) params.set('type', txnTypeFilter);
      if (txnStatusFilter) params.set('status', txnStatusFilter);
      if (txnFromDate) params.set('from_date', txnFromDate);
      if (txnToDate) params.set('to_date', txnToDate);
      const res = await fetch(apiUrl(`/api/admin/financial/transactions?${params.toString()}`));
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTransactions(data.transactions);
      setTxnTotalCount(data.totalCount);
    } catch (e) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, txnTypeFilter, txnStatusFilter, txnFromDate, txnToDate]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (invFromDate) params.set('from_date', invFromDate);
      if (invToDate) params.set('to_date', invToDate);
      const res = await fetch(apiUrl(`/api/admin/financial/invoices?${params.toString()}`));
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setInvoices(data.invoices);
      setInvTotalCount(data.totalCount);
    } catch (e) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [page, invFromDate, invToDate]);

  const fetchUserSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (userSearch) params.set('search', userSearch);
      const res = await fetch(apiUrl(`/api/admin/financial/user-summaries?${params.toString()}`));
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setUserSummaries(data.users);
      setUserTotalCount(data.totalCount);
    } catch (e) {
      toast.error('Failed to load user summaries');
    } finally {
      setLoading(false);
    }
  }, [page, userSearch]);

  const fetchUserPayments = async (userId: string) => {
    setUserPaymentLoading(true);
    setSelectedUserPayments(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/financial/user/${userId}`));
      if (!res.ok) throw new Error('Failed');
      setUserPaymentData(await res.json());
    } catch (e) {
      toast.error('Failed to load user payments');
    } finally {
      setUserPaymentLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab, subStatusFilter, txnTypeFilter, txnStatusFilter, txnFromDate, txnToDate, invFromDate, invToDate, userSearch]);

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    else if (activeTab === 'users') fetchUserSummaries();
    else if (activeTab === 'subscriptions') fetchSubscriptions();
    else if (activeTab === 'transactions') fetchTransactions();
    else if (activeTab === 'invoices') fetchInvoices();
  }, [activeTab, page, fetchAnalytics, fetchSubscriptions, fetchTransactions, fetchInvoices, fetchUserSummaries]);

  const formatCurrency = (amount: number) => '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const downloadSingleInvoice = (inv: any) => {
    const invDate = inv.created_at ? new Date(inv.created_at) : new Date();
    const userName = inv.user?.first_name ? `${inv.user.first_name} ${inv.user.last_name || ''}`.trim() : 'Customer';
    const userEmail = inv.user?.email || '-';
    const profileId = inv.user?.profile_id || inv.user_id || '-';
    const isMembership = inv.type === 'membership_purchase' || inv.type === 'membership';
    const planLabel = isMembership ? `${inv.plan_name || 'Membership'} Plan` : `${inv.plan_name || 'Credit Pack'}`;
    const totalAmt = inv.amount || 0;
    const gstAmt = inv.gst_amount || Math.round((totalAmt - totalAmt / 1.18) * 100) / 100;
    const baseAmt = Math.round((totalAmt - gstAmt) * 100) / 100;
    const cgst = (gstAmt / 2).toFixed(2);
    const creditsLine = inv.credits ? `<tr><td style="padding:12px 16px;border-bottom:1px solid #f0ebe7;font-size:14px">Credits Included</td><td style="padding:12px 16px;border-bottom:1px solid #f0ebe7;font-weight:600;font-size:14px">${inv.credits} Credits</td><td style="padding:12px 16px;border-bottom:1px solid #f0ebe7;text-align:right;font-size:14px">—</td><td style="padding:12px 16px;border-bottom:1px solid #f0ebe7;text-align:right">—</td></tr>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${inv.invoice_number} - ${brandName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#333;background:#fff}
.invoice{max-width:800px;margin:0 auto;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #8B1A1A;padding-bottom:24px;margin-bottom:32px}
.brand{display:flex;align-items:center;gap:12px}
.brand-icon{width:48px;height:48px;background:linear-gradient(135deg,#8B1A1A,#B22222);border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:bold}
.brand-name{font-size:26px;font-weight:800;color:#8B1A1A}
.brand-tagline{font-size:11px;color:#999;letter-spacing:1px;text-transform:uppercase}
.brand-gstin{font-size:11px;color:#777;margin-top:6px;line-height:1.7}
.inv-meta{text-align:right}
.inv-meta h2{font-size:26px;color:#8B1A1A;font-weight:800;text-transform:uppercase;letter-spacing:2px}
.inv-meta p{font-size:13px;color:#666;margin-top:3px}
.paid-badge{display:inline-block;background:#d1fae5;color:#065f46;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;margin-top:4px}
.details-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
.detail-box{background:#faf7f5;border-radius:12px;padding:18px;border:1px solid #f0e8e2}
.detail-box h4{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:8px}
.detail-box p{font-size:13px;color:#444;line-height:1.7}
.detail-box p strong{color:#111}
table{width:100%;border-collapse:collapse;margin-bottom:28px}
thead th{background:#8B1A1A;color:white;padding:13px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.8px}
thead th:last-child{text-align:right}
tbody td{padding:12px 16px;border-bottom:1px solid #f0ebe7;font-size:13px;color:#374151}
tbody td:last-child{text-align:right;font-weight:600}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:32px}
.totals-box{width:290px;border:1px solid #f0ebe7;border-radius:12px;overflow:hidden}
.totals-box tr td{padding:9px 16px;font-size:13px;border-bottom:1px solid #f0ebe7}
.totals-box tr td:last-child{text-align:right;font-weight:600}
.totals-box tr:last-child td{border-bottom:none;font-size:17px;font-weight:800;color:#8B1A1A;background:#faf7f5}
.footer{text-align:center;padding-top:24px;border-top:2px solid #f0ebe7}
.footer .thanks{font-size:15px;color:#8B1A1A;font-weight:700;margin-bottom:6px}
.footer p{font-size:11px;color:#999;line-height:1.8}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.invoice{padding:20px}}
</style></head>
<body><div class="invoice">
  <div class="header">
    <div class="brand">
      ${brandLogo ? `<img src="${brandLogo}" style="height:48px;object-fit:contain;border-radius:8px;" />` : `<div class="brand-icon">${brandInitials}</div>`}
      <div>
        <div class="brand-name">${brandName}</div>
        <div class="brand-tagline">${brandTagline}</div>
        <div class="brand-gstin">${brandGSTIN ? `GSTIN: ${brandGSTIN} | SAC: 9997<br/>` : ''}${brandEmail}</div>
      </div>
    </div>
    <div class="inv-meta">
      <h2>Invoice</h2>
      <p><strong>No:</strong> ${inv.invoice_number || 'N/A'}</p>
      <p><strong>Date:</strong> ${invDate.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
      <span class="paid-badge">✓ PAID</span>
    </div>
  </div>

  <div class="details-grid">
    <div class="detail-box">
      <h4>Billed To</h4>
      <p><strong>${userName}</strong></p>
      <p>Profile ID: ${profileId}</p>
      <p>${userEmail}</p>
    </div>
    <div class="detail-box">
      <h4>Plan Details</h4>
      <p><strong>${planLabel}</strong></p>
      <p>Payment Method: ${(inv.payment_method||'Online').charAt(0).toUpperCase()+(inv.payment_method||'online').slice(1)}</p>
      <p>Date: ${invDate.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Amount</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>${brandName} – ${planLabel}</strong><br/><span style="color:#888;font-size:11px">Ref: ${inv.invoice_number}</span></td>
        <td style="color:#888">9997</td>
        <td>1</td>
        <td>₹${baseAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
      </tr>
      ${creditsLine}
      <tr style="color:#888;font-size:12px">
        <td colspan="3">CGST @ 9%</td><td>₹${cgst}</td>
      </tr>
      <tr style="color:#888;font-size:12px">
        <td colspan="3">SGST @ 9%</td><td>₹${cgst}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-box">
      <tr><td>Subtotal (excl. GST)</td><td>₹${baseAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
      <tr><td>Total GST (18%)</td><td>₹${gstAmt.toFixed(2)}</td></tr>
      <tr><td>Total Paid</td><td>₹${totalAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p class="thanks">Thank you for choosing ${brandName}! 🙏</p>
    <p>This is a computer-generated invoice and does not require a signature.</p>
    <p>For queries: ${brandEmail}${brandWebsite ? ` | ${brandWebsite}` : ''}</p>
  </div>
</div></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600); }
    toast.success('Invoice opened — Print to save as PDF');
  };



  const exportToExcel = (data: any[], filename: string, title: string) => {
    if (!data.length) return toast.error('No data to export');
    const clean = data.map(row => {
      const r: any = {};
      Object.entries(row).forEach(([k, v]) => {
        if (k === 'user' || k === 'documents') return;
        r[k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())] = typeof v === 'object' ? '' : v ?? '';
      });
      return r;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(clean);
    // Style header row width
    const cols = Object.keys(clean[0] || {}).map(() => ({ wch: 20 }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Excel file downloaded!');
  };

  const exportAnalyticsExcel = () => {
    if (!analytics) return toast.error('No analytics data');
    const wb = XLSX.utils.book_new();
    // Summary sheet
    const summary = [
      { Metric: 'Total Revenue', Value: analytics.totalRevenue },
      { Metric: 'Credit Revenue', Value: analytics.creditRevenue },
      { Metric: 'Membership Revenue', Value: analytics.membershipRevenue },
      { Metric: 'Total Transactions', Value: analytics.totalTransactions },
      { Metric: 'Active Subscriptions', Value: analytics.activeSubscriptions },
      { Metric: 'Credit Purchases', Value: analytics.creditPurchasesCount },
      { Metric: 'Membership Purchases', Value: analytics.membershipPurchasesCount },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    // Monthly sheet
    if (analytics.monthlyRevenue?.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.monthlyRevenue), 'Monthly Revenue');
    }
    XLSX.writeFile(wb, `financial_report_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Analytics Excel downloaded!');
  };

  const exportToPDF = (data: any[], filename: string, title: string) => {
    if (!data.length) return toast.error('No data to export');
    const headers = Object.keys(data[0]).filter(k => !['user','documents'].includes(k));
    const th = (h: string) => `<th style="background:#7c3aed;color:#fff;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap">${h.replace(/_/g,' ')}</th>`;
    const td = (v: any) => `<td style="padding:9px 12px;font-size:12px;border-bottom:1px solid #f3f4f6;color:#374151">${(typeof v==='object'||v===null||v===undefined)?'-':v}</td>`;
    const rows = data.map(row=>`<tr style="background:#fff">${headers.map(h=>td(row[h])).join('')}</tr>`).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:30px;color:#111}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:16px;margin-bottom:24px}
.brand{font-size:22px;font-weight:800;color:#7c3aed}.sub{font-size:11px;color:#9ca3af}
h1{font-size:18px;color:#1f2937;margin:0 0 4px}p.meta{font-size:11px;color:#9ca3af;margin:0 0 20px}
table{border-collapse:collapse;width:100%}thead tr{background:#7c3aed}
tbody tr:nth-child(even){background:#f9fafb}
.foot{margin-top:30px;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between}
@media print{body{padding:10px}}</style></head>
<body><div class="hdr"><div><div class="brand">${brandName}</div><div class="sub">Matrimony Financial Report</div></div><div style="text-align:right"><div class="sub">${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div></div></div>
<h1>${title}</h1><p class="meta">Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Total records: ${data.length}</p>
<table><thead><tr>${headers.map(th).join('')}</tr></thead><tbody>${rows}</tbody></table>
<div class="foot"><span>${brandName} Matrimony &mdash; Confidential</span><span>Page 1</span></div>
</body></html>`;
    const w=window.open('','_blank');
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),600);}
    toast.success('PDF opened — use browser Print to save as PDF');
  };

  const totalPages = (total: number) => Math.ceil(total / limit);

  const Pagination = ({ total }: { total: number }) => (
    total > limit ? (
      <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
        <p className="text-sm text-gray-500">
          Showing <span className="font-bold">{(page - 1) * limit + 1}</span> to <span className="font-bold">{Math.min(page * limit, total)}</span> of <span className="font-bold">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages(total)} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
        </div>
      </div>
    ) : null
  );

  const tabs: { id: FinancialTab; label: string; icon: any }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'users', label: 'User Payments', icon: User },
    { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2"><IndianRupee size={24} className="text-primary" /> Financial Management</h1>
          <p className="text-gray-500 text-sm">Track revenue, subscriptions, transactions & invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (activeTab === 'analytics') exportAnalyticsExcel();
            else if (activeTab === 'invoices') exportToExcel(invoices, 'invoices', 'Invoices');
            else if (activeTab === 'transactions') exportToExcel(transactions, 'transactions', 'Transactions');
            else if (activeTab === 'subscriptions') exportToExcel(subscriptions, 'subscriptions', 'Subscriptions');
            else if (activeTab === 'users') exportToExcel(userSummaries, 'user_payments', 'User Payments');
          }}><Download size={14} className="mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (activeTab === 'invoices') exportToPDF(invoices, 'invoices', 'Invoices Report');
            else if (activeTab === 'transactions') exportToPDF(transactions, 'transactions', 'Transactions Report');
            else if (activeTab === 'subscriptions') exportToPDF(subscriptions, 'subscriptions', 'Subscriptions Report');
            else if (activeTab === 'users') exportToPDF(userSummaries, 'user_payments', 'User Payments Report');
            else if (activeTab === 'analytics' && analytics) exportToPDF(analytics.monthlyRevenue || [], 'analytics', 'Financial Analytics Report');
          }}><Printer size={14} className="mr-1" /> PDF</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 bg-gray-50/50 rounded-t-xl overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all rounded-t-lg ${
              activeTab === tab.id ? 'text-primary border-primary bg-white shadow-sm' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/60'
            }`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {loading && !analytics && !subscriptions.length && !transactions.length && !invoices.length ? (
        <AdminTableSkeleton />
      ) : (
        <>
          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (

            <div className="space-y-6">
              {/* Date Filters */}
              <Card className="p-4 border-none shadow-sm">
                <div className="space-y-3">
                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1"><Calendar size={12}/> Quick:</span>
                    {DATE_PRESETS.map(p => (
                      <button key={p.label} onClick={() => { setAnalyticsFromDate(p.from()); setAnalyticsToDate(p.to()); }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          analyticsFromDate === p.from() && analyticsToDate === p.to()
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                        }`}>{p.label}</button>
                    ))}
                  </div>
                  {/* Custom range */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                      <input type="date" value={analyticsFromDate} onChange={e => setAnalyticsFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                      <input type="date" value={analyticsToDate} onChange={e => setAnalyticsToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setAnalyticsFromDate(''); setAnalyticsToDate(''); }}>Clear</Button>
                    <Button size="sm" onClick={fetchAnalytics}>Apply</Button>
                  </div>
                </div>
              </Card>

              {/* Revenue Cards */}
              {!analytics ? (
                <AdminTableSkeleton />
              ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <div className="flex items-center justify-between mb-2"><IndianRupee size={20} className="opacity-80" /><ArrowUpRight size={16} className="opacity-60" /></div>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</p>
                  <p className="text-xs uppercase tracking-wider opacity-80 mt-1">Total Revenue</p>
                  <p className="text-xs opacity-60 mt-1">{analytics.totalTransactions} transactions</p>
                </div>
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                  <div className="flex items-center justify-between mb-2"><CreditCard size={20} className="opacity-80" /><ArrowUpRight size={16} className="opacity-60" /></div>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.creditRevenue)}</p>
                  <p className="text-xs uppercase tracking-wider opacity-80 mt-1">Credit Revenue</p>
                  <p className="text-xs opacity-60 mt-1">{analytics.creditPurchasesCount} purchases</p>
                </div>
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#eab308,#d97706)' }}>
                  <div className="flex items-center justify-between mb-2"><Crown size={20} className="opacity-80" /><ArrowUpRight size={16} className="opacity-60" /></div>
                  <p className="text-2xl font-bold">{formatCurrency(analytics.membershipRevenue)}</p>
                  <p className="text-xs uppercase tracking-wider opacity-80 mt-1">Membership Revenue</p>
                  <p className="text-xs opacity-60 mt-1">{analytics.membershipPurchasesCount} plans sold</p>
                </div>
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)' }}>
                  <div className="flex items-center justify-between mb-2"><Users size={20} className="opacity-80" /><TrendingUp size={16} className="opacity-60" /></div>
                  <p className="text-2xl font-bold">{analytics.activeSubscriptions}</p>
                  <p className="text-xs uppercase tracking-wider opacity-80 mt-1">Active Subscriptions</p>
                  <p className="text-xs opacity-60 mt-1">Avg: {formatCurrency(analytics.totalTransactions > 0 ? analytics.totalRevenue / analytics.totalTransactions : 0)} / txn</p>
                </div>
              </div>
              )}

              {/* Monthly Revenue Chart */}
              {analytics && <Card className="p-6 border-none shadow-sm">

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><TrendingUp size={18} className="text-primary" /> Monthly Revenue (Last 12 Months)</h3>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block"/>Total</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block"/>Credits</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"/>Membership</span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {analytics.monthlyRevenue?.map((m: any) => {
                    const maxTotal = Math.max(...analytics.monthlyRevenue.map((r: any) => r.total), 1);
                    const totalW = Math.max((m.total / maxTotal) * 100, m.total > 0 ? 2 : 0);
                    const creditW = m.total > 0 ? Math.max((m.credit_revenue / m.total) * totalW, 0) : 0;
                    const memberW = m.total > 0 ? Math.max((m.membership_revenue / m.total) * totalW, 0) : 0;
                    return (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-16 shrink-0 font-mono">{m.month?.slice(0,7)}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative flex">
                          <div className="h-full bg-blue-400 transition-all" style={{ width: `${creditW}%` }} title={`Credits: ${formatCurrency(m.credit_revenue)}`}/>
                          <div className="h-full bg-amber-400 transition-all" style={{ width: `${memberW}%` }} title={`Membership: ${formatCurrency(m.membership_revenue)}`}/>
                          <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-gray-700">{m.total > 0 ? formatCurrency(m.total) : <span className="text-gray-400">₹0</span>}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>}

              {/* Summary Stats */}
              {analytics && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <Card className="p-6 border-none shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-blue-500" /> Payment Methods</h3>
                  {Object.keys(analytics.paymentMethods || {}).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(analytics.paymentMethods).map(([method, amount]: [string, any]) => (
                        <div key={method} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium capitalize">{method}</span>
                          <span className="text-sm font-bold">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No payment data available</p>
                  )}
                </Card>
                <Card className="p-6 border-none shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-purple-500" /> Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Total Transactions</span>
                      <span className="text-sm font-bold">{analytics.totalTransactions}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Credit Purchases</span>
                      <span className="text-sm font-bold">{analytics.creditPurchasesCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Membership Purchases</span>
                      <span className="text-sm font-bold">{analytics.membershipPurchasesCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Avg. Transaction Value</span>
                      <span className="text-sm font-bold">{formatCurrency(analytics.totalTransactions > 0 ? analytics.totalRevenue / analytics.totalTransactions : 0)}</span>
                    </div>
                  </div>
                </Card>
              </div>}
            </div>
          )}





          {/* USER PAYMENTS TAB */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary" />
                </div>
              </div>
              <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Total Spent</th>
                        <th className="px-6 py-4">Credit Purchases</th>
                        <th className="px-6 py-4">Memberships</th>
                        <th className="px-6 py-4">Active Plan</th>
                        <th className="px-6 py-4">Last Payment</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan={8} className="p-0"><AdminTableSkeleton /></td></tr>
                      ) : userSummaries.length > 0 ? userSummaries.map((u: any) => (
                        <tr key={u.user_id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <Link to={`/admin/users/${u.user_id}`} className="font-medium text-sm text-gray-900 hover:text-primary">
                              {u.first_name || 'Unknown'} {u.last_name || ''}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                          <td className="px-6 py-4 text-sm font-bold text-green-600">{formatCurrency(u.total_spent)}</td>
                          <td className="px-6 py-4 text-sm">{u.credit_purchases_count}</td>
                          <td className="px-6 py-4 text-sm">{u.membership_purchases_count}</td>
                          <td className="px-6 py-4">
                            {u.active_subscription ? <Badge variant="primary">{u.active_subscription}</Badge> : <span className="text-xs text-gray-400">None</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.last_payment_date ? formatDate(u.last_payment_date) : '-'}</td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="outline" size="sm" onClick={() => fetchUserPayments(u.user_id)} className="rounded-full">
                              <Eye size={14} className="mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No paying users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={userTotalCount} />
              </Card>
            </div>
          )}

          {/* SUBSCRIPTIONS TAB */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <select value={subStatusFilter} onChange={e => setSubStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportToExcel(subscriptions, 'subscriptions', 'Subscriptions')}><Download size={14} className="mr-1" /> Excel</Button>
                  <Button variant="outline" size="sm" onClick={() => exportToPDF(subscriptions, 'subscriptions', 'Subscriptions Report')}><FileText size={14} className="mr-1" /> PDF</Button>
                </div>
              </div>
              <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-4">User</th>
                        <th className="px-4 py-4">Profile ID</th>
                        <th className="px-4 py-4">Plan</th>
                        <th className="px-4 py-4">Plan Price</th>
                        <th className="px-4 py-4">Free Views Left</th>
                        <th className="px-4 py-4">Paid Credits</th>
                        <th className="px-4 py-4">Start Date</th>
                        <th className="px-4 py-4">Expires</th>
                        <th className="px-4 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan={9} className="p-0"><AdminTableSkeleton /></td></tr>
                      ) : subscriptions.length > 0 ? subscriptions.map((s: any) => {
                        const planName = s.plan?.name || s.plan_id || '-';
                        const planPrice = s.plan?.price != null ? formatCurrency(s.plan.price) : '-';
                        const isPlanFree = (s.plan?.price === 0) || (s.plan_id === 'free');
                        const isActive = s.status === 'active';
                        const isExpired = s.expires_at && new Date(s.expires_at) < new Date();
                        const statusLabel = isExpired ? 'expired' : (s.status || 'active');
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                {s.user?.profile_photo_url ? (
                                  <img src={s.user.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><User size={14} className="text-primary" /></div>
                                )}
                                <div>
                                  <Link to={`/admin/users/${s.user_id}`} className="font-medium text-sm text-gray-900 hover:text-primary block">
                                    {s.user?.first_name || 'Unknown'} {s.user?.last_name || ''}
                                  </Link>
                                  <span className="text-xs text-gray-400">{s.user?.email || s.user_id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-mono text-gray-500">{s.user?.profile_id || '-'}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                isPlanFree ? 'bg-gray-100 text-gray-600' :
                                planName === 'Gold' ? 'bg-amber-100 text-amber-700' :
                                planName === 'Platinum' ? 'bg-purple-100 text-purple-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {isPlanFree ? '' : <Crown size={10} />} {planName}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm font-semibold text-gray-700">{planPrice}</td>
                            <td className="px-4 py-4 text-sm text-gray-600">{s.free_views_remaining ?? '-'}</td>
                            <td className="px-4 py-4 text-sm text-gray-600">{s.paid_views_balance ?? s.user?.paid_credits ?? '-'}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{formatDate(s.created_at)}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">{s.expires_at ? formatDate(s.expires_at) : <span className="text-gray-300">No Expiry</span>}</td>
                            <td className="px-4 py-4">
                              <Badge variant={isExpired ? 'warning' : isActive ? 'success' : 'danger'}>
                                {statusLabel}
                              </Badge>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">No subscriptions found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={subTotalCount} />
              </Card>
            </div>
          )}


          {/* TRANSACTIONS TAB */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select value={txnTypeFilter} onChange={e => setTxnTypeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary">
                    <option value="">All Types</option>
                    <option value="credit">Credit Purchase</option>
                    <option value="membership">Membership</option>
                  </select>
                  <select value={txnStatusFilter} onChange={e => setTxnStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary">
                    <option value="">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                  <input type="date" value={txnFromDate} onChange={e => setTxnFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" placeholder="From" />
                  <input type="date" value={txnToDate} onChange={e => setTxnToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" placeholder="To" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportToExcel(transactions, 'transactions', 'Transactions')}><Download size={14} className="mr-1" /> Excel</Button>
                  <Button variant="outline" size="sm" onClick={() => exportToPDF(transactions, 'transactions', 'Transactions Report')}><FileText size={14} className="mr-1" /> PDF</Button>
                </div>
              </div>
              <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Payment</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan={7} className="p-0"><AdminTableSkeleton /></td></tr>
                      ) : transactions.length > 0 ? transactions.map((t: any) => (
                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <Link to={`/admin/users/${t.user_id}`} className="font-medium text-sm text-gray-900 hover:text-primary">
                              {t.user?.first_name || 'Unknown'} {t.user?.last_name || ''}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={t.type === 'credit_purchase' ? 'primary' : 'warning'}>
                              {t.type === 'credit_purchase' ? 'Credit' : 'Membership'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{t.plan_name}</td>
                          <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(t.amount)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 capitalize">{t.payment_method}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(t.created_at)}</td>
                          <td className="px-6 py-4">
                            <Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'danger' : 'warning'}>
                              {t.status}
                            </Badge>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No transactions found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={txnTotalCount} />
              </Card>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="date" value={invFromDate} onChange={e => setInvFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" />
                <input type="date" value={invToDate} onChange={e => setInvToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary" />
                <Button variant="outline" size="sm" onClick={() => { setInvFromDate(''); setInvToDate(''); }}>Clear</Button>
              </div>
              <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4">Invoice #</th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Subtotal</th>
                        <th className="px-6 py-4">GST (18%)</th>
                        <th className="px-6 py-4">Total</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr><td colSpan={8} className="p-0"><AdminTableSkeleton /></td></tr>
                      ) : invoices.length > 0 ? invoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono font-semibold text-primary">{inv.invoice_number}</td>
                          <td className="px-6 py-4">
                            <Link to={`/admin/users/${inv.user_id}`} className="font-medium text-sm text-gray-900 hover:text-primary">
                              {inv.user?.first_name || 'Unknown'} {inv.user?.last_name || ''}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={inv.type === 'credit_purchase' ? 'primary' : 'warning'}>
                              {inv.type === 'credit_purchase' ? 'Credit' : 'Membership'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm">{formatCurrency(inv.subtotal)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatCurrency(inv.gst_amount)}</td>
                          <td className="px-6 py-4 text-sm font-bold">{formatCurrency(inv.amount)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(inv.created_at)}</td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="outline" size="sm" onClick={() => downloadSingleInvoice(inv)} className="rounded-full">
                              <Download size={14} className="mr-1" /> Invoice
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">No invoices found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination total={invTotalCount} />
              </Card>
            </div>
          )}
        </>
      )}

      {/* User Payment History — hook-free inline drawer */}
      {!!selectedUserPayments && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setSelectedUserPayments(null); setUserPaymentData(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl z-10">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Receipt size={18} className="text-primary" /> User Payment History</h3>
              <button onClick={() => { setSelectedUserPayments(null); setUserPaymentData(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Close">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              {userPaymentLoading ? (
                <AdminTableSkeleton />
              ) : userPaymentData ? (
                <div className="space-y-5">
                  {/* User Info */}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {userPaymentData.user?.first_name?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{userPaymentData.user?.first_name || 'Unknown'} {userPaymentData.user?.last_name || ''}</h3>
                      <p className="text-sm text-gray-500">{userPaymentData.user?.email || '-'}</p>
                    </div>
                    <Link to={`/admin/users/${selectedUserPayments}`}>
                      <Button variant="outline" size="sm">View Profile</Button>
                    </Link>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Spent', value: formatCurrency(userPaymentData.summary?.total_spent || 0), color: 'text-green-600' },
                      { label: 'Total GST', value: formatCurrency(userPaymentData.summary?.total_gst || 0), color: 'text-orange-600' },
                      { label: 'Payments', value: userPaymentData.summary?.total_payments || 0, color: 'text-blue-600' },
                      { label: 'Credits Bought', value: userPaymentData.summary?.total_credits_bought || 0, color: 'text-purple-600' },
                    ].map((s, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-[10px] uppercase text-gray-400 font-bold">{s.label}</p>
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Payment List */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Receipt size={16} className="text-primary" /> All Payments ({userPaymentData.payments?.length || 0})</h4>
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {(userPaymentData.payments || []).map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.type === 'credit_purchase' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                              {p.type === 'credit_purchase' ? <CreditCard size={16} /> : <Crown size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{p.plan_name}</p>
                              <p className="text-[11px] text-gray-400">{p.invoice_number} &middot; {formatDate(p.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold">{formatCurrency(p.amount)}</p>
                              <p className="text-[10px] text-gray-400">GST: {formatCurrency(p.gst_amount)}</p>
                            </div>
                            <Badge variant={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge>
                            <Button variant="outline" size="sm" onClick={() => downloadSingleInvoice({ ...p, user: userPaymentData.user, user_id: selectedUserPayments })} className="rounded-full px-2">
                              <Download size={13} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!userPaymentData.payments || userPaymentData.payments.length === 0) && (
                        <p className="text-center text-gray-400 py-8">No payments found</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
