export interface Profile {
  id: string
  profile_for: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string
  marital_status: string
  religion: string
  caste: string
  sub_caste: string
  gotra: string
  mother_tongue: string
  height_cm: number
  weight_kg: number
  body_type: string
  complexion: string
  physical_disability: boolean
  blood_group: string
  about_me: string
  profile_photo_url: string
  profile_completion: number
  is_verified: boolean
  email_verified: boolean
  phone_verified: boolean
  aadhaar_verified: boolean
  photo_verified: boolean
  verification_status: string
  is_active: boolean
  is_premium: boolean
  premium_plan: string | null
  premium_end: string | null
  role: string
  profile_id: string
  created_at: string
  updated_at: string
  photo_privacy?: string
  phone?: string
  phone_privacy?: string
  free_views_remaining?: number
  paid_credits?: number
  paid_credits_expiry?: string | null
  profile_status?: string
  reactivation_status?: string
  reactivation_count?: number
  reactivation_rejection_remark?: string
  match_confirmed?: boolean
  match_type?: string | null
  match_platform?: string | null
  match_partner_profile_id?: string
  referral_code?: string | null
  referral_used_by?: string | null
  referral_used_date?: string | null
  referral_amount_earned?: number
  referrer_profile_id?: string | null
  referral_discount_amount?: number
  referral_payment_status?: string | null
  referral_payment_date?: string | null
}

export interface User {
  id: string
  email?: string
  role?: string
}

export interface EducationCareer {
  id: string
  user_id: string
  highest_education: string
  education_field: string
  college_name: string
  occupation: string
  company_name: string
  designation: string
  annual_income: string
  working_city: string
  working_state: string
  working_country: string
}

export interface FamilyDetails {
  id: string
  user_id: string
  father_name: string
  father_occupation: string
  mother_name: string
  mother_occupation: string
  num_brothers: number
  brothers_married: number
  num_sisters: number
  sisters_married: number
  family_type: string
  family_status: string
  family_values: string
  native_place: string
  family_city: string
  family_state: string
  family_country: string
  about_family: string
}

export interface Lifestyle {
  id: string
  user_id: string
  diet: string
  smoking: string
  drinking: string
  hobbies: string[]
  interests: string[]
  languages_known: string[]
}

export interface HoroscopeDetails {
  id: string
  user_id: string
  manglik: string
  nakshatra: string
  rashi: string
  birth_time: string
  birth_place: string
}

export interface PartnerPreferences {
  id: string
  user_id: string
  age_from: number
  age_to: number
  height_from_cm: number
  height_to_cm: number
  marital_status_pref: string[]
  religion_pref: string[]
  caste_pref: string[]
  sub_caste_pref?: string[]
  mother_tongue_pref: string[]
  education_pref: string[]
  occupation_pref: string[]
  income_from: string
  income_to: string
  country_pref: string[]
  state_pref: string[]
  diet_pref: string[]
  smoking_pref: string
  drinking_pref: string
  manglik_pref: string
  about_partner: string
}

export interface Photo {
  id: string
  user_id: string
  photo_url: string
  is_profile_photo: boolean
  uploaded_at: string
}

export interface Interest {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  message: string
  created_at: string
  updated_at: string
  sender?: Profile
  receiver?: Profile
}

export interface Shortlist {
  id: string
  user_id: string
  shortlisted_user_id: string
  created_at: string
  shortlisted_user?: Profile
}

export interface ProfileView {
  id: string
  viewer_id: string
  viewed_id: string
  viewed_at: string
  viewer?: Profile
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  reference_id: string
  is_read: boolean
  created_at: string
}

export interface BlockReport {
  id: string
  reporter_id: string
  reported_id: string
  type: string
  reason: string
  status: string
  created_at: string
}

export interface SuccessStory {
  id: string
  user_id: string
  partner_name: string
  story_text: string
  photo_url: string
  is_approved: boolean
  created_at: string
  user?: Profile
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  is_resolved: boolean
  created_at: string
}

export interface CompleteProfile extends Profile {
  profile?: Profile
  education?: EducationCareer
  education_career?: EducationCareer
  family?: FamilyDetails
  family_details?: FamilyDetails
  lifestyle?: Lifestyle
  horoscope?: HoroscopeDetails
  horoscope_details?: HoroscopeDetails
  preferences?: PartnerPreferences
  partner_preferences?: PartnerPreferences
  photos?: Photo[]
}

export interface VerificationDocument {
  id: string
  user_id: string
  document_type: 'aadhaar_front' | 'aadhaar_back' | 'biodata'
  file_url: string
  file_name: string
  file_type: string
  uploaded_at: string
  verification_status: 'pending' | 'approved' | 'rejected'
  admin_notes: string
  reviewed_by: string
  reviewed_at: string
}
