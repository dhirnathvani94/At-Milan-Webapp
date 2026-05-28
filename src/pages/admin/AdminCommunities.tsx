import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Globe, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { apiUrl } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Community {
  id: string;
  name: string;
  sub_castes: string[];
  gotras: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Tag Input Component ──────────────────────────────────────────────────────

const TagInput = React.memo(function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (val: string) => {
    const trimmed = val.trim().replace(/,+$/, '').trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (idx: number) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="min-h-[44px] w-full border border-gray-300 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all bg-white">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="hover:text-red-500 transition-colors ml-0.5"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.trim()) addTag(input); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-800 placeholder-gray-400"
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add. Backspace to remove last.</p>
    </div>
  );
});

// ─── Community Form Modal ─────────────────────────────────────────────────────
// Extracted into its own component so typing in the name field does NOT
// re-render the communities table in the parent component.

interface CommunityModalProps {
  isOpen: boolean;
  editingCommunity: Community | null;
  defaultDisplayOrder: number;
  onClose: () => void;
  onSaved: () => void;
}

const CommunityModal = React.memo(function CommunityModal({
  isOpen,
  editingCommunity,
  defaultDisplayOrder,
  onClose,
  onSaved,
}: CommunityModalProps) {
  const [formName, setFormName] = useState('');
  const [formSubCastes, setFormSubCastes] = useState<string[]>([]);
  const [formGotras, setFormGotras] = useState<string[]>([]);
  const [formDisplayOrder, setFormDisplayOrder] = useState(1);
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset form whenever modal opens or editingCommunity changes
  useEffect(() => {
    if (isOpen) {
      if (editingCommunity) {
        setFormName(editingCommunity.name);
        setFormSubCastes([...editingCommunity.sub_castes]);
        setFormGotras([...editingCommunity.gotras]);
        setFormDisplayOrder(editingCommunity.display_order);
        setFormIsActive(editingCommunity.is_active);
      } else {
        setFormName('');
        setFormSubCastes([]);
        setFormGotras([]);
        setFormDisplayOrder(defaultDisplayOrder);
        setFormIsActive(true);
      }
    }
  }, [isOpen, editingCommunity, defaultDisplayOrder]);

  const handleSave = async () => {
    if (!formName.trim() || formName.trim().length < 2) {
      toast.error('Community name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        sub_castes: formSubCastes,
        gotras: formGotras,
        display_order: formDisplayOrder,
        is_active: formIsActive,
      };
      const token = localStorage.getItem('atmilan-token');
      const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

      let res: Response;
      if (editingCommunity) {
        res = await fetch(apiUrl(`/api/communities/${editingCommunity.id}`), {
          method: 'PUT', headers: authHeaders, body: JSON.stringify(body),
        });
      } else {
        res = await fetch(apiUrl('/api/communities'), {
          method: 'POST', headers: authHeaders, body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save community');

      toast.success(editingCommunity ? 'Community updated successfully!' : 'Community created successfully!');
      onClose();
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save community');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCommunity ? `Edit: ${editingCommunity.name}` : 'Add New Community'}
    >
      <div className="space-y-5 p-4 max-h-[80vh] overflow-y-auto">

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Community Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Lohana, Patel, Brahmin"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
          />
        </div>

        {/* Sub-castes */}
        <TagInput
          label="Sub-castes"
          tags={formSubCastes}
          onChange={setFormSubCastes}
          placeholder="Type a sub-caste and press Enter..."
        />

        {/* Gotras */}
        <TagInput
          label="Gotras"
          tags={formGotras}
          onChange={setFormGotras}
          placeholder="Type a gotra and press Enter..."
        />

        {/* Display Order */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Display Order
          </label>
          <input
            type="number"
            min={1}
            value={formDisplayOrder}
            onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
            className="w-32 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Lower number = shown first in dropdown</p>
        </div>

        {/* Is Active */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-700">Active</p>
            <p className="text-xs text-gray-500">Inactive communities are hidden from registration</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? <Spinner size="sm" /> : editingCommunity ? 'Update Community' : 'Create Community'}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl('/api/communities'), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setCommunities(data.communities || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAddModal = useCallback(() => {
    setEditingCommunity(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((c: Community) => {
    setEditingCommunity(c);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingCommunity(null);
  }, []);

  // ── Toggle active ──────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (c: Community) => {
    try {
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl(`/api/communities/${c.id}/toggle`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle community');
      toast.success(`Community ${data.community.is_active ? 'activated' : 'deactivated'}`);
      fetchCommunities();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle community');
    }
  }, [fetchCommunities]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (c: Community) => {
    if (!window.confirm(`Delete community "${c.name}"? This cannot be undone.`)) return;
    try {
      const token = localStorage.getItem('atmilan-token');
      const res = await fetch(apiUrl(`/api/communities/${c.id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete community');
      toast.success('Community deleted');
      fetchCommunities();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete community');
    }
  }, [fetchCommunities]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} className="text-primary" /> Community Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage communities shown to users during registration. Users can only select from active communities.
          </p>
        </div>
        <Button onClick={openAddModal} className="flex items-center gap-2 shrink-0">
          <Plus size={16} /> Add Community
        </Button>
      </div>

      {/* ── Info Box ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Communities added here appear in the registration form dropdown.
          If you add only one community, the app works as a single-community matrimonial.
          If you add multiple, users can choose their community during registration.
        </p>
      </div>

      {/* ── Communities Table ── */}
      <Card className="p-0 overflow-hidden">
        {communities.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Globe size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No communities added yet</h3>
            <p className="text-gray-500 text-sm mb-6">Click Add Community to get started.</p>
            <Button onClick={openAddModal} className="flex items-center gap-2 mx-auto">
              <Plus size={16} /> Add Community
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Community Name</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Sub-castes</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Gotras</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Status</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-gray-600">Order</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {communities.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {c.sub_castes.length}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 text-secondary text-xs font-bold">
                        {c.gotras.length}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {c.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-gray-600 font-medium">{c.display_order}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleToggle(c)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            c.is_active ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={c.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {c.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Add / Edit Modal — isolated component so typing doesn't re-render the table ── */}
      <CommunityModal
        isOpen={modalOpen}
        editingCommunity={editingCommunity}
        defaultDisplayOrder={communities.length + 1}
        onClose={closeModal}
        onSaved={fetchCommunities}
      />

    </div>
  );
}
