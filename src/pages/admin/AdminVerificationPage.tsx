import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle, Clock, Search, Filter, Eye, Download, AlertTriangle, ChevronRight, Users, ShieldCheck, ShieldOff, FileCheck, ZoomIn, X, Mail, Phone, Hash, Crown, Upload, RefreshCw, ArrowLeft, FileUp, BadgeCheck, Ban, UserCheck, UserX, CreditCard, FileText, Image, File } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPendingVerifications, approveDocument, rejectDocument } from '../../lib/actions/adminActions';
import { getVerifiedUsers, getAllVerificationDocs, approveAllDocuments, replaceVerificationDoc, changeDocVerificationStatus } from '../../lib/actions/adminActions';
import { VerificationDocument, Profile } from '../../lib/types';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';

interface PendingVerification extends VerificationDocument {
  profile?: Profile;
}

type DocGroup = { user_id: string; profile: any; documents: PendingVerification[]; latest_date: string };

export default function AdminVerificationPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'unverified' | 'verified'>('unverified');
  const [documents, setDocuments] = useState<PendingVerification[]>([]);
  const [verifiedUsersList, setVerifiedUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'aadhaar_front' | 'aadhaar_back' | 'biodata'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'email' | 'phone' | 'profile_id'>('all');

  // Modal state
  const [selectedUserDocs, setSelectedUserDocs] = useState<DocGroup | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [individualRejectDoc, setIndividualRejectDoc] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { socket } = useSocketStore();
  // Stable refs — always point to latest fetch functions
  const pendingRef = useRef<(showLoading?: boolean) => void>(() => {});
  const verifiedRef = useRef<(showLoading?: boolean) => void>(() => {});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  // Keep searchTerm in a ref so polling/socket handlers always use the latest value
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;

  useEffect(() => {
    if (activeTab === 'unverified') fetchPendingDocs(true);
    else fetchVerifiedUsers(true);

    // Poll every 10 seconds — catches approvals for users with no socket event received
    const poll = setInterval(() => {
      if (activeTabRef.current === 'unverified') pendingRef.current();
      else verifiedRef.current();
    }, 10000);

    // Refresh on browser tab becoming visible
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (activeTabRef.current === 'unverified') pendingRef.current();
        else verifiedRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeTab]);

  // Keep refs up-to-date every render
  useEffect(() => {
    pendingRef.current = fetchPendingDocs;
    verifiedRef.current = fetchVerifiedUsers;
  });

  // Real-time: bind directly to raw socket with stable ref callbacks
  useEffect(() => {
    if (!socket) return;

    const refreshBoth = () => { pendingRef.current(); verifiedRef.current(); };
    const refreshPending = () => pendingRef.current();
    const refreshVerified = () => { if (activeTabRef.current === 'verified') verifiedRef.current(); };

    const events: [string, () => void][] = [
      ['admin:doc-uploaded',       refreshPending],
      ['admin:doc-status-changed', refreshBoth],
      ['admin:user-registered',    refreshPending],
      ['admin:profile-updated',    refreshBoth],
      ['admin:interest-sent',      refreshVerified],
      ['admin:user-reported',      refreshBoth],
      ['admin:user-blocked',       refreshBoth],
    ];

    events.forEach(([evt, handler]) => socket.on(evt, handler));
    const onReconnect = () => events.forEach(([evt, handler]) => { socket.off(evt, handler); socket.on(evt, handler); });
    socket.on('connect', onReconnect);

    return () => {
      events.forEach(([evt, handler]) => socket.off(evt, handler));
      socket.off('connect', onReconnect);
    };
  }, [socket]);

  const fetchPendingDocs = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const docs = await getPendingVerifications();
      setDocuments(Array.isArray(docs) ? docs : (docs?.data || docs?.documents || []));
    } catch (error) {
      console.error('Error fetching pending verifications:', error);
      toast.error('Failed to load pending verifications');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchVerifiedUsers = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const users = await getVerifiedUsers(searchTerm);
      setVerifiedUsersList(users);
    } catch (error) {
      console.error('Error fetching verified users:', error);
      toast.error('Failed to load verified users');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleApproveSingle = async (docId: string) => {
    if (!user) return;
    try {
      setActionLoading(true);
      await approveDocument(docId, user.id);
      toast.success('Document approved');
      // Close detail panel and refresh lists - approved docs auto-removed from pending
      setSelectedUserDocs(null);
      fetchPendingDocs();
      fetchVerifiedUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSingle = async (docId: string, reason: string) => {
    if (!user) return;
    if (!reason.trim()) { toast.error('Please provide a reason for rejection'); return; }
    try {
      setActionLoading(true);
      await rejectDocument(docId, user.id, reason);
      toast.success('Document rejected');
      setIndividualRejectDoc(null);
      // Close detail panel and refresh lists - rejected docs auto-removed from pending
      setSelectedUserDocs(null);
      fetchPendingDocs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAll = async () => {
    if (!selectedUserDocs || !user) return;
    try {
      setActionLoading(true);
      await approveAllDocuments(selectedUserDocs.user_id, user.id);
      toast.success('All documents approved successfully - user is now verified');
      setSelectedUserDocs(null);
      fetchPendingDocs();
      fetchVerifiedUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve documents');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAll = async () => {
    if (!selectedUserDocs || !user) return;
    if (!rejectReason.trim()) { toast.error('Please provide a reason for rejection'); return; }
    try {
      setActionLoading(true);
      await Promise.all(selectedUserDocs.documents.filter(d => d.verification_status === 'pending').map(doc => rejectDocument(doc.id, user.id, rejectReason)));
      toast.success('All pending documents rejected');
      setSelectedUserDocs(null);
      setRejectReason('');
      fetchPendingDocs();
      fetchVerifiedUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject documents');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplaceDoc = async (docId: string, file: File) => {
    try {
      setActionLoading(true);
      await replaceVerificationDoc(docId, file);
      toast.success('Document replaced successfully. It will need re-verification.');
      setReplacingDocId(null);
      if (selectedUserDocs) {
        const updated = selectedUserDocs.documents.map(d => d.id === docId ? { ...d, verification_status: 'pending', file_url: URL.createObjectURL(file) } as PendingVerification : d);
        setSelectedUserDocs({ ...selectedUserDocs, documents: updated });
      }
      fetchPendingDocs();
      if (activeTab === 'verified') fetchVerifiedUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to replace document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeDoc = async (docId: string, reason: string) => {
    if (!user) return;
    if (!reason.trim()) { toast.error('Please provide a reason for revocation'); return; }
    try {
      setActionLoading(true);
      await changeDocVerificationStatus(docId, 'rejected', user.id, reason);
      toast.success('Document revoked');
      if (selectedUserDocs) {
        const updated = selectedUserDocs.documents.map(d => d.id === docId ? { ...d, verification_status: 'rejected' } as PendingVerification : d);
        setSelectedUserDocs({ ...selectedUserDocs, documents: updated });
      }
      fetchVerifiedUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke document');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesFilter = filter === 'all' || doc.document_type === filter;
    if (!searchTerm) return matchesFilter;
    const s = searchTerm.toLowerCase();
    const profile = doc.profile as any;
    let matchesSearch = false;
    if (searchField === 'all' || searchField === 'profile_id') matchesSearch = matchesSearch || profile?.profile_id?.toLowerCase().includes(s);
    if (searchField === 'all' || searchField === 'email') matchesSearch = matchesSearch || profile?.email?.toLowerCase().includes(s);
    if (searchField === 'all' || searchField === 'phone') matchesSearch = matchesSearch || profile?.phone?.includes(s);
    if (searchField === 'all') matchesSearch = matchesSearch || profile?.first_name?.toLowerCase().includes(s) || profile?.last_name?.toLowerCase().includes(s);
    return matchesFilter && matchesSearch;
  });

  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    const profile = doc.profile;
    if (!acc[doc.user_id]) acc[doc.user_id] = { user_id: doc.user_id, profile, documents: [], latest_date: doc.uploaded_at };
    acc[doc.user_id].documents.push(doc);
    if (new Date(doc.uploaded_at) > new Date(acc[doc.user_id].latest_date)) acc[doc.user_id].latest_date = doc.uploaded_at;
    return acc;
  }, {} as Record<string, DocGroup>);

  const groupedDocsList = Object.values(groupedDocs).sort((a, b) => new Date(b.latest_date).getTime() - new Date(a.latest_date).getTime());

  const getDocTypeLabel = (type: string) => {
    switch (type) { case 'aadhaar_front': return 'Aadhaar Front'; case 'aadhaar_back': return 'Aadhaar Back'; case 'biodata': return 'Biodata'; default: return type; }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) { case 'aadhaar_front': return <CreditCard size={14} />; case 'aadhaar_back': return <CreditCard size={14} />; case 'biodata': return <FileText size={14} />; default: return <File size={14} />; }
  };

  const getDocTypeColor = (type: string) => {
    switch (type) { case 'aadhaar_front': return 'bg-blue-50 text-blue-700 border-blue-100'; case 'aadhaar_back': return 'bg-indigo-50 text-indigo-700 border-indigo-100'; case 'biodata': return 'bg-purple-50 text-purple-700 border-purple-100'; default: return 'bg-gray-50 text-gray-700 border-gray-100'; }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold"><CheckCircle2 size={10} /> Approved</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold"><XCircle size={10} /> Rejected</span>;
      case 'pending': return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold"><Clock size={10} /> Pending</span>;
      default: return null;
    }
  };

  const filteredVerifiedUsers = verifiedUsersList.filter((p: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    let match = false;
    if (searchField === 'all' || searchField === 'profile_id') match = match || p.profile_id?.toLowerCase().includes(s);
    if (searchField === 'all' || searchField === 'email') match = match || p.email?.toLowerCase().includes(s);
    if (searchField === 'all' || searchField === 'phone') match = match || p.phone?.includes(s);
    if (searchField === 'all') match = match || p.first_name?.toLowerCase().includes(s) || p.last_name?.toLowerCase().includes(s);
    return match;
  });

  const openVerifiedUserDocs = async (profile: any) => {
    try {
      const rawDocs = await getAllVerificationDocs('all', profile.profile_id || profile.email);
      const docs = Array.isArray(rawDocs)
        ? rawDocs
        : (rawDocs?.data || rawDocs?.documents || []);
      if (docs.length > 0) {
        const grouped = docs.reduce((acc: any, d: any) => {
          if (!acc[d.user_id]) acc[d.user_id] = { user_id: d.user_id, profile: d.profile || profile, documents: [], latest_date: d.uploaded_at };
          acc[d.user_id].documents.push(d);
          return acc;
        }, {});
        const g = Object.values(grouped)[0] as DocGroup;
        if (g) setSelectedUserDocs(g);
      } else {
        toast.error('No documents found for this user');
      }
    } catch {
      toast.error('Failed to load documents');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><Shield className="text-primary" size={24} /></div>
            Document Verification
          </h1>
          <p className="text-gray-500 text-sm mt-1 ml-11">Review, approve, replace and manage user verification documents</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 rounded-xl flex items-center gap-2 text-sm font-semibold border border-amber-200 shadow-sm">
            <Clock size={16} /> {documents.length} Pending
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl flex items-center gap-2 text-sm font-semibold border border-emerald-200 shadow-sm">
            <ShieldCheck size={16} /> {verifiedUsersList.length} Verified
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex">
          <button
            onClick={() => setActiveTab('unverified')}
            className={`flex-1 py-4 px-6 text-sm font-bold flex items-center justify-center gap-2.5 transition-all relative ${activeTab === 'unverified' ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
          >
            <UserX size={18} /> Unverified Users
            {documents.length > 0 && <span className="ml-1 px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-[10px] font-bold">{documents.length}</span>}
            {activeTab === 'unverified' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500 rounded-t" />}
          </button>
          <button
            onClick={() => setActiveTab('verified')}
            className={`flex-1 py-4 px-6 text-sm font-bold flex items-center justify-center gap-2.5 transition-all relative ${activeTab === 'verified' ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
          >
            <UserCheck size={18} /> Verified Users
            {verifiedUsersList.length > 0 && <span className="ml-1 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-full text-[10px] font-bold">{verifiedUsersList.length}</span>}
            {activeTab === 'verified' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t" />}
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-5 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-gray-50/80 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'unverified' && (
              <>
                <Filter size={15} className="text-gray-400" />
                {['all', 'aadhaar_front', 'aadhaar_back', 'biodata'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as any)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${filter === f ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {f === 'all' ? 'All Docs' : getDocTypeLabel(f)}
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as any)}
              className="px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary focus:border-primary font-medium"
            >
              <option value="all">🔍 All</option>
              <option value="email">📧 Email</option>
              <option value="phone">📱 Phone</option>
              <option value="profile_id">🆔 User ID</option>
            </select>
            <div className="relative flex-1 sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search by ${searchField === 'all' ? 'name, email, phone, ID' : searchField}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading ? (
            <AdminTableSkeleton />
          ) : activeTab === 'unverified' ? (
            groupedDocsList.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mb-4">
                  <BadgeCheck size={36} className="text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-1">All Clear!</h3>
                <p className="text-gray-400 text-sm">No documents waiting for verification.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedDocsList.map((group) => (
                  <div key={group.user_id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all group cursor-pointer" onClick={() => setSelectedUserDocs(group)}>
                    <div className="relative">
                      <Avatar src={group.profile?.profile_photo_url} fallbackName={group.profile?.first_name || 'User'} size="lg" gender={group.profile?.gender} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                        <Clock size={10} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/admin/users/${group.profile?.id}`} onClick={e => e.stopPropagation()} className="font-bold text-gray-900 hover:text-primary transition-colors truncate">
                          {group.profile?.first_name} {group.profile?.last_name}
                        </Link>
                        {group.profile?.is_premium && <Crown size={14} className="text-amber-500" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 font-mono"><Hash size={9} />{group.profile?.profile_id || group.user_id.substring(0, 8)}</span>
                        {(group.profile as any)?.email && <span className="flex items-center gap-1"><Mail size={9} />{(group.profile as any).email}</span>}
                        {(group.profile as any)?.phone && <span className="flex items-center gap-1"><Phone size={9} />{(group.profile as any).phone}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {group.documents.map(d => (
                          <span key={d.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-semibold ${getDocTypeColor(d.document_type)}`}>
                            {getDocTypeIcon(d.document_type)} {getDocTypeLabel(d.document_type)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-400">{new Date(group.latest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-[10px] text-gray-300">{new Date(group.latest_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <Eye size={14} /> Review
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredVerifiedUsers.length === 0 ? (
              <div className="py-20 text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck size={36} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-1">No verified users found</h3>
                <p className="text-gray-400 text-sm">{searchTerm ? 'Try adjusting your search criteria.' : 'No users have been verified yet.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVerifiedUsers.map((profile: any) => (
                  <div key={profile.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all group">
                    <div className="relative">
                      <Avatar src={profile.profile_photo_url} fallbackName={`${profile.first_name} ${profile.last_name}`} size="lg" gender={profile.gender} />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircle2 size={10} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/admin/users/${profile.id}`} className="font-bold text-gray-900 hover:text-primary transition-colors truncate">
                          {profile.first_name} {profile.last_name}
                        </Link>
                        {profile.is_premium && <Crown size={14} className="text-amber-500" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 font-mono"><Hash size={9} />{profile.profile_id}</span>
                        {profile.email && <span className="flex items-center gap-1"><Mail size={9} />{profile.email}</span>}
                        {profile.phone && <span className="flex items-center gap-1"><Phone size={9} />{profile.phone}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(profile.documents || []).map((d: any) => (
                          <span key={d.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-semibold ${d.verification_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                            {getDocTypeIcon(d.document_type)} {getDocTypeLabel(d.document_type)}
                            {d.verification_status === 'approved' && <CheckCircle2 size={9} />}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openVerifiedUserDocs(profile)}
                        className="px-4 py-2 bg-gradient-to-r from-primary to-primary-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all"
                      >
                        <Eye size={13} /> View & Manage Docs
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Hidden file input for document replacement */}
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
        if (e.target.files?.[0] && replacingDocId) {
          handleReplaceDoc(replacingDocId, e.target.files[0]);
          e.target.value = '';
        }
      }} />

      {/* Review Modal */}
      {selectedUserDocs && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-start justify-center min-h-screen pt-4 px-4 pb-20">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !actionLoading && setSelectedUserDocs(null)} />
            <div className="relative bg-white rounded-2xl text-left overflow-hidden shadow-2xl my-6 max-w-6xl w-full border border-gray-200">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-primary via-primary to-primary-600 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedUserDocs(null)} className="text-white/70 hover:text-white transition-colors" disabled={actionLoading}>
                    <ArrowLeft size={20} />
                  </button>
                  <div className="relative">
                    <Avatar src={selectedUserDocs.profile?.profile_photo_url} fallbackName={selectedUserDocs.profile?.first_name || 'User'} size="lg" gender={selectedUserDocs.profile?.gender} />
                    {activeTab === 'verified' && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircle2 size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-white">
                    <h3 className="text-lg font-bold">{selectedUserDocs.profile?.first_name} {selectedUserDocs.profile?.last_name}</h3>
                    <p className="text-xs opacity-80 flex items-center gap-3">
                      <span>{selectedUserDocs.profile?.profile_id}</span>
                      <span>{selectedUserDocs.documents.length} document(s)</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedUserDocs(null)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all" disabled={actionLoading}>
                  <X size={22} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5">
                {/* User Info Sidebar */}
                <div className="md:col-span-1 bg-gradient-to-b from-gray-50 to-white p-5 border-r border-gray-100">
                  <h4 className="font-bold text-gray-800 mb-4 text-xs uppercase tracking-wider">User Details</h4>
                  <div className="space-y-3">
                    <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">Email</p>
                      <p className="text-gray-700 text-xs break-all flex items-center gap-1"><Mail size={10} className="text-gray-400 shrink-0" />{(selectedUserDocs.profile as any)?.email || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">Phone</p>
                      <p className="text-gray-700 text-xs flex items-center gap-1"><Phone size={10} className="text-gray-400 shrink-0" />{(selectedUserDocs.profile as any)?.phone || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">Profile ID</p>
                      <p className="text-gray-700 text-xs font-mono flex items-center gap-1"><Hash size={10} className="text-gray-400 shrink-0" />{selectedUserDocs.profile?.profile_id || 'N/A'}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      <p className="text-[11px]"><span className="text-gray-400">Gender:</span> <span className="capitalize font-medium text-gray-700">{selectedUserDocs.profile?.gender}</span></p>
                      <p className="text-[11px]"><span className="text-gray-400">DOB:</span> <span className="font-medium text-gray-700">{selectedUserDocs.profile?.date_of_birth ? new Date(selectedUserDocs.profile.date_of_birth).toLocaleDateString('en-IN') : 'N/A'}</span></p>
                      <p className="text-[11px]"><span className="text-gray-400">Religion:</span> <span className="font-medium text-gray-700">{selectedUserDocs.profile?.religion || 'N/A'}</span></p>
                      <p className="text-[11px]"><span className="text-gray-400">Caste:</span> <span className="font-medium text-gray-700">{selectedUserDocs.profile?.caste || 'N/A'}</span></p>
                    </div>
                    <Link to={`/admin/users/${selectedUserDocs.user_id}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-bold mt-2">
                      View Full Profile <ChevronRight size={10} />
                    </Link>
                  </div>
                </div>

                {/* Document Viewer */}
                <div className="md:col-span-4 p-5 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {selectedUserDocs.documents.map((doc) => (
                      <div key={doc.id} className={`rounded-xl border-2 overflow-hidden transition-all ${
                        doc.verification_status === 'approved' ? 'border-emerald-200 bg-emerald-50/20' :
                        doc.verification_status === 'rejected' ? 'border-red-200 bg-red-50/20' :
                        'border-amber-200 bg-amber-50/20'
                      }`}>
                        {/* Document Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white/80 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${getDocTypeColor(doc.document_type)}`}>
                              {getDocTypeIcon(doc.document_type)}
                            </div>
                            <div>
                              <span className="text-sm font-bold text-gray-800 block leading-tight">{getDocTypeLabel(doc.document_type)}</span>
                              {getStatusBadge(doc.verification_status)}
                            </div>
                          </div>
                        </div>

                        {/* Document Preview */}
                        <div className="bg-gray-50 min-h-[180px] flex items-center justify-center relative p-3">
                          {doc.file_type?.startsWith('image/') ? (
                            <img src={doc.file_url} alt={getDocTypeLabel(doc.document_type)} className="max-w-full max-h-[280px] object-contain rounded-lg cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setZoomedImage(doc.file_url)} />
                          ) : doc.file_type === 'application/pdf' ? (
                            <iframe src={doc.file_url} className="w-full h-[280px] rounded-lg border-0" title="PDF Preview" />
                          ) : (
                            <div className="text-center p-6">
                              <Image className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                              <p className="text-gray-400 text-xs">Preview not available</p>
                              <a href={doc.file_url} target="_blank" className="text-primary text-xs hover:underline mt-1 inline-block">Download to view</a>
                            </div>
                          )}
                          {doc.file_type?.startsWith('image/') && (
                            <button onClick={() => setZoomedImage(doc.file_url)} className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors shadow-sm border border-gray-200">
                              <ZoomIn size={14} className="text-gray-600" />
                            </button>
                          )}
                        </div>

                        {/* Document Actions */}
                        <div className="px-4 py-3 bg-white border-t border-gray-100 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1">
                              <Download size={10} /> Download
                            </a>
                            {doc.verification_status === 'pending' && (
                              <>
                                <button onClick={() => handleApproveSingle(doc.id)} disabled={actionLoading} className="px-2.5 py-1 bg-emerald-500 text-white rounded-md text-[10px] font-bold hover:bg-emerald-600 transition-colors flex items-center gap-1 disabled:opacity-50">
                                  <CheckCircle2 size={10} /> Approve
                                </button>
                                <button onClick={() => setIndividualRejectDoc(doc.id)} className="px-2.5 py-1 bg-red-500 text-white rounded-md text-[10px] font-bold hover:bg-red-600 transition-colors flex items-center gap-1">
                                  <XCircle size={10} /> Reject
                                </button>
                              </>
                            )}
                            {doc.verification_status === 'approved' && activeTab === 'verified' && (
                              <>
                                <button onClick={() => { setReplacingDocId(String(doc.id)); fileInputRef.current?.click(); }} className="px-2.5 py-1 bg-blue-500 text-white rounded-md text-[10px] font-bold hover:bg-blue-600 transition-colors flex items-center gap-1">
                                  <Upload size={10} /> Replace
                                </button>
                                <button onClick={() => setIndividualRejectDoc(doc.id)} className="px-2.5 py-1 bg-red-500 text-white rounded-md text-[10px] font-bold hover:bg-red-600 transition-colors flex items-center gap-1">
                                  <Ban size={10} /> Revoke
                                </button>
                              </>
                            )}
                            {doc.verification_status === 'rejected' && (
                              <button onClick={() => { setReplacingDocId(String(doc.id)); fileInputRef.current?.click(); }} className="px-2.5 py-1 bg-blue-500 text-white rounded-md text-[10px] font-bold hover:bg-blue-600 transition-colors flex items-center gap-1">
                                <Upload size={10} /> Replace
                              </button>
                            )}
                          </div>
                          {/* Individual Reject/Revoke Reason */}
                          {individualRejectDoc === doc.id && (
                            <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                              <label className="text-[10px] font-bold text-red-700 mb-1 block">
                                {doc.verification_status === 'approved' ? 'Revocation Reason (required)' : 'Rejection Reason (required)'}
                              </label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  placeholder={doc.verification_status === 'approved' ? 'e.g., Document mismatch, fraud detected...' : 'e.g., Image blurry, name mismatch...'}
                                  className="flex-1 px-2.5 py-1.5 border border-red-200 rounded-md text-xs focus:ring-red-500 focus:border-red-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value;
                                      if (doc.verification_status === 'approved') handleRevokeDoc(doc.id, val);
                                      else handleRejectSingle(doc.id, val);
                                    } else if (e.key === 'Escape') setIndividualRejectDoc(null);
                                  }}
                                  id={`reject-reason-${doc.id}`}
                                />
                                <button
                                  onClick={() => {
                                    const input = document.getElementById(`reject-reason-${doc.id}`) as HTMLInputElement;
                                    const val = input?.value || '';
                                    if (doc.verification_status === 'approved') handleRevokeDoc(doc.id, val);
                                    else handleRejectSingle(doc.id, val);
                                  }}
                                  disabled={actionLoading}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded-md text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button onClick={() => setIndividualRejectDoc(null)} className="px-2 py-1.5 bg-gray-200 text-gray-600 rounded-md text-[10px] font-bold hover:bg-gray-300">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {doc.admin_notes && (
                            <p className="text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                              <span className="font-bold">Admin Note:</span> {doc.admin_notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bulk Actions - only for unverified tab with pending docs */}
                  {activeTab === 'unverified' && selectedUserDocs.documents.some(d => d.verification_status === 'pending') && (
                    <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200">
                      <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <RefreshCw size={14} className="text-primary" /> Bulk Actions
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 mb-1 block font-semibold">Rejection reason (required for reject all)</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-red-500 focus:border-red-500"
                            placeholder="e.g., Documents don't match profile details..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                        </div>
                        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                          <Button variant="primary" onClick={handleApproveAll} loading={actionLoading} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6">
                            <CheckCircle2 size={16} /> Approve All
                          </Button>
                          <Button variant="danger" onClick={handleRejectAll} loading={actionLoading} className="flex items-center justify-center gap-2 px-6">
                            <XCircle size={16} /> Reject All
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all" onClick={() => setZoomedImage(null)}>
            <X size={32} />
          </button>
          <img src={zoomedImage} alt="Zoomed document" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
