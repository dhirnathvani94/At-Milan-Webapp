import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, X, Edit2, Save, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, Image as ImageIcon,
  Heart, MapPin, Calendar, User, RefreshCw, Search, Plus, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAdminSuccessStories, updateStoryApproval,
  editSuccessStory, toggleStoryVisibility, deleteSuccessStory,
  adminAddSuccessStory
} from '../../lib/actions/adminActions';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import { formatDate } from '../../lib/utils';
import { AdminTableSkeleton } from '../../components/ui/Skeletons';
import { useSocketStore } from '../../store/socketStore';

const TABS = [
  { key: 'all', label: 'All Stories' },
  { key: 'pending', label: 'Pending Review' },
  { key: 'approved', label: 'Published' },
  { key: 'hidden', label: 'Hidden' },
];

export default function AdminSuccessStories() {
  const [stories, setStories] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState({ 
    user_name: '', 
    partner_name: '', 
    story_text: '', 
    location: '', 
    year: '',
    photo_file: null as File | null
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const intervalRef = useRef<any>(null);
  const limit = 20;
  const { socket } = useSocketStore();

  const fetchStories = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await getAdminSuccessStories(page);
      setStories(res.stories || []);
      setTotalCount(res.totalCount || 0);
    } catch {
      if (!silent) toast.error('Failed to load stories');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [page]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchStories(true), 60000);
    return () => clearInterval(intervalRef.current);
  }, [page]);

  useEffect(() => {
    if (!socket) return;
    const handleStoryUpdate = () => {
      fetchStories(true);
    };
    socket.on('success-story:updated', handleStoryUpdate);
    return () => {
      socket.off('success-story:updated', handleStoryUpdate);
    };
  }, [socket]);

  const filtered = stories.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (s.submitter_name || '').toLowerCase().includes(q) ||
      (s.user?.first_name || '').toLowerCase().includes(q) ||
      (s.user?.last_name || '').toLowerCase().includes(q) ||
      (s.partner_name || '').toLowerCase().includes(q) ||
      (s.story_text || '').toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (tab === 'pending') return !s.is_approved && !s.is_hidden;
    if (tab === 'approved') return s.is_approved && !s.is_hidden;
    if (tab === 'hidden') return !!s.is_hidden;
    return true;
  });

  const totalPages = Math.ceil(totalCount / limit);

  const openStory = (s: any) => {
    setSelectedStory(s);
    setIsEditing(false);
    setIsAdding(false);
    setPhotoPreview(s.photo_url || null);
    setEditForm({
      user_name: s.submitter_name || s.user?.first_name || '',
      partner_name: s.partner_name || '',
      story_text: s.story_text || '',
      location: s.location || '',
      year: s.year || '',
      photo_file: null
    });
  };

  const handleAddNew = () => {
    setSelectedStory(null);
    setIsEditing(true);
    setIsAdding(true);
    setPhotoPreview(null);
    setEditForm({
      user_name: '',
      partner_name: '',
      story_text: '',
      location: '',
      year: new Date().getFullYear().toString(),
      photo_file: null
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditForm(prev => ({ ...prev, photo_file: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleApproval = async (id: string, approved: boolean) => {
    try {
      await updateStoryApproval(id, approved);
      toast.success(approved ? '✅ Story approved & published!' : '❌ Story rejected');
      await fetchStories(true);
      if (selectedStory?.id === id) {
        setSelectedStory((prev: any) => prev ? { ...prev, is_approved: approved } : null);
      }
    } catch { toast.error('Failed to update story'); }
  };

  const handleToggleVisibility = async (id: string, currently_hidden: boolean) => {
    try {
      await toggleStoryVisibility(id, !currently_hidden);
      toast.success(currently_hidden ? '👁 Story is now visible' : '🙈 Story hidden from public');
      await fetchStories(true);
      if (selectedStory?.id === id) {
        setSelectedStory((prev: any) => prev ? { ...prev, is_hidden: !currently_hidden } : null);
      }
    } catch { toast.error('Failed to toggle visibility'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSuccessStory(id);
      toast.success('Story permanently deleted');
      setDeleteConfirm(null);
      if (selectedStory?.id === id) {
        setSelectedStory(null);
        setIsEditing(false);
      }
      await fetchStories(true);
    } catch { toast.error('Failed to delete story'); }
  };

  const handleEditSubmit = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('user_name', editForm.user_name);
      formData.append('partner_name', editForm.partner_name);
      formData.append('story_text', editForm.story_text);
      formData.append('location', editForm.location);
      formData.append('year', editForm.year);
      if (isAdding) {
        formData.append('is_approved', 'true');
      }
      if (editForm.photo_file) {
        formData.append('photo', editForm.photo_file);
      }

      if (isAdding) {
        await adminAddSuccessStory(formData);
        toast.success('New success story added!');
      } else {
        await editSuccessStory(selectedStory.id, formData);
        toast.success('Story details saved!');
      }
      
      setIsEditing(false);
      setIsAdding(false);
      await fetchStories(true);
      if (!isAdding) {
        setSelectedStory((prev: any) => prev ? { ...prev, ...editForm, submitter_name: editForm.user_name } : null);
      }
    } catch { 
      toast.error(isAdding ? 'Failed to add story' : 'Failed to save changes'); 
    }
    finally { setSaving(false); }
  };

  const counts = {
    all: stories.length,
    pending: stories.filter(s => !s.is_approved && !s.is_hidden).length,
    approved: stories.filter(s => s.is_approved && !s.is_hidden).length,
    hidden: stories.filter(s => s.is_hidden).length,
  };

  const getDisplayName = (s: any) => {
    if (s.submitter_name) return s.submitter_name;
    if (s.user?.first_name) return `${s.user.first_name} ${s.user.last_name || ''}`;
    return 'User';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="text-primary" size={24} /> Success Stories
          </h1>
          <p className="text-gray-500 text-sm mt-1">Review, moderate, add, and publish couple stories</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStories()}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary bg-white border border-gray-200 hover:border-primary/40 px-4 py-2 rounded-xl transition-all"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark shadow-md hover:shadow-lg px-4 py-2 rounded-xl transition-all"
          >
            <Plus size={15} /> Add New Story
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.key
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-primary/40 hover:text-primary'
            }`}
          >
            {t.label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {counts[t.key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by user name, partner name, or story..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white shadow-sm"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <AdminTableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
          <Heart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-gray-500">No stories found</p>
          <p className="text-sm mt-1">Try a different tab or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(s => (
            <div
              key={s.id}
              className={`bg-white rounded-3xl border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col ${
                s.is_hidden ? 'opacity-60 border-gray-200' : s.is_approved ? 'border-green-100' : 'border-amber-100'
              }`}
            >
              {/* Photo */}
              <div
                className="relative h-52 bg-gradient-to-br from-pink-50 to-red-50 cursor-pointer overflow-hidden"
                onClick={() => openStory(s)}
              >
                {s.photo_url ? (
                  <img
                    src={s.photo_url}
                    alt="Couple"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <ImageIcon size={40} className="opacity-50" />
                    <span className="text-xs font-semibold uppercase tracking-wider">No Photo</span>
                  </div>
                )}
                {/* Status badge over photo */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {s.is_hidden ? (
                    <span className="px-2.5 py-1 bg-gray-900/80 text-white text-[10px] uppercase font-bold rounded-full backdrop-blur-sm flex items-center gap-1 shadow-lg border border-white/10"><EyeOff size={10} /> Hidden</span>
                  ) : s.is_approved ? (
                    <span className="px-2.5 py-1 bg-green-500/90 text-white text-[10px] uppercase font-bold rounded-full backdrop-blur-sm flex items-center gap-1 shadow-lg border border-white/10"><Check size={10} /> Published</span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-500/90 text-white text-[10px] uppercase font-bold rounded-full backdrop-blur-sm shadow-lg border border-white/10">⏳ Pending</span>
                  )}
                </div>
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-1">
                {/* Names */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 font-black text-gray-900 text-lg">
                    {s.user_id ? (
                      <Link
                        to={`/admin/users/${s.user_id}`}
                        className="hover:text-primary transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {getDisplayName(s)}
                      </Link>
                    ) : (
                      <span>{getDisplayName(s)}</span>
                    )}
                    <span className="text-pink-500 animate-pulse">♥</span>
                    <span>{s.partner_name || 'Partner'}</span>
                  </div>
                  {s.user_id && <p className="text-xs text-gray-400 mt-1 font-mono">{s.user?.profile_id || s.user_id}</p>}
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-500 mb-4 bg-gray-50 p-3 rounded-2xl">
                  {s.location && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-primary/70" />{s.location}</span>}
                  {s.year && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-primary/70" />{s.year}</span>}
                  {s.created_at && <span className="flex items-center gap-1.5"><User size={14} className="text-primary/70" />{formatDate(s.created_at)}</span>}
                </div>

                {/* Story preview */}
                <div className="flex-1">
                  <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed cursor-pointer hover:text-gray-900 transition-colors" onClick={() => openStory(s)}>
                    {s.story_text || <span className="italic text-gray-400">No story text provided.</span>}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-5 mt-auto flex-wrap border-t border-gray-100">
                  {/* Approve / Reject */}
                  {!s.is_approved ? (
                    <button
                      onClick={() => handleApproval(s.id, true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-500 text-green-700 hover:text-white text-xs font-bold rounded-xl transition-all"
                    >
                      <Check size={14} /> Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApproval(s.id, false)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-500 text-amber-700 hover:text-white text-xs font-bold rounded-xl transition-all"
                    >
                      <X size={14} /> Unapprove
                    </button>
                  )}

                  {/* Hide / Show */}
                  <button
                    onClick={() => handleToggleVisibility(s.id, !!s.is_hidden)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                      s.is_hidden
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-500 hover:text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s.is_hidden ? <><Eye size={14} /> Show</> : <><EyeOff size={14} /> Hide</>}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openStory(s)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-500 hover:text-white text-xs font-bold rounded-xl transition-all"
                  >
                    <Edit2 size={14} /> Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteConfirm(s.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white text-xs font-bold rounded-xl transition-all ml-auto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-6 py-4 shadow-sm">
          <p className="text-sm text-gray-500 font-medium">
            Showing <strong className="text-gray-900">{(page - 1) * limit + 1}</strong> to <strong className="text-gray-900">{Math.min(page * limit, totalCount)}</strong> of <strong className="text-gray-900">{totalCount}</strong>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-xl">
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Story?" size="sm">
        <div className="space-y-5">
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm leading-relaxed">
            This will permanently remove the story from the database. This action <strong>cannot be undone</strong>.
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              <Trash2 size={16} /> Delete Permanently
            </button>
          </div>
        </div>
      </Modal>

      {/* Story Detail / Add / Edit Modal */}
      <Modal
        isOpen={!!selectedStory || isAdding}
        onClose={() => { setSelectedStory(null); setIsEditing(false); setIsAdding(false); }}
        title={isAdding ? "Add New Success Story" : (isEditing ? "Edit Success Story" : "Story Details")}
        size="lg"
      >
        <div className="space-y-6">
          {/* Photo Section */}
          <div className="relative rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 group transition-all">
            {photoPreview ? (
              <div className="relative h-64 w-full">
                <img
                  src={photoPreview}
                  alt="Couple preview"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {isEditing && (
                  <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm">
                    <UploadCloud size={32} className="text-white mb-2" />
                    <span className="text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-full">Change Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                )}
              </div>
            ) : (
              <div className={`h-48 w-full flex flex-col items-center justify-center text-gray-400 gap-3 ${isEditing ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}>
                {isEditing ? (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform"><UploadCloud size={28} className="text-primary" /></div>
                    <span className="text-sm font-bold text-gray-600">Upload Couple Photo</span>
                    <span className="text-xs text-gray-400 mt-1">High quality image recommended</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                ) : (
                  <>
                    <ImageIcon size={48} className="opacity-20" />
                    <span className="text-sm font-semibold uppercase tracking-widest opacity-50">No Photo</span>
                  </>
                )}
              </div>
            )}
            
            {/* Overlay Date when not editing */}
            {!isEditing && selectedStory?.created_at && (
              <div className="absolute bottom-4 left-5 text-white">
                <p className="text-xs opacity-75 font-medium uppercase tracking-wider mb-0.5">Submitted On</p>
                <p className="font-bold">{formatDate(selectedStory.created_at)}</p>
              </div>
            )}
          </div>

          {/* Edit Form */}
          {isEditing ? (
            <div className="space-y-5 bg-white p-1 rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 ml-1">User Name (Groom/Bride)</label>
                  <input
                    type="text"
                    value={editForm.user_name}
                    placeholder="E.g. Rahul Sharma"
                    onChange={e => setEditForm(f => ({ ...f, user_name: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 ml-1">Partner Name</label>
                  <input
                    type="text"
                    value={editForm.partner_name}
                    placeholder="E.g. Priya Patel"
                    onChange={e => setEditForm(f => ({ ...f, partner_name: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 ml-1">City / Location</label>
                  <input 
                    type="text" 
                    value={editForm.location} 
                    placeholder="E.g. Mumbai, MH"
                    onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all font-medium" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 ml-1">Wedding Year</label>
                  <input 
                    type="text" 
                    value={editForm.year} 
                    placeholder="E.g. 2024"
                    onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all font-medium" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2 ml-1">Notes / Their Story</label>
                <textarea
                  value={editForm.story_text}
                  placeholder="Share their beautiful journey..."
                  onChange={e => setEditForm(f => ({ ...f, story_text: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 h-32 resize-none focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all font-medium leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button variant="outline" className="flex-1 rounded-xl py-3 font-bold" onClick={() => { setIsEditing(false); if(isAdding) setIsAdding(false); }}>Cancel</Button>
                <button
                  onClick={handleEditSubmit}
                  disabled={saving}
                  className="flex-[2] bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30 disabled:opacity-70"
                >
                  {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                  {isAdding ? 'Save & Publish Story' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            selectedStory && (
              <div className="space-y-6">
                {/* Status badges */}
                <div className="flex gap-2 flex-wrap">
                  {selectedStory.is_approved ? (
                    <span className="px-3.5 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded-full flex items-center gap-1.5"><Check size={14}/> Published</span>
                  ) : (
                    <span className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full flex items-center gap-1.5">⏳ Pending Review</span>
                  )}
                  {selectedStory.is_hidden && (
                    <span className="px-3.5 py-1.5 bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold rounded-full flex items-center gap-1.5"><EyeOff size={14} /> Hidden from public</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Couple names */}
                  <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-5">
                    <p className="text-[10px] text-pink-500 font-bold uppercase tracking-widest mb-1.5">The Couple</p>
                    <p className="text-xl font-black text-gray-900 flex items-center gap-2 flex-wrap">
                      <span>{getDisplayName(selectedStory)}</span>
                      <Heart className="text-pink-500 fill-pink-500 w-4 h-4" />
                      <span>{selectedStory.partner_name || 'Partner'}</span>
                    </p>
                  </div>

                  {/* Details */}
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex flex-col justify-center gap-3">
                    {selectedStory.location && (
                      <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                        <div className="bg-white p-1.5 rounded-lg shadow-sm"><MapPin size={16} className="text-primary" /></div>
                        {selectedStory.location}
                      </div>
                    )}
                    {selectedStory.year && (
                      <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                        <div className="bg-white p-1.5 rounded-lg shadow-sm"><Calendar size={16} className="text-primary" /></div>
                        Married in {selectedStory.year}
                      </div>
                    )}
                  </div>
                </div>

                {/* Story Text */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Their Story / Notes</p>
                    <button onClick={() => setIsEditing(true)} className="text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all">
                      <Edit2 size={12} /> Edit Details
                    </button>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {selectedStory.story_text || <span className="italic text-gray-400">No story notes provided</span>}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-4 space-y-3">
                  <div className="flex gap-3">
                    {!selectedStory.is_approved ? (
                      <button
                        onClick={() => handleApproval(selectedStory.id, true)}
                        className="flex-[2] bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all shadow-md shadow-green-500/20"
                      >
                        <Check size={16} /> Approve & Publish
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApproval(selectedStory.id, false)}
                        className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all shadow-md shadow-amber-500/20"
                      >
                        <X size={16} /> Unapprove Story
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleVisibility(selectedStory.id, !!selectedStory.is_hidden)}
                      className={`flex-1 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${
                        selectedStory.is_hidden
                          ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {selectedStory.is_hidden ? <><Eye size={16} /> Show</> : <><EyeOff size={16} /> Hide</>}
                    </button>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(selectedStory.id)}
                    className="w-full bg-red-50 hover:bg-red-500 text-red-600 hover:text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all border border-red-100 hover:border-red-500"
                  >
                    <Trash2 size={16} /> Delete Permanently
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </Modal>
    </div>
  );
}
