import { apiUrl } from '../api'

// Fetch complete profile with all related data
export async function getCompleteProfile(userId: string, currentUserId?: string) {
  try {
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
    };
    if (currentUserId) headers['x-user-id'] = currentUserId;
    // Append timestamp to bust any browser/CDN cache
    const url = apiUrl(`/api/profiles/${userId}/complete?_t=${Date.now()}`);
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) {
      console.error('[Profile] Fetch failed:', response.status, response.statusText);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('[Profile] Error fetching complete profile:', error)
    return null;
  }
}

// Save personal details (Step 1)
export async function savePersonalDetails(userId: string, data: Record<string, any>) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/personal`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to save personal details')
}

// Save education & career (Step 2)
export async function saveEducationCareer(userId: string, data: Record<string, any>) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/education`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to save education & career')
}

// Save family details (Step 3)
export async function saveFamilyDetails(userId: string, data: Record<string, any>) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/family`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to save family details')
  await updateProfileCompletion(userId)
}

// Save lifestyle & horoscope (Step 4)
export async function saveLifestyle(
  userId: string,
  lifestyleData: Record<string, any>,
  horoscopeData: Record<string, any>
) {
  const lifestyleRes = await fetch(apiUrl(`/api/profiles/${userId}/lifestyle`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lifestyleData)
  })
  if (!lifestyleRes.ok) throw new Error('Failed to save lifestyle details')

  const horoscopeRes = await fetch(apiUrl(`/api/profiles/${userId}/horoscope`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(horoscopeData)
  })
  if (!horoscopeRes.ok) throw new Error('Failed to save horoscope details')

  await updateProfileCompletion(userId)
}

// Save partner preferences (Step 6)
export async function savePartnerPreferences(userId: string, data: Record<string, any>) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/preferences`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('Failed to save partner preferences')
  await updateProfileCompletion(userId)
}

// Fetch user photos
export async function getUserPhotos(userId: string) {
  try {
    const response = await fetch(apiUrl(`/api/profiles/${userId}/photos`));
    if (!response.ok) throw new Error('Failed to fetch photos');
    return await response.json();
  } catch (error) {
    console.error('Error fetching user photos:', error)
    throw error
  }
}

// Upload profile photo
export async function uploadProfilePhoto(userId: string, file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('isProfilePhoto', 'true');

    const response = await fetch(apiUrl('/api/upload/photo'), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload photo');
    }

    const data = await response.json();
    await updateProfileCompletion(userId)
    return data.photoUrl;
  } catch (error) {
    console.error('Error uploading profile photo:', error)
    throw error
  }
}

// Upload additional photo
export async function uploadAdditionalPhoto(userId: string, file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('isProfilePhoto', 'false');

    const response = await fetch(apiUrl('/api/upload/photo'), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload photo');
    }

    const data = await response.json();
    await updateProfileCompletion(userId)
    return { url: data.photoUrl, photo: { id: Date.now(), photo_url: data.photoUrl, is_profile_photo: false } }
  } catch (error) {
    console.error('Error uploading additional photo:', error)
    throw error
  }
}

// Delete a photo
export async function deletePhoto(photoId: string) {
  const response = await fetch(apiUrl(`/api/photos/${photoId}`), {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('Failed to delete photo')
}

// Set an additional photo as the profile photo
export async function setAsProfilePhoto(userId: string, photoId: string, photoUrl: string) {
  try {
    const response = await fetch(apiUrl(`/api/profiles/${userId}/photos/${photoId}/set-profile`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoUrl })
    })
    if (!response.ok) throw new Error('Failed to set profile photo')
  } catch (error) {
    console.error('Error setting profile photo:', error)
    throw error
  }
}

// Calculate and update profile completion percentage
export async function updateProfileCompletion(userId: string) {
  try {
    const data = await getCompleteProfile(userId)
    if (!data) return;
    const { profile, education, family, lifestyle, horoscope, preferences } = data
    
    let filled = 0
    let total = 0

    const profileChecks = [
      profile?.marital_status,
      profile?.religion,
      profile?.caste,
      profile?.mother_tongue,
      profile?.height_cm,
      profile?.body_type,
      profile?.about_me
    ]
    profileChecks.forEach(val => {
      total++
      if (val) filled++
    })

    const eduChecks = [
      education?.highest_education,
      education?.occupation,
      education?.annual_income
    ]
    eduChecks.forEach(val => {
      total++
      if (val) filled++
    })

    const famChecks = [
      family?.father_name,
      family?.mother_name,
      family?.family_type
    ]
    famChecks.forEach(val => {
      total++
      if (val) filled++
    })

    total++
    if (lifestyle?.diet) filled++
    total++
    if (lifestyle?.hobbies && lifestyle.hobbies.length > 0) filled++

    total++
    if (profile?.profile_photo_url) filled++

    total++
    if (preferences?.age_from && preferences?.age_to) filled++
    total++
    if (preferences?.religion_pref && preferences.religion_pref.length > 0) filled++

    const percentage = total > 0 ? Math.min(Math.round((filled / total) * 100), 100) : 10
    const finalPercentage = Math.max(percentage, 10)

    await fetch(apiUrl(`/api/profiles/${userId}/personal`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_completion: finalPercentage })
    })

    return finalPercentage
  } catch (error) {
    console.error('Error updating profile completion:', error)
    return 10
  }
}
