import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff, CheckCircle, XCircle, AlertTriangle, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { 
  getUnblockRequests, handleUnblockRequest, getUnblockRequestDetail 
} from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../lib/utils';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';

export default function AdminUnblockRequests() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unblockRequests, setUnblockRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState<any | null>(null);
  const [historyUser, setHistoryUser] = useState<any | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [adminNotes, setAdminNotes] = useState('');
  const [loadingRequestDetail, setLoadingRequestDetail] = useState(false);

  // Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'processed'>('pending');

  useEffect(() => {
    fetchData();
    // Real-time polling every 5 seconds for new requests
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getUnblockRequests();
      setUnblockRequests(data);
    } catch (error) {
      if (showLoading) toast.error('Failed to load unblock requests');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSelectRequest = async (req: any) => {
    setSelectedRequest(req);
    setSelectedRequestDetail(null);
    setLoadingRequestDetail(true);
    try {
      const detail = await getUnblockRequestDetail(req.id);
      setSelectedRequestDetail(detail);
    } catch (error) {
      toast.error('Failed to fetch request details');
    } finally {
      setLoadingRequestDetail(false);
    }
  };

  const handleProcessUnblockRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    if (!adminNotes && status === 'rejected') {
      toast.error('Please provide notes for rejection');
      return;
    }
    setSaving(true);
    try {
      await handleUnblockRequest(requestId, (user?.id || ''), status, adminNotes);
      toast.success(`Request ${status} successfully`);
      setSelectedRequest(null);
      setSelectedRequestDetail(null);
      setAdminNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to process request');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = (user: any) => {
    setHistoryUser(user);
    setHistoryPage(1);
  };

  const filteredRequests = unblockRequests.filter(req => {
    // Filter by status
    if (statusFilter === 'pending' && req.status !== 'pending') return false;
    if (statusFilter === 'processed' && req.status === 'pending') return false;

    // Filter by search term (Email, Phone, Profile ID, Name)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchEmail = (req.user?.email || '').toLowerCase().includes(term);
      const matchPhone = (req.user?.phone || '').toLowerCase().includes(term);
      const matchProfileId = (req.user?.profile_id || '').toLowerCase().includes(term);
      const matchName = `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.toLowerCase().includes(term);
      
      if (!matchEmail && !matchPhone && !matchProfileId && !matchName) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <AdminTableSkeleton />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <ShieldOff size={28} className="text-primary" /> Unblock Requests
          </h1>
          <p className="text-gray-500">Review user appeals, check violations, and manage unblock decisions.</p>
        </div>
      </div>

      <Card className="p-4 border-none shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between bg-white rounded-xl">
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Open Requests
          </button>
          <button
            onClick={() => setStatusFilter('processed')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'processed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Closed Requests
          </button>
        </div>

        <div className="relative w-full md:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by Email, Phone, or Profile ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm bg-gray-50"
          />
        </div>
      </Card>

      <Card className="overflow-hidden border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[750px]">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Block Reason (Admin)</th>
                <th className="px-6 py-4">Appeal Reason (User)</th>
                <th className="px-6 py-4">Date</th>
                {statusFilter === 'processed' && <th className="px-6 py-4">Status</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <Link to={`/admin/users/${req.user_id}`} className="font-bold text-gray-900 hover:text-primary transition-colors block">
                          {req.user?.first_name} {req.user?.last_name}
                        </Link>
                        <p className="text-xs text-primary font-mono mt-0.5">{req.user?.profile_id}</p>
                        <p className="text-xs text-gray-500 mt-1">{req.user?.email}</p>
                        <p className="text-xs text-gray-500">{req.user?.phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-start gap-1.5 p-2 bg-red-50 text-red-800 rounded-lg text-xs font-medium max-w-[200px]">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-3">{req.user?.block_reason || 'Violation of terms'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 line-clamp-3 max-w-[250px] italic">"{req.reason}"</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(req.created_at)}</td>
                    {statusFilter === 'processed' && (
                      <td className="px-6 py-4">
                        <Badge 
                          variant={req.status === 'approved' ? 'success' : 'danger'}
                        >
                          {req.status}
                        </Badge>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/admin/users/${req.user_id}`}>
                          <Button variant="outline" size="sm" className="rounded-full shadow-sm text-xs py-1.5">
                            View Profile
                          </Button>
                        </Link>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenHistory(req.user)}
                          className="rounded-full shadow-sm text-xs py-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          Track History
                        </Button>
                        <Button 
                          variant={req.status === 'pending' ? 'primary' : 'outline'}
                          size="sm" 
                          onClick={() => handleSelectRequest(req)}
                          className="rounded-full shadow-sm text-xs py-1.5"
                        >
                          {req.status === 'pending' ? 'Review & Action' : 'View Details'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={statusFilter === 'processed' ? 6 : 5} className="px-6 py-16 text-center text-gray-400">
                    <ShieldOff size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">No {statusFilter === 'pending' ? 'open' : 'closed'} unblock requests found</p>
                    {searchTerm && <p className="text-xs mt-1">Try adjusting your search criteria</p>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => {
          setSelectedRequest(null);
          setSelectedRequestDetail(null);
        }}
        title={selectedRequest?.status === 'pending' ? "Review Unblock Request" : "Request Details"}
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">User Details</p>
                  <div className="flex items-center gap-3">
                    <Link to={`/admin/users/${selectedRequest.user_id}`} className="font-bold text-lg text-gray-900 hover:text-primary transition-colors block">
                      {selectedRequest.user?.first_name} {selectedRequest.user?.last_name}
                    </Link>
                    <Link to={`/admin/users/${selectedRequest.user_id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-3 py-0 rounded-full border-gray-300 text-gray-700 hover:bg-gray-100">
                        View Profile
                      </Button>
                    </Link>
                  </div>
                  <p className="text-sm text-primary font-mono mt-1">{selectedRequest.user?.profile_id}</p>
                </div>
                <Badge variant={selectedRequest.status === 'pending' ? 'warning' : selectedRequest.status === 'approved' ? 'success' : 'danger'}>
                  {selectedRequest.status.toUpperCase()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2 mb-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Email</span>
                  <span className="font-medium">{selectedRequest.user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Phone</span>
                  <span className="font-medium">{selectedRequest.user?.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-400 uppercase font-bold mb-2">User's Appeal/Explanation</p>
                <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-700 italic shadow-inner">
                  "{selectedRequest.reason}"
                </div>
              </div>
            </div>

            {loadingRequestDetail ? (
              <AdminTableSkeleton />
            ) : selectedRequestDetail && (
              <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-sm">
                <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} /> Original Violation Context
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-red-600 uppercase font-bold mb-1">Admin Block Reason</p>
                    <p className="text-sm font-medium text-red-900 bg-red-100/50 p-3 rounded-lg border border-red-200">
                      {selectedRequestDetail.user?.block_reason || selectedRequest.user?.block_reason || 'Unknown Violation'}
                    </p>
                  </div>
                  {selectedRequestDetail.warnings?.violation_messages && selectedRequestDetail.warnings.violation_messages.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs text-red-600 uppercase font-bold mb-2">Detailed Violation Evidence (Messages Sent)</p>
                      <div className="space-y-3 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedRequestDetail.warnings.violation_messages.map((vm: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm relative">
                            <div className="absolute top-4 left-0 w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                            <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-200 pb-2 mb-2">
                              <span>Sent: {formatDate(vm.timestamp)}</span>
                              {vm.chat_with && <span>Chat with: <Link to={`/admin/users/${vm.chat_with}`} className="text-blue-600 hover:underline font-bold">{vm.chat_with.substring(0,12)}...</Link></span>}
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-red-200 text-sm shadow-sm relative overflow-visible">
                              <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-t border-l border-red-200 rotate-45"></div>
                              <p className="text-red-900 font-mono font-medium relative z-10 break-all">{vm.message}</p>
                            </div>
                            {vm.is_exact_match && <p className="text-[10px] text-red-500 uppercase font-bold mt-2 text-right tracking-wider">System Detected PII Pattern</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedRequest.status === 'pending' ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Required for rejection)</label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none shadow-inner"
                    rows={3}
                    placeholder="Add notes about your decision before approving or rejecting..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  ></textarea>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-red-700 bg-white border border-red-200 hover:bg-red-800 hover:text-white hover:border-red-800 transition-colors justify-center py-2.5"
                    onClick={() => handleProcessUnblockRequest(selectedRequest.id, 'rejected')}
                    disabled={saving}
                  >
                    <XCircle size={18} className="mr-2" /> Reject Appeal
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none shadow-md shadow-emerald-200 justify-center py-2.5"
                    onClick={() => handleProcessUnblockRequest(selectedRequest.id, 'approved')}
                    disabled={saving}
                  >
                    <CheckCircle size={18} className="mr-2" /> Approve & Unblock User
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 p-5 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-800 mb-1">Resolution Summary</p>
                <p className="text-sm text-gray-600">This request was <strong className={selectedRequest.status === 'approved' ? 'text-emerald-600' : 'text-red-600'}>{selectedRequest.status}</strong> on {formatDate(selectedRequest.reviewed_at)}.</p>
                {selectedRequest.admin_notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Admin Notes</p>
                    <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-gray-200 shadow-inner">{selectedRequest.admin_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* User History Link in Modal */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="text-sm text-gray-500">Want to see all past appeals from this user?</span>
              <Button variant="outline" size="sm" onClick={() => handleOpenHistory(selectedRequest.user)} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                Open Track History
              </Button>
            </div>

          </div>
        )}
      </Modal>

      {/* Track History Modal */}
      <Modal
        isOpen={!!historyUser}
        onClose={() => setHistoryUser(null)}
        title="User Unblock Request History"
        size="md"
      >
        {historyUser && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">Tracking History For</p>
                <p className="font-bold text-lg text-blue-900">{historyUser.first_name} {historyUser.last_name}</p>
                <p className="text-sm text-blue-700 font-mono">{historyUser.profile_id}</p>
              </div>
              <Link to={`/admin/users/${historyUser.id || historyUser.profile_id}`}>
                <Button variant="primary" size="sm" className="shadow-sm">View Profile</Button>
              </Link>
            </div>

            {(() => {
              const userHistory = unblockRequests.filter(r => r.user_id === (historyUser.id || historyUser.profile_id));
              if (userHistory.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No unblock request history found for this user.</p>
                  </div>
                );
              }
              
              const ITEMS_PER_PAGE = 5;
              const totalPages = Math.ceil(userHistory.length / ITEMS_PER_PAGE);
              const sortedHistory = userHistory.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              const paginatedHistory = sortedHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

              return (
                <div className="space-y-4">
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {paginatedHistory.map((hist, index) => {
                      const absoluteIndex = userHistory.length - ((historyPage - 1) * ITEMS_PER_PAGE + index);
                      return (
                        <div key={hist.id} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm relative">
                          <div className="absolute -left-2 top-6 w-5 h-5 bg-blue-100 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 shadow-sm">{absoluteIndex}</div>
                          <div className="pl-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-gray-500">{formatDate(hist.created_at)}</span>
                              <Badge variant={hist.status === 'approved' ? 'success' : hist.status === 'rejected' ? 'danger' : 'warning'}>
                                {hist.status.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 italic mb-3">User Appeal: "{hist.reason}"</p>
                            {hist.status !== 'pending' && (
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                                <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Admin Action & Remarks</span>
                                <span className="text-gray-800">{hist.admin_notes || 'No remarks provided.'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        className="text-xs py-1"
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-bold text-gray-500">
                        Page {historyPage} of {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={historyPage === totalPages}
                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                        className="text-xs py-1"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
