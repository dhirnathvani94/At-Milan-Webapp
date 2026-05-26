import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getUnreadMessageCount } from '../lib/actions/messageActions'
import { Heart, Menu, X, MessageCircle, Search, User, Settings, LogOut, Shield, ChevronDown, Bell, Home, Users, Star, AlertTriangle } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'
import MessageDropdown from './MessageDropdown'
import Avatar from './ui/Avatar'
import Logo from './Logo'

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [verificationDismissed, setVerificationDismissed] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetch unread messages
  useEffect(() => {
    if (user?.id) {
      getUnreadMessageCount((user?.id || '')).then(count => setUnreadMsgCount(count)).catch(() => {})
      const interval = setInterval(() => {
        getUnreadMessageCount((user?.id || '')).then(count => setUnreadMsgCount(count)).catch(() => {})
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [user?.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Check verification banner dismissal
  useEffect(() => {
    const dismissed = localStorage.getItem('verification_banner_dismissed')
    if (dismissed) {
      const dismissedTime = new Date(dismissed).getTime()
      const now = new Date().getTime()
      if (now - dismissedTime < 24 * 60 * 60 * 1000) {
        setVerificationDismissed(true)
      }
    }
  }, [])

  const handleSignOut = async () => {
    setProfileDropdownOpen(false)
    setMobileMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const dismissVerificationBanner = () => {
    setVerificationDismissed(true)
    localStorage.setItem('verification_banner_dismissed', new Date().toISOString())
  }

  // Navigation links based on auth state
  const publicLinks = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/success-stories', label: 'Success Stories' },
    { to: '/membership', label: 'Membership' },
    { to: '/contact', label: 'Contact' },
  ]

  // When logged in, navbar shows these links (NO Dashboard here)
  const authLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/search', label: 'Search', icon: Search },
    { to: '/matches', label: 'Matches', icon: Heart },
  ]

  // Profile dropdown menu items (Dashboard and all features here)
  const profileMenuItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/my-profile', label: 'My Profile', icon: User },
    { to: '/interests', label: 'Interests', icon: Heart },
    { to: '/shortlist', label: 'Shortlisted', icon: Star },
    { to: '/who-viewed-me', label: 'Who Viewed Me', icon: Users },
    { to: '/complete-profile', label: 'Edit Profile', icon: Settings },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <>
      {/* Main Navbar */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur-md'
      }`} role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <Logo />

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1">
              {(user ? authLinks : publicLinks).map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => `
                    px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'text-primary bg-primary-50' 
                      : 'text-gray-600 hover:text-primary hover:bg-gray-50'}
                  `}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {user && profile ? (
                <>
                  {/* Messages Dropdown */}
                  <div className="block">
                    <MessageDropdown userId={(profile?.id || '')} />
                  </div>

                  {/* Notifications */}
                  <div className="block">
                    <NotificationDropdown userId={(profile?.id || '')} />
                  </div>

                  {/* Profile Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                      className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-gray-100 transition border border-transparent hover:border-gray-200"
                    >
                      <Avatar 
                        src={profile.profile_photo_url} 
                        fallbackName={`${profile.first_name} ${profile.last_name}`}
                        gender={profile.gender}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[100px] truncate">
                        {profile.first_name}
                      </span>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {profileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-slide-down">
                        {/* User info header */}
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="font-semibold text-gray-800 truncate">{profile.first_name} {profile.last_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{profile.profile_id}</p>
                          {!profile.is_verified && (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1.5">
                              <AlertTriangle size={10} /> Unverified
                            </span>
                          )}
                        </div>

                        {/* Menu Items - ALL dashboard features here */}
                        <div className="py-1">
                          {profileMenuItems.map(item => (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setProfileDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                            >
                              <item.icon size={16} className="text-gray-400" />
                              {item.label}
                            </Link>
                          ))}

                          {/* Messages link (also in dropdown for mobile) */}
                          <Link
                            to="/messages"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition sm:hidden"
                          >
                            <MessageCircle size={16} className="text-gray-400" />
                            Messages
                            {unreadMsgCount > 0 && (
                              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{unreadMsgCount}</span>
                            )}
                          </Link>

                          {/* Admin link */}
                          {profile.role === 'admin' && (
                            <Link
                              to="/admin"
                              onClick={() => setProfileDropdownOpen(false)}
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
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition w-full text-left"
                          >
                            <LogOut size={16} />
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Not logged in - Login & Register buttons */}
                  <Link
                    to="/login"
                    className="hidden sm:block text-sm font-medium text-gray-700 hover:text-primary px-4 py-2 rounded-lg transition"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-primary-700 transition"
                  >
                    Register Free
                  </Link>
                </>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition ml-1"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t bg-white shadow-lg animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {(user ? authLinks : publicLinks).map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `
                    block px-4 py-3 rounded-lg text-sm font-medium transition
                    ${isActive ? 'text-primary bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}
                  `}
                >
                  {link.label}
                </NavLink>
              ))}
              {!user && (
                <div className="flex gap-3 pt-3 border-t mt-3">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2.5 border border-primary text-primary rounded-lg font-medium text-sm">Login</Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1 text-center py-2.5 bg-primary text-white rounded-lg font-medium text-sm">Register</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Verification Banner - shows below navbar if profile not verified */}
      {user && profile && !profile.is_verified && !verificationDismissed && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-yellow-800">
                Your profile is not verified. Upload Aadhaar to get the <strong>verified badge</strong>.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/my-profile" className="text-sm font-semibold text-primary hover:underline whitespace-nowrap">
                Upload Now →
              </Link>
              <button onClick={dismissVerificationBanner} className="text-yellow-500 hover:text-yellow-700">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
