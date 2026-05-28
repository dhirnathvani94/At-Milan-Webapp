import { create } from 'zustand';
import { apiUrl } from '../lib/api';

interface MasterDataState {
  castes: any[]; sub_castes: any[]; gotras: any[]; nakshatras: any[];
  raashis: any[]; heights: any[]; weights: any[]; body_types: any[];
  complexions: any[]; blood_groups: any[]; marital_statuses: any[];
  education_levels: any[]; occupations: any[]; incomes: any[];
  countries: any[]; states: any[]; cities: any[]; family_types: any[];
  diets: any[]; habits: any[]; hobbies: any[]; languages: any[];
  admin_settings_kv: any[];
  communities: any[];
  isLoading: boolean; isLoaded: boolean; error: string | null;
  fetchAllMasterData: () => Promise<void>;
  refetchMasterData: () => Promise<void>;
  getSubCastesByCaste: (casteId: string) => any[];
  getGotrasByCaste: (casteId: string) => any[];
  getStatesByCountry: (countryId: string) => any[];
  getCitiesByState: (stateId: string) => any[];
}

async function fetchSettingsSafe(): Promise<any[]> {
  try {
    const res = await fetch(apiUrl(`/api/master-data/app-config?_t=${Date.now()}`), { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && Array.isArray(json.data.admin_settings_kv)) {
        return json.data.admin_settings_kv;
      }
    }
  } catch { }
  return [];
}

async function fetchMasterDataSafe(): Promise<Record<string, any>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      apiUrl(`/api/master-data?_t=${Date.now()}`),
      { cache: 'no-store', signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return {};
    const json = await res.json();
    return json.data ?? json ?? {};
  } catch {
    return {};
  }
}

async function fetchCommunitiesSafe(): Promise<any[]> {
  try {
    const res = await fetch(apiUrl(`/api/communities/active?_t=${Date.now()}`), { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.communities)) {
        return json.communities;
      }
    }
  } catch { /* communities not critical — ignore error */ }
  return [];
}

export const useMasterData = create<MasterDataState>((set, get) => ({
  castes: [], sub_castes: [], gotras: [], nakshatras: [], raashis: [],
  heights: [], weights: [], body_types: [], complexions: [], blood_groups: [],
  marital_statuses: [], education_levels: [], occupations: [], incomes: [],
  countries: [], states: [], cities: [], family_types: [], diets: [],
  habits: [], hobbies: [], languages: [], admin_settings_kv: [],
  communities: [],
  isLoading: false, isLoaded: false, error: null,

  fetchAllMasterData: async () => {
    if (get().isLoaded) return;
    set({ isLoading: true, error: null });
    try {
      const [masterData, settingsFromConfig] = await Promise.all([
        fetchMasterDataSafe(),
        fetchSettingsSafe(),
      ]);
      const adminSettings = settingsFromConfig.length > 0
        ? settingsFromConfig
        : (masterData.admin_settings_kv ?? []);
      set({ ...masterData, admin_settings_kv: adminSettings, isLoaded: true, isLoading: false });

      // Fetch active communities — not critical, runs after main data is set
      try {
        const commRes = await fetch(apiUrl(`/api/communities/active?_t=${Date.now()}`), { cache: 'no-store' });
        if (commRes.ok) {
          const commJson = await commRes.json();
          if (commJson.success && Array.isArray(commJson.communities)) {
            set({ communities: commJson.communities });
          }
        }
      } catch { /* communities not critical — ignore error */ }
    } catch (error: any) {
      console.warn('Master data fetch failed — app will work with empty data:', error?.message);
      set({ error: null, isLoading: false, isLoaded: true });
    }
  },

  refetchMasterData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [masterData, settingsFromConfig] = await Promise.all([
        fetchMasterDataSafe(),
        fetchSettingsSafe(),
      ]);
      const adminSettings = settingsFromConfig.length > 0
        ? settingsFromConfig
        : (masterData.admin_settings_kv ?? []);
      set({ ...masterData, admin_settings_kv: adminSettings, isLoaded: true, isLoading: false });

      // Fetch active communities — not critical, runs after main data is set
      try {
        const commRes = await fetch(apiUrl(`/api/communities/active?_t=${Date.now()}`), { cache: 'no-store' });
        if (commRes.ok) {
          const commJson = await commRes.json();
          if (commJson.success && Array.isArray(commJson.communities)) {
            set({ communities: commJson.communities });
          }
        }
      } catch { /* communities not critical — ignore error */ }
    } catch (error: any) {
      console.warn('Master data fetch failed — app will work with empty data:', error?.message);
      set({ error: null, isLoading: false, isLoaded: true });
    }
  },

  getSubCastesByCaste: (casteId) => get().sub_castes.filter((sc) => sc.caste_id === casteId),
  getGotrasByCaste: (casteId) => get().gotras.filter((g) => g.caste_id === casteId),
  getStatesByCountry: (countryId) => get().states.filter((s) => s.country_id === countryId),
  getCitiesByState: (stateId) => get().cities.filter((c) => c.state_id === stateId),
}));
