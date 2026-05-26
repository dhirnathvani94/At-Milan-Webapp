-- Single community name (not a table — stored in admin_settings)
-- admin_settings key: 'community_name' = 'Patel' (or whatever community)

-- ==============================================================================
-- PART A — Master Data Tables 
-- ==============================================================================

CREATE TABLE master_castes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE master_sub_castes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caste_id UUID REFERENCES master_castes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(caste_id, name)
);

CREATE TABLE master_gotras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caste_id UUID REFERENCES master_castes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE master_nakshatras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_raashis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_heights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, -- "4'10\" / 147cm"
  cm_value INTEGER NOT NULL, -- 147
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, -- "50 kg"
  kg_value INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_body_types (
  id TEXT PRIMARY KEY, -- slim/athletic/average/heavy_set
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_complexions (
  id TEXT PRIMARY KEY, -- fair/wheatish/dusky/dark
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_blood_groups (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_marital_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_disabilities (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_education_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city_id UUID, -- Will references master_cities
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, -- "5-10 LPA"
  min_value INTEGER,
  max_value INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT, -- IN, US, GB, CA
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES master_countries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(country_id, name)
);

CREATE TABLE master_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID REFERENCES master_states(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Add foreign key back to colleges now that cities is created
ALTER TABLE master_colleges ADD CONSTRAINT fk_colleges_city FOREIGN KEY (city_id) REFERENCES master_cities(id);

CREATE TABLE master_residency_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_family_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_family_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_family_values (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_diets (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_habits (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'smoking' or 'drinking'
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE master_hobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- ==============================================================================
-- PART B — Application Tables 
-- ==============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id TEXT UNIQUE,
  profile_for TEXT, -- self/son/daughter/brother/sister/friend
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT, -- male/female
  date_of_birth DATE,
  age INTEGER,
  
  -- Physical
  marital_status_id TEXT REFERENCES master_marital_statuses(id),
  blood_group_id TEXT REFERENCES master_blood_groups(id),
  height_id UUID REFERENCES master_heights(id),
  weight_id UUID REFERENCES master_weights(id),
  body_type_id TEXT REFERENCES master_body_types(id),
  complexion_id TEXT REFERENCES master_complexions(id),
  disability_id TEXT REFERENCES master_disabilities(id),
  
  -- Community
  caste_id UUID REFERENCES master_castes(id),
  sub_caste_id UUID REFERENCES master_sub_castes(id),
  gotra_id UUID REFERENCES master_gotras(id),
  nakshatra_id UUID REFERENCES master_nakshatras(id),
  raashi_id UUID REFERENCES master_raashis(id),
  manglik TEXT, -- yes/no/anshik
  horoscope_url TEXT,
  
  -- Education & Career
  education_level_id UUID REFERENCES master_education_levels(id),
  specialization_id UUID REFERENCES master_specializations(id),
  college_id UUID REFERENCES master_colleges(id),
  occupation_id UUID REFERENCES master_occupations(id),
  company_name TEXT,
  annual_income_id UUID REFERENCES master_incomes(id),
  working_country_id UUID REFERENCES master_countries(id),
  working_state_id UUID REFERENCES master_states(id),
  working_city_id UUID REFERENCES master_cities(id),
  
  -- Location
  country_id UUID REFERENCES master_countries(id),
  state_id UUID REFERENCES master_states(id),
  city_id UUID REFERENCES master_cities(id),
  native_place TEXT,
  residency_status_id TEXT REFERENCES master_residency_statuses(id),
  willing_to_relocate TEXT, -- yes/no/maybe
  
  -- Family
  father_name TEXT,
  father_occupation_id UUID REFERENCES master_occupations(id),
  mother_name TEXT,
  mother_occupation_id UUID REFERENCES master_occupations(id),
  brothers_count INTEGER DEFAULT 0,
  brothers_married INTEGER DEFAULT 0,
  sisters_count INTEGER DEFAULT 0,
  sisters_married INTEGER DEFAULT 0,
  family_type_id TEXT REFERENCES master_family_types(id),
  family_status_id TEXT REFERENCES master_family_statuses(id),
  family_values_id TEXT REFERENCES master_family_values(id),
  family_income_id UUID REFERENCES master_incomes(id),
  
  -- Lifestyle
  diet_id TEXT REFERENCES master_diets(id),
  smoking_id TEXT REFERENCES master_habits(id),
  drinking_id TEXT REFERENCES master_habits(id),
  hobby_ids UUID[], 
  language_ids UUID[], 
  mother_tongue_id UUID REFERENCES master_languages(id),
  about_me TEXT, 
  
  -- Media
  profile_photo_url TEXT,
  gallery_photos TEXT[],
  photo_privacy TEXT DEFAULT 'all',
  biodata_url TEXT,
  
  -- KYC Documents
  aadhaar_front_url TEXT,
  aadhaar_back_url TEXT,
  pan_url TEXT,
  passport_url TEXT,
  
  -- Verification
  verification_status TEXT DEFAULT 'pending',
  verification_note TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  photo_verified BOOLEAN DEFAULT FALSE,
  profile_completeness INTEGER DEFAULT 0,
  
  -- Premium
  is_premium BOOLEAN DEFAULT FALSE,
  premium_plan TEXT, 
  premium_start TIMESTAMPTZ,
  premium_end TIMESTAMPTZ,
  premium_auto_renew BOOLEAN DEFAULT TRUE,
  
  -- Status
  profile_visibility TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_type TEXT,
  block_until TIMESTAMPTZ,
  violation_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  last_active TIMESTAMPTZ DEFAULT now(),
  activity_score INTEGER DEFAULT 0,
  login_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE partner_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  min_age INTEGER,
  max_age INTEGER,
  min_height_id UUID REFERENCES master_heights(id),
  max_height_id UUID REFERENCES master_heights(id),
  preferred_marital TEXT[], 
  preferred_caste_ids UUID[],
  preferred_sub_caste_ids UUID[],
  preferred_education_ids UUID[],
  preferred_occupation_ids UUID[],
  preferred_city_ids UUID[],
  preferred_income_id UUID REFERENCES master_incomes(id),
  manglik_preference TEXT,
  preferred_diet_ids TEXT[],
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  free_monthly_limit INTEGER DEFAULT 10,
  free_views_remaining INTEGER DEFAULT 10,
  free_views_reset_date DATE,
  paid_views_balance INTEGER DEFAULT 0,
  paid_credits_expiry TIMESTAMPTZ,
  paid_credits_purchased INTEGER DEFAULT 0,
  total_unlocks_done INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount_credits INTEGER NOT NULL,
  balance_after INTEGER,
  deduct_reason TEXT,
  related_profile_id UUID,
  plan_id UUID,
  payment_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', 
  
  contact_unlock_expiry TIMESTAMPTZ, 
  contact_unlock_by UUID, 
  contact_unlock_count INTEGER DEFAULT 0, 
  last_unlock_date TIMESTAMPTZ,
  
  sent_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id != receiver_id)
);

CREATE OR REPLACE VIEW interest_contact_status AS
SELECT 
  id, sender_id, receiver_id, status, contact_unlock_expiry, contact_unlock_count, last_unlock_date,
  CASE WHEN contact_unlock_expiry IS NOT NULL AND contact_unlock_expiry > now() THEN TRUE ELSE FALSE END AS is_contact_active,
  CASE WHEN contact_unlock_expiry IS NOT NULL AND contact_unlock_expiry > now() 
       THEN EXTRACT(EPOCH FROM (contact_unlock_expiry - now()))::INTEGER ELSE 0 END AS seconds_remaining
FROM interests;

CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- PART C — Triggers and Functions 
-- ==============================================================================

CREATE SEQUENCE profile_id_seq START 1;
CREATE OR REPLACE FUNCTION generate_profile_id() RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_id := 'SM-' || LPAD(nextval('profile_id_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profile_id
  BEFORE INSERT ON users
  FOR EACH ROW WHEN (NEW.profile_id IS NULL)
  EXECUTE FUNCTION generate_profile_id();

CREATE OR REPLACE FUNCTION create_user_credits() RETURNS TRIGGER AS $$
DECLARE free_limit INTEGER;
BEGIN
  -- Fallback to 10 if setting missing
  free_limit := 10;
  INSERT INTO credits (user_id, free_monthly_limit, free_views_remaining, free_views_reset_date)
  VALUES (NEW.id, free_limit, free_limit, (date_trunc('month', now()) + INTERVAL '1 month')::DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_credits
  AFTER INSERT ON users 
  FOR EACH ROW EXECUTE FUNCTION create_user_credits();

-- ==============================================================================
-- PART D — Default Data Inserts 
-- ==============================================================================

INSERT INTO admin_settings (key, value, description) VALUES
  ('community_name', 'Your Community', 'Single community name for this app'),
  ('free_monthly_views', '10', 'Free contact unlocks/month'),
  ('premium_multiplier', '5', 'Premium 5x monthly free credits'),
  ('paid_credits_validity_months', '3', 'Months before paid credits expire'),
  ('contact_unlock_duration_hours', '24', 'Hours contact details remain visible after unlock');

-- Insert Marital Statuses
INSERT INTO master_marital_statuses (id, label) VALUES
  ('never_married', 'Never Married'),
  ('divorced', 'Divorced'),
  ('widowed', 'Widowed'),
  ('separated', 'Separated');

-- Insert Blood Groups
INSERT INTO master_blood_groups (id, label) VALUES
  ('a_pos', 'A+'), ('a_neg', 'A-'), ('b_pos', 'B+'), ('b_neg', 'B-'),
  ('o_pos', 'O+'), ('o_neg', 'O-'), ('ab_pos', 'AB+'), ('ab_neg', 'AB-'), ('unknown', 'Unknown');

-- ==============================================================================
-- PART F — Enable Realtime 
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE interests, credits;
