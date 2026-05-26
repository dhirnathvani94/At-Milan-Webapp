import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Mail, MessageSquare, CheckCircle, Clock, Eye, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp, XCircle, Filter, Tag, User, Phone, Image as ImageIcon, UploadCloud, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminContacts, markContactResolved, markContactRejected, reopenContactTicket } from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { formatDate } from '../../lib/utils';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';

const TABS = [
  { key: 'open', label: 'Open Tickets' },
  { key: 'closed', label: 'Closed Tickets' },
];

const SUBJECT_OPTIONS = [
  { value: '', label: 'All Subjects' },
  { value: 'Profile Issue', label: 'Profile Issue' },
  { value: 'Membership Query', label: 'Membership Query' },
  { value: 'Report Issue', label: 'Report Issue' },
  { value: 'Feedback', label: 'Feedback' },
  { value: 'Suggestion', label: 'Suggestion' },
  { value: 'Other', label: 'Other' }
];

export default function AdminContacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('open');
  const intervalRef = useRef<any>(null);
  
  // Filters
  const [searchTicketId, setSearchTicketId] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  const [resolveNote, setResolveNote] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const limit = 20;

  const fetchContacts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await getAdminContacts(1); 
      setContacts(res.contacts || []);
    } catch (error) {
      if (!silent) toast.error('Failed to fetch contact messages');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    intervalRef.current = setInterval(() => fetchContacts(true), 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Reset page to 1 when filters/tabs change
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTicketId, searchSubject, searchEmail, searchPhone, searchUserId]);

  const handleAction = async (id: string, type: 'resolve' | 'reject') => {
    if (!resolveNote.trim()) {
      toast.error(`Please enter a ${type === 'resolve' ? 'resolution' : 'rejection'} note to notify the user`);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      if (type === 'resolve') {
        formData.append('resolution_note', resolveNote);
      } else {
        formData.append('rejection_note', resolveNote);
      }
      formData.append('admin_id', 'admin');
      if (attachmentFile) {
        formData.append('photo', attachmentFile);
      }

      if (type === 'resolve') {
        await markContactResolved(id, formData);
        toast.success('Ticket marked as solved and email sent');
      } else {
        await markContactRejected(id, formData);
        toast.success('Ticket rejected and email sent');
      }
      
      await fetchContacts(true);
      setSelectedContact(null);
      setExpandedRow(null);
      resetActionForm();
    } catch (error) {
      toast.error('Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (id: string) => {
    setSubmitting(true);
    try {
      await reopenContactTicket(id);
      toast.success('Ticket reopened successfully');
      await fetchContacts(true);
      setSelectedContact(null);
      setActiveTab('open'); // Auto navigate to open tab
    } catch (error) {
      toast.error('Failed to reopen ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRow(expandedRow === id ? null : id);
  };

  const clearFilters = () => {
    setSearchTicketId('');
    setSearchSubject('');
    setSearchEmail('');
    setSearchPhone('');
    setSearchUserId('');
  };

  const resetActionForm = () => {
    setResolveNote('');
    setAttachmentFile(null);
    setAttachmentPreview(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachmentFile(file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const filteredContacts = contacts.filter((c: any) => {
    let match = true;
    
    // Tab filtering
    if (activeTab === 'open') {
      if (c.status === 'closed' || c.status === 'rejected') match = false;
    } else if (activeTab === 'closed') {
      if (c.status !== 'closed' && c.status !== 'rejected') match = false;
    }
    
    if (searchTicketId && !c.ticket_number?.toLowerCase().includes(searchTicketId.toLowerCase())) match = false;
    if (searchSubject && c.subject !== searchSubject) match = false;
    if (searchEmail && !c.email?.toLowerCase().includes(searchEmail.toLowerCase())) match = false;
    
    if (searchPhone) {
      const phoneStr = (c.phone || c.phone_number || '').toLowerCase();
      if (!phoneStr.includes(searchPhone.toLowerCase())) match = false;
    }
    if (searchUserId) {
      const userIdStr = (c.user_id || c.profile_id || '').toLowerCase();
      if (!userIdStr.includes(searchUserId.toLowerCase())) match = false;
    }
    
    return match;
  });

  const totalCount = filteredContacts.length;
  const totalPages = Math.ceil(totalCount / limit);
  const paginatedContacts = filteredContacts.slice((page - 1) * limit, page * limit);

  const openCount = contacts.filter(c => c.status !== 'closed' && c.status !== 'rejected').length;
  const closedCount = contacts.filter(c => c.status === 'closed' || c.status === 'rejected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
            <MessageSquare className="text-primary" size={26} /> Ticket Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Professional help desk for user inquiries and support tickets</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchContacts()}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary bg-white border border-gray-200 hover:border-primary/40 px-4 py-2 rounded-xl transition-all"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <Button 
            variant={showFilters ? "primary" : "outline"} 
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-xl shadow-sm font-semibold"
          >
            <Filter size={16} className="mr-2" /> Filters
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === t.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-primary/40 hover:text-primary'
            }`}
          >
            {t.label}
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t.key === 'open' ? openCount : closedCount}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="p-5 border border-gray-100 shadow-sm rounded-2xl bg-white animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
              <Filter size={14} /> Advanced Filtering
            </h3>
            <button onClick={clearFilters} className="text-xs font-bold text-primary hover:text-primary-dark">Clear All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Subject</label>
              <Select 
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                options={SUBJECT_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Ticket ID</label>
              <div className="relative">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchTicketId} onChange={e => setSearchTicketId(e.target.value)} placeholder="e.g. TKT-001" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="user@example.com" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchPhone} onChange={e => setSearchPhone(e.target.value)} placeholder="Filter by phone..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">User ID</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchUserId} onChange={e => setSearchUserId(e.target.value)} placeholder="Filter by User ID..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tickets Table */}
      <Card className="overflow-hidden border border-gray-100 shadow-sm rounded-3xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50/80 text-[11px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Ticket Details</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Message Preview</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && contacts.length === 0 ? (
                <tr><td colSpan={6} className="p-0"><AdminTableSkeleton /></td></tr>
              ) : paginatedContacts.length > 0 ? (
                paginatedContacts.map((c) => (
                  <Fragment key={c.id}>
                    <tr 
                      className={`hover:bg-primary/5 transition-colors cursor-pointer group ${expandedRow === c.id ? 'bg-primary/5' : ''}`}
                      onClick={() => { setSelectedContact(c); resetActionForm(); }}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-mono font-black text-primary text-xs mb-1 bg-primary/10 inline-block px-2 py-0.5 rounded-md">{c.ticket_number || 'LEGACY-TKT'}</p>
                          <p className="font-bold text-gray-900 mt-1">{c.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">{c.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="primary" className="text-[10px] font-bold tracking-wide">{c.subject}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 truncate max-w-[250px] font-medium">{c.message}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-medium flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-400" />
                        {c.created_at ? formatDate(c.created_at) : 'Unknown Date'}
                      </td>
                      <td className="px-6 py-4">
                        {c.status === 'closed' || (c.is_resolved && c.status !== 'rejected') ? (
                          <Badge variant="success" className="shadow-sm">Solved</Badge>
                        ) : c.status === 'rejected' ? (
                          <Badge variant="danger" className="shadow-sm bg-red-100 text-red-700">Rejected</Badge>
                        ) : (
                          <Badge variant="warning" className="shadow-sm bg-amber-100 text-amber-700 border-amber-200">Open</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl px-2 bg-white"
                            onClick={(e) => toggleRow(c.id, e)}
                          >
                            {expandedRow === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </Button>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="rounded-xl shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContact(c);
                              resetActionForm();
                            }}
                          >
                            Action
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === c.id && (
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <td colSpan={6} className="px-8 py-6">
                          <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-2xl" />
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-black text-gray-900 mb-1 text-lg">Full Message details</h4>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{c.ticket_number}</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-5 rounded-xl border border-gray-100 mb-4 font-medium leading-relaxed">
                              {c.message}
                            </div>
                            
                            {(c.status === 'closed' || c.status === 'rejected' || c.is_resolved) && c.resolution_note && (
                              <div className={`mt-4 p-5 border rounded-xl shadow-sm ${c.status === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                <p className={`text-xs font-black uppercase tracking-widest mb-2 ${c.status === 'rejected' ? 'text-red-800' : 'text-green-800'}`}>
                                  Admin Action Note (Sent to User)
                                </p>
                                <p className={`text-sm font-medium ${c.status === 'rejected' ? 'text-red-900' : 'text-green-900'}`}>
                                  {c.resolution_note}
                                </p>
                                {c.resolution_photo && (
                                  <div className="mt-3">
                                    <p className="text-[10px] uppercase font-bold mb-1 opacity-70">Attached Photo</p>
                                    <a href={c.resolution_photo} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                                      <img src={c.resolution_photo} alt="Resolution Attachment" className="h-24 w-auto rounded-lg border shadow-sm" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    <MessageSquare size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="font-bold">No tickets match your criteria</p>
                    <p className="text-xs mt-1">Try adjusting your filters or tabs</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-white flex items-center justify-between border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-500">
              Showing <span className="text-gray-900">{(page - 1) * limit + 1}</span> to <span className="text-gray-900">{Math.min(page * limit, totalCount)}</span> of <span className="text-gray-900">{totalCount}</span> tickets
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Professional Ticket Action Modal */}
      <Modal
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        title="Manage Ticket"
        size="lg"
      >
        {selectedContact && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Ticket Information</p>
                <p className="font-mono text-xs text-primary font-bold mb-2 bg-primary/10 inline-block px-2 py-0.5 rounded-md">{selectedContact.ticket_number || 'LEGACY-TKT'}</p>
                <p className="text-xl font-black text-gray-900">{selectedContact.name}</p>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-sm text-gray-600 font-medium flex items-center gap-1.5"><Mail size={14} className="text-gray-400" /> {selectedContact.email}</p>
                  {selectedContact.phone && <p className="text-sm text-gray-600 font-medium flex items-center gap-1.5"><Phone size={14} className="text-gray-400" /> {selectedContact.phone}</p>}
                </div>
              </div>
              <Badge variant={selectedContact.status === 'closed' ? 'success' : selectedContact.status === 'rejected' ? 'danger' : 'warning'} className="shadow-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                {selectedContact.status === 'closed' ? 'Solved' : selectedContact.status === 'rejected' ? 'Rejected' : 'Open Ticket'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Subject</p>
                <p className="font-bold text-gray-900 text-sm">{selectedContact.subject}</p>
              </div>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Received On</p>
                <p className="font-bold text-gray-900 text-sm">{selectedContact.created_at ? formatDate(selectedContact.created_at) : 'Unknown Date'}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Message Content</p>
              <div className="p-5 bg-white border border-gray-100 rounded-2xl text-gray-800 leading-relaxed whitespace-pre-wrap shadow-inner font-medium text-sm">
                {selectedContact.message}
              </div>
            </div>

            {/* Display existing resolution note if resolved/rejected */}
            {(selectedContact.status === 'closed' || selectedContact.status === 'rejected' || selectedContact.is_resolved) && (
              <div className={`p-5 border rounded-2xl ${selectedContact.status === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <p className={`text-[10px] uppercase font-black tracking-widest mb-2 ${selectedContact.status === 'rejected' ? 'text-red-500' : 'text-green-500'}`}>
                  Admin Action Taken
                </p>
                <div className={`text-sm whitespace-pre-wrap font-medium leading-relaxed ${selectedContact.status === 'rejected' ? 'text-red-900' : 'text-green-900'}`}>
                  {selectedContact.resolution_note || <span className="italic">No note provided</span>}
                </div>
                {selectedContact.resolution_photo && (
                  <div className="mt-4 pt-4 border-t border-black/5">
                    <p className={`text-[10px] uppercase font-bold mb-2 ${selectedContact.status === 'rejected' ? 'text-red-600/70' : 'text-green-600/70'}`}>Attached Photo</p>
                    <a href={selectedContact.resolution_photo} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                      <img src={selectedContact.resolution_photo} alt="Resolution Attachment" className="h-32 w-auto rounded-xl border shadow-sm" />
                    </a>
                  </div>
                )}
                
                <div className="mt-6 pt-5 border-t border-black/10 flex justify-end">
                  <button 
                    onClick={() => handleReopen(selectedContact.id)}
                    disabled={submitting}
                    className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-all hover:bg-gray-50 disabled:opacity-50"
                  >
                    {submitting ? <Spinner size="sm" /> : <RefreshCw size={16} />} Reopen Ticket
                  </button>
                </div>
              </div>
            )}

            {/* Action Inputs for Open Tickets */}
            {!(selectedContact.status === 'closed' || selectedContact.status === 'rejected' || selectedContact.is_resolved) && (
              <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100">
                <p className="text-xs text-gray-700 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle size={16} className="text-primary" /> Action Center
                </p>
                
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-600 block mb-2">Action Note (Emailed to user)</label>
                  <textarea
                    className="w-full p-4 border border-gray-200 bg-white rounded-2xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none shadow-sm resize-none"
                    rows={4}
                    placeholder="Type the resolution or rejection details here..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                  ></textarea>
                </div>

                {/* Photo Attachment */}
                <div className="mb-5">
                  <p className="text-xs font-bold text-gray-600 block mb-2">Attach Photo (Optional)</p>
                  <div className="flex items-center gap-4">
                    {attachmentPreview ? (
                      <div className="relative h-20 w-20 rounded-xl overflow-hidden border shadow-sm group">
                        <img src={attachmentPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => { setAttachmentFile(null); setAttachmentPreview(null); }}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <XCircle size={20} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <label className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center cursor-pointer transition-colors text-gray-400 group">
                        <UploadCloud size={20} className="group-hover:text-primary transition-colors" />
                        <span className="text-[10px] font-bold mt-1 uppercase">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    )}
                    <div className="flex-1 text-xs text-gray-500 font-medium">
                      You can optionally attach a screenshot or proof of resolution to the email.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleAction(selectedContact.id, 'resolve')}
                    disabled={submitting}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
                  >
                    {submitting ? <Spinner size="sm" /> : <CheckCircle size={18} />} Mark as Solved
                  </button>
                  <button 
                    onClick={() => handleAction(selectedContact.id, 'reject')}
                    disabled={submitting}
                    className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
                  >
                    {submitting ? <Spinner size="sm" /> : <XCircle size={18} />} Reject Ticket
                  </button>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button 
                variant="outline" 
                className="rounded-xl px-6 font-bold"
                onClick={() => { setSelectedContact(null); resetActionForm(); }}
              >
                Close Window
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
