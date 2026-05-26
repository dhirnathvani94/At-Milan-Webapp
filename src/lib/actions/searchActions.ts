import { apiUrl } from '../api'

export async function searchProfiles(filters: any, currentUserId: string) {
  try {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        if (Array.isArray(filters[key])) {
          if (filters[key].length > 0) {
            filters[key].forEach((val: string) => params.append(key, val));
          }
        } else {
          params.append(key, filters[key]);
        }
      }
    });

    const url = apiUrl(`/api/search?${params.toString()}`);
    console.log('[Search] Fetching:', url);
    const response = await fetch(url, {
      headers: { 'x-user-id': currentUserId }
    });
    if (!response.ok) {
      console.error('[Search] Failed with status:', response.status, response.statusText);
      return { profiles: [], totalCount: 0 };
    }
    const data = await response.json();
    console.log('[Search] Results:', data.totalCount, 'profiles');
    return data;
  } catch (error) {
    console.error('[Search] Error:', error)
    return { profiles: [], totalCount: 0 };
  }
}

export async function loadAllProfiles(currentUserId: string, page: number = 1, limit: number = 12) {
  return searchProfiles({ page, limit }, currentUserId);
}

export async function getRecommendations(currentUserId: string, limit: number = 4) {
  try {
    const response = await fetch(apiUrl(`/api/recommendations?userId=${currentUserId}&limit=${limit}`));
    if (!response.ok) throw new Error('Failed to fetch recommendations');
    return await response.json();
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}

export async function getNewMembers(currentUserId: string, limit: number = 4) {
  try {
    const response = await fetch(apiUrl(`/api/new-members?userId=${currentUserId}&limit=${limit}`));
    if (!response.ok) throw new Error('Failed to fetch new members');
    return await response.json();
  } catch (error) {
    console.error('Error getting new members:', error);
    return [];
  }
}
