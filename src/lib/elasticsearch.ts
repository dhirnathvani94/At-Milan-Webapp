import { Client } from '@elastic/elasticsearch';

// ──────────────────────────────────────────────
// Elasticsearch Client & Index Configuration
// ──────────────────────────────────────────────

const ES_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const PROFILES_INDEX = 'atmilan_profiles';

let esClient: Client | null = null;
let esReady = false;

export function getESClient(): Client | null {
  if (esClient) return esClient;
  try {
    esClient = new Client({ node: ES_URL, requestTimeout: 10000, maxRetries: 3 });
    console.log(`[ES] Client created for ${ES_URL}`);
    return esClient;
  } catch (e) {
    console.error('[ES] Failed to create client:', e);
    return null;
  }
}

export function isESReady(): boolean {
  return esReady;
}

// ──────────────────────────────────────────────
// Index Mappings
// ──────────────────────────────────────────────

const PROFILES_MAPPING = {
  index: PROFILES_INDEX,
  body: {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          name_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding'],
          },
          ngram_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding', 'name_ngram'],
          },
        },
        tokenizer: {
          name_ngram: {
            type: 'ngram_tokenizer',
            min_gram: 2,
            max_gram: 3,
            token_chars: ['letter', 'digit'],
          },
        },
        filter: {
          name_ngram: {
            type: 'ngram',
            min_gram: 2,
            max_gram: 3,
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        profile_id: { type: 'keyword' },
        profile_for: { type: 'keyword' },
        first_name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            ngram: { type: 'text', analyzer: 'ngram_analyzer', search_analyzer: 'name_analyzer' },
            search: { type: 'text', analyzer: 'name_analyzer' },
          },
        },
        last_name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            ngram: { type: 'text', analyzer: 'ngram_analyzer', search_analyzer: 'name_analyzer' },
            search: { type: 'text', analyzer: 'name_analyzer' },
          },
        },
        full_name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            ngram: { type: 'text', analyzer: 'ngram_analyzer', search_analyzer: 'name_analyzer' },
            search: { type: 'text', analyzer: 'name_analyzer' },
          },
        },
        gender: { type: 'keyword' },
        date_of_birth: { type: 'date', format: 'strict_date_optional_time||epoch_millis' },
        age: { type: 'integer' },
        marital_status: { type: 'keyword' },
        religion: { type: 'keyword' },
        caste: { type: 'keyword' },
        sub_caste: { type: 'keyword' },
        gotra: { type: 'keyword' },
        mother_tongue: { type: 'keyword' },
        height_cm: { type: 'integer' },
        weight_kg: { type: 'integer' },
        body_type: { type: 'keyword' },
        complexion: { type: 'keyword' },
        blood_group: { type: 'keyword' },
        physical_disability: { type: 'boolean' },
        disability_desc: { type: 'text', analyzer: 'name_analyzer' },
        about_me: { type: 'text', analyzer: 'name_analyzer' },
        profile_photo_url: { type: 'keyword', index: false },
        profile_completion: { type: 'integer' },
        is_verified: { type: 'boolean' },
        is_active: { type: 'boolean' },
        is_premium: { type: 'boolean' },
        premium_plan: { type: 'keyword' },
        premium_end: { type: 'date', format: 'strict_date_optional_time||epoch_millis' },
        role: { type: 'keyword' },
        phone: { type: 'keyword' },
        email: { type: 'keyword' },
        photo_privacy: { type: 'keyword' },
        children_count: { type: 'integer' },
        created_at: { type: 'date', format: 'strict_date_optional_time||epoch_millis' },
        updated_at: { type: 'date', format: 'strict_date_optional_time||epoch_millis' },

        // Nested: Education & Career
        education_career: {
          type: 'nested',
          properties: {
            highest_education: { type: 'keyword' },
            education_field: { type: 'text', analyzer: 'name_analyzer' },
            college_name: { type: 'text', analyzer: 'name_analyzer' },
            occupation: { type: 'keyword' },
            company_name: { type: 'text', analyzer: 'name_analyzer' },
            designation: { type: 'text', analyzer: 'name_analyzer' },
            annual_income: { type: 'keyword' },
            working_city: { type: 'keyword' },
            working_state: { type: 'keyword' },
            working_country: { type: 'keyword' },
          },
        },

        // Nested: Family
        family: {
          type: 'nested',
          properties: {
            family_type: { type: 'keyword' },
            father_occupation: { type: 'text', analyzer: 'name_analyzer' },
            mother_occupation: { type: 'text', analyzer: 'name_analyzer' },
            brothers: { type: 'integer' },
            sisters: { type: 'integer' },
            family_status: { type: 'keyword' },
            family_income: { type: 'keyword' },
          },
        },

        // Nested: Lifestyle
        lifestyle: {
          type: 'nested',
          properties: {
            diet: { type: 'keyword' },
            smoking: { type: 'keyword' },
            drinking: { type: 'keyword' },
            hobbies: { type: 'keyword' },
          },
        },

        // Nested: Partner Preferences
        partner_preferences: {
          type: 'nested',
          properties: {
            age_from: { type: 'integer' },
            age_to: { type: 'integer' },
            height_from_cm: { type: 'integer' },
            height_to_cm: { type: 'integer' },
            marital_status_pref: { type: 'keyword' },
            religion_pref: { type: 'keyword' },
            caste_pref: { type: 'keyword' },
            sub_caste_pref: { type: 'keyword' },
            mother_tongue_pref: { type: 'keyword' },
            education_pref: { type: 'keyword' },
            occupation_pref: { type: 'keyword' },
            income_from: { type: 'keyword' },
            income_to: { type: 'keyword' },
            country_pref: { type: 'keyword' },
            state_pref: { type: 'keyword' },
            diet_pref: { type: 'keyword' },
            smoking_pref: { type: 'keyword' },
            drinking_pref: { type: 'keyword' },
            manglik_pref: { type: 'keyword' },
            about_partner: { type: 'text', analyzer: 'name_analyzer' },
          },
        },

        // Location fields (denormalized for fast filtering)
        state: { type: 'keyword' },
        city: { type: 'keyword' },
        country: { type: 'keyword' },

        // Horoscope fields
        manglik: { type: 'keyword' },
        nakshatra: { type: 'keyword' },
        raashi: { type: 'keyword' },
      },
    },
  },
};

// ──────────────────────────────────────────────
// Initialize Index
// ──────────────────────────────────────────────

export async function initializeES(): Promise<boolean> {
  const client = getESClient();
  if (!client) return false;

  try {
    const health = await client.cluster.health();
    console.log(`[ES] Cluster status: ${health.status}`);

    // Check if index exists
    const exists = await client.indices.exists({ index: PROFILES_INDEX });
    if (!exists) {
      await client.indices.create(PROFILES_MAPPING as any);
      console.log(`[ES] Created index: ${PROFILES_INDEX}`);
    } else {
      console.log(`[ES] Index already exists: ${PROFILES_INDEX}`);
    }

    esReady = true;
    return true;
  } catch (e: any) {
    console.error(`[ES] Init error: ${e.message}`);
    // ES not available - app continues without it
    esReady = false;
    return false;
  }
}

// ──────────────────────────────────────────────
// Index a Single Profile
// ──────────────────────────────────────────────

export async function indexProfile(profile: any, db: any): Promise<void> {
  const client = getESClient();
  if (!client || !esReady) return;

  try {
    const age = profile.date_of_birth
      ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
      : null;

    const edu = db.education_career?.find((e: any) => e.user_id === (profile?.id || '')) || null;
    const fam = db.family_details?.find((f: any) => f.user_id === (profile?.id || '')) || null;
    const life = db.lifestyle?.find((l: any) => l.user_id === (profile?.id || '')) || null;
    const prefs = db.partner_preferences?.find((p: any) => p.user_id === (profile?.id || '')) || null;

    const doc = {
      id: (profile?.id || ''),
      profile_id: profile.profile_id,
      profile_for: profile.profile_for,
      first_name: profile.first_name,
      last_name: profile.last_name,
      full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      gender: profile.gender,
      date_of_birth: profile.date_of_birth || null,
      age,
      marital_status: profile.marital_status,
      religion: profile.religion,
      caste: profile.caste,
      sub_caste: profile.sub_caste,
      gotra: profile.gotra,
      mother_tongue: profile.mother_tongue,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      body_type: profile.body_type,
      complexion: profile.complexion,
      blood_group: profile.blood_group,
      physical_disability: profile.physical_disability || false,
      disability_desc: profile.disability_desc,
      about_me: profile.about_me,
      profile_photo_url: profile.profile_photo_url,
      profile_completion: profile.profile_completion,
      is_verified: profile.is_verified,
      is_active: profile.is_active,
      is_premium: profile.is_premium,
      premium_plan: profile.premium_plan,
      premium_end: profile.premium_end || null,
      role: profile.role,
      phone: profile.phone,
      email: profile.email,
      photo_privacy: profile.photo_privacy,
      children_count: profile.children_count || 0,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      state: profile.state,
      city: profile.city,
      country: profile.country,
      manglik: profile.manglik,
      nakshatra: profile.nakshatra,
      raashi: profile.raashi,
      education_career: edu ? [edu] : [],
      family: fam ? [fam] : [],
      lifestyle: life ? [life] : [],
      partner_preferences: prefs ? [prefs] : [],
    };

    await client.index({
      index: PROFILES_INDEX,
      id: (profile?.id || ''),
      document: doc,
      refresh: 'wait_for',
    });
  } catch (e: any) {
    console.error(`[ES] Index error for ${(profile?.id || '')}: ${e.message}`);
  }
}

// ──────────────────────────────────────────────
// Bulk Index All Profiles
// ──────────────────────────────────────────────

export async function bulkIndexProfiles(db: any): Promise<{ indexed: number; errors: number }> {
  const client = getESClient();
  if (!client || !esReady) return { indexed: 0, errors: 0 };

  const profiles = db.profiles || [];
  let indexed = 0;
  let errors = 0;

  const body: any[] = [];
  for (const profile of profiles) {
    const age = profile.date_of_birth
      ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
      : null;

    const edu = db.education_career?.find((e: any) => e.user_id === (profile?.id || '')) || null;
    const fam = db.family_details?.find((f: any) => f.user_id === (profile?.id || '')) || null;
    const life = db.lifestyle?.find((l: any) => l.user_id === (profile?.id || '')) || null;
    const prefs = db.partner_preferences?.find((p: any) => p.user_id === (profile?.id || '')) || null;

    body.push({ index: { _index: PROFILES_INDEX, _id: (profile?.id || '') } });
    body.push({
      id: (profile?.id || ''),
      profile_id: profile.profile_id,
      profile_for: profile.profile_for,
      first_name: profile.first_name,
      last_name: profile.last_name,
      full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      gender: profile.gender,
      date_of_birth: profile.date_of_birth || null,
      age,
      marital_status: profile.marital_status,
      religion: profile.religion,
      caste: profile.caste,
      sub_caste: profile.sub_caste,
      gotra: profile.gotra,
      mother_tongue: profile.mother_tongue,
      height_cm: profile.height_cm,
      weight_kg: profile.weight_kg,
      body_type: profile.body_type,
      complexion: profile.complexion,
      blood_group: profile.blood_group,
      physical_disability: profile.physical_disability || false,
      disability_desc: profile.disability_desc,
      about_me: profile.about_me,
      profile_photo_url: profile.profile_photo_url,
      profile_completion: profile.profile_completion,
      is_verified: profile.is_verified,
      is_active: profile.is_active,
      is_premium: profile.is_premium,
      premium_plan: profile.premium_plan,
      premium_end: profile.premium_end || null,
      role: profile.role,
      phone: profile.phone,
      email: profile.email,
      photo_privacy: profile.photo_privacy,
      children_count: profile.children_count || 0,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      state: profile.state,
      city: profile.city,
      country: profile.country,
      manglik: profile.manglik,
      nakshatra: profile.nakshatra,
      raashi: profile.raashi,
      education_career: edu ? [edu] : [],
      family: fam ? [fam] : [],
      lifestyle: life ? [life] : [],
      partner_preferences: prefs ? [prefs] : [],
    });
  }

  if (body.length > 0) {
    try {
      const result = await client.bulk({ body, refresh: 'wait_for' });
      if (result.errors) {
        const errItems = result.items.filter((item: any) => item.index?.status >= 400);
        errors = errItems.length;
      }
      indexed = result.items.length;
      console.log(`[ES] Bulk indexed ${indexed} profiles, ${errors} errors`);
    } catch (e: any) {
      console.error(`[ES] Bulk error: ${e.message}`);
      errors = profiles.length;
    }
  }

  return { indexed, errors };
}

// ──────────────────────────────────────────────
// Delete a Profile from Index
// ──────────────────────────────────────────────

export async function deleteProfileFromIndex(profileId: string): Promise<void> {
  const client = getESClient();
  if (!client || !esReady) return;
  try {
    await client.delete({ index: PROFILES_INDEX, id: profileId, refresh: 'wait_for' });
  } catch (e: any) {
    // Ignore not found errors
    if (!e.message?.includes('not_found')) {
      console.error(`[ES] Delete error: ${e.message}`);
    }
  }
}

// ──────────────────────────────────────────────
// Search Profiles with Elasticsearch
// ──────────────────────────────────────────────

export async function searchProfiles(filters: any, currentUserId: string, db: any): Promise<{ profiles: any[]; totalCount: number }> {
  const client = getESClient();

  // Fallback to DB search if ES not available
  if (!client || !esReady) {
    return null; // Caller will use DB fallback
  }

  try {
    const must: any[] = [];
    const mustNot: any[] = [];
    const should: any[] = [];

    // Always exclude current user, inactive, unverified, admin
    mustNot.push({ term: { id: currentUserId } });
    mustNot.push({ term: { is_active: false } });
    mustNot.push({ term: { is_verified: false } });
    mustNot.push({ term: { role: 'admin' } });

    // Blocked users
    const blockedIds = db.user_blocks
      ? db.user_blocks
          .filter((b: any) => b.blocker_id === currentUserId || b.blocked_id === currentUserId)
          .map((b: any) => b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id)
      : [];
    blockedIds.forEach((bid: string) => mustNot.push({ term: { id: bid } }));

    // Gender filter — ALWAYS enforce opposite gender (same rule as DB fallback)
    if (filters.looking_for) {
      must.push({ term: { gender: filters.looking_for } });
    } else {
      // Derive target gender from requesting user's own profile
      const myProfile = db.profiles?.find((p: any) => p.id === currentUserId);
      if (myProfile?.gender) {
        const targetGender = myProfile.looking_for
          ? myProfile.looking_for
          : (myProfile.gender === 'Male' ? 'Female' : 'Male');
        must.push({ term: { gender: targetGender } });
      }
    }

    // Caste filter
    if (filters.caste) {
      const castes = Array.isArray(filters.caste) ? filters.caste : [filters.caste];
      must.push({ terms: { caste: castes } });
    }

    // Sub-caste filter
    if (filters.sub_caste) {
      const subCastes = Array.isArray(filters.sub_caste) ? filters.sub_caste : [filters.sub_caste];
      must.push({ terms: { sub_caste: subCastes } });
    }

    // Mother tongue filter
    if (filters.mother_tongue) {
      const tongues = Array.isArray(filters.mother_tongue) ? filters.mother_tongue : [filters.mother_tongue];
      must.push({ terms: { mother_tongue: tongues } });
    }

    // Age range filter
    if (filters.age_from || filters.age_to) {
      const range: any = {};
      if (filters.age_from) range.gte = Number(filters.age_from);
      if (filters.age_to) range.lte = Number(filters.age_to);
      must.push({ range: { age: range } });
    }

    // Profile ID search
    if (filters.profile_id) {
      must.push({ term: { profile_id: (filters.profile_id as string).toUpperCase() } });
    }

    // City filter — uses profile.city (set at registration, Step 5 Location)
    // NOT working_city from education_career
    if (filters.city) {
      const cities = Array.isArray(filters.city) ? filters.city : [filters.city];
      must.push({ terms: { city: cities.map((c: string) => c.toLowerCase()) } });
    }

    // Near me filter — uses profile.city (registration city), NOT working_city
    if (filters.near_me === 'true' || filters.near_me === true) {
      const myProfile = db.profiles?.find((p: any) => p.id === currentUserId);
      const myCity = (myProfile?.city || '').toLowerCase();
      if (myCity) {
        must.push({ term: { city: myCity } });
      }
    }

    // Text search (name, about_me, occupation, etc.)
    if (filters.q) {
      should.push(
        { match: { 'full_name.ngram': { query: filters.q, boost: 3 } } },
        { match: { 'full_name.search': { query: filters.q, boost: 2 } } },
        { match: { about_me: { query: filters.q, boost: 1 } } },
        { match: { 'first_name.search': { query: filters.q, boost: 2 } } },
        { match: { 'last_name.search': { query: filters.q, boost: 2 } } },
      );
      must.push({ bool: { should } });
    }

    // Marital status
    if (filters.marital_status) {
      const statuses = Array.isArray(filters.marital_status) ? filters.marital_status : [filters.marital_status];
      must.push({ terms: { marital_status: statuses } });
    }

    // Religion
    if (filters.religion) {
      must.push({ term: { religion: filters.religion } });
    }

    // Height range
    if (filters.height_from || filters.height_to) {
      const range: any = {};
      if (filters.height_from) range.gte = Number(filters.height_from);
      if (filters.height_to) range.lte = Number(filters.height_to);
      must.push({ range: { height_cm: range } });
    }

    // Occupation
    if (filters.occupation) {
      const occs = Array.isArray(filters.occupation) ? filters.occupation : [filters.occupation];
      must.push({
        nested: {
          path: 'education_career',
          query: { terms: { 'education_career.occupation': occs } },
        },
      });
    }

    // Education
    if (filters.education) {
      const edus = Array.isArray(filters.education) ? filters.education : [filters.education];
      must.push({
        nested: {
          path: 'education_career',
          query: { terms: { 'education_career.highest_education': edus } },
        },
      });
    }

    // Premium filter
    if (filters.is_premium === 'true') {
      must.push({ term: { is_premium: true } });
    }

    // Diet
    if (filters.diet) {
      const diets = Array.isArray(filters.diet) ? filters.diet : [filters.diet];
      must.push({
        nested: {
          path: 'lifestyle',
          query: { terms: { 'lifestyle.diet': diets } },
        },
      });
    }

    // Smoking
    if (filters.smoking) {
      must.push({
        nested: {
          path: 'lifestyle',
          query: { term: { 'lifestyle.smoking': filters.smoking } },
        },
      });
    }

    // Drinking
    if (filters.drinking) {
      must.push({
        nested: {
          path: 'lifestyle',
          query: { term: { 'lifestyle.drinking': filters.drinking } },
        },
      });
    }

    // State
    if (filters.state) {
      const states = Array.isArray(filters.state) ? filters.state : [filters.state];
      must.push({ terms: { state: states } });
    }

    // Family type
    if (filters.family_type) {
      const types = Array.isArray(filters.family_type) ? filters.family_type : [filters.family_type];
      must.push({
        nested: {
          path: 'family',
          query: { terms: { 'family.family_type': types } },
        },
      });
    }

    // Complexion
    if (filters.complexion) {
      const complexions = Array.isArray(filters.complexion) ? filters.complexion : [filters.complexion];
      must.push({ terms: { complexion: complexions } });
    }

    // Body type
    if (filters.body_type) {
      const types = Array.isArray(filters.body_type) ? filters.body_type : [filters.body_type];
      must.push({ terms: { body_type: types } });
    }

    // Manglik
    if (filters.manglik) {
      must.push({ term: { manglik: filters.manglik } });
    }

    // Nakshatra
    if (filters.nakshatra) {
      must.push({ term: { nakshatra: filters.nakshatra } });
    }

    // Raashi
    if (filters.raashi) {
      must.push({ term: { raashi: filters.raashi } });
    }

    // Has photo
    if (filters.has_photo === 'true') {
      must.push({ exists: { field: 'profile_photo_url' } });
    }

    // Verified only
    if (filters.verified_only === 'true') {
      must.push({ term: { is_verified: true } });
    }

    // Sort based on sort_by parameter
    const sort: any[] = [];
    const sortBy = filters.sort_by || 'newest';
    switch (sortBy) {
      case 'newest':
        sort.push({ is_premium: { order: 'desc' } }, { created_at: { order: 'desc' } });
        break;
      case 'oldest':
        sort.push({ is_premium: { order: 'desc' } }, { created_at: { order: 'asc' } });
        break;
      case 'relevance':
        sort.push({ is_premium: { order: 'desc' } }, { profile_completion: { order: 'desc' } });
        break;
      case 'last_active':
        sort.push({ is_premium: { order: 'desc' } }, { updated_at: { order: 'desc' } });
        break;
      default:
        sort.push({ is_premium: { order: 'desc' } }, { created_at: { order: 'desc' } });
    }

    const query = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        must_not: mustNot,
      },
    };

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const from = (page - 1) * limit;

    const result = await client.search({
      index: PROFILES_INDEX,
      query,
      sort,
      from,
      size: limit,
    });

    const totalCount = result.hits.total as any;
    const profiles = result.hits.hits.map((hit: any) => ({
      ...hit._source,
      _score: hit._score,
      _esMatch: true,
    }));

    return { profiles, totalCount: totalCount?.value || 0 };
  } catch (e: any) {
    console.error(`[ES] Search error: ${e.message}`);
    return null; // Caller will use DB fallback
  }
}

// ──────────────────────────────────────────────
// Autocomplete / Suggest
// ──────────────────────────────────────────────

export async function suggestProfiles(query: string, limit: number = 8): Promise<any[]> {
  const client = getESClient();
  if (!client || !esReady || !query) return [];

  try {
    const result = await client.search({
      index: PROFILES_INDEX,
      query: {
        bool: {
          must: [
            { match: { is_verified: true } },
            { match: { is_active: true } },
            {
              bool: {
                should: [
                  { match: { 'full_name.ngram': { query, boost: 3 } } },
                  { match: { 'first_name.ngram': { query, boost: 2 } } },
                  { match: { 'last_name.ngram': { query, boost: 2 } } },
                  { prefix: { profile_id: { value: query.toUpperCase(), boost: 5 } } },
                ],
              },
            },
          ],
          must_not: [{ term: { role: 'admin' } }],
        },
      },
      sort: [{ _score: { order: 'desc' } }, { is_premium: { order: 'desc' } }],
      size: limit,
      _source: ['id', 'profile_id', 'first_name', 'last_name', 'gender', 'profile_photo_url', 'caste', 'city', 'age', 'is_premium'],
    });

    return result.hits.hits.map((hit: any) => hit._source);
  } catch (e: any) {
    console.error(`[ES] Suggest error: ${e.message}`);
    return [];
  }
}
