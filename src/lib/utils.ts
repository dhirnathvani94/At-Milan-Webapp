import { formatDistanceToNow, format } from 'date-fns'

export function calculateAge(dateOfBirth: string): number {
  const today = new Date()
  const birth = new Date(dateOfBirth)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function formatHeight(cm: number): string {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}"`
}

export function getInitials(firstName: string, lastName: string): string {
  return `${(firstName?.[0] || '').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`
}

export function getRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return format(d, 'dd MMM yyyy');
  } catch (e) {
    return 'Invalid Date';
  }
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function calculateMatchPercentage(myProfile: any, otherProfile: any): number {
  if (!myProfile || !otherProfile) return 0

  const prefs = myProfile.partner_preferences || myProfile.preferences
  if (!prefs) return 0 // No preferences set, can't calculate

  let totalWeight = 0
  let earnedScore = 0

  // Helper: check if value is in a preference array (or pref is empty = "Doesn't matter")
  const matchesList = (prefList: string[] | undefined, value: string | undefined): boolean => {
    if (!prefList || prefList.length === 0) return true // No preference = accepts all
    if (!value) return false
    return prefList.some(p => p.toLowerCase() === value.toLowerCase())
  }

  // 1. Age range (weight: 15)
  const ageWeight = 15
  totalWeight += ageWeight
  if (otherProfile.date_of_birth) {
    const otherAge = calculateAge(otherProfile.date_of_birth)
    const ageFrom = Number(prefs.age_from) || 18
    const ageTo = Number(prefs.age_to) || 60
    if (otherAge >= ageFrom && otherAge <= ageTo) {
      earnedScore += ageWeight
    } else {
      // Partial credit if within 3 years of range
      const offBy = Math.min(
        Math.abs(otherAge - ageFrom),
        Math.abs(otherAge - ageTo)
      )
      if (offBy <= 3) earnedScore += ageWeight * 0.5
    }
  }

  // 2. Height range (weight: 10)
  const heightWeight = 10
  totalWeight += heightWeight
  if (otherProfile.height_cm) {
    const hFrom = Number(prefs.height_from_cm) || 0
    const hTo = Number(prefs.height_to_cm) || 999
    if (hFrom === 0 && hTo >= 200) {
      earnedScore += heightWeight // No pref set = match
    } else if (otherProfile.height_cm >= hFrom && otherProfile.height_cm <= hTo) {
      earnedScore += heightWeight
    }
  }

  // 3. Religion (weight: 15)
  const relWeight = 15
  totalWeight += relWeight
  if (matchesList(prefs.religion_pref, otherProfile.religion)) {
    earnedScore += relWeight
  }

  // 4. Caste (weight: 12)
  const casteWeight = 12
  totalWeight += casteWeight
  if (matchesList(prefs.caste_pref, otherProfile.caste)) {
    earnedScore += casteWeight
  }

  // 5. Mother tongue (weight: 8)
  const mtWeight = 8
  totalWeight += mtWeight
  if (matchesList(prefs.mother_tongue_pref, otherProfile.mother_tongue)) {
    earnedScore += mtWeight
  }

  // 6. Education (weight: 10)
  const eduWeight = 10
  totalWeight += eduWeight
  const otherEdu = otherProfile.education_career?.[0]?.highest_education || otherProfile.education_career?.highest_education
  if (matchesList(prefs.education_pref, otherEdu)) {
    earnedScore += eduWeight
  }

  // 7. Occupation (weight: 8)
  const occWeight = 8
  totalWeight += occWeight
  const otherOcc = otherProfile.education_career?.[0]?.occupation || otherProfile.education_career?.occupation
  if (matchesList(prefs.occupation_pref, otherOcc)) {
    earnedScore += occWeight
  }

  // 8. State/Location (weight: 8)
  const stateWeight = 8
  totalWeight += stateWeight
  const otherState = otherProfile.education_career?.[0]?.working_state || otherProfile.education_career?.working_state
  if (matchesList(prefs.state_pref, otherState)) {
    earnedScore += stateWeight
  }

  // 9. Marital status (weight: 7)
  const msWeight = 7
  totalWeight += msWeight
  if (matchesList(prefs.marital_status_pref, otherProfile.marital_status)) {
    earnedScore += msWeight
  }

  // 10. Diet (weight: 5)
  const dietWeight = 5
  totalWeight += dietWeight
  const otherDiet = otherProfile.lifestyle?.diet || otherProfile.diet
  if (matchesList(prefs.diet_pref, otherDiet)) {
    earnedScore += dietWeight
  }

  // 11. Manglik (weight: 2)
  const mangWeight = 2
  totalWeight += mangWeight
  const mangPref = prefs.manglik_pref
  if (!mangPref || mangPref === "Doesn't Matter") {
    earnedScore += mangWeight
  } else {
    const otherManglik = otherProfile.horoscope_details?.manglik || otherProfile.manglik
    if (otherManglik && otherManglik.toLowerCase() === mangPref.toLowerCase()) {
      earnedScore += mangWeight
    }
  }

  if (totalWeight === 0) return 0
  const percentage = Math.round((earnedScore / totalWeight) * 100)
  return Math.min(percentage, 99) // Cap at 99%
}
