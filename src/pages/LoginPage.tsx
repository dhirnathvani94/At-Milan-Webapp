import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import { useMasterData } from '../store/masterDataStore'
import { loginUser, socialLoginUser } from '../lib/actions/authActions'
import { signInWithSocial } from '../lib/firebase'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'
import { Mail, Lock, CheckCircle, Heart } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [rememberMe, setRememberMe] = useState(false)
  
  const navigate = useNavigate()
  const { user, setUser, setProfile } = useAuthStore()
  const { admin_settings_kv } = useMasterData()
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan'

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    const newErrors: { email?: string; password?: string } = {}
    if (!email) newErrors.email = 'Email is required'
    if (!password) newErrors.password = 'Password is required'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setLoading(true)
    try {
      const data = await loginUser(email, password)
      
      // Reset initialization state and forcefully re-initialize all user context
      useAuthStore.setState({ initialized: false })
      await useAuthStore.getState().initialize()
      
      const authStore = useAuthStore.getState()
      const profile = authStore.profile
      
      toast.success(`Welcome back, ${profile?.first_name || 'User'}! 👋`)
      if (profile?.role === 'admin') {
        navigate('/admin')
      } else {
        // Check if profile is blocked — navigate to reactivation page
        const blockedStatuses = ['yellow', 'red', 'engaged', 'married']
        if (profile?.profile_status &&
            blockedStatuses.includes(profile.profile_status)) {
          navigate('/reactivation-pending')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setLoading(true)
    try {
      const socialUser = await signInWithSocial(provider)
      if (!socialUser || !socialUser.email) throw new Error('Could not retrieve email from provider')
      
      const data = await socialLoginUser(socialUser.email, provider)
      
      // Reset initialization state and forcefully re-initialize all user context
      useAuthStore.setState({ initialized: false })
      await useAuthStore.getState().initialize()
      
      const authStore = useAuthStore.getState()
      const profile = authStore.profile
      
      toast.success(`Welcome back, ${profile?.first_name || 'User'}! 👋`)
      if (profile?.role === 'admin') {
        navigate('/admin')
      } else {
        // Check if profile is blocked — navigate to reactivation page
        const blockedStatuses = ['yellow', 'red', 'engaged', 'married']
        if (profile?.profile_status &&
            blockedStatuses.includes(profile.profile_status)) {
          navigate('/reactivation-pending')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (error: any) {
      if (error.message.includes('not configured')) {
        toast.error('Social Login is not configured. Admin needs to add Firebase credentials.')
      } else {
        toast.error(error.message || `Failed to login via ${provider}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-5/12 bg-gradient-to-br from-primary-800 via-primary to-primary-700 flex-col justify-center px-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Heart className="text-secondary" size={28} fill="currentColor" />
            <span className="text-white font-heading font-bold text-3xl">{siteName}</span>
          </div>
          
          <div className="mt-12">
            <h1 className="text-4xl font-heading font-bold text-white">Welcome Back! 👋</h1>
            <p className="text-xl text-white/80 mt-4">Your perfect match is waiting</p>
          </div>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-secondary" size={20} />
              <span className="text-white/90">500+ couples matched this year</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-secondary" size={20} />
              <span className="text-white/90">100% verified profiles</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-secondary" size={20} />
              <span className="text-white/90">Safe & secure platform</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute top-1/4 -right-12 w-48 h-48 bg-white opacity-10 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-secondary opacity-10 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-7/12 bg-white min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full mx-auto">
          <h2 className="text-3xl font-heading font-bold text-gray-900">Login to {siteName}</h2>
          <p className="mt-2 text-gray-600">
            New here? <Link to="/register" className="text-primary font-semibold hover:underline">Register Free</Link>
          </p>
          
          <form onSubmit={handleSubmit} className="mt-8">
            <Input
              label="Email or Phone Number"
              type="text"
              placeholder="Enter email or phone number"
              icon={<Mail size={18} />}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            
            <div className="mt-4">
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                icon={<Lock size={18} />}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />
            </div>
            
            <div className="mt-3 flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>
            
            <div className="mt-6">
              <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                Login
              </Button>
            </div>
            
            <div className="mt-6 flex items-center gap-4">
              <hr className="flex-1 border-gray-200" />
              <span className="text-gray-400 text-sm">or</span>
              <hr className="flex-1 border-gray-200" />
            </div>
            
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={loading}
                className="w-full border border-gray-300 rounded-lg py-2.5 flex items-center justify-center gap-3 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin('facebook')}
                disabled={loading}
                className="w-full border border-[#1877F2] rounded-lg py-2.5 flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] transition-colors font-medium text-white shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>
            </div>
            
            <p className="mt-8 text-center text-sm text-gray-500">
              Don't have an account? <Link to="/register" className="text-primary font-semibold hover:underline">Register Free</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
