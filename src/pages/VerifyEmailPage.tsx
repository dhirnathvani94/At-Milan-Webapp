import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    fetch(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-gray-100">
        {/* Logo / Branding */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">SM</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Email Verification</h1>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={48} className="text-primary animate-spin" />
            <p className="text-gray-600 font-medium">Verifying your email address…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Email Verified! 🎉</h2>
            <p className="text-gray-600 leading-relaxed">{message}</p>
            <p className="text-gray-500 text-sm">You can now log in and access all features of the platform.</p>
            <Link
              to="/login"
              className="mt-4 w-full bg-gradient-to-r from-primary to-primary-700 text-white px-8 py-3 rounded-xl font-bold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Go to Login →
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
              <XCircle size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Verification Failed</h2>
            <p className="text-gray-600 leading-relaxed">{message}</p>
            <p className="text-gray-500 text-sm">If the link expired, you can resend from your profile page.</p>
            <Link
              to="/login"
              className="mt-4 w-full border border-primary text-primary px-8 py-3 rounded-xl font-bold text-base hover:bg-primary-50 transition-all"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
