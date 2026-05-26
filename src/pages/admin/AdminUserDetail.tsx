import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, User, Shield, ShieldOff, Trash2, CheckCircle, XCircle, 
  AlertTriangle, Image as ImageIcon, FileText, Mail, Phone, MapPin, 
  Briefcase, GraduationCap, Heart, Clock, Flag, MessageSquare, Activity, Check,
  CreditCard, Crown, Plus, Minus, Send, Eye, ChevronRight, X, RotateCcw, RotateCw, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getAdminUserFullDetail, updateUserField, adminBlockUser, 
  adminUnblockUser, adminDeleteUser, updateVerificationStatus, approveAllDocuments,
  adminUpdateCredits, adminAssignPremium, adminRemovePremium, getUserAllChats,
  getUserChatHistory, getMembershipPlans
} from '../../lib/actions/adminActions';
import { generateInvoiceHTML } from '../../components/credits/MembershipWidget';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatDate, getRelativeTime } from '../../lib/utils';
import { ProfileDetailSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();

  // Reset user password state
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmUserPassword, setConfirmUserPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const navigate = useNavigate();
  const { user: adminUser } = useAuthStore();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockType, setBlockType] = useState<'temp' | 'permanent'>('temp');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Credit management state
  const [creditAction, setCreditAction] = useState<'add' | 'remove'>('add');
  const [creditType, setCreditType] = useState<'free' | 'paid'>('free');
  const [creditAmount, setCreditAmount] = useState<number>(1);
  
  // Premium management state
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [premiumDuration, setPremiumDuration] = useState<number>(1);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  // Chat history state
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [selectedChatPartner, setSelectedChatPartner] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatOtherUser, setChatOtherUser] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const { on: socketOn, off: socketOff } = useSocketStore();

  useEffect(() => {
    if (id) {
      fetchUserDetail();
    }
  }, [id]);

  // Real-time: listen for admin socket events and refresh user detail
  useEffect(() => {
    const handleProfileUpdated = (data: any) => {
      // Handles admin:profile-updated { id, profile } and profile:updated (direct profile object)
      const matchId = data.id || data.user_id;
      if (matchId === id || (data.free_credits_remaining !== undefined && !matchId)) {
        fetchUserDetail();
      }
    };
  const handleDocStatusChanged = (data: any) => { if (data.userId === id) fetchUserDetail(); };
    const handleDocUploaded = (data: any) => { if (data.userId === id) fetchUserDetail(); };
    const handleInterestSent = (data: any) => { if (data.sender_id === id || data.receiver_id === id) fetchUserDetail(); };
    const handleMessageSent = (data: any) => { 
      if (data.sender_id === id || data.receiver_id === id) {
        fetchUserDetail();
        // If the admin is actively viewing this specific chat, append the message
        setChatMessages(prev => {
          // If the message belongs to the currently open chat
          if (
            (data.sender_id === id && data.receiver_id === selectedChatPartner) ||
            (data.receiver_id === id && data.sender_id === selectedChatPartner)
          ) {
            // Check if message is already there to prevent duplicates
            if (!prev.find(m => m.id === data.id)) {
              return [...prev, data];
            }
          }
          return prev;
        });
        
        // Also refresh conversations list if active
        if (activeTab === 'chats' && !selectedChatPartner) {
          fetchChatConversations();
        }
      }
    };
    const handleUserReported = (data: any) => { if (data.reporter_id === id || data.reported_user_id === id) fetchUserDetail(); };
    const handleUserBlocked = (data: any) => { if (data.blocker_id === id || data.blocked_id === id) fetchUserDetail(); };
    const handleUserUnblocked = (data: any) => { if (data.blocker_id === id || data.blocked_id === id) fetchUserDetail(); };

    socketOn('admin:profile-updated', handleProfileUpdated);
    socketOn('admin:doc-status-changed', handleDocStatusChanged);
    socketOn('admin:doc-uploaded', handleDocUploaded);
    socketOn('admin:interest-sent', handleInterestSent);
    socketOn('admin:message-sent', handleMessageSent);
    socketOn('admin:user-reported', handleUserReported);
    socketOn('admin:user-blocked', handleUserBlocked);
    socketOn('admin:user-unblocked', handleUserUnblocked);

    return () => {
      socketOff('admin:profile-updated', handleProfileUpdated);
      socketOff('admin:doc-status-changed', handleDocStatusChanged);
      socketOff('admin:doc-uploaded', handleDocUploaded);
      socketOff('admin:interest-sent', handleInterestSent);
      socketOff('admin:message-sent', handleMessageSent);
      socketOff('admin:user-reported', handleUserReported);
      socketOff('admin:user-blocked', handleUserBlocked);
      socketOff('admin:user-unblocked', handleUserUnblocked);
    };
  }, [id, activeTab, selectedChatPartner]);

  // ── Reset user password — component-level handler ──────────────────────────
  const handleResetUserPassword = async () => {
    if (!newUserPassword || newUserPassword.length < 8) {
      return toast.error('Password must be at least 8 characters.');
    }
    if (newUserPassword !== confirmUserPassword) {
      return toast.error('Passwords do not match.');
    }
    setResettingPassword(true);
    try {
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl(`/api/admin/users/${id}/reset-password`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newUserPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      toast.success('User password reset successfully!');
      setNewUserPassword('');
      setConfirmUserPassword('');
      setShowPasswordReset(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      const data = await getAdminUserFullDetail(id!);
      setUser(data);
    } catch (error) {
      toast.error('Failed to fetch user details');
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      setActionLoading(true);
      await updateUserField(id!, 'is_active', !user.is_active);
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePremium = async () => {
    try {
      setActionLoading(true);
      await updateUserField(id!, 'is_premium', !user.is_premium);
      toast.success(`User premium status updated`);
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to update premium status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      setActionLoading(true);
      await updateUserField(id!, 'role', newRole);
      toast.success(`User role updated to ${newRole}`);
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to update user role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockReason.trim()) {
      toast.error('Please provide a reason for blocking');
      return;
    }
    
    try {
      setActionLoading(true);
      await adminBlockUser(id!, blockType, blockReason);
      toast.success(`User ${blockType === 'temp' ? 'temporarily' : 'permanently'} blocked`);
      setBlockModalOpen(false);
      setBlockReason('');
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to block user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!window.confirm('Are you sure you want to unblock this user?')) return;
    try {
      setActionLoading(true);
      await adminUnblockUser(id!);
      toast.success('User unblocked successfully');
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm('WARNING: This will permanently delete the user and all associated data. This action cannot be undone. Are you absolutely sure?')) return;
    try {
      setActionLoading(true);
      await adminDeleteUser(id!);
      toast.success('User deleted successfully');
      navigate('/admin/users');
    } catch (error) {
      toast.error('Failed to delete user');
      setActionLoading(false);
    }
  };

  const handleVerifyDocument = async (docType: string, status: string) => {
    let reason = '';
    if (status === 'rejected') {
      const promptReason = window.prompt(`Please enter the reason for rejecting the ${docType.replace('_', ' ')}:`);
      if (promptReason === null) return; // cancelled
      reason = promptReason.trim();
      if (!reason) {
        toast.error('Reason is required for rejection');
        return;
      }
    }

    try {
      setActionLoading(true);
      await updateVerificationStatus(id!, docType, status, reason);
      toast.success(`Document marked as ${status}`);
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to update document status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAllDocuments = async () => {
    try {
      setActionLoading(true);
      await approveAllDocuments(id!, (adminUser?.id || ''));
      toast.success('All pending documents approved');
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to approve documents');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDocument = async (docType: string) => {
    if (!window.confirm(`Are you sure you want to remove the ${docType.replace('_', ' ')}? This cannot be undone.`)) return;
    try {
      setActionLoading(true);
      await fetch(apiUrl(`/api/admin/users/${id}/documents/${docType}`), { method: 'DELETE' });
      toast.success('Document removed successfully');
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to remove document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplaceDocument = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('document_type', docType);
    formData.append('file', file);
    
    try {
      setActionLoading(true);
      const res = await fetch(apiUrl(`/api/admin/users/${id}/documents/upload`), {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      toast.success('Document replaced successfully');
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to replace document');
    } finally {
      setActionLoading(false);
    }
  };

  // Dedicated credit refresh — bypasses cache to always get live values
  const refreshCreditsOnly = async () => {
    if (!id) return;
    try {
      const res = await fetch(apiUrl(`/api/credits/${id}?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const cd = await res.json();
        if (cd) {
          setUser((prev: any) => ({
            ...prev,
            free_views_remaining: cd.free_views_remaining ?? prev.free_views_remaining,
            free_monthly_limit: cd.free_monthly_limit ?? prev.free_monthly_limit,
            paid_views_balance: cd.paid_views_balance ?? prev.paid_views_balance,
            paid_credits_expiry: cd.paid_credits_expiry ?? prev.paid_credits_expiry,
          }));
        }
      }
    } catch (e) {
      console.error('Credit refresh error:', e);
    }
  };

  const handleUpdateCredits = async () => {
    if (!creditAmount || creditAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    try {
      setActionLoading(true);
      const result = await adminUpdateCredits(id!, creditAction, creditType, creditAmount);
      // 1. Immediately apply returned values from the API response
      if (result) {
        setUser((prev: any) => ({
          ...prev,
          free_views_remaining: result.free_views_remaining ?? result.free_credits_remaining ?? prev.free_views_remaining,
          paid_views_balance: result.paid_views_balance ?? result.paid_credits ?? prev.paid_views_balance,
        }));
      }
      toast.success(`${creditAction === 'add' ? 'Added' : 'Removed'} ${creditAmount} ${creditType} credits`);
      // 2. Immediately fetch fresh credits from DB (no cache)
      await refreshCreditsOnly();
      // 3. Full refresh in background for all other data
      fetchUserDetail();
    } catch (error) {
      toast.error('Failed to update credits');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignPremium = async () => {
    if (!selectedPlanId) {
      toast.error('Please select a membership plan');
      return;
    }
    if (!premiumDuration || premiumDuration < 1) {
      toast.error('Please enter a valid duration (minimum 1 month)');
      return;
    }
    try {
      setActionLoading(true);

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + premiumDuration);

      let planName = `Custom (${premiumDuration}m)`;

      if (selectedPlanId !== 'custom') {
        // Real plan — get plan name from loaded plans
        const selectedPlan = membershipPlans.find((p: any) => p.id === selectedPlanId);
        if (selectedPlan) planName = selectedPlan.name;
      }

      // Always use PATCH directly — works for both custom and real plans
      // This is the existing endpoint that always works and emits socket events
      const res = await fetch(apiUrl(`/api/profiles/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_premium: true,
          premium_plan: planName,
          premium_end: expiresAt.toISOString(),
          plan_id: selectedPlanId,
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || 'Failed to assign premium');
      }
      const data = await res.json();

      // Update local state immediately from response — no stale data
      setUser((prev: any) => ({
        ...prev,
        is_premium: true,
        premium_plan: planName,
        premium_end: expiresAt.toISOString(),
        plan_id: selectedPlanId,
        ...(data.profile || {}),
      }));

      toast.success('Premium membership assigned successfully');
      setShowPremiumModal(false);
      fetchUserDetail();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to assign premium');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePremium = async () => {
    if (!window.confirm('Are you sure you want to remove premium membership from this user?')) return;
    try {
      setActionLoading(true);

      // Use PATCH directly — always works, emits socket events
      const res = await fetch(apiUrl(`/api/profiles/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_premium: false,
          premium_plan: null,
          premium_end: null,
          plan_id: 'free',
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || 'Failed to remove premium');
      }

      // Update local state immediately
      setUser((prev: any) => ({
        ...prev,
        is_premium: false,
        premium_plan: null,
        premium_end: null,
        plan_id: 'free',
      }));

      toast.success('Premium membership removed');
      fetchUserDetail();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove premium');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadInvoice = (type: 'credit' | 'membership', data: any) => {
    let planName = data.plan_id || data.plan_name || 'Custom Plan';
    let html = '';
    if (type === 'membership') {
      html = generateInvoiceHTML(user, planName, data.expires_at || data.created_at);
    } else {
      html = generateInvoiceHTML(user, planName, null);
      html = html.replace(/Subscription Period/g, 'Purchase Date').replace(/Membership Plan/g, 'Credit Pack');
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const fetchChatConversations = async () => {
    if (!id) return;
    try {
      setChatLoading(true);
      const chats = await getUserAllChats(id);
      setChatConversations(chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchChatMessages = async (partnerId: string) => {
    if (!id) return;
    try {
      setChatLoading(true);
      setSelectedChatPartner(partnerId);
      const data = await getUserChatHistory(id, partnerId);
      let messages: any[] = data.messages || [];

      // Merge deleted (flagged) messages from warnings data into the chat
      // so admin always sees phone/email sharing attempts even if backend filters them
      const userRef = user; // capture current user state
      if (userRef?.deleted_messages && userRef.deleted_messages.length > 0) {
        const flaggedForThisChat = userRef.deleted_messages.filter(
          (dm: any) => dm.receiver_id === partnerId || dm.sender_id === partnerId
        );
        if (flaggedForThisChat.length > 0) {
          // Add any that are not already in messages array (avoid duplicates)
          const existingIds = new Set(messages.map((m: any) => m.id));
          const newFlagged = flaggedForThisChat
            .filter((dm: any) => !existingIds.has(dm.id))
            .map((dm: any) => ({
              ...dm,
              // Normalize field names
              content: dm.original_content || dm.content,
              sender_id: id, // these are messages sent BY this user
              is_deleted: true,
              _flagged: true, // mark as flagged for UI
            }));
          messages = [...messages, ...newFlagged];
          // Sort chronologically
          messages.sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        }
      }

      setChatMessages(messages);
      setChatOtherUser(data.otherUser);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const loadMembershipPlans = async () => {
    try {
      const plans = await getMembershipPlans();
      setMembershipPlans(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  if (loading) {
    return (
      <ProfileDetailSkeleton />
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">User not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/users')}>
          Back to Users
        </Button>
      </div>
    );
  }

  const isBlocked = user.is_permanently_blocked || (user.blocked_until && new Date(user.blocked_until) > new Date());
  const pendingDocsCount = user.documents?.filter((d: any) => d.verification_status === 'pending').length || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')} className="rounded-xl px-4 h-10 flex items-center justify-center font-bold text-gray-700 bg-white">
            <ArrowLeft size={18} className="mr-2" /> Back to Users
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
              {user.first_name} {user.last_name}
              {user.is_verified && <CheckCircle size={20} className="text-blue-500" />}
            </h1>
            <p className="text-gray-500 font-mono text-sm">{user.profile_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBlocked ? (
            <Button variant="outline" onClick={handleUnblockUser} disabled={actionLoading} className="border-green-200 text-green-600 hover:bg-green-50">
              <Shield size={18} className="mr-2" /> Unblock User
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setBlockModalOpen(true)} disabled={actionLoading} className="border-orange-200 text-orange-600 hover:bg-orange-50">
              <ShieldOff size={18} className="mr-2" /> Block User
            </Button>
          )}
          <Button variant="danger" onClick={handleDeleteUser} disabled={actionLoading}>
            <Trash2 size={18} className="mr-2" /> Delete User
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {isBlocked && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-bold">Account Blocked</h3>
            <p className="text-sm mt-1">
              {user.is_permanently_blocked ? 'Permanently blocked.' : `Temporarily blocked until ${formatDate(user.blocked_until)}.`}
            </p>
            {user.block_reason && <p className="text-sm mt-1 font-medium">Reason: {user.block_reason}</p>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'documents', label: 'Documents', badge: pendingDocsCount > 0 ? pendingDocsCount : null },
            { id: 'credits', label: 'Credits & Premium' },
            { id: 'photos', label: 'Photos', badge: user.photos?.length || 0 },
            { id: 'chats', label: 'Chat History', badge: null },
            { id: 'interests', label: 'Interests' },
            { id: 'warnings', label: 'Warnings & Reports', badge: ((user.reports_received?.length || 0) + (user.user_reports_received?.length || 0) + (user.chat_warnings?.[0]?.warning_count || 0)) || null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.badge !== null && tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-white shadow-lg relative">
                    <img 
                      src={user.profile_photo_url || (user.gender === 'Female' ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg' : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg')} 
                      alt={user.first_name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = user.gender === 'Female' ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg' : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg';
                      }}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
                  <p className="text-gray-500 text-sm mb-4">{user.email}</p>
                  
                  <div className="w-full space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Status</span>
                      <button 
                        onClick={handleToggleActive}
                        disabled={actionLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    
                    {!user.is_premium ? (
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Premium</span>
                        <button 
                          onClick={() => { loadMembershipPlans(); setShowPremiumModal(true); }}
                          disabled={actionLoading}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-gray-300 hover:bg-gray-400"
                          title="Click to assign premium"
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-700">Premium</span>
                        <button
                          onClick={handleRemovePremium}
                          disabled={actionLoading}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-yellow-400 hover:bg-yellow-500"
                          title="Click to remove premium"
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Role</span>
                      <select 
                        value={user.role || 'user'}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        disabled={actionLoading}
                        className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-primary" /> Activity
                </h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between"><span className="text-gray-500">Joined:</span> <span>{formatDate(user.created_at)}</span></li>
                  <li className="flex justify-between"><span className="text-gray-500">Last Active:</span> <span>{user.last_active ? getRelativeTime(user.last_active) : 'Never'}</span></li>
                  <li className="flex justify-between"><span className="text-gray-500">Profile Completion:</span> <span>{user.profile_completion || 0}%</span></li>
                </ul>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={18} className="text-primary" /> Complete Profile Details
                </h3>

                {/* SECTION 1: Basic & Contact */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <User size={14} /> Basic & Contact Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Profile For', value: user.profile_for },
                      { label: 'Full Name', value: `${user.first_name || ''} ${user.last_name || ''}`.trim() },
                      { label: 'Gender', value: user.gender },
                      { label: 'Date of Birth', value: user.date_of_birth ? formatDate(user.date_of_birth) : user.dob ? formatDate(user.dob) : null },
                      { label: 'Marital Status', value: user.marital_status },
                      { label: 'Phone', value: user.phone },
                      { label: 'Email', value: user.email },
                      { label: 'City', value: user.city },
                      { label: 'State', value: user.state },
                      { label: 'Country', value: user.country },
                      { label: 'Profile ID', value: user.profile_id },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 2: Religion & Community */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <Heart size={14} /> Religion & Community
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Religion', value: user.religion },
                      { label: 'Caste', value: user.caste },
                      { label: 'Sub Caste', value: user.sub_caste || user.subcaste },
                      { label: 'Gotra', value: user.gotra },
                      { label: 'Mother Tongue', value: user.mother_tongue },
                      { label: 'Manglik', value: user.manglik },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 3: Physical Attributes */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <Activity size={14} /> Physical Attributes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Height', value: user.height_cm ? `${user.height_cm} cm` : (user.height ? `${user.height} cm` : null) },
                      { label: 'Weight', value: user.weight_kg ? `${user.weight_kg} kg` : (user.weight ? `${user.weight} kg` : null) },
                      { label: 'Body Type', value: user.body_type },
                      { label: 'Complexion', value: user.complexion },
                      { label: 'Blood Group', value: user.blood_group },
                      { label: 'Physical Disability', value: user.physical_disability ? (user.disability_desc || 'Yes') : 'No' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 4: Education & Career */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <GraduationCap size={14} /> Education & Career
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Highest Education', value: user.highest_education || user.education },
                      { label: 'College / Institute', value: user.college_name },
                      { label: 'Course / Degree', value: user.course_name || user.degree },
                      { label: 'Occupation', value: user.occupation || user.profession },
                      { label: 'Company', value: user.company_name },
                      { label: 'Working City', value: user.working_city },
                      { label: 'Annual Income', value: user.annual_income },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 5: Lifestyle */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <Activity size={14} /> Lifestyle
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Diet', value: user.diet },
                      { label: 'Smoking', value: user.smoking || user.smoke },
                      { label: 'Drinking', value: user.drinking || user.drink },
                      { label: 'Hobbies', value: Array.isArray(user.hobbies) ? user.hobbies.join(', ') : user.hobbies },
                      { label: 'Languages Known', value: Array.isArray(user.languages) ? user.languages.join(', ') : user.languages },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 6: Family Details */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                    <Heart size={14} /> Family Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                    {[
                      { label: 'Family Type', value: user.family_type },
                      { label: 'Family Status', value: user.family_status },
                      { label: 'Family Values', value: user.family_values },
                      { label: 'Family Income', value: user.family_income },
                      { label: 'Father Name', value: user.father_name },
                      { label: 'Father Occupation', value: user.father_occupation || user.father_profession },
                      { label: 'Mother Name', value: user.mother_name },
                      { label: 'Mother Occupation', value: user.mother_occupation || user.mother_profession },
                      { label: 'Brothers', value: user.brothers !== undefined ? `${user.brothers} (${user.married_brothers || 0} married)` : null },
                      { label: 'Sisters', value: user.sisters !== undefined ? `${user.sisters} (${user.married_sisters || 0} married)` : null },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                        <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mosal / Maternal Details */}
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">🏡 Mosal (Maternal Family) Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                      {[
                        { label: 'Mosal Name', value: user.mosal_name },
                        { label: 'Mosal State', value: user.mosal_state },
                        { label: 'Mosal City', value: user.mosal_city },
                        { label: 'Mosal Address', value: user.mosal_address },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col py-1.5 border-b border-amber-100">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{label}</span>
                          <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Children Details (shown for Divorced/Widowed etc.) */}
                  {(Number(user.children_count) > 0 || (Array.isArray(user.children) && user.children.length > 0)) && (
                    <div className="mt-4 p-3 bg-pink-50 border border-pink-100 rounded-xl">
                      <p className="text-xs font-bold text-pink-700 uppercase tracking-wider mb-2">👶 Children Details ({user.children_count || user.children?.length || 0} children)</p>
                      {Array.isArray(user.children) && user.children.length > 0 ? (
                        <div className="space-y-2">
                          {user.children.map((child: any, idx: number) => (
                            <div key={idx} className="grid grid-cols-3 gap-2 text-sm bg-white rounded-lg p-2 border border-pink-100">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-pink-400 uppercase">Child {idx + 1} Name</span>
                                <span className="font-medium text-gray-900">{child.name || '—'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-pink-400 uppercase">Gender</span>
                                <span className="font-medium text-gray-900">{child.gender || '—'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-pink-400 uppercase">Age</span>
                                <span className="font-medium text-gray-900">{child.age ? `${child.age} yrs` : '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Total children: <strong>{user.children_count}</strong></p>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 7: Horoscope */}
                {(user.rashi || user.nakshatra || user.birth_time || user.birth_place) && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2 border-b pb-2">
                      ⭐ Horoscope Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                      {[
                        { label: 'Rashi (Moon Sign)', value: user.rashi },
                        { label: 'Nakshatra (Star)', value: user.nakshatra },
                        { label: 'Manglik', value: user.manglik },
                        { label: 'Birth Time', value: user.birth_time },
                        { label: 'Birth Place', value: user.birth_place },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col py-1.5 border-b border-gray-50">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                          <span className="text-gray-900 font-medium">{value || <span className="text-gray-300 italic">Not provided</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* About Me */}
                {(user.about_me || user.about) && (
                  <div className="mt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">About Me</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                      {user.about_me || user.about}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Shield size={18} className="text-primary" /> Documents & Verification
              </h3>
              {pendingDocsCount > 0 && (
                <Button 
                  onClick={handleApproveAllDocuments} 
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check size={18} className="mr-2" /> Approve All Pending
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Aadhaar Front */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">Aadhaar Front</p>
                  <Badge variant={user.aadhaar_front_verified ? 'success' : user.aadhaar_front_url ? 'warning' : 'danger'}>
                    {user.aadhaar_front_verified ? 'Verified' : user.aadhaar_front_url ? 'Pending' : 'Not Uploaded'}
                  </Badge>
                </div>
                {user.aadhaar_front_url ? (
                  <div className="mt-2">
                    {user.aadhaar_front_url.toLowerCase().endsWith('.pdf') || user.aadhaar_front_url.includes('application/pdf') ? (
                      <div className="w-full h-32 rounded-lg border border-gray-200 bg-white flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition" onClick={() => window.open(user.aadhaar_front_url, '_blank')}>
                        <FileText size={28} className="text-red-500" />
                        <span className="text-xs font-medium text-gray-600">PDF Document</span>
                        <a href={user.aadhaar_front_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Click to View PDF</a>
                      </div>
                    ) : (
                      <img 
                        src={user.aadhaar_front_url} 
                        alt="Aadhaar Front" 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer border border-gray-200"
                        onClick={() => setSelectedImage(user.aadhaar_front_url)}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleVerifyDocument('aadhaar_front', 'verified')} disabled={user.aadhaar_front_verified || actionLoading}>Approve</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs text-red-500 hover:bg-red-50" onClick={() => handleVerifyDocument('aadhaar_front', 'rejected')} disabled={!user.aadhaar_front_verified && !user.aadhaar_front_url || actionLoading}>Reject</Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <label className="flex-1">
                        <span className="block w-full text-center py-1.5 px-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-medium cursor-pointer transition-colors text-gray-700">
                          {actionLoading ? '...' : 'Replace'}
                        </span>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleReplaceDocument('aadhaar_front', e)} disabled={actionLoading} />
                      </label>
                      <Button size="sm" variant="outline" className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRemoveDocument('aadhaar_front')} disabled={actionLoading}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-gray-100 rounded-lg mt-2 text-gray-400 border-2 border-dashed border-gray-300 relative group">
                    <ImageIcon size={24} className="mb-2" />
                    <span className="text-xs font-medium group-hover:text-primary transition-colors">Upload Document</span>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" accept="image/*,application/pdf" onChange={(e) => handleReplaceDocument('aadhaar_front', e)} disabled={actionLoading} />
                  </div>
                )}
              </div>

              {/* Aadhaar Back */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">Aadhaar Back</p>
                  <Badge variant={user.aadhaar_back_verified ? 'success' : user.aadhaar_back_url ? 'warning' : 'danger'}>
                    {user.aadhaar_back_verified ? 'Verified' : user.aadhaar_back_url ? 'Pending' : 'Not Uploaded'}
                  </Badge>
                </div>
                {user.aadhaar_back_url ? (
                  <div className="mt-2">
                    {user.aadhaar_back_url.toLowerCase().endsWith('.pdf') || user.aadhaar_back_url.includes('application/pdf') ? (
                      <div className="w-full h-32 rounded-lg border border-gray-200 bg-white flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition" onClick={() => window.open(user.aadhaar_back_url, '_blank')}>
                        <FileText size={28} className="text-red-500" />
                        <span className="text-xs font-medium text-gray-600">PDF Document</span>
                        <a href={user.aadhaar_back_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Click to View PDF</a>
                      </div>
                    ) : (
                      <img 
                        src={user.aadhaar_back_url} 
                        alt="Aadhaar Back" 
                        className="w-full h-32 object-cover rounded-lg cursor-pointer border border-gray-200"
                        onClick={() => setSelectedImage(user.aadhaar_back_url)}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleVerifyDocument('aadhaar_back', 'verified')} disabled={user.aadhaar_back_verified || actionLoading}>Approve</Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs text-red-500 hover:bg-red-50" onClick={() => handleVerifyDocument('aadhaar_back', 'rejected')} disabled={!user.aadhaar_back_verified && !user.aadhaar_back_url || actionLoading}>Reject</Button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <label className="flex-1">
                        <span className="block w-full text-center py-1.5 px-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-medium cursor-pointer transition-colors text-gray-700">
                          {actionLoading ? '...' : 'Replace'}
                        </span>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleReplaceDocument('aadhaar_back', e)} disabled={actionLoading} />
                      </label>
                      <Button size="sm" variant="outline" className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRemoveDocument('aadhaar_back')} disabled={actionLoading}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center bg-gray-100 rounded-lg mt-2 text-gray-400 border-2 border-dashed border-gray-300 relative group">
                    <ImageIcon size={24} className="mb-2" />
                    <span className="text-xs font-medium group-hover:text-primary transition-colors">Upload Document</span>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" accept="image/*,application/pdf" onChange={(e) => handleReplaceDocument('aadhaar_back', e)} disabled={actionLoading} />
                  </div>
                )}
              </div>

              {/* Biodata */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 md:col-span-2">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">Biodata Document</p>
                  <Badge variant={user.biodata_verified ? 'success' : user.biodata_url ? 'warning' : 'danger'}>
                    {user.biodata_verified ? 'Verified' : user.biodata_url ? 'Pending' : 'Not Uploaded'}
                  </Badge>
                </div>
                {user.biodata_url ? (
                  <div className="mt-2">
                    {/* Preview: PDF inline or image thumbnail */}
                    {user.biodata_url.toLowerCase().endsWith('.pdf') || user.biodata_url.includes('application/pdf') ? (
                      <div className="w-full rounded-lg border border-gray-200 overflow-hidden mb-3">
                        <iframe
                          src={user.biodata_url}
                          title="Biodata PDF"
                          className="w-full h-64"
                          style={{ border: 'none' }}
                        />
                      </div>
                    ) : (
                      <img
                        src={user.biodata_url}
                        alt="Biodata"
                        className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white mb-3 cursor-pointer"
                        onClick={() => setSelectedImage(user.biodata_url)}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <FileText size={20} className="text-primary" />
                        <a href={user.biodata_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate max-w-[200px]">
                          View Biodata Document
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVerifyDocument('biodata', 'verified')} disabled={user.biodata_verified || actionLoading}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-xs text-red-500 hover:bg-red-50" onClick={() => handleVerifyDocument('biodata', 'rejected')} disabled={!user.biodata_verified && !user.biodata_url || actionLoading}>Reject</Button>
                        <div className="border-l border-gray-200 mx-1"></div>
                        <label>
                          <span className="inline-block text-center py-1.5 px-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-xs font-medium cursor-pointer transition-colors text-gray-700">
                            {actionLoading ? '...' : 'Replace'}
                          </span>
                          <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleReplaceDocument('biodata', e)} disabled={actionLoading} />
                        </label>
                        <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRemoveDocument('biodata')} disabled={actionLoading}>Remove</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-4 bg-gray-50 border border-gray-200 p-4 rounded-xl border-dashed">
                    <p className="text-sm text-gray-500">No biodata document uploaded.</p>
                    <label>
                      <span className="inline-block text-center py-1.5 px-3 bg-primary text-white hover:bg-primary-dark rounded text-xs font-medium cursor-pointer transition-colors shadow-sm">
                        Upload Biodata
                      </span>
                      <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleReplaceDocument('biodata', e)} disabled={actionLoading} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'credits' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Credit Management */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-primary" /> Credit Management
                </h3>
                <button
                  onClick={refreshCreditsOnly}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                  title="Refresh to see latest credit values"
                >
                  <RotateCcw size={12} /> Refresh Live
                </button>
              </div>

              {/* Current Balance */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-600 font-bold uppercase mb-1">Free Credits</p>
                  <p className="text-3xl font-bold text-blue-700">
                    {user.free_views_remaining ?? user.free_credits_remaining ?? user.free_credits ?? user.monthly_credits_remaining ?? 0}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">remaining this month</p>
                  <p className="text-[10px] text-blue-400 mt-1">
                    Limit: {user.free_monthly_limit ?? 10}/month
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-purple-600 font-bold uppercase mb-1">Paid Credits</p>
                  <p className="text-3xl font-bold text-purple-700">
                    {user.paid_views_balance ?? user.paid_credits ?? user.credits_paid ?? user.credits_balance ?? 0}
                  </p>
                  <p className="text-xs text-purple-500 mt-1">balance</p>
                  {(user.paid_views_balance > 0 || user.paid_credits > 0) && user.paid_credits_expiry && (
                    <p className="text-[10px] text-purple-400 mt-1">Expires: {formatDate(user.paid_credits_expiry)}</p>
                  )}
                  {(user.paid_views_balance > 0 || user.paid_credits > 0) && !user.paid_credits_expiry && user.paid_credits_expiry_after_membership && user.is_premium && user.premium_end && (
                    <p className="text-[10px] text-purple-400 mt-1">
                      Expires: {user.paid_credits_expiry_after_membership} days after {formatDate(user.premium_end)}
                    </p>
                  )}
                </div>
              </div>

              {/* Add/Remove Controls */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreditAction('add')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${creditAction === 'add' ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Plus size={16} /> Add
                  </button>
                  <button
                    onClick={() => setCreditAction('remove')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors ${creditAction === 'remove' ? 'bg-red-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Minus size={16} /> Remove
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreditType('free')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${creditType === 'free' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Free Credits
                  </button>
                  <button
                    onClick={() => setCreditType('paid')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${creditType === 'paid' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Paid Credits
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min={1}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm"
                  />
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleUpdateCredits}
                  disabled={actionLoading}
                  className={creditAction === 'remove' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  {creditAction === 'add' ? <Plus size={16} className="mr-1" /> : <Minus size={16} className="mr-1" />}
                  {creditAction === 'add' ? 'Add' : 'Remove'} {creditAmount} {creditType} credit{creditAmount > 1 ? 's' : ''}
                </Button>
              </div>
            </Card>

            {/* Premium Membership */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Crown size={18} className="text-yellow-500" /> Premium Membership
              </h3>
              
              {/* Current Status */}
              <div className={`rounded-xl p-4 mb-6 ${user.is_premium ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <Badge variant={user.is_premium ? 'success' : 'danger'}>
                    {user.is_premium ? 'Premium' : 'Free'}
                  </Badge>
                </div>
                {user.is_premium && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Plan</span>
                      <span className="text-sm font-medium text-gray-900">{user.premium_plan || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Expires</span>
                      <span className="text-sm font-medium text-gray-900">{user.premium_end ? formatDate(user.premium_end) : 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Premium Actions */}
              <div className="space-y-3">
                {!user.is_premium ? (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      loadMembershipPlans();
                      setShowPremiumModal(true);
                    }}
                    className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
                  >
                    <Crown size={16} className="mr-2" /> Assign Premium
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => {
                        loadMembershipPlans();
                        setShowPremiumModal(true);
                      }}
                    >
                      <Crown size={16} className="mr-2" /> Change Plan
                    </Button>
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={handleRemovePremium}
                      disabled={actionLoading}
                    >
                      <XCircle size={16} className="mr-2" /> Remove Premium
                    </Button>
                  </>
                )}
              </div>

              {/* Membership Subscription History */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Crown size={14} className="text-yellow-500" /> Membership Subscription History
                </h4>
                {!user.membership_purchases?.length ? (
                  <p className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg text-center">No membership subscriptions found.</p>
                ) : (
                  <div className="space-y-2">
                    {user.membership_purchases.map((mp: any) => (
                      <div key={mp.id} className="flex justify-between items-center p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-sm">
                        <div>
                          <p className="font-bold text-yellow-800">{mp.plan_name || mp.plan_id || 'Premium Plan'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Purchased: {formatDate(mp.created_at)}
                            {mp.expires_at && <span className="ml-2">• Expires: {formatDate(mp.expires_at)}</span>}
                            {mp.duration_months && <span className="ml-2">• {mp.duration_months} month(s)</span>}
                          </p>
                          {mp.amount && <p className="text-xs text-green-700 font-semibold mt-0.5">₹{mp.amount}</p>}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice('membership', mp)} className="h-8 text-xs bg-white shrink-0">
                          <Download size={14} className="mr-1" /> Invoice
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Credit Purchase History */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <CreditCard size={14} className="text-purple-500" /> Credit Purchase History
                </h4>
                {!user.purchases?.length ? (
                  <p className="text-sm text-gray-400 bg-gray-50 p-3 rounded-lg text-center">No credit purchases found.</p>
                ) : (
                  <div className="space-y-2">
                    {user.purchases.map((p: any) => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-purple-50 border border-purple-100 rounded-xl text-sm">
                        <div>
                          <p className="font-bold text-purple-800">{p.credits_added || p.credits || 0} Credits</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {p.plan_id || p.pack_name || 'Custom'} • {formatDate(p.created_at)}
                          </p>
                          {p.amount && <p className="text-xs text-green-700 font-semibold mt-0.5">₹{p.amount}</p>}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice('credit', p)} className="h-8 text-xs bg-white shrink-0">
                          <Download size={14} className="mr-1" /> Invoice
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'photos' && (
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-primary" /> User Photos
            </h3>
            {user.photos && user.photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user.photos.map((photo: any) => (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square">
                    <img 
                      src={photo.photo_url} 
                      alt="User photo" 
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setSelectedImage(photo.photo_url)}
                      referrerPolicy="no-referrer"
                    />
                    {photo.is_primary && (
                      <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full">
                        PRIMARY
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No photos uploaded.</p>
            )}
          </Card>
        )}

        {activeTab === 'chats' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" /> Chat History
              </h3>
              <Button variant="outline" size="sm" onClick={fetchChatConversations} disabled={chatLoading}>
                {chatLoading ? 'Loading...' : chatConversations.length > 0 ? 'Refresh' : 'Load Conversations'}
              </Button>
            </div>

            {selectedChatPartner ? (
              <div>
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedChatPartner(null); setChatMessages([]); setChatOtherUser(null); }}>
                    <ArrowLeft size={16} className="mr-1" /> Back
                  </Button>
                  {chatOtherUser && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        {chatOtherUser.first_name?.[0] || '?'}
                      </div>
                      <div>
                        <Link to={`/admin/users/${chatOtherUser.id}`} className="font-medium text-sm text-primary hover:underline">
                          {chatOtherUser.first_name} {chatOtherUser.last_name}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {chatMessages.length > 0 ? chatMessages.map((msg: any) => {
                    const isSelf = msg.sender_id === id;
                    const isFlagged = msg._flagged === true;
                    const isDeleted = !isFlagged && (msg.is_deleted || msg.deleted_by_sender || msg.deleted_at);
                    const senderName = isSelf
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : (chatOtherUser ? `${chatOtherUser.first_name || ''} ${chatOtherUser.last_name || ''}`.trim() : 'Other');
                    return (
                      <div key={`${msg.id || ''}-${msg.created_at}`} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <span className={`text-[10px] font-bold mb-0.5 px-1 ${isFlagged ? 'text-orange-600' : isSelf ? 'text-primary/70' : 'text-gray-500'}`}>{senderName}</span>
                        <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                          isFlagged ? 'border-2 border-orange-400 bg-orange-50'
                          : isDeleted ? 'border-2 border-red-300 bg-red-50'
                          : isSelf ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-900'
                        }`}>
                          {isFlagged && (
                            <div className="mb-2 bg-orange-100 border border-orange-300 rounded-lg px-2 py-1.5">
                              <p className="text-[10px] font-bold text-orange-700 uppercase">⚠️ WARNING — Auto-deleted: Contact info detected</p>
                              {msg.detected_pattern && (
                                <p className="text-[10px] text-orange-600 mt-0.5">Pattern: <code className="bg-orange-200 px-1 rounded">{msg.detected_pattern}</code></p>
                              )}
                              {msg.warning_number && <p className="text-[10px] text-orange-600 mt-0.5">Warning #{msg.warning_number}</p>}
                            </div>
                          )}
                          {isDeleted && (
                            <p className="text-[10px] font-bold text-red-600 uppercase mb-1">🗑️ Deleted by user — admin view only</p>
                          )}
                          {msg.message_image_url && (
                            <img src={msg.message_image_url} alt="attachment" className="w-48 h-32 object-cover rounded-lg mb-2 cursor-pointer" onClick={() => setSelectedImage(msg.message_image_url)} />
                          )}
                          <p className={`text-sm whitespace-pre-wrap ${isFlagged ? 'text-gray-800 font-medium' : isDeleted ? 'text-gray-700 italic' : ''}`}>{msg.content || msg.message || msg.text}</p>
                          <p className={`text-[10px] mt-1 ${isFlagged ? 'text-orange-400' : isDeleted ? 'text-red-400' : isSelf ? 'text-white/60' : 'text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleString('en-IN')}
                            {!isFlagged && (msg.is_read ? ' ✓✓' : ' ✓')}
                          </p>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-center text-gray-400 py-8">No messages found in this conversation.</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {chatConversations.length > 0 ? (
                  <div className="space-y-2">
                    {chatConversations.map((chat: any) => (
                      <div
                        key={chat.partner_id}
                        onClick={() => fetchChatMessages(chat.partner_id)}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border border-gray-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {chat.partner_name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <Link
                              to={`/admin/users/${chat.partner_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-sm text-gray-900 hover:text-primary"
                            >
                              {chat.partner_name}
                            </Link>
                            <span className="text-xs text-gray-400">{chat.last_message_time ? getRelativeTime(chat.last_message_time) : ''}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{chat.last_message}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-gray-400">{chat.total_messages} msgs</span>
                          {chat.unread_count > 0 && (
                            <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{chat.unread_count}</span>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare size={48} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 text-sm">
                      {chatLoading ? 'Loading conversations...' : 'Click "Load Conversations" to view chat history'}
                    </p>
                  </div>
                )}
              </div>
            )}

          </Card>
        )}

        {activeTab === 'interests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Heart size={18} className="text-primary" /> Interests Sent
              </h3>
              {user.interests_sent && user.interests_sent.length > 0 ? (
                <div className="space-y-3">
                  {user.interests_sent.map((interest: any) => (
                    <div key={interest.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                      <div>
                        <Link to={`/admin/users/${interest.receiver_id}`} className="font-medium text-sm text-blue-600 hover:underline">
                          {interest.receiver?.first_name} {interest.receiver?.last_name}
                        </Link>
                        <p className="text-xs text-gray-500">{formatDate(interest.created_at)}</p>
                      </div>
                      <Badge variant={interest.status === 'accepted' ? 'success' : interest.status === 'rejected' ? 'danger' : 'warning'}>
                        {interest.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No interests sent.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Heart size={18} className="text-pink-500" /> Interests Received
              </h3>
              {user.interests_received && user.interests_received.length > 0 ? (
                <div className="space-y-3">
                  {user.interests_received.map((interest: any) => (
                    <div key={interest.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-gray-50">
                      <div>
                        <Link to={`/admin/users/${interest.sender_id}`} className="font-medium text-sm text-blue-600 hover:underline">
                          {interest.sender?.first_name} {interest.sender?.last_name}
                        </Link>
                        <p className="text-xs text-gray-500">{formatDate(interest.created_at)}</p>
                      </div>
                      <Badge variant={interest.status === 'accepted' ? 'success' : interest.status === 'rejected' ? 'danger' : 'warning'}>
                        {interest.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No interests received.</p>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'warnings' && (
          <div className="space-y-6">
            {/* Summary dashboard */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-500" /> Safety & Moderation Dashboard
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                  className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center cursor-pointer hover:bg-orange-100 transition-colors"
                  onClick={() => document.getElementById('flagged-messages')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <p className="text-xs text-orange-600 font-bold uppercase mb-1">Chat Warnings</p>
                  <p className="text-2xl font-bold text-orange-700">{user.chat_warnings?.[0]?.warning_count || user.deleted_messages?.length || 0}</p>
                  <p className="text-xs text-orange-400 mt-1">↓ View messages</p>
                </div>
                <div
                  className="bg-red-50 border border-red-100 rounded-xl p-4 text-center cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => document.getElementById('reports-received')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <p className="text-xs text-red-600 font-bold uppercase mb-1">Reports Against</p>
                  <p className="text-2xl font-bold text-red-700">{(user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)}</p>
                  <p className="text-xs text-red-400 mt-1">↓ View reports</p>
                </div>
                <div
                  className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => document.getElementById('reports-sent')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <p className="text-xs text-blue-600 font-bold uppercase mb-1">Reports By User</p>
                  <p className="text-2xl font-bold text-blue-700">{(user.message_reports?.length || 0) + (user.user_reports_sent?.length || 0)}</p>
                  <p className="text-xs text-blue-400 mt-1">↓ View details</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-600 font-bold uppercase mb-1">Risk Level</p>
                  <p className={`text-xl font-bold ${
                    ((user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)) > 3 ? 'text-red-600' :
                    ((user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)) > 1 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {((user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)) > 3 ? 'HIGH' :
                     ((user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)) > 1 ? 'MEDIUM' : 'LOW'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Flagged / Deleted Messages — shown when warning_count > 0 regardless of deleted_messages array */}
            <div id="flagged-messages">
              <Card className="p-6">
                <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" /> Flagged Chat Messages
                  <span className="ml-auto text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {user.chat_warnings?.[0]?.warning_count || user.deleted_messages?.length || 0} warning(s)
                  </span>
                </h4>
                <p className="text-xs text-gray-500 mb-4">System flagged these messages — user tried to share contact info without credits.</p>
                {user.deleted_messages && user.deleted_messages.length > 0 ? (
                  <div className="space-y-3">
                    {user.deleted_messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className="border border-red-100 bg-red-50 p-4 rounded-xl shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-sm text-red-800">🚫 Contact info detected: <code className="bg-red-100 px-1 rounded">{msg.detected_pattern || 'pattern'}</code></span>
                          <span className="text-xs font-medium text-gray-500">{formatDate(msg.created_at)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-red-200 mb-3 font-mono text-sm text-gray-800 shadow-inner select-all">
                          {msg.original_content || msg.content}
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">
                            Sent to: <Link to={`/admin/users/${msg.receiver_id}`} className="text-blue-600 hover:underline font-bold" onClick={(e) => e.stopPropagation()}>{msg.receiver?.first_name} {msg.receiver?.last_name}</Link>
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="danger">Warning #{msg.warning_number}</Badge>
                            <button
                              className="text-blue-500 font-medium hover:underline"
                              onClick={() => { setActiveTab('chats'); if (msg.receiver_id) fetchChatMessages(msg.receiver_id); }}
                            >View Chat →</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-orange-800 mb-2">
                      ⚠️ This user has received <strong>{user.chat_warnings?.[0]?.warning_count || 0}</strong> chat warning(s).
                    </p>
                    <p className="text-xs text-orange-600 mb-3">The warning count is tracked but message-level records are not returned by the API. To see the flagged conversations, load the Chat History tab and check conversations.</p>
                    {user.chat_warnings?.map((w: any) => (
                      <div key={w.id || w.user_id} className="text-xs bg-white border border-orange-100 rounded-lg p-3 mt-2">
                        <p className="font-bold text-gray-900">⚠️ Total Warnings: {w.warning_count}</p>
                        {w.last_warning_at && <p className="text-gray-500 mt-1">Last warning: {formatDate(w.last_warning_at)}</p>}
                        {w.conversation_partner_id && (
                          <button
                            className="mt-2 text-blue-600 font-semibold hover:underline"
                            onClick={() => { setActiveTab('chats'); fetchChatMessages(w.conversation_partner_id); }}
                          >💬 View flagged conversation →</button>
                        )}
                      </div>
                    ))}
                    <button
                      className="mt-3 w-full text-xs text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg py-2 transition-colors"
                      onClick={() => setActiveTab('chats')}
                    >📂 Go to Chat History to find flagged conversations →</button>
                  </div>
                )}
              </Card>
            </div>

            {/* Reports received against this user */}
            <div id="reports-received">
              <Card className="p-6">
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Flag size={16} className="text-red-500" /> Reports Against This User
                  <span className="ml-auto text-xs text-gray-400 font-normal">{(user.reports_received?.length || 0) + (user.user_reports_received?.length || 0)} total</span>
                </h4>
                
                {/* Message reports against this user */}
                {user.reports_received && user.reports_received.length > 0 && (
                  <div className="space-y-3 mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message / Content Reports</p>
                    {user.reports_received.map((report: any) => (
                      <div key={report.id} className="text-sm border border-red-100 rounded-xl p-4 bg-red-50">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="danger">Message Report</Badge>
                              {report.category && <Badge variant="warning">{report.category}</Badge>}
                              <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                            </div>
                            <p className="font-bold text-gray-900 mt-1">"{report.reason}"</p>
                            {report.description && <p className="text-gray-600 text-xs mt-1">{report.description}</p>}
                            <p className="text-xs text-gray-500 mt-2">
                              Reported by: <Link to={`/admin/users/${report.reporter_id}`} className="text-blue-600 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{report.reporter?.first_name} {report.reporter?.last_name}</Link>
                            </p>
                          </div>
                          <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setBlockReason(`Reported by ${report.reporter?.first_name}: ${report.reason}`); setBlockModalOpen(true); }}>
                            <ShieldOff size={12} className="mr-1" /> Block
                          </Button>
                        </div>
                        {/* Reported message content box - for admin screenshot proof */}
                        {(report.message_content || report.reported_message || report.content) && (
                          <div className="bg-white border border-red-200 rounded-lg p-3 mb-2">
                            <p className="text-[10px] font-bold text-red-600 uppercase mb-1">📋 Reported Message Content</p>
                            <p className="text-sm text-gray-800 font-mono whitespace-pre-wrap select-all">{report.message_content || report.reported_message || report.content}</p>
                          </div>
                        )}
                        <button
                          className="w-full mt-2 text-xs text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg py-1.5 transition-colors"
                          onClick={() => { if (report.reporter_id) { setActiveTab('chats'); fetchChatMessages(report.reporter_id); } }}
                        >
                          💬 View Full Chat with {report.reporter?.first_name || 'Reporter'} →
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* User (profile) reports against this user */}
                {user.user_reports_received && user.user_reports_received.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile Reports</p>
                    {user.user_reports_received.map((report: any) => (
                      <div key={report.id} className="text-sm border border-orange-100 rounded-xl p-4 bg-orange-50">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="warning">Profile Report</Badge>
                              {report.reason && <Badge variant="warning">{report.reason}</Badge>}
                              <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                            </div>
                            {report.description && <p className="font-medium text-gray-800 mt-1">{report.description}</p>}
                            <p className="text-xs text-gray-500 mt-2">
                              Reported by: <Link to={`/admin/users/${report.reporter_id}`} className="text-blue-600 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{report.reporter?.first_name} {report.reporter?.last_name}</Link>
                            </p>
                          </div>
                          <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); setBlockReason(`Profile report by ${report.reporter?.first_name}: ${report.reason}`); setBlockModalOpen(true); }}>
                            <ShieldOff size={12} className="mr-1" /> Block
                          </Button>
                        </div>
                        {(report.message_content || report.reported_message || report.content) && (
                          <div className="bg-white border border-orange-200 rounded-lg p-3 mb-2">
                            <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">📋 Reported Content</p>
                            <p className="text-sm text-gray-800 font-mono whitespace-pre-wrap select-all">{report.message_content || report.reported_message || report.content}</p>
                          </div>
                        )}
                        <button
                          className="w-full mt-2 text-xs text-blue-600 font-semibold bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg py-1.5 transition-colors"
                          onClick={() => { if (report.reporter_id) { setActiveTab('chats'); fetchChatMessages(report.reporter_id); } }}
                        >
                          💬 View Full Chat with {report.reporter?.first_name || 'Reporter'} →
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(!user.reports_received?.length && !user.user_reports_received?.length) && (
                  <p className="text-gray-400 text-sm text-center py-4">No reports received against this user.</p>
                )}
              </Card>
            </div>

            {/* Reports made BY this user */}
            <div id="reports-sent">
              <Card className="p-6">
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Flag size={16} className="text-blue-500" /> Reports Made By This User
                  <span className="ml-auto text-xs text-gray-400 font-normal">{(user.message_reports?.length || 0) + (user.user_reports_sent?.length || 0)} total</span>
                </h4>

                {user.user_reports_sent && user.user_reports_sent.length > 0 && (
                  <div className="space-y-3 mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile Reports Sent</p>
                    {user.user_reports_sent.map((report: any) => (
                      <div
                        key={report.id}
                        className="text-sm border border-blue-100 rounded-xl p-4 bg-blue-50 cursor-pointer hover:bg-blue-100 hover:shadow-md transition-all"
                        onClick={() => {
                          if (report.reported_user_id) {
                            setActiveTab('chats');
                            fetchChatMessages(report.reported_user_id);
                          }
                        }}
                        title="Click to view chat with reported user"
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="pending">Reported</Badge>
                          {report.reason && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">{report.reason}</span>}
                          <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                        </div>
                        {report.description && <p className="text-gray-700 text-sm">{report.description}</p>}
                        <p className="text-xs text-gray-500 mt-2">
                          Reported user: <Link to={`/admin/users/${report.reported_user_id}`} className="text-blue-600 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{report.reported_user?.first_name} {report.reported_user?.last_name}</Link>
                          {report.reported_user_id && <span className="text-blue-400 ml-2">(click to view chat)</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {user.message_reports && user.message_reports.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message Reports Sent</p>
                    {user.message_reports.map((report: any) => (
                      <div
                        key={report.id}
                        className="text-sm border border-gray-100 rounded-xl p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 hover:shadow-md transition-all"
                        onClick={() => {
                          if (report.reported_user_id) {
                            setActiveTab('chats');
                            fetchChatMessages(report.reported_user_id);
                          }
                        }}
                        title="Click to view chat with reported user"
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="pending">Message Report</Badge>
                          {report.category && <Badge variant="warning">{report.category}</Badge>}
                          <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                        </div>
                        <p className="font-medium text-gray-800">"{report.reason}"</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Reported user: <Link to={`/admin/users/${report.reported_user_id}`} className="text-blue-600 font-bold hover:underline" onClick={(e) => e.stopPropagation()}>{report.reported_user?.first_name} {report.reported_user?.last_name}</Link>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {(!user.user_reports_sent?.length && !user.message_reports?.length) && (
                  <p className="text-gray-400 text-sm text-center py-4">This user has not reported anyone.</p>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Block Modal */}
      <Modal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title="Block User"
        size="md"
      >
        <form onSubmit={handleBlockUser} className="space-y-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-sm text-red-800 mb-4">
            <AlertTriangle size={20} className="inline mr-2 mb-1" />
            Blocking a user will prevent them from logging in and interacting with others.
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Block Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="blockType" 
                  value="temp" 
                  checked={blockType === 'temp'} 
                  onChange={() => setBlockType('temp')}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">Temporary (24 Hours)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="blockType" 
                  value="permanent" 
                  checked={blockType === 'permanent'} 
                  onChange={() => setBlockType('permanent')}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm">Permanent</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Blocking</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
              rows={3}
              placeholder="E.g., Violation of terms, inappropriate behavior..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setBlockModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={actionLoading}>Block User</Button>
          </div>
        </form>
      </Modal>

      {/* Premium Assignment Modal */}
      <Modal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        title="Assign Premium Membership"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-sm text-yellow-800">
            <Crown size={20} className="inline mr-2 mb-1" />
            Assigning premium will update the user's free credit limit based on the plan's multiplier.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Membership Plan</label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {membershipPlans.filter((p: any) => p.id !== 'free').map((plan: any) => (
                <label
                  key={plan.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedPlanId === plan.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => {
                      setSelectedPlanId(plan.id);
                      setPremiumDuration(plan.duration_months || 1);
                    }}
                    className="text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">₹{plan.price} • {plan.duration_months} months • {plan.free_credits_multiplier || 1}x free credits</p>
                  </div>
                  <Crown size={18} className={selectedPlanId === plan.id ? 'text-primary' : 'text-gray-300'} />
                </label>
              ))}

              {/* Custom Plan — always visible */}
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedPlanId === 'custom' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input
                  type="radio"
                  name="plan"
                  value="custom"
                  checked={selectedPlanId === 'custom'}
                  onChange={() => { setSelectedPlanId('custom'); setPremiumDuration(1); }}
                  className="text-primary focus:ring-primary"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">Custom Plan</p>
                  <p className="text-xs text-gray-500">Set a custom duration for this user</p>
                </div>
                <Crown size={18} className={selectedPlanId === 'custom' ? 'text-primary' : 'text-gray-300'} />
              </label>
            </div>
          </div>

          {selectedPlanId && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {selectedPlanId === 'custom' ? 'Custom Duration (Months)' : 'Override Duration (Months)'}
              </label>
              <input
                type="number"
                min={1}
                value={premiumDuration || 1}
                onChange={(e) => setPremiumDuration(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary text-sm font-medium"
              />
              <p className="text-xs text-gray-500 mt-2">
                {selectedPlanId === 'custom'
                  ? 'User will be premium for this many months.'
                  : 'Leave as-is to use plan default, or change to override.'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowPremiumModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleAssignPremium}
              disabled={actionLoading || !selectedPlanId}
              className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            >
              <Crown size={16} className="mr-1" /> Assign Premium
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => { setSelectedImage(null); setImageRotation(0); }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button 
              className="text-white hover:text-primary hover:bg-white/10 bg-black/50 rounded-full p-3 transition-colors"
              onClick={(e) => { e.stopPropagation(); setImageRotation(r => r - 90); }}
              title="Rotate Left"
            >
              <RotateCcw size={24} />
            </button>
            <button 
              className="text-white hover:text-primary hover:bg-white/10 bg-black/50 rounded-full p-3 transition-colors"
              onClick={(e) => { e.stopPropagation(); setImageRotation(r => r + 90); }}
              title="Rotate Right"
            >
              <RotateCw size={24} />
            </button>
            <button 
              className="text-white hover:text-red-500 hover:bg-white/10 bg-black/50 rounded-full p-3 transition-colors ml-4"
              onClick={() => { setSelectedImage(null); setImageRotation(0); }}
            >
              <X size={24} />
            </button>
          </div>
          <img 
            src={selectedImage} 
            alt="Full size" 
            className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-300 shadow-2xl"
            style={{ transform: `rotate(${imageRotation}deg)`, maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Reset User Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-gray-600" />
            <h3 className="font-semibold text-gray-900">Reset User Password</h3>
          </div>
          <button
            onClick={() => setShowPasswordReset(prev => !prev)}
            className="text-sm text-primary hover:underline font-medium"
          >
            {showPasswordReset ? 'Cancel' : 'Reset Password'}
          </button>
        </div>
        {showPasswordReset && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Set a new password for this user. They can change it later from their own profile settings.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password for User</label>
              <input
                type="password"
                className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                placeholder="Minimum 8 characters"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Re-enter New Password</label>
              <input
                type="password"
                className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                placeholder="Repeat new password"
                value={confirmUserPassword}
                onChange={(e) => setConfirmUserPassword(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleResetUserPassword}
              disabled={resettingPassword}
              className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Shield size={16} />
              {resettingPassword ? 'Resetting...' : 'Confirm Reset Password'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
