import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { resetPassword, verifyResetOTP, confirmPasswordReset } from '../lib/actions/authActions'
import { useMasterData } from '../store/masterDataStore'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft, Heart, CheckCircle, Shield, Lock, Eye, EyeOff } from 'lucide-react'

type Step = 'email' | 'otp' | 'newpassword' | 'done'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { admin_settings_kv } = useMasterData()
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan'

  const [step, setStep]               = useState<Step>('email')
  const [email, setEmail]             = useState('')
  const [otp, setOtp]                 = useState('')
  const [resetToken, setResetToken]   = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [loading, setLoading]         = useState(false)

  // Split brand name for two-part logo display
  const logoPart1 = brandName.includes(' ')
    ? brandName.split(' ')[0]
    : brandName.replace(/([A-Z][a-z]+)([A-Z])/, '$1')
  const logoPart2 = brandName.includes(' ')
    ? brandName.split(' ').slice(1).join(' ')
    : brandName.replace(/^[A-Z][a-z]+/, '')

  // Step 1 — Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return toast.error('Please enter your email')
    setLoading(true)
    try {
      await resetPassword(email)
      toast.success('OTP sent to your email!')
      setStep('otp')
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  // Step 2 — Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) return toast.error('Please enter the 6-digit OTP')
    setLoading(true)
    try {
      const data = await verifyResetOTP(email, otp)
      setResetToken(data.resetToken)
      toast.success('OTP verified!')
      setStep('newpassword')
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP')
    } finally { setLoading(false) }
  }

  // Step 3 — Set New Password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) return toast.error('Password must be at least 8 characters')
    if (newPassword !== confirmPw) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      await confirmPasswordReset(email, resetToken, newPassword)
      toast.success('Password changed successfully!')
      setStep('done')
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  // Step indicator dots
  const steps: Step[] = ['email', 'otp', 'newpassword', 'done']
  const currentStepIdx = steps.indexOf(step)

  return (
    <div
      className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #6B1A1A 0%, #8B1A1A 50%, #B22222 100%)' }}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">

        {/* ── Dynamic Brand Logo ── */}
        <div className="flex justify-center items-center mb-6">
          <span
            className="font-heading font-bold text-4xl drop-shadow-lg"
            style={{ color: '#F5C518' }}
          >
            {logoPart1}
          </span>
          <Heart
            className="mx-2 drop-shadow-lg"
            size={34}
            fill="#F5C518"
            style={{ color: '#F5C518' }}
          />
          <span className="font-heading font-bold text-4xl text-white drop-shadow-lg">
            {logoPart2}
          </span>
        </div>

        {/* ── Step indicator dots ── */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStepIdx
                  ? 'w-6 bg-yellow-400'
                  : i < currentStepIdx
                  ? 'w-2 bg-yellow-400/60'
                  : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* ── White Card ── */}
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100">

          {/* ── Step 1: Enter Email ── */}
          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 font-heading">Forgot Password?</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Enter your email and we'll send you a 6-digit OTP to reset your password.
                </p>
              </div>
              <form onSubmit={handleSendOTP} className="space-y-6">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="Enter your registered email"
                  icon={<Mail size={18} />}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                  Send OTP
                </Button>
              </form>
            </>
          )}

          {/* ── Step 2: Enter OTP ── */}
          {step === 'otp' && (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 font-heading">Enter OTP</h2>
                <p className="mt-2 text-sm text-gray-600">
                  We sent a 6-digit OTP to{' '}
                  <span className="font-medium text-gray-900">{email}</span>.
                  Valid for 10 minutes.
                </p>
              </div>
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <Input
                  label="6-Digit OTP"
                  type="text"
                  placeholder="Enter OTP"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                  Verify OTP
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setOtp('') }}
                  className="w-full text-sm text-gray-500 hover:text-primary text-center"
                >
                  Didn't receive OTP? Go back
                </button>
              </form>
            </>
          )}

          {/* ── Step 3: Set New Password ── */}
          {step === 'newpassword' && (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 font-heading">Set New Password</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Choose a strong password of at least 8 characters.
                </p>
              </div>
              <form onSubmit={handleSetPassword} className="space-y-6">
                <div className="relative">
                  <Input
                    label="New Password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-9 text-gray-400"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat new password"
                  required
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
                <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
                  Update Password
                </Button>
              </form>
            </>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="text-center py-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 font-heading mb-2">Password Updated!</h2>
              <p className="text-gray-600 mb-8">
                Your password has been changed successfully. Please login with your new password.
              </p>
              <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}

          {/* Back to login link */}
          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-white/70 hover:text-white flex items-center justify-center gap-2"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
