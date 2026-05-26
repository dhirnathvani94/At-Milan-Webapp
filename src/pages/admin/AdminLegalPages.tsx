import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Edit2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { updateSiteSetting } from '../../lib/actions/adminActions';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import { PageSkeleton } from '../../components/ui/Skeletons';
import { apiFetch, apiUrl } from '../../lib/api';

export default function AdminLegalPages() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'faq' | 'privacy' | 'terms'>('faq');

  // Data
  const [faqData, setFaqData] = useState<any[]>([]);
  const [privacyData, setPrivacyData] = useState<any[]>([]);
  const [termsData, setTermsData] = useState<any[]>([]);

  // Editing helpers
  const [editingFaqCat, setEditingFaqCat] = useState<string | null>(null);
  const [editingFaqItem, setEditingFaqItem] = useState<{catId: string; idx: number} | null>(null);
  const [editingPrivacyIdx, setEditingPrivacyIdx] = useState<number | null>(null);
  const [editingTermsIdx, setEditingTermsIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Try admin endpoint first (has all settings including sensitive ones)
      const res = await apiFetch('/api/admin/settings');
      const json = await res.json();

      let all: any[] = [];

      if (Array.isArray(json)) {
        // Root server returns plain array with { setting_key, setting_value }
        all = json.map((s: any) => ({
          key: s.setting_key ?? s.key,
          value: s.setting_value ?? s.value,
        }));
      } else if (json.settings && Array.isArray(json.settings)) {
        // Backend server returns { success: true, settings: [{ key, value }] }
        all = json.settings;
      }

      // If admin endpoint returned nothing useful, fall back to public master-data
      if (all.length === 0) {
        const pubRes = await fetch(apiUrl('/api/master-data'));
        const pubJson = await pubRes.json();
        if (Array.isArray(pubJson.admin_settings_kv)) {
          all = pubJson.admin_settings_kv;
        }
      }

      const parse = (raw: string | undefined) => {
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      };

      const faqSetting = all.find((s: any) => s.key === 'faq_data');
      const faqParsed = parse(faqSetting?.value);
      setFaqData(faqParsed);

      const pp = all.find((s: any) => s.key === 'privacy_policy_data');
      const ppParsed = parse(pp?.value);
      setPrivacyData(ppParsed);

      const td = all.find((s: any) => s.key === 'terms_data');
      const tdParsed = parse(td?.value);
      setTermsData(tdParsed);

    } catch (error) {
      // Last resort: try public endpoint directly
      try {
        const pubRes = await fetch(apiUrl('/api/master-data'));
        const pubJson = await pubRes.json();
        const all: any[] = pubJson.admin_settings_kv ?? [];
        const parse = (raw: string | undefined) => { if (!raw) return []; try { return JSON.parse(raw); } catch { return []; } };
        setFaqData(parse(all.find((s: any) => s.key === 'faq_data')?.value));
        setPrivacyData(parse(all.find((s: any) => s.key === 'privacy_policy_data')?.value));
        setTermsData(parse(all.find((s: any) => s.key === 'terms_data')?.value));
      } catch {
        toast.error('Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { key: 'faq' as const, label: 'FAQ Manager', count: faqData.length },
    { key: 'privacy' as const, label: 'Privacy Policy', count: privacyData.length },
    { key: 'terms' as const, label: 'Terms & Conditions', count: termsData.length },
  ];

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
          <FileText size={28} className="text-primary" /> Legal & FAQ Pages
        </h1>
        <p className="text-gray-500">Manage FAQ, Privacy Policy, and Terms & Conditions content</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-3">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSection === s.key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/30 hover:text-primary'
            }`}
          >
            {s.label}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
              activeSection === s.key ? 'bg-white/20' : 'bg-gray-100'
            }`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* â”€â”€ FAQ Section â”€â”€ */}
      {activeSection === 'faq' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={async () => {
              const newCat = { id: `cat_${Date.now()}`, title: 'New Category', items: [] };
              const updated = [...faqData, newCat];
              setFaqData(updated);
              await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
              toast.success('Category added');
            }}>
              <Plus size={16} className="mr-1" /> Add Category
            </Button>
          </div>
          {faqData.map((cat: any, cIdx: number) => (
            <Card key={cat.id} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                {editingFaqCat === cat.id ? (
                  <input
                    className="flex-1 border border-primary rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    defaultValue={cat.title}
                    onBlur={async (e) => {
                      const updated = faqData.map((c: any) => c.id === cat.id ? { ...c, title: e.target.value } : c);
                      setFaqData(updated);
                      setEditingFaqCat(null);
                      await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                      toast.success('Category updated');
                    }}
                    autoFocus
                  />
                ) : (
                  <h3 className="flex-1 text-lg font-bold text-gray-900">{cat.title}</h3>
                )}
                <button onClick={() => setEditingFaqCat(cat.id)} className="text-gray-400 hover:text-primary transition-colors" title="Rename category"><Edit2 size={16} /></button>
                <button onClick={async () => {
                  if (!confirm('Delete this entire category?')) return;
                  const updated = faqData.filter((_: any, i: number) => i !== cIdx);
                  setFaqData(updated);
                  await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                  toast.success('Category deleted');
                }} className="text-red-400 hover:text-red-600 transition-colors" title="Delete category"><Trash2 size={16} /></button>
              </div>
              <div className="space-y-3">
                {cat.items.map((item: any, iIdx: number) => (
                  <div key={iIdx} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                    {editingFaqItem?.catId === cat.id && editingFaqItem?.idx === iIdx ? (
                      <div className="space-y-2">
                        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30" defaultValue={item.question} id={`faq-q-${cat.id}-${iIdx}`} />
                        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px]" defaultValue={item.answer} id={`faq-a-${cat.id}-${iIdx}`} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={async () => {
                            const q = (document.getElementById(`faq-q-${cat.id}-${iIdx}`) as HTMLInputElement)?.value;
                            const a = (document.getElementById(`faq-a-${cat.id}-${iIdx}`) as HTMLTextAreaElement)?.value;
                            const updated = faqData.map((c: any) => c.id === cat.id ? { ...c, items: c.items.map((it: any, i: number) => i === iIdx ? { question: q, answer: a } : it) } : c);
                            setFaqData(updated);
                            setEditingFaqItem(null);
                            await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                            toast.success('FAQ updated');
                          }}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFaqItem(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{item.question}</p>
                          <p className="text-gray-500 text-sm mt-1">{item.answer}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setEditingFaqItem({ catId: cat.id, idx: iIdx })} className="text-gray-400 hover:text-primary transition-colors"><Edit2 size={15} /></button>
                          <button onClick={async () => {
                            const updated = faqData.map((c: any) => c.id === cat.id ? { ...c, items: c.items.filter((_: any, i: number) => i !== iIdx) } : c);
                            setFaqData(updated);
                            await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                            toast.success('Question deleted');
                          }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={async () => {
                  const updated = faqData.map((c: any) => c.id === cat.id ? { ...c, items: [...c.items, { question: 'New Question', answer: 'New Answer' }] } : c);
                  setFaqData(updated);
                  await apiFetch('/api/admin/settings/faq_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                  toast.success('Question added');
                }} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                  <Plus size={16} /> Add Question
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* â”€â”€ Privacy Policy Section â”€â”€ */}
      {activeSection === 'privacy' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={async () => {
              const updated = [...privacyData, { id: privacyData.length + 1, title: 'New Section', content: 'Enter content here.' }];
              setPrivacyData(updated);
              await apiFetch('/api/admin/settings/privacy_policy_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
              toast.success('Section added');
            }}>
              <Plus size={16} className="mr-1" /> Add Section
            </Button>
          </div>
          {privacyData.map((section: any, idx: number) => (
            <Card key={idx} className="p-5">
              {editingPrivacyIdx === idx ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</span>
                    <input className="flex-1 border border-primary rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" defaultValue={section.title} id={`pp-title-${idx}`} />
                  </div>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[120px]" defaultValue={section.content} id={`pp-content-${idx}`} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={async () => {
                      const title = (document.getElementById(`pp-title-${idx}`) as HTMLInputElement)?.value;
                      const content = (document.getElementById(`pp-content-${idx}`) as HTMLTextAreaElement)?.value;
                      const updated = privacyData.map((s: any, i: number) => i === idx ? { ...s, title, content } : s);
                      setPrivacyData(updated);
                      setEditingPrivacyIdx(null);
                      await apiFetch('/api/admin/settings/privacy_policy_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                      toast.success('Section updated');
                    }}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPrivacyIdx(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{section.title}</h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{section.content}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => setEditingPrivacyIdx(idx)} className="text-gray-400 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                    <button onClick={async () => {
                      const updated = privacyData.filter((_: any, i: number) => i !== idx).map((s: any, i: number) => ({ ...s, id: i + 1 }));
                      setPrivacyData(updated);
                      await apiFetch('/api/admin/settings/privacy_policy_data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(updated) }) });
                      toast.success('Section deleted');
                    }} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* â”€â”€ Terms & Conditions Section â”€â”€ */}
      {activeSection === 'terms' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={async () => {
              const updated = [...termsData, { id: termsData.length + 1, title: 'New Term', content: 'Enter content here.' }];
              setTermsData(updated);
              try {
                setSaving(true);
                await updateSiteSetting('terms_data', JSON.stringify(updated), (user?.id || ''));
                toast.success('Term added');
              } catch (e) { toast.error('Failed to add term'); } finally { setSaving(false); }
            }}>
              <Plus size={16} className="mr-1" /> Add Term
            </Button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 space-y-6">
              {termsData.map((term: any, index: number) => (
                <div key={index} className="flex flex-col gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <input
                      type="text"
                      className="w-full font-bold px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none mb-2"
                      value={term.title}
                      onChange={(e) => {
                        const newTerms = [...termsData];
                        newTerms[index].title = e.target.value;
                        setTermsData(newTerms);
                      }}
                    />
                    <button
                      onClick={async () => {
                        const newTerms = termsData.filter((_: any, i: number) => i !== index);
                        setTermsData(newTerms);
                        try {
                          setSaving(true);
                          await updateSiteSetting('terms_data', JSON.stringify(newTerms), (user?.id || ''));
                          toast.success('Term removed');
                        } catch (e) { toast.error('Failed to remove term'); } finally { setSaving(false); }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg ml-2"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm"
                    rows={3}
                    value={term.content}
                    onChange={(e) => {
                      const newTerms = [...termsData];
                      newTerms[index].content = e.target.value;
                      setTermsData(newTerms);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <Button 
                variant="primary" 
                onClick={async () => {
                  try {
                    setSaving(true);
                    await updateSiteSetting('terms_data', JSON.stringify(termsData), (user?.id || ''));
                    toast.success('Terms & Conditions updated successfully');
                  } catch (e) { toast.error('Failed to update Terms & Conditions'); } finally { setSaving(false); }
                }}
                loading={saving}
              >
                <Save size={18} className="mr-2" /> Save Terms
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
