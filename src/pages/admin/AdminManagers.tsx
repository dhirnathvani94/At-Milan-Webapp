import { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, Edit2, Trash2, Key, ToggleLeft, ToggleRight, Info, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PAGES = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/verification', label: 'Verifications' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/communities', label: 'Community Management' },
  { path: '/admin/notifications', label: 'Push Notifications' },
  { path: '/admin/plans', label: 'Plans & Credits' },
  { path: '/admin/coupons', label: 'Offers & Coupons' },
  { path: '/admin/payment-gateways', label: 'Payment Gateways' },
  { path: '/admin/financials', label: 'Financials' },
  { path: '/admin/analytics', label: 'Analytics & Reports' },
  { path: '/admin/reports', label: 'User Profile Reports' },
  { path: '/admin/emails', label: 'Email Templates' },
  { path: '/admin/unblock', label: 'Unblock Requests' },
  { path: '/admin/success-stories', label: 'Success Stories' },
  { path: '/admin/match-confirmations', label: 'Match Confirmations' },
  { path: '/admin/contacts', label: 'Contact Messages' },
  { path: '/admin/content', label: 'Content Management' },
  { path: '/admin/seo-marketing', label: 'SEO & Marketing' },
  { path: '/admin/legal-pages', label: 'Legal & FAQ' },
  { path: '/admin/settings', label: 'General Settings' },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  master_admin: ['*'],
  admin: ['/admin', '/admin/verification', '/admin/users', '/admin/communities', '/admin/notifications', '/admin/plans', '/admin/coupons', '/admin/payment-gateways', '/admin/financials', '/admin/analytics', '/admin/reports', '/admin/emails', '/admin/unblock', '/admin/success-stories', '/admin/match-confirmations', '/admin/contacts', '/admin/content', '/admin/seo-marketing', '/admin/legal-pages', '/admin/settings'],
  administration: ['/admin', '/admin/verification', '/admin/users', '/admin/reports', '/admin/unblock', '/admin/success-stories', '/admin/match-confirmations', '/admin/contacts', '/admin/communities'],
  finance: ['/admin', '/admin/financials', '/admin/analytics', '/admin/plans', '/admin/payment-gateways', '/admin/coupons'],
};

const ROLE_LABELS: Record<string, string> = {
  master_admin: '⭐ Master Admin',
  admin: '🛡️ Admin',
  administration: '🔧 Administration',
  finance: '💰 Finance',
};

const ROLE_BADGE: Record<string, string> = {
  master_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  admin: 'bg-red-100 text-red-700 border-red-200',
  administration: 'bg-blue-100 text-blue-700 border-blue-200',
  finance: 'bg-green-100 text-green-700 border-green-200',
};

interface Manager {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
}

function getToken() { return localStorage.getItem('atmilan-token') || ''; }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }; }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminManagers() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<Manager | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' });

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    permissions: ['*'],
  });

  // ── Fetch managers ─────────────────────────────────────────────────────────

  const fetchManagers = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Cache-busting timestamp prevents stale data from browser cache
      const res = await fetch(apiUrl(`/api/admin/managers?_t=${Date.now()}`), {
        headers: { ...authHeaders(), 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setManagers(data.managers || []);
    } catch (err: any) {
      if (!silent && err.message !== 'Failed to fetch') {
        toast.error(err.message || 'Failed to load admin managers');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Refresh on mount AND whenever the tab becomes visible (catches stale data)
  useEffect(() => {
    fetchManagers();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchManagers(true); };
    document.addEventListener('visibilitychange', onVisible);
    // Also refresh when window regains focus
    const onFocus = () => fetchManagers(true);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchManagers]);

  // ── Form field change handler ──────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'role') {
      if (value === 'master_admin') {
        // Master admin always gets full access
        setForm(prev => ({ ...prev, role: value, permissions: ['*'] }));
      } else {
        // For all other roles — keep existing permissions, do NOT auto-assign
        // Master admin must manually select what this sub-admin can access
        setForm(prev => ({ ...prev, role: value }));
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const togglePerm = (path: string) => {
    setForm(prev => {
      const perms = prev.permissions;
      if (perms.includes('*')) {
        return { ...prev, permissions: ALL_PAGES.map(p => p.path).filter(p => p !== path) };
      }
      if (perms.includes(path)) {
        return { ...prev, permissions: perms.filter(p => p !== path) };
      }
      return { ...prev, permissions: [...perms, path] };
    });
  };

  // ── Open/Close Add/Edit Modal ──────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    // Start with NO permissions — master admin must explicitly select what to give
    setForm({ name: '', email: '', password: '', role: 'admin', permissions: [] });
    setSaving(false);
    setModalOpen(true);
  };

  const openEdit = (m: Manager) => {
    setEditing(m);
    setForm({ name: m.name, email: m.email, password: '', role: m.role, permissions: [...m.permissions] });
    setSaving(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSaving(false);
  };

  // ── Save Admin ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email are required.');
    if (!editing && form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setSaving(true);
    try {
      const body: any = { name: form.name.trim(), email: form.email.trim(), role: form.role, permissions: form.permissions };
      if (!editing || form.password) body.password = form.password;
      const url = editing ? apiUrl(`/api/admin/managers/${editing.id}`) : apiUrl('/api/admin/managers');
      const method = editing ? 'PUT' : 'POST';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body), signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      toast.success(editing ? 'Admin updated!' : 'Admin created!');
      closeModal();
      fetchManagers(true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('Request timed out. Check server is running.');
      } else {
        toast.error(err.message || 'Failed to save admin. Check browser console.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Change Password ────────────────────────────────────────────────────────

  const openPwModal = (m: Manager) => {
    setPwTarget(m);
    setPwForm({ newPw: '', confirmPw: '' });
    setPwSaving(false);
    setPwModalOpen(true);
  };

  const closePwModal = () => {
    setPwModalOpen(false);
    setPwTarget(null);
    setPwSaving(false);
  };

  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPwForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePwSave = async () => {
    if (pwForm.newPw.length < 8) return toast.error('Password must be at least 8 characters.');
    if (pwForm.newPw !== pwForm.confirmPw) return toast.error('Passwords do not match.');
    setPwSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/managers/${pwTarget!.id}/change-password`), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ newPassword: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Password changed!');
      closePwModal();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Toggle / Delete ────────────────────────────────────────────────────────

  const handleToggle = async (m: Manager) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/managers/${m.id}`), { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ is_active: !m.is_active }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Admin ${!m.is_active ? 'activated' : 'deactivated'}`);
      // Update local state immediately for instant UI feedback
      setManagers(prev => prev.map(mgr => mgr.id === m.id ? { ...mgr, is_active: !m.is_active } : mgr));
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (m: Manager) => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/managers/${m.id}`), { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok && res.status !== 404) throw new Error(data.error || 'Failed');
      toast.success('Admin removed');
      // Remove from local state immediately so table updates instantly
      setManagers(prev => prev.filter(mgr => mgr.id !== m.id));
    } catch (err: any) { toast.error(err.message); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <UserCog size={28} className="text-primary" /> Admin Manager
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Add and manage admin accounts. Assign roles and control which sections each admin can access.</p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2 shrink-0">
          <Plus size={16} /> Add Admin
        </Button>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800"><strong>Only Master Admin can access this page.</strong> Sub-admins can only see sections assigned to them.</p>
      </div>

      {/* Role descriptions */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Shield size={16} className="text-primary" /> Role Descriptions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { role: 'master_admin', desc: 'Full access to everything including Admin Manager' },
            { role: 'admin', desc: 'Full access to all pages except Admin Manager' },
            { role: 'administration', desc: 'User management, verifications, reports, communities' },
            { role: 'finance', desc: 'Financials, plans, payment gateways, analytics' },
          ].map(({ role, desc }) => (
            <div key={role} className="flex items-start gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 mt-0.5 ${ROLE_BADGE[role]}`}>{ROLE_LABELS[role]}</span>
              <span className="text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {managers.length === 0 ? (
          <div className="text-center py-16 px-6">
            <UserCog size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No admin managers yet</h3>
            <p className="text-gray-500 text-sm mb-6">Click Add Admin to create the first sub-admin.</p>
            <Button onClick={openAdd} className="flex items-center gap-2 mx-auto"><Plus size={16} /> Add Admin</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Email</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Role</th>
                <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Last Login</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {managers.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-900">{m.name}</td>
                    <td className="px-4 py-4 text-gray-600 text-xs">{m.email}</td>
                    <td className="px-4 py-4 text-center"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_BADGE[m.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>{ROLE_LABELS[m.role] || m.role}</span></td>
                    <td className="px-4 py-4 text-center">
                      {m.is_active
                        ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active</span>
                        : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive</span>}
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-xs">{m.last_login ? new Date(m.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit"><Edit2 size={15} /></button>
                        <button onClick={() => openPwModal(m)} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title="Change Password"><Key size={15} /></button>
                        <button onClick={() => handleToggle(m)} className={`p-1.5 rounded-lg ${m.is_active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`} title={m.is_active ? 'Deactivate' : 'Activate'}>{m.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}</button>
                        {m.role !== 'master_admin' && <button onClick={() => handleDelete(m)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── ADD/EDIT MODAL ─────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? `Edit: ${editing.name}` : 'Add New Admin'}</h3>
              <span onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"><X size={20} /></span>
            </div>
            <div className="space-y-4 p-5 max-h-[75vh] overflow-y-auto">

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input name="name" type="text" value={form.name} onChange={handleChange} placeholder="Full name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="admin@example.com" disabled={!!editing}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm disabled:bg-gray-50 disabled:text-gray-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editing ? <span className="text-gray-400 font-normal">(leave blank to keep)</span> : <span className="text-red-500">*</span>}
                </label>
                <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 8 characters"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                <select name="role" value={form.role} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm bg-white">
                  <option value="master_admin">⭐ Master Admin</option>
                  <option value="admin">🛡️ Admin</option>
                  <option value="administration">🔧 Administration</option>
                  <option value="finance">💰 Finance</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Page Permissions</label>
                  {form.role !== 'master_admin' && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, permissions: DEFAULT_PERMISSIONS[prev.role] || ['/admin'] }))}
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Load suggested defaults for {ROLE_LABELS[form.role] || form.role}
                    </button>
                  )}
                </div>
                {form.role === 'master_admin' ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <span className="text-green-600 text-sm font-medium">✅ Full access to all pages (Master Admin)</span>
                  </div>
                ) : (
                  <>
                    {form.permissions.length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                        ⚠️ No pages selected — this admin will only see the Dashboard. Select pages below to grant access.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-64 overflow-y-auto">
                      {ALL_PAGES.map(page => (
                        <label key={page.path} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg px-2 py-1 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes('*') || form.permissions.includes(page.path)}
                            onChange={() => togglePerm(page.path)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span className="text-sm text-gray-700">{page.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Spinner size="sm" /> : editing ? 'Update Admin' : 'Create Admin'}
                </Button>
                <Button variant="outline" onClick={closeModal} className="flex-1">Cancel</Button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ──────────────────────────────────────────── */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={closePwModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Change Password — {pwTarget?.name || ''}</h3>
              <span onClick={closePwModal} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"><X size={20} /></span>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                <input name="newPw" type="password" value={pwForm.newPw} onChange={handlePwChange} placeholder="Min 8 characters"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                <input name="confirmPw" type="password" value={pwForm.confirmPw} onChange={handlePwChange} placeholder="Repeat new password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handlePwSave} disabled={pwSaving} className="flex-1">
                  {pwSaving ? <Spinner size="sm" /> : 'Change Password'}
                </Button>
                <Button variant="outline" onClick={closePwModal} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
