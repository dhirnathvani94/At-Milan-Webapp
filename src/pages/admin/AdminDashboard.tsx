import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, UserCheck, ShieldCheck, Crown, 
  Clock, Flag, Heart, CheckCircle, 
  ChevronRight, ExternalLink, ThumbsUp, ThumbsDown,
  CreditCard, MessageSquare, Settings, Eye, FileText,
  TrendingUp, Activity, ArrowRight, DollarSign, Database,
  BarChart3, UserX, AlertTriangle, Zap, Globe, ArrowUpRight,
  ArrowDownRight, Wallet, Receipt, PieChart, Users2, ShieldOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { 
  getAdminStats, 
  getAdminUsers, 
  getPendingVerifications,
  approveDocument,
  rejectDocument,
  getMessageReports,
  getUnblockRequests,
  getFinancialAnalytics
} from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../lib/utils';
import { AdminStatsSkeleton } from '../../components/ui/Skeletons';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

export default function AdminDashboard() {
  const { user: adminUser } = useAuthStore();
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    revenue: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
    verifiedUsers: 0,
    unverifiedUsers: 0,
    inactiveUsers: 0,
    blockedUsers: 0,
    pendingDocs: 0,
    totalInterests: 0,
    totalTransactions: 0,
    maleUsers: 0,
    femaleUsers: 0,
    activeSubscriptions: 0
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);
  const [groupedPendingDocs, setGroupedPendingDocs] = useState<any[]>([]);
  const [pendingMessageReports, setPendingMessageReports] = useState<any[]>([]);
  const [pendingUnblockRequests, setPendingUnblockRequests] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive' | 'premium' | 'verified' | 'blocked'>('all');

  const { socket } = useSocketStore();
  // Stable ref — always points to the latest fetchDashboardData without re-binding socket handlers
  const fetchRef = useRef<(showLoading?: boolean) => void>(() => {});

  useEffect(() => {
    fetchDashboardData(true);

    // Poll every 10 seconds — catches real-time changes even if socket event is missed
    const poll = setInterval(() => fetchRef.current(), 10000);

    // Refresh when admin comes back to this tab
    const onVisible = () => { if (document.visibilityState === 'visible') fetchRef.current(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Real-time: bind directly to the raw socket so handlers survive re-renders and reconnects
  useEffect(() => {
    fetchRef.current = fetchDashboardData;
  });

  useEffect(() => {
    const handleNewUser  = (data: any) => { toast.success(`New user registered: ${data?.first_name} ${data?.last_name}`); fetchRef.current(); };
    const handleAny      = () => fetchRef.current();
    const handleReported = (data: any) => { toast.error(`User reported: ${data?.reason}`); fetchRef.current(); };

    const events: [string, (...args: any[]) => void][] = [
      ['admin:new-user',          handleNewUser],
      ['admin:doc-uploaded',      handleAny],
      ['admin:doc-status-changed',handleAny],
      ['admin:profile-updated',   handleAny],
      ['admin:user-deleted',      handleAny],
      ['admin:unblock-request',   handleAny],
      ['admin:interest-sent',     handleAny],
      ['admin:interest-updated',  handleAny],
      ['admin:message-sent',      handleAny],
      ['admin:user-reported',     handleReported],
      ['admin:message-reported',  handleAny],
      ['admin:user-blocked',      handleAny],
      ['admin:user-unblocked',    handleAny],
    ];

    if (!socket) return;
    events.forEach(([evt, handler]) => socket.on(evt, handler));
    // Re-register on reconnect so events aren't lost after brief disconnects
    const onReconnect = () => events.forEach(([evt, handler]) => { socket.off(evt, handler); socket.on(evt, handler); });
    socket.on('connect', onReconnect);

    return () => {
      events.forEach(([evt, handler]) => socket.off(evt, handler));
      socket.off('connect', onReconnect);
    };
  }, [socket]);

  const fetchDashboardData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [statsRes, usersRes, docsRes, reportsRes, unblockRes, finRes] = await Promise.all([
        getAdminStats(),
        getAdminUsers(1, 50),
        getPendingVerifications(),
        getMessageReports(1, 'pending'),
        getUnblockRequests('pending'),
        getFinancialAnalytics()
      ]);
      setStats(statsRes);
      setRecentUsers(usersRes.users);
      const docsArray = Array.isArray(docsRes)
        ? docsRes
        : (docsRes?.data || docsRes?.documents || []);
      setPendingDocs(docsArray);
      setFinancialData(finRes);
      
      const groupedDocs = docsArray.reduce((acc: any, doc: any) => {
        if (!acc[doc.user_id]) {
          acc[doc.user_id] = {
            user_id: doc.user_id,
            profile: doc.profile,
            documents: [],
            latest_date: doc.uploaded_at
          };
        }
        acc[doc.user_id].documents.push(doc);
        if (new Date(doc.uploaded_at) > new Date(acc[doc.user_id].latest_date)) {
          acc[doc.user_id].latest_date = doc.uploaded_at;
        }
        return acc;
      }, {});
      setGroupedPendingDocs(Object.values(groupedDocs).sort((a: any, b: any) => new Date(b.latest_date).getTime() - new Date(a.latest_date).getTime()));
      setPendingMessageReports(reportsRes.reports);
      setPendingUnblockRequests(unblockRes);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      console.warn('Dashboard data unavailable — showing zeros');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleApprove = async (docId: string) => {
    if (!adminUser) return;
    try {
      await approveDocument(docId, adminUser.id);
      toast.success('Document approved');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to approve document');
    }
  };

  const handleReject = async (docId: string) => {
    if (!adminUser) return;
    const reason = window.prompt('Enter reason for rejection:');
    if (reason === null) return;
    if (!reason) {
      toast.error('Reason is required for rejection');
      return;
    }
    try {
      await rejectDocument(docId, adminUser.id, reason);
      toast.success('Document rejected');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to reject document');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-72 animate-pulse"></div>
          </div>
        </div>
        <AdminStatsSkeleton />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  // Primary stat cards
  const primaryStats = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, color: "from-blue-500 to-blue-600", link: "/admin/users", sub: `${stats?.activeUsers || 0} active` },
    { label: "Revenue", value: formatCurrency(stats?.totalRevenue || 0), icon: Wallet, color: "from-emerald-500 to-emerald-600", link: "/admin/financials", sub: `${stats?.revenueGrowth >= 0 ? '+' : ''}${stats?.revenueGrowth || 0}% MoM` },
    { label: "Premium Members", value: stats?.premiumUsers, icon: Crown, color: "from-amber-500 to-amber-600", link: "/admin/users", sub: `${stats?.activeSubscriptions || 0} active subs` },
    { label: "Verified Users", value: stats?.verifiedUsers, icon: ShieldCheck, color: "from-teal-500 to-teal-600", link: "/admin/verification", sub: `${stats?.unverifiedUsers || 0} unverified` },
  ];

  // Secondary stat cards
  const secondaryStats = [
    { label: "Inactive Users", value: stats?.inactiveUsers, icon: UserX, color: "text-gray-600 bg-gray-50", link: "/admin/users" },
    { label: "Blocked Users", value: stats?.blockedUsers, icon: ShieldOff, color: "text-red-600 bg-red-50", link: "/admin/users" },
    { label: "Pending Docs", value: stats?.pendingDocs, icon: Clock, color: "text-orange-600 bg-orange-50", link: "/admin/verification" },
    { label: "Message Reports", value: pendingMessageReports.length, icon: Flag, color: "text-rose-600 bg-rose-50", link: "/admin/reports" },
    { label: "Total Interests", value: stats?.totalInterests, icon: Heart, color: "text-pink-600 bg-pink-50", link: "/admin" },
    { label: "Transactions", value: stats?.totalTransactions, icon: Receipt, color: "text-indigo-600 bg-indigo-50", link: "/admin/financials" },
  ];

  // User breakdown for the chart area
  const userBreakdown = [
    { label: "Male", value: stats?.maleUsers || 0, color: "bg-blue-500" },
    { label: "Female", value: stats?.femaleUsers || 0, color: "bg-pink-500" },
    { label: "Active", value: stats?.activeUsers || 0, color: "bg-emerald-500" },
    { label: "Inactive", value: stats?.inactiveUsers || 0, color: "bg-gray-400" },
    { label: "Premium", value: stats?.premiumUsers || 0, color: "bg-amber-500" },
    { label: "Blocked", value: stats?.blockedUsers || 0, color: "bg-red-500" },
  ];

  const quickActions = [
    { label: "Verify Documents", icon: Eye, link: "/admin/verification", color: "bg-orange-50 text-orange-600 hover:bg-orange-100" },
    { label: "Manage Users", icon: Users, link: "/admin/users", color: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
    { label: "View Reports", icon: Flag, link: "/admin/reports", color: "bg-red-50 text-red-600 hover:bg-red-100" },
    { label: "Plans & Credits", icon: CreditCard, link: "/admin/plans", color: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
    { label: "Financials", icon: DollarSign, link: "/admin/financials", color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
    { label: "Success Stories", icon: Heart, link: "/admin/success-stories", color: "bg-pink-50 text-pink-600 hover:bg-pink-100" },
    { label: "Contact Messages", icon: MessageSquare, link: "/admin/contacts", color: "bg-green-50 text-green-600 hover:bg-green-100" },
    { label: "Site Settings", icon: Settings, link: "/admin/settings", color: "bg-gray-50 text-gray-600 hover:bg-gray-100" },
    { label: "ES Reindex", icon: Database, link: "#", color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100", action: "es-reindex" },
    { label: "Legal & FAQ", icon: FileText, link: "/admin/legal-pages", color: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" },
  ];

  // Monthly revenue mini chart
  const monthlyData = financialData?.monthlyRevenue?.slice(-6) || [];
  const maxRevenue = Math.max(...monthlyData.map((m: any) => m.total || 0), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back! Here's what's happening on {brandName}.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)}>
            <Activity size={14} className="mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map((stat, index) => (
          <Link key={index} to={stat.link || "#"} className="block group">
            <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-all group-hover:scale-[1.02] bg-gradient-to-br ${stat.color}`}>
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <stat.icon size={22} className="opacity-90" />
                  <ArrowRight size={16} className="opacity-0 group-hover:opacity-70 transition-opacity" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
                <p className="text-xs font-medium uppercase tracking-wider opacity-80 mt-1">{stat.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{stat.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryStats.map((stat, index) => (
          <Link key={index} to={stat.link || "#"} className="block group">
            <div className={`rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all ${stat.color?.split(' ')[0]} ${stat.color?.includes('bg-') ? stat.color : 'bg-white'}`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={16} className={stat.color?.split(' ')[0]} />
                <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${stat.color?.split(' ')[0]}`}>{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Breakdown & Revenue Chart */}
        <Card className="p-6 border-none shadow-sm lg:col-span-1">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart size={20} className="text-primary" /> User Breakdown
          </h2>
          <div className="space-y-3">
            {userBreakdown.map((item) => {
              const total = stats?.totalUsers || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Revenue Mini Chart */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
              <TrendingUp size={14} className="text-emerald-500" /> Revenue Trend (6 months)
            </h3>
            <div className="flex items-end gap-1 h-20">
              {monthlyData.map((m: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-emerald-100 rounded-t relative" style={{ height: `${Math.max((m.total / maxRevenue) * 60, 4)}px` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t opacity-80" />
                  </div>
                  <span className="text-[9px] text-gray-400">{m.month?.slice(5)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">This month: {formatCurrency(stats?.monthlyRevenue || 0)}</p>
          </div>
        </Card>

        {/* Recent Users */}
        <Card className="p-6 border-none shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users2 size={20} className="text-primary" /> Recent Users
            </h2>
            <Link to="/admin/users" className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          {/* User filter tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto hide-scrollbar">
            {(['all', 'active', 'inactive', 'premium', 'verified', 'blocked'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setUserFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${userFilter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {recentUsers
              .filter((u) => {
                if (userFilter === 'all') return true;
                if (userFilter === 'active') return u.is_active;
                if (userFilter === 'inactive') return !u.is_active;
                if (userFilter === 'premium') return u.is_premium;
                if (userFilter === 'verified') return u.is_verified;
                if (userFilter === 'blocked') return u.is_permanently_blocked || u.blocked_until;
                return true;
              })
              .slice(0, 8)
              .map((u) => (
                <Link key={u.id} to={`/admin/users/${u.id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <Avatar src={u.profile_photo_url} fallbackName={`${u.first_name} ${u.last_name}`} size="sm" gender={u.gender} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                      {u.first_name} {u.last_name}
                    </p>
                    <p className="text-[11px] text-gray-400">{u.profile_id} · {formatDate(u.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {u.is_premium && <Crown size={12} className="text-amber-500" />}
                    {u.is_verified && <ShieldCheck size={12} className="text-teal-500" />}
                    {!u.is_active && <UserX size={12} className="text-gray-400" />}
                  </div>
                </Link>
              ))}
          </div>
        </Card>

        {/* Pending Verifications + Quick Actions */}
        <Card className="p-6 border-none shadow-sm lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-orange-500" /> Pending Verifications
            </h2>
            <Link to="/admin/verification" className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
              Review All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2 mb-6">
            {groupedPendingDocs.length > 0 ? (
              groupedPendingDocs.slice(0, 5).map((group) => (
                <div key={group.user_id} className="flex items-center gap-3 p-2.5 bg-orange-50/50 rounded-xl border border-orange-100/50 group">
                  <Avatar 
                    src={group.profile?.profile_photo_url} 
                    fallbackName={`${group.profile?.first_name} ${group.profile?.last_name}`}
                    size="sm"
                    gender={group.profile?.gender}
                  />
                  <div className="flex-1 min-w-0">
                    <Link to={`/admin/users/${group.profile?.id}`} className="text-sm font-semibold text-gray-900 truncate hover:text-primary transition-colors block">
                      {group.profile?.first_name} {group.profile?.last_name}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {group.documents.map((d: any) => (
                        <span key={d.id} className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                          {d.document_type.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleApprove(group.documents[0]?.id)} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Approve">
                      <CheckCircle size={14} />
                    </button>
                    <button onClick={() => handleReject(group.documents[0]?.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Reject">
                      <AlertTriangle size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-400">
                <ShieldCheck size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No pending verifications</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1">
              <Zap size={14} className="text-amber-500" /> Quick Actions
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {quickActions.map((action) => (
                action.action === 'es-reindex' ? (
                  <button
                    key={action.label}
                    onClick={async () => {
                      try {
                        toast.loading('Reindexing profiles to Elasticsearch...', { id: 'es-reindex' });
                        const res = await fetch(apiUrl('/api/admin/es/reindex'), { method: 'POST' });
                        const data = await res.json();
                        if (data.success) {
                          toast.success(`Reindexed ${data.indexed} profiles (${data.errors} errors)`, { id: 'es-reindex' });
                        } else {
                          toast.error(data.error || 'Elasticsearch not available', { id: 'es-reindex' });
                        }
                      } catch (e) {
                        toast.error('Reindex failed', { id: 'es-reindex' });
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-colors ${action.color}`}
                  >
                    <action.icon size={16} />
                    <span className="text-[10px] font-medium text-center leading-tight">{action.label}</span>
                  </button>
                ) : (
                  <Link
                    key={action.label}
                    to={action.link}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-colors ${action.color}`}
                  >
                    <action.icon size={16} />
                    <span className="text-[10px] font-medium text-center leading-tight">{action.label}</span>
                  </Link>
                )
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Row - Reports & Unblock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Message Reports */}
        <Card className="p-6 border-none shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Flag size={20} className="text-red-500" /> Message Reports
            </h2>
            <Link to="/admin/reports" className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingMessageReports.length > 0 ? (
              pendingMessageReports.slice(0, 4).map((report) => (
                <div key={report.id} className="p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="text-xs font-medium text-gray-700">
                      <Link to={`/admin/users/${report.reporter?.id}`} className="text-primary hover:underline">{report.reporter?.first_name}</Link>
                      <span className="text-gray-400"> reported </span>
                      <Link to={`/admin/users/${report.reported_user?.id}`} className="text-primary hover:underline">{report.reported_user?.first_name}</Link>
                    </div>
                    <Badge variant="danger" className="text-[10px]">{report.reason}</Badge>
                  </div>
                  <p className="text-xs text-gray-600 italic bg-white p-2 rounded border border-red-100/50 line-clamp-2">
                    "{report.message_content}"
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Flag size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No pending reports</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Unblock Requests */}
        <Card className="p-6 border-none shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldOff size={20} className="text-purple-500" /> Unblock Requests
            </h2>
            <Link to="/admin/unblock" className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingUnblockRequests.length > 0 ? (
              pendingUnblockRequests.slice(0, 4).map((req) => (
                <div key={req.id} className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/50">
                  <div className="flex justify-between items-start mb-1.5">
                    <Link to={`/admin/users/${req.user?.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors">
                      {req.user?.first_name} {req.user?.last_name}
                    </Link>
                    <span className="text-[10px] text-gray-400">{formatDate(req.created_at)}</span>
                  </div>
                  <div className="text-[10px] text-red-600 font-medium mb-1">
                    Blocked: {req.user?.block_reason || 'Policy violation'}
                  </div>
                  <p className="text-xs text-gray-600 bg-white p-2 rounded border border-purple-100/50 line-clamp-2">
                    "{req.reason}"
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShieldCheck size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No pending unblock requests</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Financial Overview */}
      <Card className="p-6 border-none shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-emerald-500" /> Financial Overview
          </h2>
          <Link to="/admin/financials" className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
            Detailed Reports <ChevronRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
            <p className="text-xs text-emerald-600 font-medium mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats?.totalRevenue || 0)}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 font-medium mb-1">This Month</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(stats?.monthlyRevenue || 0)}</p>
            <p className="text-[10px] text-blue-500 mt-0.5 flex items-center gap-0.5">
              {stats?.revenueGrowth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {stats?.revenueGrowth >= 0 ? '+' : ''}{stats?.revenueGrowth || 0}% vs last month
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-600 font-medium mb-1">Transactions</p>
            <p className="text-xl font-bold text-purple-700">{stats?.totalTransactions || 0}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-600 font-medium mb-1">Active Subscriptions</p>
            <p className="text-xl font-bold text-amber-700">{stats?.activeSubscriptions || 0}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
