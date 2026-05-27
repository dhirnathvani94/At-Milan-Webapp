import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Flag, AlertTriangle, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight, ShieldOff, MessageCircle, Download, FileText, Calendar, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { formatDate } from '../../lib/utils';
import { updateReportStatus, adminBlockUser } from '../../lib/actions/adminActions';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';
import { useMasterData } from '../../store/masterDataStore';
import { apiUrl } from '../../lib/api';

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());
const startOf = (d: Date) => { const r = new Date(d); r.setDate(1); return fmt(r); };
const DATE_PRESETS = [
  { label: 'Today',       from: () => today(),                              to: () => today() },
  { label: 'This Week',   from: () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return fmt(d); }, to: () => today() },
  { label: 'This Month',  from: () => startOf(new Date()),                  to: () => today() },
  { label: 'Last Month',  from: () => { const d=new Date(); d.setMonth(d.getMonth()-1); return startOf(d); },
                          to: () => { const d=new Date(); d.setDate(0); return fmt(d); } },
  { label: 'This Year',   from: () => `${new Date().getFullYear()}-01-01`,  to: () => today() },
  { label: 'All Time',    from: () => '',                                   to: () => '' },
];

export default function AdminReports() {
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const [reports, setReports] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const limit = 20;

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);

      const res = await fetch(apiUrl(`/api/admin/reports?${params.toString()}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data.reports || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle Updates
  const handleUpdateStatus = async (reportId: string, status: string) => {
    try {
      await updateReportStatus(reportId, status);
      toast.success(`Report status updated to ${status}`);
      fetchReports();
      setSelectedReport(null);
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const handleBlockUser = async (userId: string, reportId: string, duration: 'temp' | 'permanent') => {
    const reason = window.prompt(`Enter reason for ${duration === 'temp' ? 'temporarily' : 'permanently'} blocking user:`);
    if (reason === null) return;
    if (!reason) return toast.error('Reason is required to block user');
    try {
      await adminBlockUser(userId, duration, reason);
      await updateReportStatus(reportId, 'resolved');
      toast.success(`User ${duration === 'temp' ? 'temporarily' : 'permanently'} blocked and report resolved`);
      fetchReports();
      setSelectedReport(null);
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleReview = async (report: any) => {
    if (report.type === 'user_report') {
      try {
        const res = await fetch(apiUrl(`/api/admin/user-report/${report.id}`), {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        });
        if (res.ok) {
          const fullReport = await res.json();
          setSelectedReport(fullReport);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch full report details');
      }
    }
    setSelectedReport(report);
  };

  const handleDownloadExcel = () => {
    if (!reports || reports.length === 0) return toast.error('No reports available to download');
    const wb = XLSX.utils.book_new();
    const exportData = reports.map(r => ({
      'Report ID': r.id,
      'Date': formatDate(r.created_at),
      'Reporter Name': r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : '-',
      'Reporter Email': r.reporter?.email || '-',
      'Reported User Name': r.reported ? `${r.reported.first_name} ${r.reported.last_name}` : '-',
      'Reported User Email': r.reported?.email || '-',
      'Type': r.type,
      'Reason': r.reason,
      'Status': r.status
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), 'Reports');
    XLSX.writeFile(wb, `admin_reports_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success('Excel downloaded successfully!');
  };

  const handleDownloadPDF = () => {
    if (!reports || reports.length === 0) return toast.error('No reports available to download');
    
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>System Reports - ${brandName}</title>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; margin: 0 auto; }
  .header { border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { color: #8B1A1A; margin: 0 0 10px 0; }
  .header p { color: #666; margin: 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background-color: #f9fafb; color: #444; font-weight: bold; text-transform: uppercase; font-size: 11px; }
  .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
  .status-pending { background: #fef3c7; color: #92400e; }
  .status-resolved { background: #d1fae5; color: #065f46; }
  .status-reviewed { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 20px; }
</style>
</head>
<body>
  <div class="header">
    <h1>System Reports & Flags</h1>
    <p>Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p>Total Reports: ${totalCount} | Status Filter: ${statusFilter.toUpperCase()}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Reporter</th>
        <th>Reported User</th>
        <th>Type</th>
        <th>Reason</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${reports.map(r => `
        <tr>
          <td>${formatDate(r.created_at)}</td>
          <td>${r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : '-'}</td>
          <td>${r.reported ? `${r.reported.first_name} ${r.reported.last_name}` : '-'}</td>
          <td>${r.type}</td>
          <td>${r.reason}</td>
          <td><span class="status-badge status-${r.status}">${r.status}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  
  <div class="footer">${brandName} Admin Portal &middot; Professional Reports Export</div>
</body></html>`;
    
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);
  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Flag size={28} className="text-primary" /> User Profile Reports
          </h1>
          <p className="text-gray-500 text-sm">Review, track, and resolve user complaints professionally</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownloadExcel} className="flex items-center gap-2 border-green-500 text-green-700 hover:bg-green-50">
            <FileText size={16} /> Excel Export
          </Button>
          <Button variant="primary" onClick={handleDownloadPDF} className="flex items-center gap-2 bg-[#8B1A1A] hover:bg-[#721515]">
            <Download size={16} /> PDF Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-none shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div><p className="text-xs text-gray-400 font-bold uppercase">Total Reports</p><h3 className="text-2xl font-bold">{totalCount}</h3></div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center"><Flag size={20} /></div>
        </Card>
        <Card className="p-4 border-none shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div><p className="text-xs text-gray-400 font-bold uppercase">Pending Actions</p><h3 className="text-2xl font-bold">{pendingCount}</h3></div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center"><AlertTriangle size={20} /></div>
        </Card>
        <Card className="p-4 border-none shadow-sm flex items-center justify-between border-l-4 border-l-green-500">
          <div><p className="text-xs text-gray-400 font-bold uppercase">Resolved</p><h3 className="text-2xl font-bold">{reports.filter(r => r.status === 'resolved').length}</h3></div>
          <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center"><CheckCircle size={20} /></div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 border-none shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1"><Calendar size={12} /> Presets:</span>
            {DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => { setFromDate(p.from()); setToDate(p.to()); }} className="px-3 py-1 text-xs rounded-full border border-gray-200 hover:bg-primary/10 hover:text-primary transition-colors">{p.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-2"><Filter size={14} className="text-gray-400" /> <span className="text-xs text-gray-500">Status</span>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[{ value: 'all', label: 'All Status' }, { value: 'pending', label: 'Pending' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'resolved', label: 'Resolved' }]} className="text-sm py-1.5 min-w-[120px]" />
            </div>
            <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Type</span>
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[{ value: 'all', label: 'All Types' }, { value: 'user_report', label: 'User Report' }, { value: 'spam', label: 'Spam' }, { value: 'abuse', label: 'Abuse' }]} className="text-sm py-1.5 min-w-[120px]" />
            </div>
            <div className="flex items-center gap-2"><span className="text-xs text-gray-500">From</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-2"><span className="text-xs text-gray-500">To</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setFromDate(''); setToDate(''); }} className="text-xs">Reset Filters</Button>
          </div>
        </div>
      </Card>

      {/* Reports Table */}
      <Card className="overflow-hidden border-none shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-bold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4">Reported User</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="p-0"><AdminTableSkeleton /></td></tr>
              ) : reports.length > 0 ? (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      {r.reporter ? (
                        <div className="text-sm">
                          <Link to={`/admin/users/${r.reporter.id}`} className="font-bold text-gray-900 hover:text-primary block">{r.reporter.first_name} {r.reporter.last_name}</Link>
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{r.reporter.profile_id}</p>
                        </div>
                      ) : <span className="text-gray-400 text-sm">Unknown User</span>}
                    </td>
                    <td className="px-6 py-4">
                      {r.reported ? (
                        <div className="text-sm">
                          <Link to={`/admin/users/${r.reported.id}`} className="font-bold text-gray-900 hover:text-primary block">{r.reported.first_name} {r.reported.last_name}</Link>
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">{r.reported.profile_id}</p>
                        </div>
                      ) : <span className="text-gray-400 text-sm">Unknown User</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={r.type === 'user_report' ? 'danger' : 'warning'} className="capitalize">{r.type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4"><p className="text-sm text-gray-600 truncate max-w-[200px]" title={r.reason}>{r.reason}</p></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(r.created_at)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={r.status === 'pending' ? 'warning' : r.status === 'resolved' ? 'success' : 'primary'}>{r.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleReview(r)} className="rounded-full flex items-center gap-1.5"><Eye size={14} /> Review</Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400 flex flex-col items-center"><CheckCircle size={40} className="mb-3 text-gray-300" /><p>No reports found matching your criteria</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
            <p className="text-sm text-gray-500">Showing <span className="font-bold text-gray-900">{(page - 1) * limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(page * limit, totalCount)}</span> of <span className="font-bold text-gray-900">{totalCount}</span></p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Report Modal */}
      {!!selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedReport(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 rounded-t-2xl z-10">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Flag size={18} className="text-primary" /> Report Details</h3>
              <button onClick={() => setSelectedReport(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"><XCircle size={18} className="text-gray-500" /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-600 uppercase font-bold mb-1">Reporter</p>
                  {selectedReport.reporter ? (
                    <>
                      <Link to={`/admin/users/${selectedReport.reporter.id}`} className="font-bold text-gray-900 hover:text-primary block text-sm">{selectedReport.reporter.first_name} {selectedReport.reporter.last_name}</Link>
                      <p className="text-xs text-primary font-mono mt-0.5">{selectedReport.reporter.profile_id}</p>
                    </>
                  ) : <span className="text-sm text-gray-500">Unknown</span>}
                </div>
                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600 uppercase font-bold mb-1">Reported User</p>
                  {selectedReport.reported ? (
                    <>
                      <Link to={`/admin/users/${selectedReport.reported.id}`} className="font-bold text-gray-900 hover:text-primary block text-sm">{selectedReport.reported.first_name} {selectedReport.reported.last_name}</Link>
                      <p className="text-xs text-primary font-mono mt-0.5">{selectedReport.reported.profile_id}</p>
                    </>
                  ) : <span className="text-sm text-gray-500">Unknown</span>}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase font-bold mb-2">Report Context & Reason</p>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-700">
                  <span className="font-bold text-gray-900">{selectedReport.reason}</span>
                  {selectedReport.note && (
                    <p className="mt-2 text-sm italic border-t border-gray-200 pt-2 text-gray-600">
                      User Remark: "{selectedReport.note}"
                    </p>
                  )}
                </div>
              </div>

              {selectedReport.message_history?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2 flex items-center gap-2">
                    <MessageCircle size={14} /> Message History Context
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[250px] overflow-y-auto space-y-3">
                    {selectedReport.message_history.map((msg: any) => {
                      const isReporter = selectedReport.reporter && msg.sender_id === selectedReport.reporter.id;
                      return (
                        <div key={msg.id} className={`flex ${isReporter ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                            isReporter ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                          }`}>
                            <p className="text-[9px] opacity-70 mb-0.5 font-bold uppercase">{isReporter ? 'Reporter' : 'Reported User'}</p>
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')} className="flex items-center justify-center gap-2 text-gray-600">
                  <XCircle size={16} /> Close (False Report)
                </Button>
                <Button variant="outline" onClick={() => handleUpdateStatus(selectedReport.id, 'reviewed')} className="flex items-center justify-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                  <CheckCircle size={16} /> Mark as Reviewed
                </Button>
                <Button variant="outline" className="flex items-center justify-center gap-2 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleBlockUser(selectedReport.reported?.id, selectedReport.id, 'temp')} disabled={!selectedReport.reported?.id}>
                  <AlertTriangle size={16} /> Temp Block (24h)
                </Button>
                <Button variant="danger" className="flex items-center justify-center gap-2" onClick={() => handleBlockUser(selectedReport.reported?.id, selectedReport.id, 'permanent')} disabled={!selectedReport.reported?.id}>
                  <ShieldOff size={16} /> Permanent Block
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
