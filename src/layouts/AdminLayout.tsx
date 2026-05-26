import { useState, useEffect } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAdminPermissions } from '../store/adminPermissionStore'
import { useSocketStore } from '../store/socketStore'
import { 
  LayoutDashboard, Users, Flag, Heart, Mail, ArrowLeft, 
  Menu, X, LogOut, Shield, ChevronRight, Settings, CreditCard, Tag,
  CheckSquare, Home, Info, FileText, DollarSign, BarChart2, Send, LayoutTemplate, Search, Bell, Globe, UserCog, HeartHandshake
} from 'lucide-react'
import Logo from '../components/Logo'

export default function AdminLayout() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { hasPermission, isMasterAdmin, role, loaded } = useAdminPermissions()
  const { socket } = useSocketStore()

  // Real-time: when master admin updates this admin's permissions, re-fetch immediately
  useEffect(() => {
    if (!socket) return;
    const handlePermUpdate = (data: { role: string; permissions: string[]; is_active: boolean }) => {
      if (!data.is_active) {
        // Deactivated — force logout
        signOut().then(() => navigate('/login'));
        return;
      }
      useAdminPermissions.setState({
        role: data.role,
        permissions: data.permissions,
        loaded: true,
      });
    };
    const handleAccountDeleted = (data: { reason: string }) => {
      // Account deleted by master admin — force logout immediately
      alert(data.reason || 'Your admin account has been removed.');
      signOut().then(() => navigate('/login'));
    };
    socket.on('admin:permissions-updated', handlePermUpdate);
    socket.on('admin:account-deleted', handleAccountDeleted);
    return () => {
      socket.off('admin:permissions-updated', handlePermUpdate);
      socket.off('admin:account-deleted', handleAccountDeleted);
    };
  }, [socket, signOut, navigate]);

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const allNavItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { path: '/admin/verification', label: 'Verifications', icon: CheckSquare },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/communities', label: 'Community Management', icon: Globe },
    { path: '/admin/notifications', label: 'Push Notifications', icon: Bell },
    { path: '/admin/plans', label: 'Plans & Credits', icon: CreditCard },
    { path: '/admin/coupons', label: 'Offers & Coupons', icon: Tag },
    { path: '/admin/payment-gateways', label: 'Payment Gateways', icon: Shield },
    { path: '/admin/financials', label: 'Financials', icon: DollarSign },
    { path: '/admin/analytics', label: 'Analytics & Reports', icon: BarChart2 },
    { path: '/admin/reports', label: 'User Profile Reports', icon: Flag },
    { path: '/admin/emails', label: 'Email Templates', icon: Send },
    { path: '/admin/unblock', label: 'Unblock Requests', icon: Shield },
    { path: '/admin/success-stories', label: 'Success Stories', icon: Heart },
    { path: '/admin/match-confirmations', label: 'Match Confirmations', icon: Heart },
    { path: '/admin/contacts', label: 'Contact Messages', icon: Mail },
    { path: '/admin/content', label: 'Content Management', icon: LayoutTemplate },
    { path: '/admin/seo-marketing', label: 'SEO & Marketing', icon: Search },
    { path: '/admin/legal-pages', label: 'Legal & FAQ', icon: FileText },
    { path: '/admin/settings', label: 'General Settings', icon: Settings },
  ]

  // Filter nav items based on permissions
  // While loading: show nothing except Dashboard to avoid flashing wrong items
  // After loaded: filter strictly by hasPermission, Admin Manager only for master_admin
  const navItems = !loaded
    ? [{ path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
    : [
        ...allNavItems.filter(item => hasPermission(item.path)),
        ...(isMasterAdmin()
          ? [{ path: '/admin/managers', label: 'Admin Manager', icon: UserCog }]
          : []),
      ]

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1a1a2e] text-white 
        transform transition-transform duration-300 ease-in-out flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-secondary" size={24} />
              <div>
                <Logo white size="sm" hideLink />
                <p className="text-xs text-gray-400">Admin Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Admin Info */}
        <div className="p-4 border-b border-white/10">
          <p className="text-sm text-gray-300">Welcome,</p>
          <p className="font-semibold text-white">{profile?.first_name} {profile?.last_name}</p>
          <p className="text-xs text-gray-400 capitalize mt-1">
            {role === 'master_admin' ? '⭐ Master Admin' :
             role === 'administration' ? '🔧 Administration' :
             role === 'finance' ? '💰 Finance' : 'Administrator'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-5 py-3 text-sm transition-all
                ${isActive 
                  ? 'bg-white/10 text-secondary border-r-4 border-secondary font-semibold' 
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'}
              `}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <ArrowLeft size={18} />
            Back to App
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center text-sm text-gray-500">
              <Shield size={16} className="text-primary mr-2" />
              <span className="font-medium text-gray-800">Admin Panel</span>
              <ChevronRight size={14} className="mx-1" />
              <span>Management</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              {profile?.first_name} {profile?.last_name}
            </span>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
              {profile?.first_name?.[0] || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
