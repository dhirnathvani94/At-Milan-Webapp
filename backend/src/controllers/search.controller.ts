import { Request, Response } from 'express';
import { getDB } from '../db/database';
import { env } from '../config/env';

// ─── Internal types ───────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  phone: string | null;
  profile_complete: boolean;
  is_verified: boolean;
  religion?: string;
  caste?: string;
  education_level?: string;
  occupation?: string;
  annual_income?: string;
  city?: string;
  state?: string;
  country?: string;
  marital_status?: string;
  profile_photo?: string | null;
  // Preferences
  pref_age_min?: number;
  pref_age_max?: number;
  pref_religion?: string;
  pref_caste?: string;
  pref_education?: string;
  pref_occupation?: string;
  pref_income?: string;
  pref_marital_status?: string;
  pref_location?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface UserRow {
  id: string;
  email: string;
  is_active: boolean;
  role: string;
  gender: string;
  created_at: string;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Strip contact details for non-premium viewers */
function publicProfile(profile: ProfileRow, viewerId: string | null): ProfileRow {
  if (!viewerId) {
    return { ...profile, phone: null };
  }
  return profile;
}

// ─── In-memory filter ─────────────────────────────────────────────────────────

interface SearchFilters {
  looking_for?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  religion?: string;
  caste?: string;
  education?: string;
  occupation?: string;
  income?: string;
  city?: string;
  state?: string;
  marital_status?: string;
  page?: number;
  limit?: number;
}

function filterProfiles(
  profiles: ProfileRow[],
  users: UserRow[],
  filters: SearchFilters,
  excludeUserId: string | null
): { results: ProfileRow[]; total: number } {
  const activeUserIds = new Set(
    users.filter((u) => u.is_active && u.role !== 'admin').map((u) => u.id)
  );

  let results = profiles.filter((p) => {
    // Exclude inactive/deleted users
    if (!activeUserIds.has(p.user_id)) return false;
    // Exclude own profile
    if (excludeUserId && p.user_id === excludeUserId) return false;

    // Gender / looking_for filter
    if (filters.gender && p.gender?.toLowerCase() !== filters.gender.toLowerCase()) return false;
    if (filters.looking_for && p.gender?.toLowerCase() !== filters.looking_for.toLowerCase()) return false;

    // Age filter
    if (p.date_of_birth) {
      const age = calculateAge(p.date_of_birth);
      if (filters.age_min !== undefined && age < filters.age_min) return false;
      if (filters.age_max !== undefined && age > filters.age_max) return false;
    }

    // Religion
    if (filters.religion && p.religion?.toLowerCase() !== filters.religion.toLowerCase()) return false;

    // Caste
    if (filters.caste && p.caste?.toLowerCase() !== filters.caste.toLowerCase()) return false;

    // Education
    if (filters.education && p.education_level?.toLowerCase() !== filters.education.toLowerCase()) return false;

    // Occupation
    if (filters.occupation && p.occupation?.toLowerCase() !== filters.occupation.toLowerCase()) return false;

    // Income
    if (filters.income && p.annual_income?.toLowerCase() !== filters.income.toLowerCase()) return false;

    // City
    if (filters.city && p.city?.toLowerCase() !== filters.city.toLowerCase()) return false;

    // State
    if (filters.state && p.state?.toLowerCase() !== filters.state.toLowerCase()) return false;

    // Marital status
    if (filters.marital_status && p.marital_status?.toLowerCase() !== filters.marital_status.toLowerCase()) return false;

    return true;
  });

  const total = results.length;

  // Sort by newest first
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Paginate
  const page  = Math.max(1, filters.page ?? 1);
  const limit = Math.min(20, Math.max(1, filters.limit ?? 20));
  results = results.slice((page - 1) * limit, page * limit);

  return { results, total };
}

// ─── Elasticsearch search ─────────────────────────────────────────────────────

async function elasticsearchSearch(
  filters: SearchFilters,
  excludeUserId: string | null
): Promise<{ results: ProfileRow[]; total: number } | null> {
  if (!env.ELASTICSEARCH_URL) return null;

  try {
    const must: unknown[] = [];

    if (filters.gender || filters.looking_for) {
      must.push({ match: { gender: filters.gender ?? filters.looking_for } });
    }
    if (filters.religion) must.push({ match: { religion: filters.religion } });
    if (filters.caste)    must.push({ match: { caste: filters.caste } });
    if (filters.education) must.push({ match: { education_level: filters.education } });
    if (filters.occupation) must.push({ match: { occupation: filters.occupation } });
    if (filters.city)  must.push({ match: { city: filters.city } });
    if (filters.state) must.push({ match: { state: filters.state } });
    if (filters.marital_status) must.push({ match: { marital_status: filters.marital_status } });

    const mustNot: unknown[] = [];
    if (excludeUserId) mustNot.push({ term: { user_id: excludeUserId } });
    mustNot.push({ term: { is_active: false } });

    const filter: unknown[] = [];
    if (filters.age_min !== undefined || filters.age_max !== undefined) {
      const today = new Date();
      const range: Record<string, string> = {};
      if (filters.age_max !== undefined) {
        const minDob = new Date(today);
        minDob.setFullYear(today.getFullYear() - filters.age_max);
        range['gte'] = minDob.toISOString().split('T')[0]!;
      }
      if (filters.age_min !== undefined) {
        const maxDob = new Date(today);
        maxDob.setFullYear(today.getFullYear() - filters.age_min);
        range['lte'] = maxDob.toISOString().split('T')[0]!;
      }
      filter.push({ range: { date_of_birth: range } });
    }

    const page  = Math.max(1, filters.page ?? 1);
    const limit = Math.min(20, Math.max(1, filters.limit ?? 20));

    const body = {
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must, must_not: mustNot, filter } },
      sort: [{ created_at: { order: 'desc' } }],
    };

    const response = await fetch(`${env.ELASTICSEARCH_URL}/profiles/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      hits: { total: { value: number }; hits: Array<{ _source: ProfileRow }> };
    };

    return {
      results: data.hits.hits.map((h) => h._source),
      total: data.hits.total.value,
    };
  } catch (err) {
    console.error('[Search] Elasticsearch error, falling back to in-memory:', (err as Error).message);
    return null;
  }
}

// ─── searchProfiles ───────────────────────────────────────────────────────────

export async function searchProfiles(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query as Record<string, string>;
    const viewerId = req.user?.id ?? null;

    const filters: SearchFilters = {
      looking_for:    q['looking_for'],
      gender:         q['gender'],
      age_min:        q['age_min']  ? parseInt(q['age_min'],  10) : undefined,
      age_max:        q['age_max']  ? parseInt(q['age_max'],  10) : undefined,
      religion:       q['religion'],
      caste:          q['caste'],
      education:      q['education'],
      occupation:     q['occupation'],
      income:         q['income'],
      city:           q['city'],
      state:          q['state'],
      marital_status: q['marital_status'],
      page:           q['page']  ? parseInt(q['page'],  10) : 1,
      limit:          q['limit'] ? parseInt(q['limit'], 10) : 20,
    };

    // Try Elasticsearch first; fall back to in-memory
    let searchResult = await elasticsearchSearch(filters, viewerId);

    if (!searchResult) {
      const db = await getDB();
      searchResult = filterProfiles(
        db.profiles as ProfileRow[],
        db.users as UserRow[],
        filters,
        viewerId
      );
    }

    // Strip contact details for unauthenticated users
    const profiles = searchResult.results.map((p) => publicProfile(p, viewerId));

    res.status(200).json({
      success: true,
      profiles,
      totalCount: searchResult.total,
      page:  filters.page ?? 1,
      limit: filters.limit ?? 20,
      totalPages: Math.ceil(searchResult.total / (filters.limit ?? 20)),
    });
  } catch (err) {
    console.error('[Search] searchProfiles error:', err);
    res.status(500).json({ success: false, error: 'Search failed.' });
  }
}

// ─── getRecommendations ───────────────────────────────────────────────────────

export async function getRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const db = await getDB();

    const myProfile = (db.profiles as ProfileRow[]).find((p) => p.user_id === userId);
    if (!myProfile) {
      res.status(404).json({ success: false, error: 'Your profile not found.' });
      return;
    }

    // Build filters from partner preferences
    const filters: SearchFilters = {
      age_min:        myProfile.pref_age_min,
      age_max:        myProfile.pref_age_max,
      religion:       myProfile.pref_religion,
      caste:          myProfile.pref_caste,
      education:      myProfile.pref_education,
      occupation:     myProfile.pref_occupation,
      income:         myProfile.pref_income,
      marital_status: myProfile.pref_marital_status,
      // Recommend opposite gender by default
      gender:         myProfile.gender === 'Male' ? 'Female' : 'Male',
      page:           1,
      limit:          20,
    };

    const { results, total } = filterProfiles(
      db.profiles as ProfileRow[],
      db.users as UserRow[],
      filters,
      userId
    );

    res.status(200).json({
      success: true,
      profiles: results,
      totalCount: total,
    });
  } catch (err) {
    console.error('[Search] getRecommendations error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch recommendations.' });
  }
}

// ─── getNewMembers ────────────────────────────────────────────────────────────

export async function getNewMembers(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(20, parseInt((req.query['limit'] as string) ?? '12', 10));
    const viewerId = req.user?.id ?? null;

    const db = await getDB();
    const activeUserIds = new Set(
      (db.users as UserRow[])
        .filter((u) => u.is_active && u.role !== 'admin')
        .map((u) => u.id)
    );

    const profiles = (db.profiles as ProfileRow[])
      .filter((p) => activeUserIds.has(p.user_id) && (!viewerId || p.user_id !== viewerId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map((p) => publicProfile(p, viewerId));

    res.status(200).json({ success: true, profiles });
  } catch (err) {
    console.error('[Search] getNewMembers error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch new members.' });
  }
}

// ─── searchSuggest ────────────────────────────────────────────────────────────

export async function searchSuggest(req: Request, res: Response): Promise<void> {
  try {
    const q = ((req.query['q'] as string) ?? '').toLowerCase().trim();

    if (!q || q.length < 2) {
      res.status(200).json({ success: true, suggestions: [] });
      return;
    }

    const db = await getDB();

    // Collect unique values from profile fields for autocomplete
    const profiles = db.profiles as ProfileRow[];

    const citySet      = new Set<string>();
    const stateSet     = new Set<string>();
    const religionSet  = new Set<string>();
    const casteSet     = new Set<string>();
    const occupationSet = new Set<string>();

    for (const p of profiles) {
      if (p.city      && p.city.toLowerCase().includes(q))       citySet.add(p.city);
      if (p.state     && p.state.toLowerCase().includes(q))      stateSet.add(p.state);
      if (p.religion  && p.religion.toLowerCase().includes(q))   religionSet.add(p.religion);
      if (p.caste     && p.caste.toLowerCase().includes(q))      casteSet.add(p.caste);
      if (p.occupation && p.occupation.toLowerCase().includes(q)) occupationSet.add(p.occupation);
    }

    const suggestions = [
      ...[...citySet].slice(0, 3).map((v) => ({ type: 'city', value: v })),
      ...[...stateSet].slice(0, 3).map((v) => ({ type: 'state', value: v })),
      ...[...religionSet].slice(0, 3).map((v) => ({ type: 'religion', value: v })),
      ...[...casteSet].slice(0, 3).map((v) => ({ type: 'caste', value: v })),
      ...[...occupationSet].slice(0, 3).map((v) => ({ type: 'occupation', value: v })),
    ].slice(0, 10);

    res.status(200).json({ success: true, suggestions });
  } catch (err) {
    console.error('[Search] searchSuggest error:', err);
    res.status(500).json({ success: false, error: 'Suggest failed.' });
  }
}
