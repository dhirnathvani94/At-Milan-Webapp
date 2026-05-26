import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, Download, TrendingUp, Users, DollarSign, Activity, 
  FileText, Calendar, Crown, ShieldCheck, IndianRupee, AlertCircle,
  Heart, MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { AdminDashboardSkeleton } from '../../components/ui/Skeletons';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

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

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` };
      const [statsRes, analyticsRes] = await Promise.all([
        fetch(apiUrl(`/api/admin/stats?${params.toString()}`), { headers }),
        fetch(apiUrl(`/api/admin/financial/analytics?${params.toString()}`), { headers })
      ]);
      
      if (!statsRes.ok || !analyticsRes.ok) throw new Error('Failed to fetch data');
      
      setStats(await statsRes.json());
      setAnalytics(await analyticsRes.json());
    } catch (e) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) => '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleDownloadExcel = () => {
    if (!stats || !analytics) return toast.error('No data available');
    const wb = XLSX.utils.book_new();
    
    const overview = [
      { Metric: 'Total Users', Value: stats.totalUsers },
      { Metric: 'Active Users', Value: stats.activeUsers },
      { Metric: 'Premium Users', Value: stats.premiumUsers },
      { Metric: 'Verified Users', Value: stats.verifiedUsers },
      { Metric: 'Pending Docs', Value: stats.pendingDocs },
      { Metric: 'Total Revenue', Value: formatCurrency(analytics.totalRevenue) },
      { Metric: 'Credit Revenue', Value: formatCurrency(analytics.creditRevenue) },
      { Metric: 'Membership Revenue', Value: formatCurrency(analytics.membershipRevenue) }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overview), 'Overview');
    
    const demographics = [
      { Metric: 'Male Users', Value: stats.maleUsers },
      { Metric: 'Female Users', Value: stats.femaleUsers }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(demographics), 'Demographics');
    
    if (analytics.monthlyRevenue?.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.monthlyRevenue), 'Monthly Revenue');
    }

    XLSX.writeFile(wb, `analytics_report_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Excel downloaded successfully!');
  };

  const handleDownloadPDF = () => {
    if (!stats || !analytics) return toast.error('No data available');
    
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Analytics Report - ${brandName}</title>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #8B1A1A; margin: 0 0 10px 0; }
  .header p { color: #666; margin: 0; font-size: 14px; }
  .section { margin-bottom: 30px; }
  .section h2 { color: #444; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; font-size: 18px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
  .card { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
  .card-label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
  .card-value { font-size: 20px; font-weight: bold; color: #111827; margin-top: 5px; }
  .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Analytics & Performance Report</h1>
    <p>Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p>Date Range: ${fromDate ? fromDate : 'All Time'} to ${toDate ? toDate : 'All Time'}</p>
  </div>
  
  <div class="section">
    <h2>User Overview</h2>
    <div class="grid">
      <div class="card"><div class="card-label">Total Users</div><div class="card-value">${stats.totalUsers || 0}</div></div>
      <div class="card"><div class="card-label">Active Users</div><div class="card-value">${stats.activeUsers || 0}</div></div>
      <div class="card"><div class="card-label">Premium Users</div><div class="card-value">${stats.premiumUsers || 0}</div></div>
      <div class="card"><div class="card-label">Verified Profiles</div><div class="card-value">${stats.verifiedUsers || 0}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Financial Performance</h2>
    <div class="grid">
      <div class="card"><div class="card-label">Total Revenue</div><div class="card-value">${formatCurrency(analytics.totalRevenue)}</div></div>
      <div class="card"><div class="card-label">Credit Sales</div><div class="card-value">${formatCurrency(analytics.creditRevenue)}</div></div>
      <div class="card"><div class="card-label">Membership Sales</div><div class="card-value">${formatCurrency(analytics.membershipRevenue)}</div></div>
      <div class="card"><div class="card-label">Total Transactions</div><div class="card-value">${analytics.totalTransactions || 0}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Demographics & Compliance</h2>
    <div class="grid">
      <div class="card"><div class="card-label">Male Users</div><div class="card-value">${stats.maleUsers || 0}</div></div>
      <div class="card"><div class="card-label">Female Users</div><div class="card-value">${stats.femaleUsers || 0}</div></div>
      <div class="card"><div class="card-label">Pending Verifications</div><div class="card-value">${stats.pendingDocs || 0}</div></div>
      <div class="card"><div class="card-label">Pending Reports</div><div class="card-value">${stats.pendingReports || 0}</div></div>
    </div>
  </div>
  
  <div class="footer">
    ${brandName} Admin Portal &middot; Professional Analytics Report
  </div>
</body>
</html>`;
    
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
    toast.success('PDF opened — use browser Print to save as PDF');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 size={28} className="text-primary" /> Analytics & Reports
          </h1>
          <p className="text-gray-500 text-sm">Track platform performance and generate professional reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 border-green-500 text-green-700 hover:bg-green-50"
          >
            <FileText size={16} className="text-green-600" />
            Excel Report
          </Button>
          <Button 
            variant="primary" 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-[#8B1A1A] hover:bg-[#721515]"
          >
            <Download size={16} />
            PDF Report
          </Button>
        </div>
      </div>

      {/* Date Filters */}
      <Card className="p-4 border-none shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2 flex items-center gap-1">
              <Calendar size={12} /> Quick Presets:
            </span>
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => { setFromDate(p.from()); setToDate(p.to()); }}
                className="px-3 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">From Date</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-primary focus:border-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">To Date</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-primary focus:border-primary" />
            </div>
            {(fromDate || toDate) && (
              <Button variant="outline" size="sm" onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs px-3 py-1.5 text-red-600 border-red-200 hover:bg-red-50">Clear Filters</Button>
            )}
          </div>
        </div>
      </Card>

      {loading || !stats || !analytics ? (
        <AdminDashboardSkeleton />
      ) : (
        <>
          {/* Main KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-none shadow-sm border-l-4 border-l-blue-500 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Users</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.totalUsers}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500"><Users size={20} /></div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs relative z-10">
                <Badge variant="success" className="px-1.5 py-0">Active: {stats.activeUsers}</Badge>
              </div>
            </Card>

            <Card className="p-5 border-none shadow-sm border-l-4 border-l-purple-500 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Premium Users</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.premiumUsers}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500"><Crown size={20} /></div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs relative z-10">
                <span className="text-gray-500">{((stats.premiumUsers / (stats.totalUsers || 1)) * 100).toFixed(1)}% Conversion Rate</span>
              </div>
            </Card>

            <Card className="p-5 border-none shadow-sm border-l-4 border-l-green-500 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Revenue</p>
                  <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500"><IndianRupee size={20} /></div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs relative z-10">
                <span className="text-gray-500">{analytics.totalTransactions} Total Transactions</span>
              </div>
            </Card>

            <Card className="p-5 border-none shadow-sm border-l-4 border-l-orange-500 relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Verified Profiles</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.verifiedUsers}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500"><ShieldCheck size={20} /></div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs relative z-10">
                {stats.pendingDocs > 0 ? (
                  <span className="text-orange-600 font-medium">{stats.pendingDocs} pending verification</span>
                ) : (
                  <span className="text-gray-500">All up to date</span>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Breakdowns */}
            <Card className="p-6 border-none shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><TrendingUp size={18} className="text-primary" /> Revenue Breakdown</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Credits Revenue</p>
                  <h4 className="text-xl font-bold text-gray-900">{formatCurrency(analytics.creditRevenue)}</h4>
                  <p className="text-xs text-gray-500 mt-1">{analytics.creditPurchasesCount || 0} Packages Sold</p>
                </div>
                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Membership Revenue</p>
                  <h4 className="text-xl font-bold text-gray-900">{formatCurrency(analytics.membershipRevenue)}</h4>
                  <p className="text-xs text-gray-500 mt-1">{analytics.membershipPurchasesCount || 0} Plans Sold</p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-700 mb-3 text-sm">Monthly Revenue Trend</h4>
              <div className="h-64 flex items-end gap-3 pb-2 pt-6">
                {analytics.monthlyRevenue && analytics.monthlyRevenue.length > 0 ? (
                  analytics.monthlyRevenue.map((data: any, i: number) => {
                    const maxTotal = Math.max(...analytics.monthlyRevenue.map((r: any) => r.total), 1);
                    const creditPct = (data.credit_revenue / maxTotal) * 100;
                    const memberPct = (data.membership_revenue / maxTotal) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end group">
                        <div className="w-full flex flex-col justify-end relative cursor-pointer" style={{ height: '100%' }}>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            <div className="font-bold mb-1">{data.month}</div>
                            <div>Credits: {formatCurrency(data.credit_revenue)}</div>
                            <div>Membership: {formatCurrency(data.membership_revenue)}</div>
                            <div className="border-t border-gray-700 mt-1 pt-1 font-bold">Total: {formatCurrency(data.total)}</div>
                          </div>
                          <div className="w-full flex flex-col justify-end h-full">
                            <div className="w-full bg-amber-400/80 rounded-t-sm hover:bg-amber-400 transition-colors" style={{ height: `${memberPct}%` }} />
                            <div className="w-full bg-blue-500/80 rounded-b-sm hover:bg-blue-500 transition-colors" style={{ height: `${creditPct}%` }} />
                          </div>
                        </div>
                        <div className="text-center text-[10px] text-gray-500 mt-2 font-medium truncate">
                          {data.month}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No monthly data available</div>
                )}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> <span className="text-gray-600">Credits</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> <span className="text-gray-600">Membership</span></div>
              </div>
            </Card>

            {/* Demographics & System Health */}
            <div className="space-y-6">
              <Card className="p-6 border-none shadow-sm">
                <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Users size={18} className="text-blue-500" /> User Demographics</h3>
                <div className="space-y-6">
                  <div 
                    className="cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => navigate('/admin/users', { state: { gender: 'Male' } })}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700 flex items-center gap-1"><Users size={14} className="text-blue-500" /> Male Users</span>
                      <span className="font-bold text-gray-900">{stats.maleUsers} <span className="text-gray-400 font-normal ml-1">({stats.totalUsers ? Math.round(stats.maleUsers/stats.totalUsers*100) : 0}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.totalUsers ? (stats.maleUsers/stats.totalUsers*100) : 0}%` }}></div>
                    </div>
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => navigate('/admin/users', { state: { gender: 'Female' } })}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-gray-700 flex items-center gap-1"><Users size={14} className="text-pink-500" /> Female Users</span>
                      <span className="font-bold text-gray-900">{stats.femaleUsers} <span className="text-gray-400 font-normal ml-1">({stats.totalUsers ? Math.round(stats.femaleUsers/stats.totalUsers*100) : 0}%)</span></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${stats.totalUsers ? (stats.femaleUsers/stats.totalUsers*100) : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-none shadow-sm">
                <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Heart size={18} className="text-rose-500" /> Marital Status</h3>
                <div className="space-y-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => navigate('/admin/users', { state: { search: 'Single', search_field: 'all' } })}
                  >
                    <span className="text-sm font-medium text-gray-700">Never Married / Single</span>
                    <Badge variant="primary">{stats.singleUsers || 0}</Badge>
                  </div>
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => navigate('/admin/users', { state: { search: 'Divorced', search_field: 'all' } })}
                  >
                    <span className="text-sm font-medium text-gray-700">Divorced</span>
                    <Badge variant="warning">{stats.divorcedUsers || 0}</Badge>
                  </div>
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => navigate('/admin/users', { state: { search: 'Widow', search_field: 'all' } })}
                  >
                    <span className="text-sm font-medium text-gray-700">Widowed</span>
                    <Badge variant="primary" className="!bg-purple-100 !text-purple-700">{stats.widowedUsers || 0}</Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-none shadow-sm">
                <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><MapPin size={18} className="text-emerald-500" /> Top Cities</h3>
                <div className="space-y-3">
                  {stats.topCities && stats.topCities.length > 0 ? stats.topCities.map((city: any, i: number) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate('/admin/users', { state: { city: city.city } })}
                    >
                      <span className="text-sm font-medium text-gray-700">{city.city || 'Unknown'}</span>
                      <span className="text-xs font-bold text-gray-900">{city.count} users</span>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500 text-center py-4">No city data available</div>
                  )}
                </div>
              </Card>

              <Card className="p-6 border-none shadow-sm">
                <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Users size={18} className="text-purple-500" /> Top Sub-Castes</h3>
                <div className="space-y-3">
                  {stats.topSubCastes && stats.topSubCastes.length > 0 ? stats.topSubCastes.map((sub: any, i: number) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate('/admin/users', { state: { search: sub.sub_caste, search_field: 'all' } })}
                    >
                      <span className="text-sm font-medium text-gray-700">{sub.sub_caste || 'Unknown'}</span>
                      <span className="text-xs font-bold text-gray-900">{sub.count} users</span>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500 text-center py-4">No sub-caste data available</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card className="p-6 border-none shadow-sm">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Calendar size={18} className="text-indigo-500" /> Age Distribution</h3>
              <div className="space-y-4">
                {stats.ageGroups && Object.entries(stats.ageGroups).map(([ageRange, count]: [string, any]) => (
                  <div 
                    key={ageRange}
                    className="cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors"
                    onClick={() => {
                      const min = ageRange === '46+' ? '46' : ageRange.split('-')[0];
                      const max = ageRange === '46+' ? '' : ageRange.split('-')[1];
                      navigate('/admin/users', { state: { age_min: min, age_max: max } });
                    }}
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{ageRange} Years</span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${stats.totalUsers ? (count/stats.totalUsers*100) : 0}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><Crown size={18} className="text-amber-500" /> Membership Usage</h3>
              <div className="flex flex-col h-full gap-4">
                <div 
                  className="bg-amber-50 rounded-xl p-4 flex justify-between items-center border border-amber-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/admin/users', { state: { premium: 'true' } })}
                >
                  <div>
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Premium Buyers</p>
                    <p className="text-sm text-gray-600">Purchased a plan</p>
                  </div>
                  <h4 className="text-2xl font-bold text-amber-700">{stats.uniqueMembershipBuyers || 0}</h4>
                </div>
                <div 
                  className="bg-gray-50 rounded-xl p-4 flex justify-between items-center border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/admin/users', { state: { premium: 'false' } })}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Free Members</p>
                    <p className="text-sm text-gray-500">Basic profiles</p>
                  </div>
                  <h4 className="text-2xl font-bold text-gray-700">{stats.freeMembers || 0}</h4>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-none shadow-sm">
              <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2"><DollarSign size={18} className="text-blue-500" /> Credit Usage</h3>
              <div className="flex flex-col h-full gap-4">
                <div 
                  className="bg-blue-50 rounded-xl p-4 flex justify-between items-center border border-blue-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/admin/users')} // Ideally filters by users who bought credits, but we go to users list for now
                >
                  <div>
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Credit Buyers</p>
                    <p className="text-sm text-gray-600">Purchased credit packs</p>
                  </div>
                  <h4 className="text-2xl font-bold text-blue-700">{stats.uniqueCreditBuyers || 0}</h4>
                </div>
                <div 
                  className="bg-emerald-50 rounded-xl p-4 flex justify-between items-center border border-emerald-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate('/admin/users')} 
                >
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Free Credit Users</p>
                    <p className="text-sm text-gray-600">Using free sign-up credits</p>
                  </div>
                  <h4 className="text-2xl font-bold text-emerald-700">{stats.usersWithFreeCredits || 0}</h4>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
