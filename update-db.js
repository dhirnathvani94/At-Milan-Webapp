import fs from 'fs';

const db = JSON.parse(fs.readFileSync('database.json', 'utf-8'));
const userId = 'test-girl-user';

// 1. Verify profile and add biodata
const profile = db.profiles.find(p => p.id === userId);
if (profile) {
  profile.is_verified = true;
  profile.biodata_url = '/uploads/sample-biodata.pdf';
  profile.about_me = 'I am a vibrant and caring person with a passion for life. I believe in maintaining a healthy balance between my professional ambitions and personal life.';
  profile.weight_kg = 55;
  profile.body_type = 'Slim';
  profile.complexion = 'Fair';
  profile.blood_group = 'O+';
}

// 2. Education & Career
if (!db.education_career) db.education_career = [];
let edu = db.education_career.find(e => e.user_id === userId);
if (!edu) {
  edu = { user_id: userId };
  db.education_career.push(edu);
}
Object.assign(edu, {
  highest_education: "Master's Degree",
  education_field: 'Computer Science',
  college_name: 'IIT Bombay',
  occupation: 'Software Engineer',
  company_name: 'Google',
  designation: 'Senior Developer',
  annual_income: '20-30 Lakhs',
  working_city: 'Bangalore',
  working_state: 'Karnataka',
  working_country: 'India'
});

// 3. Family
if (!db.family_details) db.family_details = [];
let fam = db.family_details.find(f => f.user_id === userId);
if (!fam) {
  fam = { user_id: userId };
  db.family_details.push(fam);
}
Object.assign(fam, {
  father_name: 'Rajesh Patel',
  father_occupation: 'Business',
  mother_name: 'Meena Patel',
  mother_occupation: 'Homemaker',
  num_brothers: 1,
  brothers_married: 0,
  num_sisters: 1,
  sisters_married: 1,
  family_type: 'Nuclear',
  family_status: 'Upper Middle Class',
  native_place: 'Ahmedabad',
  family_city: 'Mumbai',
  family_state: 'Maharashtra',
  about_family: 'Ours is a close-knit, modern yet culturally grounded family.'
});

// 4. Lifestyle
if (!db.lifestyle) db.lifestyle = [];
let life = db.lifestyle.find(l => l.user_id === userId);
if (!life) {
  life = { user_id: userId };
  db.lifestyle.push(life);
}
Object.assign(life, {
  diet: 'Vegetarian',
  smoking: 'No',
  drinking: 'No',
  hobbies: ['Reading', 'Traveling', 'Cooking'],
  languages_known: ['English', 'Hindi', 'Gujarati']
});

// 5. Horoscope
if (!db.horoscope_details) db.horoscope_details = [];
let horo = db.horoscope_details.find(h => h.user_id === userId);
if (!horo) {
  horo = { user_id: userId };
  db.horoscope_details.push(horo);
}
Object.assign(horo, {
  manglik: 'No',
  rashi: 'Aries',
  nakshatra: 'Ashwini',
  birth_time: '10:30 AM',
  birth_place: 'Ahmedabad'
});

// 6. Preferences
if (!db.partner_preferences) db.partner_preferences = [];
let prefs = db.partner_preferences.find(p => p.user_id === userId);
if (!prefs) {
  prefs = { user_id: userId };
  db.partner_preferences.push(prefs);
}
Object.assign(prefs, {
  age_from: 26,
  age_to: 32,
  height_from_cm: 165,
  height_to_cm: 185,
  smoking_pref: 'No',
  drinking_pref: 'No',
  manglik_pref: 'No',
  caste_pref: ['Patel', 'Lohana'],
  about_partner: 'Looking for a supportive, well-educated partner who values family.'
});

fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
console.log('Database updated successfully.');
