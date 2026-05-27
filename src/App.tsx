import React, { useEffect, lazy, Suspense, Component, ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useMasterData } from './store/masterDataStore'
import { I18nProvider, SkipToContent } from './lib/accessibility'
import SEOProvider from './components/SEOProvider'
import { PageSkeleton } from './components/ui/Skeletons'
import CookieConsent from './components/ui/CookieConsent'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'

// ── EAGER imports for all public/critical pages ─────────────────────────────
// These are NEVER lazy-loaded so they can NEVER produce a chunk-load error
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import MembershipPage from './pages/MembershipPage'
import SuccessStoriesPage from './pages/SuccessStoriesPage'
import FaqPage from './pages/FaqPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import PendingApprovalPage from './pages/PendingApprovalPage'
import ReactivationPendingPage from './pages/ReactivationPendingPage'

// ── retryLazy: wraps lazy() with one automatic retry on chunk-load failure ───
function retryLazy<T extends React.ComponentType<any>>(
  fn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() =>
    fn().catch(() =>
      // Wait 800ms then try again once — fixes stale Vite cache issues
      new Promise<{ default: T }>(resolve => setTimeout(() => resolve(fn()), 800))
    )
  )
}

// Protected Pages (lazy with retry)
const DashboardPage = retryLazy(() => import('./pages/dashboard/DashboardPage'))
const SearchPage = retryLazy(() => import('./pages/dashboard/SearchPage'))
const MatchesPage = retryLazy(() => import('./pages/dashboard/MatchesPage'))
const InterestsPage = retryLazy(() => import('./pages/dashboard/InterestsPage'))
const MessagesPage = retryLazy(() => import('./pages/dashboard/MessagesPage'))
const ShortlistPage = retryLazy(() => import('./pages/dashboard/ShortlistPage'))
const WhoViewedMePage = retryLazy(() => import('./pages/dashboard/WhoViewedMePage'))
const MyProfilePage = retryLazy(() => import('./pages/dashboard/MyProfilePage'))
const SettingsPage = retryLazy(() => import('./pages/dashboard/SettingsPage'))
const CompleteProfilePage = retryLazy(() => import('./pages/dashboard/CompleteProfilePage'))
const ViewProfilePage = retryLazy(() => import('./pages/dashboard/ViewProfilePage'))
const SuccessStorySharePage = retryLazy(() => import('./pages/SuccessStorySharePage'))
const BuyCreditsPage = retryLazy(() => import('./pages/dashboard/BuyCreditsPage'))
const CheckoutPage = retryLazy(() => import('./pages/CheckoutPage'))

const MatchConfirmationPage = retryLazy(() => import("./pages/MatchConfirmationPage"))
const AdminMatchConfirmations = retryLazy(() => import("./pages/admin/AdminMatchConfirmations"))

// Admin Pages (lazy with retry)
const AdminDashboard = retryLazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = retryLazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = retryLazy(() => import('./pages/admin/AdminUserDetail'))
const AdminReports = retryLazy(() => import('./pages/admin/AdminReports'))
const AdminSuccessStories = retryLazy(() => import('./pages/admin/AdminSuccessStories'))
const AdminContacts = retryLazy(() => import('./pages/admin/AdminContacts'))
const AdminSettings = retryLazy(() => import('./pages/admin/AdminSettings'))
const AdminPlans = retryLazy(() => import('./pages/admin/AdminPlans'))
const AdminCoupons = retryLazy(() => import('./pages/admin/AdminCoupons'))
const AdminPaymentGateways = retryLazy(() => import('./pages/admin/AdminPaymentGateways'))
const AdminVerificationPage = retryLazy(() => import('./pages/admin/AdminVerificationPage'))
const AdminContentCMS = retryLazy(() => import('./pages/admin/AdminContentCMS'))
const AdminSEOMarketing = retryLazy(() => import('./pages/admin/AdminSEOMarketing'))
const AdminLegalPages = retryLazy(() => import('./pages/admin/AdminLegalPages'))
const AdminUnblockRequests = retryLazy(() => import('./pages/admin/AdminUnblockRequests'))
const AdminFinancials = retryLazy(() => import('./pages/admin/AdminFinancials'))
const AdminAnalytics = retryLazy(() => import('./pages/admin/AdminAnalytics'))
const AdminEmailTemplates = retryLazy(() => import('./pages/admin/AdminEmailTemplates'))
const AdminNotifications = retryLazy(() => import('./pages/admin/AdminNotifications'))
const AdminCommunities = retryLazy(() => import('./pages/admin/AdminCommunities'))
const AdminManagers = retryLazy(() => import('./pages/admin/AdminManagers'))

// Components
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import SettingsSocketProvider from './components/SettingsSocketProvider'
import SecurityGuard from './components/SecurityGuard'

function MembershipLayoutWrapper() {
  const { profile } = useAuthStore()
  if (profile) return <DashboardLayout />
  return <PublicLayout />
}

// Smart Error Boundary: auto-recovers on route navigation, no reload required
export class ErrorBoundary extends Component<
  { children: ReactNode; locationPathname?: string },
  { error: Error | null; errorKey: number }
> {
  state = { error: null as Error | null, errorKey: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: any) {
    // Log the error
    console.error('[ErrorBoundary] Caught error:', error.message, info?.componentStack?.split('\n')?.[1] || '')

    // Auto-recover from ChunkLoadErrors (new deployment) or JSON Parse errors (Render 502 wake-up)
    const isNetworkOrParseError = 
      error.name === 'ChunkLoadError' || 
      error.message.includes('dynamically imported module') || 
      error.message.includes('fetch') ||
      (error instanceof SyntaxError && error.message.includes('Unexpected token'));

    if (isNetworkOrParseError) {
      const reloadCount = parseInt(sessionStorage.getItem('atmilan_error_reload') || '0');
      if (reloadCount < 2) {
        sessionStorage.setItem('atmilan_error_reload', String(reloadCount + 1));
        // Give Render backend a brief moment to wake up, then reload
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
    }
  }

  componentDidUpdate(prevProps: any) {
    // Auto-recover silently whenever the user navigates to a different route
    if (this.props.locationPathname !== prevProps.locationPathname && this.state.error) {
      this.setState({ error: null, errorKey: this.state.errorKey + 1 })
    }
  }

  handleRecover = () => {
    this.setState({ error: null, errorKey: this.state.errorKey + 1 })
    window.history.back()
  }

  handleRetry = () => {
    this.setState({ error: null, errorKey: this.state.errorKey + 1 })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, sans-serif', padding: 40
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
              An unexpected error occurred. Please try again.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleRecover}
                style={{
                  padding: '10px 28px', background: '#8B1A1A', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 600, fontSize: 14
                }}
              >
                ← Go Back
              </button>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 28px', background: '#f3f4f6', color: '#374151',
                  border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
                  fontWeight: 600, fontSize: 14
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Wraps children in ErrorBoundary and resets it on every route change
// This prevents stale error state from showing on back-navigation
export function RouteChangeResetBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <ErrorBoundary locationPathname={location.pathname}>
      {children}
    </ErrorBoundary>
  )
}

import posthog from 'posthog-js'

function App() {
  const { initialize, loading, initialized, profile, user } = useAuthStore()
  const { fetchAllMasterData, isLoaded, admin_settings_kv } = useMasterData()

  useEffect(() => {
    // Clear error reload counter on successful app load
    sessionStorage.removeItem('atmilan_error_reload')
    initialize()
    fetchAllMasterData()
  }, []) // Empty deps - only run once on mount

  useEffect(() => {
    try {
      if (isLoaded && admin_settings_kv) {
        const apiKey = admin_settings_kv.find((s: any) => s.key === 'posthog_api_key')?.value;
        const host = admin_settings_kv.find((s: any) => s.key === 'posthog_host')?.value || 'https://us.i.posthog.com';
        
        if (apiKey && !posthog.__loaded) {
          posthog.init(apiKey, {
            api_host: host,
            autocapture: true,
            capture_pageview: true,
            capture_pageleave: true
          });
        }

        // Identify user if logged in
        if (apiKey && profile) {
          posthog.identify(profile.id, {
            email: user?.email || '',
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            is_premium: profile.is_premium || false,
          });
        } else if (apiKey && !profile && posthog.__loaded) {
          posthog.reset();
        }
      }
    } catch (e) {
      console.warn('Posthog initialization failed. Tracking disabled.', e);
    }
  }, [isLoaded, admin_settings_kv, profile]);

  return (
    <SEOProvider>
      <RouteChangeResetBoundary>
        <I18nProvider>
      <SkipToContent />
      <CookieConsent />
      <Toaster position="top-center" toastOptions={{
        duration: 4000,
        className: 'shadow-2xl border border-gray-100/50',
        style: { 
          borderRadius: '16px', 
          background: '#ffffff', 
          color: '#1a1a1a',
          padding: '14px 24px',
          fontWeight: '600',
          fontSize: '14px',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)'
        },
        success: {
          iconTheme: { primary: '#D4AF37', secondary: '#fff' }
        },
        error: {
          iconTheme: { primary: '#8B1A1A', secondary: '#fff' }
        }
      }} />
      <SettingsSocketProvider />
      <SecurityGuard />
      {!initialized && !new URLSearchParams(window.location.search).has('screenshot') ? (
        <div className="min-h-screen pt-20 bg-gray-50">
          <PageSkeleton />
        </div>
      ) : (
        <Suspense fallback={<div className="min-h-screen pt-20 bg-gray-50"><PageSkeleton /></div>}>
          <Routes>
            {/* Dynamic Membership Route */}
            <Route element={<MembershipLayoutWrapper />}>
              <Route path="/membership" element={<MembershipPage />} />
            </Route>

            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/success-stories" element={<SuccessStoriesPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/pending-approval" element={<PendingApprovalPage />} />
              <Route path="/reactivation-pending" element={<ReactivationPendingPage />} />
              <Route path="/match-confirmation" element={<MatchConfirmationPage />} />
            </Route>

            {/* Standalone: no layout needed */}
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/interests" element={<InterestsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/shortlist" element={<ShortlistPage />} />
                <Route path="/who-viewed-me" element={<WhoViewedMePage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/complete-profile" element={<CompleteProfilePage />} />
                <Route path="/profile/:id" element={<ViewProfilePage />} />
                <Route path="/success-stories/share" element={<SuccessStorySharePage />} />
                <Route path="/credits" element={<BuyCreditsPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/verification" element={<AdminVerificationPage />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/users/:id" element={<AdminUserDetail />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/success-stories" element={<AdminSuccessStories />} />
                <Route path="/admin/contacts" element={<AdminContacts />} />
                <Route path="/admin/content" element={<AdminContentCMS />} />
                <Route path="/admin/seo-marketing" element={<AdminSEOMarketing />} />
                <Route path="/admin/legal-pages" element={<AdminLegalPages />} />
                <Route path="/admin/unblock" element={<AdminUnblockRequests />} />
                <Route path="/admin/payment-gateways" element={<AdminPaymentGateways />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/emails" element={<AdminEmailTemplates />} />
                <Route path="/admin/financials" element={<AdminFinancials />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/plans" element={<AdminPlans />} />
                <Route path="/admin/coupons" element={<AdminCoupons />} />
                <Route path="/admin/communities" element={<AdminCommunities />} />
                <Route path="/admin/managers" element={<AdminManagers />} />
                <Route path="/admin/match-confirmations" element={<AdminMatchConfirmations />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
      </I18nProvider>
    </RouteChangeResetBoundary>
    </SEOProvider>
  )
}

export default App
