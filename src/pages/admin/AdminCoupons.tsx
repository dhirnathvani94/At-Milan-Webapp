import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { apiUrl } from '../../lib/api';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: 0,
    validFrom: '',
    validUntil: '',
    maxUses: '',
    isActive: true
  });

  const fetchCoupons = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/coupons'));
      const data = await res.json();
      setCoupons(data);
    } catch (err) {
      console.error('Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || formData.value <= 0) {
      toast.error('Please fill required fields correctly');
      return;
    }

    try {
      const url = editingCoupon 
        ? apiUrl(`/api/admin/coupons/${editingCoupon.id}`)
        : apiUrl('/api/admin/coupons');
      const method = editingCoupon ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        maxUses: formData.maxUses ? parseInt(formData.maxUses.toString()) : null,
        validFrom: formData.validFrom || null,
        validUntil: formData.validUntil || null
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save coupon');
      
      toast.success(editingCoupon ? 'Coupon updated' : 'Coupon created');
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const res = await fetch(apiUrl(`/api/admin/coupons/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Coupon deleted');
      fetchCoupons();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const openModal = (coupon?: any) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        validFrom: coupon.validFrom ? coupon.validFrom.substring(0, 16) : '',
        validUntil: coupon.validUntil ? coupon.validUntil.substring(0, 16) : '',
        maxUses: coupon.maxUses || '',
        isActive: coupon.isActive
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        validFrom: '',
        validUntil: '',
        maxUses: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const toggleStatus = async (coupon: any) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/coupons/${coupon.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Coupon ${!coupon.isActive ? 'Activated' : 'Deactivated'}`);
      fetchCoupons();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-primary" /> Offer Settings & Coupons
          </h1>
          <p className="text-gray-500">Manage discount codes for users</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus size={18} className="mr-2" /> Add Coupon
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">Discount</th>
                <th className="p-4 font-bold text-gray-700">Validity</th>
                <th className="p-4 font-bold text-gray-700">Usage</th>
                <th className="p-4 font-bold text-gray-700">Status</th>
                <th className="p-4 font-bold text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No coupons found. Create your first offer!
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <span className="bg-primary/10 text-primary font-mono font-bold px-3 py-1 rounded border border-primary/20">
                        {c.code}
                      </span>
                    </td>
                    <td className="p-4 font-medium">
                      {c.type === 'percentage' ? `${c.value}% OFF` : `₹${c.value} OFF`}
                    </td>
                    <td className="p-4 text-sm">
                      <div className="text-gray-600">
                        From: {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : 'Always'}
                      </div>
                      <div className="text-gray-600">
                        Until: {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Forever'}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      {c.usedCount} {c.maxUses ? `/ ${c.maxUses}` : 'uses'}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleStatus(c)}
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          c.isActive 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openModal(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors mr-2">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full p-2 border rounded font-mono uppercase"
                  placeholder="e.g. SUMMER50"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.value || ''}
                    onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="datetime-local"
                    value={formData.validFrom}
                    onChange={e => setFormData({...formData, validFrom: e.target.value})}
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="datetime-local"
                    value={formData.validUntil}
                    onChange={e => setFormData({...formData, validUntil: e.target.value})}
                    className="w-full p-2 border rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Total Uses (Leave blank for unlimited)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxUses}
                  onChange={e => setFormData({...formData, maxUses: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. 100"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 text-primary rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active / Usable</label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit">Save Coupon</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
