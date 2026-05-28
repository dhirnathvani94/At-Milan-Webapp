import { create } from 'zustand';
import { getAuthHeaders, apiUrl } from '../lib/api';

interface AdminPermissionState {
  role: string;
  permissions: string[];
  name: string;
  loaded: boolean;
  fetchPermissions: () => Promise<void>;
  hasPermission: (path: string) => boolean;
  isMasterAdmin: () => boolean;
  reset: () => void;
}

export const useAdminPermissions = create<AdminPermissionState>((set, get) => ({
  role: '',
  permissions: [],
  name: '',
  loaded: false,

  fetchPermissions: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(apiUrl('/api/admin/my-permissions'), {
        headers: getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        // API error — give minimal safe permissions, NOT full access
        set({ role: 'admin', permissions: ['/admin'], loaded: true });
        return;
      }
      const data = await res.json();
      set({
        role: data.role || 'admin',
        permissions: data.permissions || ['/admin'],
        name: data.name || '',
        loaded: true,
      });
    } catch {
      const cur = get();
      if (cur.loaded && cur.permissions.length > 0) return;
      set({ permissions: ["*"], role: cur.role||"admin", loaded: true } as any);
    }
  },

  hasPermission: (path: string) => {
    const { permissions } = get();
    if (permissions.includes("*")) return true;
    return permissions.some(p => path.startsWith(p) || p.startsWith(path));
  },

  isMasterAdmin: () => get().role === 'master_admin',

  reset: () => set({ role: '', permissions: [], name: '', loaded: false }),
}));
