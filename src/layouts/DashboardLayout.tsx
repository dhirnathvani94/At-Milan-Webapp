import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import { 
  Home, Search, Heart, MessageCircle, 
  Star, User, Settings, Menu, X, Crown, LogOut,
  Gem, ShieldCheck, Bell, Clock, CheckCheck, Check,
  ChevronDown, AlertTriangle, Users, Shield
} from 'lucide-react'
import { 
  getUnreadMessageCount, getUnreadNotificationCount,
  getConversations, getNotifications, markAllNotificationsRead, markNotificationRead
} from '../lib/actions/messageActions'
import { getRelativeTime } from '../lib/utils'
import MessageDropdown from '../components/MessageDropdown'
import NotificationDropdown from '../components/NotificationDropdown'
import Avatar from '../components/ui/Avatar'
import Logo from '../components/Logo'
import { useI18n, LanguageSwitcher } from '../lib/accessibility'
import { announce } from '../lib/a11yUtils'
import { usePushNotifications } from '../lib/hooks/usePushNotifications.tsx'

export default function DashboardLayout() {
  const { profile, signOut } = useAuthStore()
  const { socket } = useSocketStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const location = useLocation()

  // Initialize Firebase Push Notifications for this user
  usePushNotifications(profile?.id || null)

  // Message dropdown state
  const [msgOpen, setMsgOpen] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const msgRef = useRef<HTMLDivElement>(null)

  // Notification dropdown state
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) setMsgOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch message conversations + count (memoized to prevent re-render loops)
  const fetchMessages = useCallback(async () => {
    if (!profile?.id) return
    try {
      const [convs, count] = await Promise.allSettled([
        getConversations((profile?.id || '')),
        getUnreadMessageCount((profile?.id || ''))
      ])
      if (convs.status === 'fulfilled') {
        const data: any[] = convs.value || []
        // Sort: unread first, then by latest message
        data.sort((a, b) => {
          if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount
          const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0
          const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0
          return bTime - aTime
        })
        setConversations(data)
      }
      if (count.status === 'fulfilled') setUnreadMsgCount(count.value || 0)
    } catch (_) {}
  }, [profile?.id])

  // Fetch notifications + count (memoized)
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return
    try {
      const [notifs, count] = await Promise.allSettled([
        getNotifications((profile?.id || '')),
        getUnreadNotificationCount((profile?.id || ''))
      ])
      if (notifs.status === 'fulfilled') setNotifications(notifs.value || [])
      if (count.status === 'fulfilled') setUnreadNotifCount(count.value || 0)
    } catch (_) {}
  }, [profile?.id])

  useEffect(() => {
    if (!socket) return;
    const handleNewNotif = (notif: any) => {
      if (!notif.user_id || notif.user_id === profile?.id) {
        setUnreadNotifCount(prev => prev + 1);
      }
    };
    const handleNewMsg = () => {
      setUnreadMsgCount(prev => prev + 1);
    };
    socket.on('notification:new', handleNewNotif);
    socket.on('notification:broadcast', handleNewNotif);
    socket.on('message:new', handleNewMsg);
    return () => {
      socket.off('notification:new', handleNewNotif);
      socket.off('notification:broadcast', handleNewNotif);
      socket.off('message:new', handleNewMsg);
    };
  }, [socket, profile?.id]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
    setMsgOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  const handleChatClick = (conv: any) => {
    setMsgOpen(false)
    navigate('/messages', { state: { selectedUserId: conv.otherUserId } })
  }

  const handleNotifClick = async (notif: any) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id)
        setUnreadNotifCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map((n: any) => n.id === notif.id ? { ...n, is_read: true } : n))
      }
    } catch (_) {}
    setNotifOpen(false)
    switch (notif.type) {
      case 'interest_received':
      case 'interest_accepted':
      case 'interest_declined':
        navigate('/interests'); break
      case 'new_message':
        navigate('/messages'); break
      default:
        break
    }
  }

  const handleMarkAllNotifsRead = async () => {
    try {
      await markAllNotificationsRead((profile?.id || ''))
      setUnreadNotifCount(0)
      setNotifications(prev => prev.map((n: any) => ({ ...n, is_read: true })))
    } catch (_) {}
  }

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: Home },
    ...(profile?.role === 'admin' ? [{ name: 'Admin Panel', path: '/admin', icon: ShieldCheck }] : []),
    { name: 'Browse', path: '/search', icon: Search },
    { name: 'My Profile', path: '/my-profile', icon: User },
    { name: 'Interests', path: '/interests', icon: Heart },
    { name: 'Shortlist', path: '/shortlist', icon: Star },
    { name: 'Chat', path: '/messages', icon: MessageCircle },
    { name: 'Premium', path: '/membership', icon: Gem },
    { name: 'Settings', path: '/settings', icon: Settings },
  ]

  const mobileNavLinks = [
    { name: 'Home', path: '/dashboard', icon: Home, badgeKey: null },
    { name: 'Browse', path: '/search', icon: Search, badgeKey: null },
    { name: 'Chat', path: '/messages', icon: MessageCircle, badgeKey: 'msg' },
    { name: 'Alerts', path: '/interests', icon: Bell, badgeKey: 'notif' },
    { name: 'Profile', path: '/my-profile', icon: User, badgeKey: null },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#1A0505] border-r border-[#1A0505] 
        transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:block flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <Logo white />
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/50 hover:text-white" aria-label="Close navigation menu">
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-white/10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary-900 border-2 border-white/20 flex items-center justify-center text-white font-bold overflow-hidden">
            {profile?.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              (profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '')
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-white/50 truncate">{profile?.profile_id}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" role="navigation" aria-label="Main navigation">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.name}
                to={link.path}
                aria-label={link.name}
                className={({ isActive }) => `
                  flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
                {link.name}
              </NavLink>
            )
          })}
          
          {/* Logout Button */}
          <button
            onClick={() => { signOut(); announce('Signed out successfully'); window.location.href = '/login'; }}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors mt-4"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
            Logout
          </button>
        </nav>

        {/* Premium Upgrade */}
        {!profile?.is_premium && (
          <div className="p-4 border-t border-white/10">
            <Link to="/membership" className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Premium
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 z-30 sticky top-0">
          <div className="flex items-center flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden mr-4 text-gray-500 hover:text-gray-700"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* ── MESSAGE DROPDOWN ── */}
            <div className="block">
              <MessageDropdown userId={(profile?.id || '')} />
            </div>

            {/* ── NOTIFICATION DROPDOWN ── */}
            <div className="block ml-1">
              <NotificationDropdown userId={(profile?.id || '')} />
            </div>

            {/* Profile Dropdown */}
            <div className="relative hidden md:block ml-2">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-gray-100 transition border border-transparent hover:border-gray-200"
              >
                <Avatar 
                  src={profile?.profile_photo_url} 
                  fallbackName={`${profile?.first_name} ${profile?.last_name}`}
                  gender={profile?.gender}
                  size="sm"
                />
                <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {profile?.first_name}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-slide-down">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-800 truncate">{profile?.first_name} {profile?.last_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{profile?.profile_id}</p>
                      {!profile?.is_verified && (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1.5">
                          <AlertTriangle size={10} /> Unverified
                        </span>
                      )}
                    </div>

                    {/* Menu Items - ALL dashboard features here */}
                    <div className="py-1">
                      {[
                        { to: '/dashboard', label: 'Dashboard', icon: Home },
                        { to: '/my-profile', label: 'My Profile', icon: User },
                        { to: '/interests', label: 'Interests', icon: Heart },
                        { to: '/shortlist', label: 'Shortlisted', icon: Star },
                        { to: '/who-viewed-me', label: 'Who Viewed Me', icon: Users },
                        { to: '/complete-profile', label: 'Edit Profile', icon: Settings },
                        { to: '/settings', label: 'Settings', icon: Settings },
                      ].map(item => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                        >
                          <item.icon size={16} className="text-gray-400" />
                          {item.label}
                        </Link>
                      ))}

                      {/* Admin link */}
                      {profile?.role === 'admin' && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary font-medium hover:bg-primary-50 transition"
                        >
                          <Shield size={16} className="text-primary" />
                          Admin Panel
                        </Link>
                      )}
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={() => { setDropdownOpen(false); signOut(); navigate('/'); }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main id="main-content" className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-8" role="main" aria-label="Main content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation — App-style */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        {/* Frosted glass background */}
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200/80 shadow-[0_-2px_20px_rgba(0,0,0,0.08)]">
          <div className="flex justify-around items-end px-1 pt-1.5 pb-2">
            {mobileNavLinks.map((link) => {
              const Icon = link.icon
              const badge = link.badgeKey === 'msg' ? unreadMsgCount : link.badgeKey === 'notif' ? unreadNotifCount : 0
              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  className={({ isActive }) => `
                    flex flex-col items-center justify-center relative px-3 py-1 rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'text-primary' 
                      : 'text-gray-400 active:scale-95'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active indicator pill */}
                      {isActive && (
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-primary rounded-full" />
                      )}
                      <div className="relative">
                        <Icon className={`w-[22px] h-[22px] transition-all ${isActive ? 'scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 1.8} />
                        {badge > 0 && (
                          <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 border-2 border-white shadow-sm">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] mt-1 transition-all ${isActive ? 'font-bold' : 'font-medium'}`}>{link.name}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
          {/* Safe area for devices with home indicator */}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>
  )
}
