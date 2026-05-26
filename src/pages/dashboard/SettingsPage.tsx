import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, Shield, Bell, Lock, AlertTriangle, User, Eye, EyeOff, Save, Trash2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { updatePassword, updateProfileField, deactivateAccount, deleteAccount } from '../../lib/actions/authActions';
import { getVerificationStatus } from '../../lib/actions/documentActions';
import { getBlockedUsers, unblockUser } from '../../lib/actions/dashboardActions';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SettingsSkeleton } from '../../components/ui/Skeletons';
import DocumentUploadSection from '../../components/DocumentUploadSection';
import Badge from '../../components/ui/Badge';
import { apiUrl } from '../../lib/api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, setUser, setProfile , loading: authLoading} = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  
  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => setOtpCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const handleSendOTP = async (targetPhone: string) => {
    if (!/^\d{10}$/.test(targetPhone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'OTP Sent successfully');
        setOtpSent(true);
        setOtpCountdown(90);
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTPAndSave = async (targetPhone: string) => {
    const code = otpValues.join('');
    if (code.length !== 6) return;

    setOtpLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, otp: code })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Phone verified successfully!');
        // Now save the phone number
        await handleSavePhone(targetPhone);
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    newOtp[index] = value.substring(value.length - 1);
    setOtpValues(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  
  // Account Settings State
  const [phone, setPhone] = useState(profile?.phone || '');
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  
  // Privacy Settings State
  const [visibility, setVisibility] = useState(profile?.is_active ? 'visible' : 'hidden');
  const [showPhone, setShowPhone] = useState(true);
  const [showPhotos, setShowPhotos] = useState(profile?.photo_privacy || 'everyone');
  
  // Notification Settings State
  const [notifications, setNotifications] = useState({
    interests: true,
    messages: true,
    profileViews: false
  });

  // Dialog States
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Blocked Users State
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchVerificationStatus();
    }
  }, [user?.id]);

  const fetchVerificationStatus = async () => {
    try {
      const status = await getVerificationStatus((user?.id || ''));
      setVerificationStatus(status);
    } catch (error) {
      console.error('Error fetching verification status:', error);
    }
  };

  useEffect(() => {
    if (profile?.phone && !phone) {
      setPhone(profile.phone);
    }
  }, [profile?.phone]);

  const handleUpdatePhone = async (phoneToSave?: string) => {
    const target = phoneToSave !== undefined ? phoneToSave : phone;
    if (!target || !/^\d{10}$/.test(target)) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    // Trigger OTP sending before saving
    handleSendOTP(target);
  };

  const handleSavePhone = async (target: string) => {
    setLoading(true);
    try {
      await updateProfileField((user?.id || ''), { phone: target });
      setPhone(target);
      if (profile) {
        setProfile({ ...profile, phone: target });
      }
      setNewPhone('');
      setShowPhoneEdit(false);
      setOtpSent(false);
      setOtpValues(['', '', '', '', '', '']);
      toast.success('Phone number updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.new.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      await updatePassword(passwords.new);
      toast.success('Password updated successfully');
      setShowPasswordForm(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrivacy = async (field: string, value: any) => {
    try {
      if (field === 'visibility') {
        const isActive = value === 'visible';
        await updateProfileField((user?.id || ''), { is_active: isActive });
        setVisibility(value);
        toast.success(`Profile is now ${value}`);
      } else if (field === 'showPhone') {
        await updateProfileField((user?.id || ''), { phone_privacy: value ? 'accepted' : 'hidden' });
        setShowPhone(value);
        toast.success('Phone visibility updated');
      } else if (field === 'showPhotos') {
        await updateProfileField((user?.id || ''), { photo_privacy: value });
        setShowPhotos(value);
        toast.success('Photo visibility updated');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update privacy settings');
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateAccount((user?.id || ''));
      setUser(null);
      setProfile(null);
      toast.success('Account deactivated successfully');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate account');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAccount((user?.id || ''));
      setUser(null);
      setProfile(null);
      toast.success('Account permanently deleted');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    }
  };

  const handleFetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const users = await getBlockedUsers((user?.id || ''));
      setBlockedUsers(users);
      setShowBlockedModal(true);
    } catch (error) {
      toast.error('Failed to load blocked users');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    try {
      await unblockUser((user?.id || ''), blockedId);
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedId));
      toast.success('User unblocked successfully');
    } catch (error) {
      toast.error('Failed to unblock user');
    }
  };

  // Guard: wait for auth to be ready before rendering
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <SettingsSkeleton />
      </div>
    );
  }
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
          <Settings className="text-primary" size={32} />
          Account Settings
        </h1>

        <div className="space-y-8">
          
          {/* Section 1: Account Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <User className="text-gray-500" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Account Information</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                  {user?.email}
                  <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">Read-only</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                {phone ? (
                  // User already has a phone number — show it read-only with Replace button
                  !showPhoneEdit ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
                        +91 {phone}
                        <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">Registered</span>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => { setShowPhoneEdit(true); setNewPhone(''); }}
                      >
                        Replace
                      </Button>
                    </div>
                  ) : (
                    // Replace form: Old + New number inputs
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Old Mobile Number</label>
                        <div className="flex items-center p-3 bg-white border border-gray-200 rounded-lg text-gray-500 select-none">
                          +91 {phone}
                          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Current</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">New Mobile Number</label>
                        <Input
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="Enter new 10-digit mobile number"
                        />
                      </div>
                      <div className="flex gap-3 pt-1">
                        {!otpSent ? (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => handleUpdatePhone(newPhone)}
                              loading={otpLoading}
                              disabled={newPhone.length !== 10 || newPhone === phone}
                            >
                              Send OTP
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => { setShowPhoneEdit(false); setNewPhone(''); setOtpSent(false); }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <div className="w-full bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in zoom-in duration-300">
                            <label className="block text-sm font-bold text-gray-800 mb-2 text-center">Enter 6-Digit OTP</label>
                            <div className="flex justify-center gap-2 mb-4">
                              {otpValues.map((digit, index) => (
                                <input
                                  key={index}
                                  ref={el => otpRefs.current[index] = el}
                                  type="text"
                                  inputMode="numeric"
                                  className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                                  value={digit}
                                  onChange={e => handleOtpChange(index, e.target.value)}
                                  onKeyDown={e => handleOtpKeyDown(index, e)}
                                />
                              ))}
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                              <div className="text-sm font-medium text-gray-500">
                                {otpCountdown > 0 ? (
                                  <span>Resend OTP in <span className="text-primary font-bold">{otpCountdown}s</span></span>
                                ) : (
                                  <button type="button" onClick={() => handleSendOTP(newPhone)} className="text-primary hover:underline font-bold" disabled={otpLoading}>
                                    Resend OTP
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setOtpSent(false)} disabled={otpLoading || loading}>Cancel</Button>
                                <Button variant="primary" type="button" onClick={() => handleVerifyOTPAndSave(newPhone)} loading={otpLoading || loading} disabled={otpValues.join('').length !== 6}>
                                  Verify & Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  // No phone registered — show plain input + Save
                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex gap-3">
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="flex-1"
                        disabled={otpSent}
                      />
                      {!otpSent && (
                        <Button
                          variant="outline"
                          onClick={() => handleUpdatePhone(phone)}
                          loading={otpLoading}
                          disabled={phone.length !== 10}
                        >
                          Send OTP
                        </Button>
                      )}
                    </div>
                    {otpSent && (
                      <div className="w-full bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in zoom-in duration-300">
                        <label className="block text-sm font-bold text-gray-800 mb-2 text-center">Enter 6-Digit OTP</label>
                        <div className="flex justify-center gap-2 mb-4">
                          {otpValues.map((digit, index) => (
                            <input
                              key={index}
                              ref={el => otpRefs.current[index] = el}
                              type="text"
                              inputMode="numeric"
                              className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                              value={digit}
                              onChange={e => handleOtpChange(index, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(index, e)}
                            />
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="text-sm font-medium text-gray-500">
                            {otpCountdown > 0 ? (
                              <span>Resend OTP in <span className="text-primary font-bold">{otpCountdown}s</span></span>
                            ) : (
                              <button type="button" onClick={() => handleSendOTP(phone)} className="text-primary hover:underline font-bold" disabled={otpLoading}>
                                Resend OTP
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setOtpSent(false)} disabled={otpLoading || loading}>Cancel</Button>
                            <Button variant="primary" type="button" onClick={() => handleVerifyOTPAndSave(phone)} loading={otpLoading || loading} disabled={otpValues.join('').length !== 6}>
                              Verify & Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                {!showPasswordForm ? (
                  <Button variant="outline" onClick={() => setShowPasswordForm(true)} className="flex items-center gap-2">
                    <Lock size={16} /> Change Password
                  </Button>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                      <Lock size={16} className="text-primary" /> Update Password
                    </h3>
                    <Input 
                      type="password" 
                      label="Current Password" 
                      value={passwords.current} 
                      onChange={(e) => setPasswords({...passwords, current: e.target.value})} 
                      required
                    />
                    <Input 
                      type="password" 
                      label="New Password" 
                      value={passwords.new} 
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})} 
                      required
                    />
                    <Input 
                      type="password" 
                      label="Confirm New Password" 
                      value={passwords.confirm} 
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} 
                      required
                    />
                    <div className="flex gap-3 pt-2">
                      <Button type="submit" variant="primary" loading={loading}>Update Password</Button>
                      <Button type="button" variant="ghost" onClick={() => setShowPasswordForm(false)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Verification */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="text-gray-500" size={20} />
                <h2 className="text-lg font-bold text-gray-900">Verification Status</h2>
              </div>
              {verificationStatus?.isFullyVerified ? (
                <Badge variant="verified" />
              ) : verificationStatus?.hasPending ? (
                <Badge variant="pending" text="Under Review" />
              ) : verificationStatus?.hasRejected ? (
                <Badge variant="declined" text="Action Required" />
              ) : (
                <Badge variant="offline" text="Unverified" />
              )}
            </div>
            <div className="p-6">
              <DocumentUploadSection 
                userId={(user?.id || '')} 
                onUploadComplete={fetchVerificationStatus}
              />
              <div className="mt-6 text-center">
                <Link to="/my-profile?tab=verification">
                  <Button variant="ghost" className="text-primary">Go to full verification page →</Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Section 3: Privacy Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Eye className="text-gray-500" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Privacy Settings</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">Profile Visibility</h3>
                  <p className="text-sm text-gray-500">Control who can see your profile in search results</p>
                </div>
                <div className="w-full sm:w-48">
                  <Select 
                    options={[
                      { value: 'visible', label: 'Visible to All' },
                      { value: 'hidden', label: 'Hidden (Private)' }
                    ]}
                    value={visibility}
                    onChange={(e) => handleUpdatePrivacy('visibility', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">Show Phone Number</h3>
                  <p className="text-sm text-gray-500">Allow accepted matches to see your phone number</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={showPhone}
                    onChange={(e) => handleUpdatePrivacy('showPhone', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Show Photos To</h3>
                  <p className="text-sm text-gray-500">Control who can view your full-size photos</p>
                </div>
                <div className="w-full sm:w-64">
                  <Select 
                    options={[
                      { value: 'everyone', label: 'All Registered Members' },
                      { value: 'accepted', label: 'Accepted Interests Only' }
                    ]}
                    value={showPhotos}
                    onChange={(e) => handleUpdatePrivacy('showPhotos', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">View Blocked User</h3>
                  <p className="text-sm text-gray-500">Manage users you have blocked from contacting you</p>
                </div>
                <div className="w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={handleFetchBlockedUsers}
                    loading={loadingBlocked}
                  >
                    View Blocked List
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Notification Preferences */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Bell className="text-gray-500" size={20} />
              <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">Interest Notifications</h3>
                  <p className="text-sm text-gray-500">Get notified when someone sends or accepts an interest</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.interests}
                    onChange={(e) => {
                      setNotifications({...notifications, interests: e.target.checked});
                      toast.success('Notification preferences updated');
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">Message Notifications</h3>
                  <p className="text-sm text-gray-500">Get notified when you receive a new message</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.messages}
                    onChange={(e) => {
                      setNotifications({...notifications, messages: e.target.checked});
                      toast.success('Notification preferences updated');
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Profile View Notifications</h3>
                  <p className="text-sm text-gray-500">Get notified when someone views your profile</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.profileViews}
                    onChange={(e) => {
                      setNotifications({...notifications, profileViews: e.target.checked});
                      toast.success('Notification preferences updated');
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 5: Danger Zone */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-red-100 bg-red-50 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              <h2 className="text-lg font-bold text-red-800">Danger Zone</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div>
                  <h3 className="font-medium text-gray-900">Deactivate Account</h3>
                  <p className="text-sm text-gray-500">Temporarily hide your profile from all searches. You can reactivate later.</p>
                </div>
                <Button 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  onClick={() => setShowDeactivateDialog(true)}
                >
                  Deactivate Account
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-500">Permanently delete your account and all associated data. This cannot be undone.</p>
                </div>
                <Button 
                  variant="danger" 
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Trash2 size={16} /> Delete Account
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showDeactivateDialog}
        onClose={() => setShowDeactivateDialog(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Account"
        message="Are you sure you want to deactivate your account? Your profile will be hidden from all searches and matches until you log back in and reactivate it."
        confirmText="Yes, Deactivate"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Account Permanently"
        message="This action cannot be undone. All your data, photos, messages, and matches will be permanently deleted from our servers."
        confirmText="Yes, Delete Everything"
        variant="danger"
      />

      {/* Blocked Users Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Blocked Users</h3>
              <button 
                onClick={() => setShowBlockedModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <AlertTriangle className="hidden" /> {/* just to import icon */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {blockedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="text-gray-400" size={32} />
                  </div>
                  <h4 className="text-gray-900 font-medium mb-1">No Blocked Users</h4>
                  <p className="text-sm text-gray-500">You haven't blocked anyone yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {blockedUsers.map((blockedUser) => (
                    <div key={blockedUser.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm">
                          {blockedUser.profile_photo_url ? (
                            <img src={blockedUser.profile_photo_url} alt={blockedUser.first_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary-50 text-primary font-bold">
                              {blockedUser.first_name?.[0] || 'U'}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{blockedUser.first_name} {blockedUser.last_name}</h4>
                          <p className="text-xs text-gray-500">Blocked on {new Date(blockedUser.blocked_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-primary border-primary-200 hover:bg-primary-50"
                        onClick={() => handleUnblock(blockedUser.id)}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-right">
              <Button variant="ghost" onClick={() => setShowBlockedModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
