export const DEFAULT_MALE_AVATAR = 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
export const DEFAULT_FEMALE_AVATAR = 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'

export function getDefaultAvatar(gender: string): string {
  if (gender === 'Female') return DEFAULT_FEMALE_AVATAR
  return DEFAULT_MALE_AVATAR
}

export const profileForOptions = ['Self', 'Son', 'Daughter', 'Brother', 'Sister', 'Friend', 'Relative'];
export const genderOptions = ['Male', 'Female'];
export const maritalStatusOptions = ['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'];
export const religionOptions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Other'];

export const castesByReligion: Record<string, string[]> = {
  Hindu: ['Brahmin', 'Kshatriya', 'Vaishya', 'Kayastha', 'Rajput', 'Maratha', 'Jat', 'Patel', 'Yadav', 'Gupta', 'Agarwal', 'Baniya', 'Nair', 'Reddy', 'Naidu', 'Iyer', 'Iyengar', 'Sharma', 'Verma', 'Other'],
  Muslim: ['Sunni', 'Shia', 'Pathan', 'Syed', 'Sheikh', 'Ansari', 'Qureshi', 'Other'],
  Christian: ['Catholic', 'Protestant', 'Orthodox', 'Born Again', 'Other'],
  Sikh: ['Jat', 'Khatri', 'Arora', 'Ramgharia', 'Saini', 'Other'],
  Buddhist: ['Mahayana', 'Theravada', 'Vajrayana', 'Other'],
  Jain: ['Digambar', 'Shwetambar', 'Other'],
  Parsi: ['Parsi', 'Irani', 'Other'],
  Other: ['Other']
};

export const motherTongueOptions = ['Hindi', 'English', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Maithili', 'Sindhi', 'Konkani', 'Dogri', 'Kashmiri', 'Sanskrit', 'Other'];

export const heightOptions = Array.from({ length: 37 }, (_, i) => {
  const totalInches = 48 + i; // 4'0" is 48 inches
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return { label: `${feet}' ${inches}" (${cm} cm)`, value: cm };
});

export const educationOptions = ['Below 10th', '10th', '12th', 'Diploma', 'Bachelors', 'Masters (MBA/MS/MA)', 'PhD/Doctorate', 'B.Tech/B.E', 'MBBS/BDS', 'BCA/MCA', 'B.Com/M.Com', 'BA/MA', 'BSc/MSc', 'LLB/LLM', 'CA/CS/ICWA', 'B.Pharm/M.Pharm', 'BBA/MBA', 'Other'];
export const occupationOptions = ['Private Job', 'Government Job', 'Business/Self Employed', 'Doctor', 'Engineer', 'Software Professional', 'Teacher/Professor', 'Lawyer/Legal', 'CA/CS', 'Banking/Finance', 'Civil Services (IAS/IPS)', 'Defence/Armed Forces', 'Scientist/Researcher', 'Architect', 'Pilot', 'Farmer/Agriculture', 'Media/Journalism', 'Artist/Designer', 'Not Working', 'Student', 'Other'];
export const incomeOptions = ['Not Specified', 'Below 2 LPA', '2-4 LPA', '4-6 LPA', '6-8 LPA', '8-10 LPA', '10-15 LPA', '15-20 LPA', '20-30 LPA', '30-50 LPA', '50-75 LPA', '75 LPA - 1 Cr', '1 Cr+'];
export const bodyTypeOptions = ['Slim', 'Average', 'Athletic', 'Heavy'];
export const complexionOptions = ['Very Fair', 'Fair', 'Wheatish', 'Wheatish Brown', 'Dark'];
export const dietOptions = ['Vegetarian', 'Non-Vegetarian', 'Eggetarian', 'Jain', 'Vegan'];
export const smokingDrinkingOptions = ['No', 'Occasionally', 'Yes'];
export const familyTypeOptions = ['Joint', 'Nuclear', 'Other'];
export const familyStatusOptions = ['Middle Class', 'Upper Middle Class', 'Rich', 'Affluent'];
export const familyValuesOptions = ['Orthodox', 'Moderate', 'Liberal'];
export const manglikOptions = ['Yes', 'No', 'Not Sure', 'Not Applicable'];
export const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not Known'];

export const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const hobbiesList = ['Reading', 'Cooking', 'Traveling', 'Photography', 'Music', 'Dancing', 'Painting/Drawing', 'Gaming', 'Yoga/Meditation', 'Gym/Fitness', 'Gardening', 'Writing/Blogging', 'Movies/TV', 'Sports', 'Social Media', 'Volunteering', 'Crafts/DIY', 'Singing', 'Playing Instruments', 'Swimming'];

export const rashiOptions = ['Mesh', 'Vrishabh', 'Mithun', 'Kark', 'Singh', 'Kanya', 'Tula', 'Vrishchik', 'Dhanu', 'Makar', 'Kumbh', 'Meen'];

export const nakshatraOptions = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];
