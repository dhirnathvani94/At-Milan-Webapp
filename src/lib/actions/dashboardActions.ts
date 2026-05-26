import { apiUrl } from '../api'

// Get dashboard statistics
export async function getDashboardStats(userId: string) {
  try {
    const response = await fetch(apiUrl(`/api/dashboard/stats/${userId}?t=${Date.now()}`));
    if (!response.ok) throw new Error('Failed to fetch dashboard stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return { interestsReceived: 0, interestsSent: 0, profileViews: 0, shortlistedBy: 0 }
  }
}

// Get recent profile viewers
export async function getRecentViewers(userId: string, limit: number = 5) {
  try {
    const response = await fetch(apiUrl(`/api/profile-views/${userId}?t=${Date.now()}`));
    if (!response.ok) throw new Error('Failed to fetch viewers');
    const data = await response.json();
    return data.slice(0, limit);
  } catch (error) {
    console.error('Error fetching viewers:', error)
    return []
  }
}

// Record profile view
export async function recordProfileView(viewerId: string, viewedId: string) {
  if (viewerId === viewedId) return // Don't record self views
  await fetch(apiUrl('/api/profile-views'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewerId, viewedId })
  });
}

// Get complete profile for viewing (with all related data)
export async function getProfileForViewing(profileId: string, currentUserId?: string) {
  const headers: Record<string, string> = {};
  if (currentUserId) headers['x-user-id'] = currentUserId;
  const response = await fetch(apiUrl(`/api/profiles/${profileId}/complete`), { headers });
  if (!response.ok) throw new Error('Failed to fetch profile');
  const data = await response.json();
  return {
    ...data.profile,
    education_career: data.education,
    family_details: data.family,
    lifestyle: data.lifestyle,
    horoscope_details: data.horoscope,
    partner_preferences: data.preferences,
    photos: data.photos
  };
}

// Check interest status between two users
export async function checkInterestStatus(userId: string, otherUserId: string) {
  try {
    const response = await fetch(apiUrl(`/api/interests/status/${userId}/${otherUserId}?t=${Date.now()}`));
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching interest status:', error);
  }
  return null;
}

// Get shortlisted profiles
export async function getShortlistedProfiles(userId: string) {
  try {
    const response = await fetch(apiUrl(`/api/shortlists/${userId}?t=${Date.now()}`));
    if (!response.ok) throw new Error('Failed to fetch shortlist');
    const data = await response.json();
    return data.map((item: any) => item.shortlisted_user).filter(Boolean);
  } catch (error) {
    console.error('Error fetching shortlist:', error)
    return []
  }
}

// Toggle shortlist
export async function toggleShortlist(userId: string, targetId: string) {
  const response = await fetch(apiUrl('/api/shortlists/toggle'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, targetId })
  });
  if (!response.ok) throw new Error('Failed to toggle shortlist');
  const data = await response.json();
  return data.shortlisted;
}

// Check if shortlisted
export async function isShortlisted(userId: string, targetId: string) {
  const response = await fetch(apiUrl(`/api/shortlists/${userId}/${targetId}`));
  if (!response.ok) return false;
  const data = await response.json();
  return data.shortlisted;
}

// Get similar profiles
export async function getSimilarProfiles(profileId: string, gender: string, limit: number = 5) {
  try {
    const response = await fetch(apiUrl(`/api/search?looking_for=${gender}&limit=${limit}`));
    if (!response.ok) throw new Error('Failed to fetch similar profiles');
    const data = await response.json();
    return data.profiles.filter((p: any) => p.id !== profileId).slice(0, limit);
  } catch (error) {
    console.error('Error fetching similar profiles:', error)
    return []
  }
}

// Block user
export async function blockUser(blockerId: string, blockedId: string) {
  try {
    const response = await fetch(apiUrl('/api/users/block'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId })
    });
    if (!response.ok) throw new Error('Failed to block user');
    return await response.json();
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

// Get blocked users
export async function getBlockedUsers(userId: string) {
  try {
    const response = await fetch(apiUrl(`/api/users/${userId}/blocked`));
    if (!response.ok) throw new Error('Failed to fetch blocked users');
    return await response.json();
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return [];
  }
}

// Unblock user
export async function unblockUser(blockerId: string, blockedId: string) {
  try {
    const response = await fetch(apiUrl('/api/users/unblock'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId })
    });
    if (!response.ok) throw new Error('Failed to unblock user');
    return await response.json();
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

// Report user (with radio reason + note + optional source page)
export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: string,
  note: string,
  sourcePage: 'profile' | 'messages' = 'profile'
) {
  try {
    const response = await fetch(apiUrl('/api/users/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason,
        note,
        source_page: sourcePage
      })
    });
    if (!response.ok) throw new Error('Failed to report user');
    return await response.json();
  } catch (error) {
    console.error('Error reporting user:', error);
    throw error;
  }
}
