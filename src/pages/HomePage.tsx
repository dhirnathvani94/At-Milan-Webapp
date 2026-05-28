import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useMasterData } from '../store/masterDataStore';
import { registerUser } from '../lib/actions/authActions';
import toast from 'react-hot-toast';
import { State, City } from 'country-state-city';
import {
  ShieldCheck, Users, Heart, MessageCircle, Filter, Lock,
  Search, CheckCircle2, Star, ChevronRight, UserPlus
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { calculateAge } from '../lib/utils';
import { useSocketStore } from '../store/socketStore';
import { apiUrl } from '../lib/api';

export const DUMMY_PROFILES = [
  {
    name: 'Rahul M.',
    age: 28,
    city: 'Ahmedabad',
    education: 'M.Tech',
    occupation: 'Software Engineer',
    is_premium: true,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop'
  },
  {
    name: 'Priya K.',
    age: 26,
    city: 'Surat',
    education: 'MBA',
    occupation: 'Marketing Manager',
    is_premium: false,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'
  },
  {
    name: 'Amit V.',
    age: 30,
    city: 'Mumbai',
    education: 'B.E.',
    occupation: 'Business Analyst',
    is_premium: true,
    last_active: false,
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'
  },
  {
    name: 'Neha S.',
    age: 27,
    city: 'Pune',
    education: 'M.Sc',
    occupation: 'College Professor',
    is_premium: false,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop'
  },
  {
    name: 'Karan J.',
    age: 29,
    city: 'Delhi',
    education: 'CA',
    occupation: 'Finance Manager',
    is_premium: true,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop'
  },
  {
    name: 'Anjali R.',
    age: 25,
    city: 'Bangalore',
    education: 'B.Tech',
    occupation: 'Product Designer',
    is_premium: false,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop'
  },
  {
    name: 'Vikram S.',
    age: 31,
    city: 'Chennai',
    education: 'MD',
    occupation: 'Doctor',
    is_premium: true,
    last_active: false,
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop'
  },
  {
    name: 'Meera K.',
    age: 28,
    city: 'Hyderabad',
    education: 'M.Com',
    occupation: 'Banker',
    is_premium: false,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop'
  },
  {
    name: 'Rohan D.',
    age: 32,
    city: 'Kolkata',
    education: 'LLB',
    occupation: 'Lawyer',
    is_premium: true,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop'
  },
  {
    name: 'Sneha P.',
    age: 26,
    city: 'Jaipur',
    education: 'B.Arch',
    occupation: 'Architect',
    is_premium: false,
    last_active: false,
    photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop'
  },
  {
    name: 'Aditya N.',
    age: 29,
    city: 'Lucknow',
    education: 'MBA',
    occupation: 'Entrepreneur',
    is_premium: true,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1504257432389-523431e15ce5?w=200&h=200&fit=crop'
  },
  {
    name: 'Pooja M.',
    age: 27,
    city: 'Chandigarh',
    education: 'M.Ed',
    occupation: 'Teacher',
    is_premium: false,
    last_active: true,
    photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1b4d08?w=200&h=200&fit=crop'
  }
];

// ─── Banner Slider Component ──────────────────────────────────────────────────
function HomeBannerSlider({ banners }: { banners: { url: string; link?: string }[] }) {
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="w-full overflow-hidden relative">
      <div className="relative w-full h-[150px] sm:h-[220px] md:h-[300px] lg:h-[380px]">
        {banners.map((banner, idx) => (
          <div
            key={idx}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: idx === current ? 1 : 0 }}
          >
            {banner.link ? (
              <a href={banner.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <img src={banner.url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
              </a>
            ) : (
              <img src={banner.url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
            )}
          </div>
        ))}
        {/* Dots — hidden on mobile/tablet, only visible on desktop (md+) */}
        {banners.length > 1 && (
          <div className="hidden md:flex" style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', alignItems: 'center', gap: '4px', zIndex: 10 }}>
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                style={{
                  width: idx === current ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: idx === current ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'width 0.3s ease, background-color 0.3s ease',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Banner Wrapper — reads from store, updated in real-time by SettingsSocketProvider ────────
function HomeBannerSection({ storeBanners }: { storeBanners: { url: string; link?: string }[] }) {
  if (storeBanners.length === 0) return null;
  return <HomeBannerSlider banners={storeBanners} />;
}

export default function HomePage() {
  const { user, profile } = useAuthStore();
  const { castes, getSubCastesByCaste, admin_settings_kv, communities } = useMasterData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isScreenshot = searchParams.get('screenshot') === 'true';
  
  const siteConfig = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan';
  const rawCommunityName = admin_settings_kv?.find(s => s.key === 'community_name')?.value;
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;

  const statProfiles = admin_settings_kv?.find(s => s.key === 'stat_profiles')?.value || '10K+';
  const statMarriages = admin_settings_kv?.find(s => s.key === 'stat_marriages')?.value || '500+';
  const statHappyUsers = admin_settings_kv?.find(s => s.key === 'stat_happy_users')?.value || '98%';
  const _rawHowTitle = admin_settings_kv?.find((s: any) => s.key === 'section_how_it_works_title')?.value || '';
  const sectionHowItWorksTitle = (_rawHowTitle && _rawHowTitle.trim() !== '') ? _rawHowTitle.replace(/AtMilan|Shubh Milan/gi, siteConfig) : `How ${siteConfig} Works`;

  const _rawLoveTitle = admin_settings_kv?.find((s: any) => s.key === 'section_love_stories_title')?.value || '';
  const sectionLoveStoriesTitle = (_rawLoveTitle && _rawLoveTitle.trim() !== '') ? _rawLoveTitle.replace(/AtMilan|Shubh Milan/gi, siteConfig) : `Love Stories Made on ${siteConfig}`;
  const sectionTestimonialsTitle = admin_settings_kv?.find(s => s.key === 'section_testimonials_title')?.value || 'What Our Users Say';
  const freeJourneyText = admin_settings_kv?.find(s => s.key === 'free_journey_text')?.value || 'Every member automatically receives 10 free contact unlock credits every month! Browse profiles, send unlimited interests, and explore matches at absolutely no cost.';
  const _rawHero = admin_settings_kv?.find((s: any) => s.key === 'hero_description')?.value || '';
  const heroDescription = (_rawHero && _rawHero.trim() !== '') ? _rawHero.replace(/AtMilan|Shubh Milan/gi, siteConfig) : `Join millions of happy families who found their life partner on ${siteConfig}. Verified profiles. Safe & secure.`;
  const appStoreLink = admin_settings_kv?.find(s => s.key === 'app_store_link')?.value || '#';
  const playStoreLink = admin_settings_kv?.find(s => s.key === 'play_store_link')?.value || '#';

  const safeParseJSON = (jsonString: string, fallback: any) => {
    try { return JSON.parse(jsonString); } catch (e) { return fallback; }
  };

  const howItWorksItems = safeParseJSON(admin_settings_kv?.find(s => s.key === 'how_it_works_items')?.value || '', [
    { step: 1, title: 'Register', desc: 'Create your profile with photos, education, and partner preferences in just 2 minutes.' },
    { step: 2, title: 'Get Verified', desc: 'Complete your Aadhaar KYC to verify your identity and build trust within the community.' },
    { step: 3, title: 'Search Matches', desc: 'Use our smart 20+ filters or let AI recommend the most compatible profiles for you.' },
    { step: 4, title: 'Connect & Meet', desc: "Send interests, securely unlock contact details, and start a meaningful conversation." }
  ]);

  // Registration Form State
  const [profileFor, setProfileFor] = useState('Self');
  const [gender, setGender] = useState('Groom');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [dynamicPlans, setDynamicPlans] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [approvedStories, setApprovedStories] = useState<any[]>([]);
  const { socket } = useSocketStore();

  const fetchStories = async () => {
    try {
      const res = await fetch(
        apiUrl(`/api/success-stories?_t=${Date.now()}`)
      );
      if (res.ok) {
        const data = await res.json();
        setApprovedStories(data.slice(0, 3));
      }
    } catch {}
  };

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleStoryUpdate = () => { fetchStories(); };
    socket.on('success-story:updated', handleStoryUpdate);
    return () => { socket.off('success-story:updated', handleStoryUpdate); };
  }, [socket]);

  const defaultLoveStories = safeParseJSON(admin_settings_kv?.find(s => s.key === 'love_stories_items')?.value || '', [
    { story: "This platform made it so easy to find someone who shares our family values.", groom: "Rahul", bride: "Priya", year: "2024", location: "Surat, Gujarat", photo: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=500&h=400&fit=crop" },
    { story: "From our first message to our wedding day, everything felt like destiny!", groom: "Amit", bride: "Sneha", year: "2023", location: "Ahmedabad, Gujarat", photo: "https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=500&h=400&fit=crop" },
    { story: "The detailed profiles helped us understand each other even before we met.", groom: "Vikram", bride: "Anjali", year: "2024", location: "Mumbai, Maharashtra", photo: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&h=400&fit=crop" }
  ]);

  const realLoveStories = approvedStories.map((s: any) => ({
    groom: s.groom_name || s.user_name || 'Groom',
    bride: s.bride_name || s.partner_name || 'Bride',
    story: s.story_text || s.story || '',
    year: s.year || new Date(s.created_at).getFullYear().toString(),
    location: s.location || '',
    photo: s.photos?.[0]
      ? (s.photos[0].startsWith('/') ? apiUrl(s.photos[0]) : s.photos[0])
      : (s.photo_url || s.photo || '')
  }));

  const loveStoriesItems = [...realLoveStories, ...defaultLoveStories].slice(0, 3);

  const testimonialsItems = safeParseJSON(admin_settings_kv?.find(s => s.key === 'testimonials_items')?.value || '', [
    { name: "Ramesh Patel", city: "Surat", occupation: "Businessman", rating: 5, text: `The quality of profiles on ${siteConfig} is unmatched. The Aadhaar verification feature gave my family peace of mind.`, photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&h=100&fit=crop" },
    { name: "Ananya Desai", city: "Ahmedabad", occupation: "HR Manager", rating: 5, text: "I loved that the site is strictly single-community. It saved us so much time filtering out irrelevant profiles.", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
    { name: "Suresh Shah", city: "Vadodara", occupation: "Engineer", rating: 4, text: "The privacy features are excellent. My photo remained hidden until I chose to unlock my details for mutual interests.", photo: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" }
  ]);



  useEffect(() => {
    fetch(apiUrl('/api/plans/membership'))
      .then(res => res.json())
      .then(data => setDynamicPlans(data.plans || data))
      .catch(() => {});

    fetch(apiUrl('/api/search?limit=12'))
      .then(res => res.json())
      .then(data => {
        if (data.profiles && Array.isArray(data.profiles)) {
          setActiveMembers(data.profiles);
        }
      })
      .catch(() => {});
  }, []);

  const displayProfiles = [
    ...activeMembers.map(p => {
      // education_career can be an object OR an array depending on API version
      const ec = Array.isArray(p.education_career)
        ? p.education_career[0]
        : p.education_career;
      return {
        name: p.first_name + " " + (p.last_name?.[0] ? p.last_name[0] + "." : ""),
        age: calculateAge(p.date_of_birth),
        city: p.city || p.state || p.working_city || "Location not specified",
        education: ec?.highest_education || ec?.education_level || "Not specified",
        occupation: ec?.occupation || "Not specified",
        is_premium: p.is_premium,
        last_active: p.is_active !== false,
        photo: p.profile_photo_url || (p.gender === 'Female'
          ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
          : 'https://www.w3schools.com/howto/img_avatar.png'),
        id: p.id
      };
    })
  ].slice(0, 12); // Never show more than 12

  // Fill with demo profiles if fewer than 12 real profiles available
  if (displayProfiles.length < 12) {
    displayProfiles.push(
      ...DUMMY_PROFILES.slice(0, 12 - displayProfiles.length).map((p, i) => ({
        ...p,
        id: `dummy-${i}`
      }))
    );
  }

  // Quick Search State
  const [searchFilters, setSearchFilters] = useState({
    lookingFor: '',
    ageFrom: '',
    ageTo: '',
    caste: '',
    subcaste: '',
    state: '',
    city: ''
  })

  // Quick Search Dependent Dropdowns
  // Use communities from store (fetched from /api/communities/active) for caste + sub-caste options
  const activeCommunityList = (communities && communities.length > 0)
    ? communities
    : [{ id: 'default', name: communityName, sub_castes: ['Goghari', 'Halai', 'Kutchi', 'Vaishnav'], gotras: [] }];

  const effectiveCasteName = searchFilters.caste || communityName;
  const selectedCommunityObj = activeCommunityList.find((c: any) => c.name === effectiveCasteName);
  const selectedCasteObj = castes.find(c => c.name === effectiveCasteName);
  let availableSubCastes: any[] = selectedCommunityObj?.sub_castes?.map((s: string) => ({ id: s, name: s })) ||
    (selectedCasteObj ? getSubCastesByCaste(selectedCasteObj.id) : []);
  
  // Fallback if admin hasn't configured it in backend yet
  if (availableSubCastes.length === 0) {
    availableSubCastes = [
      { id: 'fallback_1', name: 'Goghari' },
      { id: 'fallback_2', name: 'Halai' },
      { id: 'fallback_3', name: 'Kutchi' },
      { id: 'fallback_4', name: 'Vaishnav' }
    ];
  }

  const indiaStates = State.getStatesOfCountry('IN');

  const selectedStateObj = searchFilters.state ? indiaStates.find(s => s.name === searchFilters.state) : null;
  const availableCities = selectedStateObj ? City.getCitiesOfState('IN', selectedStateObj.isoCode) : [];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !phone || !password || !dateOfBirth) {
      toast.error('Please fill all fields');
      return;
    }
    
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    navigate('/register', {
      state: {
        prefillData: {
          profile_for: profileFor,
          gender: gender,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          password: password,
          confirm_password: password,
          date_of_birth: dateOfBirth
        }
      }
    });
  };

  const handleQuickSearch = () => {
    if (!user) {
      toast('Please register to search profiles', { icon: '🔍' })
      navigate('/register')
      return
    }
    
    // Build query string from filters
    const params = new URLSearchParams()
    if (searchFilters.lookingFor) params.set('looking_for', searchFilters.lookingFor)
    if (searchFilters.ageFrom) params.set('age_from', searchFilters.ageFrom)
    if (searchFilters.ageTo) params.set('age_to', searchFilters.ageTo)
    
    // Use selected caste, otherwise fallback to communityName
    params.set('caste', searchFilters.caste || communityName)
    if (searchFilters.subcaste) params.set('sub_caste', searchFilters.subcaste)
    
    if (searchFilters.state) params.set('state', searchFilters.state)
    if (searchFilters.city) params.set('city', searchFilters.city)
    
    navigate('/search?' + params.toString())
  }

  const ageOptions = Array.from({ length: 43 }, (_, i) => ({ value: String(i + 18), label: String(i + 18) }));

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* BANNER SLIDER — only shows if admin has added banners */}
      {(() => {
        const bannersRaw = admin_settings_kv?.find((s: any) => s.key === 'home_banners')?.value;
        const banners: { url: string; link?: string }[] = bannersRaw ? (() => { try { return JSON.parse(bannersRaw); } catch { return []; } })() : [];
        return <HomeBannerSection storeBanners={banners} />;
      })()}

      {/* SECTION 1 - HERO */}
      <section className="relative min-h-[650px] bg-gradient-to-br from-[#1a0a0a] via-primary-800 to-[#2d0a0a] overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 flex flex-col lg:flex-row items-center gap-12 relative z-10">
          {/* LEFT SIDE */}
          <div className="w-full lg:w-1/2 text-center lg:text-left">
            <div className="bg-white/10 backdrop-blur text-white/90 text-sm px-4 py-1.5 rounded-full inline-flex items-center gap-2 mb-6 border border-white/20">
              <ShieldCheck size={16} className="text-secondary" />
              <span>India's Most Trusted Matrimonial Platform</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Find your Perfect Match
            </h1>
            
            <div className="mt-6 inline-block bg-secondary/10 border border-secondary text-secondary font-bold px-4 py-1.5 rounded-full text-sm uppercase tracking-wider">
              For {communityName} Community
            </div>
            
            <p className="text-lg text-white/70 mt-6 max-w-lg mx-auto lg:mx-0">
              {heroDescription}
            </p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-8">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <CheckCircle2 size={18} className="text-green-400" />
                <span>Aadhaar Verified</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Lock size={18} className="text-blue-400" />
                <span>100% Privacy</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Star size={18} className="text-yellow-400" />
                <span>Free Registration</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-8 mt-10 justify-center lg:justify-start">
              <div>
                <div className="text-3xl font-bold text-secondary">{statProfiles}</div>
                <div className="text-sm text-white/60 mt-1 uppercase tracking-wider">Profiles</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-secondary">{statMarriages}</div>
                <div className="text-sm text-white/60 mt-1 uppercase tracking-wider">Marriages</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-secondary">{statHappyUsers}</div>
                <div className="text-sm text-white/60 mt-1 uppercase tracking-wider">Happy Users</div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE - REGISTRATION FORM */}
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
            {!user ? (
              <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-md w-full animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-900 text-center">Create Free Account</h2>
                <p className="text-gray-500 text-center text-sm mt-1 mb-6">Find your perfect life partner</p>
                
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Select
                      options={[
                        { value: 'Self', label: 'Self' },
                        { value: 'Son', label: 'Son' },
                        { value: 'Daughter', label: 'Daughter' },
                        { value: 'Brother', label: 'Brother' },
                        { value: 'Sister', label: 'Sister' },
                        { value: 'Relative', label: 'Relative' },
                        { value: 'Friend', label: 'Friend' },
                      ]}
                      value={profileFor}
                      onChange={(e) => setProfileFor(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('Groom')}
                      className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors border ${
                        gender === 'Groom' 
                          ? 'bg-primary-50 border-primary text-primary' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Groom
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('Bride')}
                      className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors border ${
                        gender === 'Bride' 
                          ? 'bg-primary-50 border-primary text-primary' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Bride
                    </button>
                  </div>
                  
                  <Input
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  
                  <Input
                    type="tel"
                    placeholder="Mobile Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />

                  <Input
                    type="date"
                    placeholder="Date of Birth"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                  
                  <Input
                    type="password"
                    placeholder="Create Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full py-3 text-lg mt-2"
                    >
                      Continue Registration →
                    </Button>
                  
                  <p className="text-center text-xs text-gray-400 mt-4">
                    By registering, you agree to our Terms & Privacy Policy
                  </p>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or</span>
                    </div>
                  </div>
                  
                  <p className="text-center text-sm text-gray-600">
                    Already a member?{' '}
                    <Link to="/login" className="text-primary font-semibold hover:underline">
                      Login
                    </Link>
                  </p>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-fade-in">
                <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                  {profile?.profile_photo_url ? (
                    <img src={profile.profile_photo_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-primary">
                      {profile?.first_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome back, {profile?.first_name || 'User'}!
                </h2>
                <p className="text-gray-500 mb-8">Ready to find your perfect match?</p>
                
                <div className="space-y-3">
                  <Link to="/dashboard" className="block">
                    <Button variant="primary" className="w-full py-3">
                      Go to Dashboard →
                    </Button>
                  </Link>
                  <Link to="/search" className="block">
                    <Button variant="outline" className="w-full py-3">
                      Search Profiles
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Search Bar */}
      <section className="relative -mt-8 z-10 px-4">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <h3 className="text-lg font-heading font-semibold text-gray-800 text-center mb-5">
            Quick Search
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8 gap-3 items-end">
            {/* Looking For */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Looking for</label>
              <select
                value={searchFilters.lookingFor}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, lookingFor: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white"
              >
                <option value="">Select</option>
                <option value="Female">Bride</option>
                <option value="Male">Groom</option>
              </select>
            </div>

            {/* Age From */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Age from</label>
              <select
                value={searchFilters.ageFrom}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, ageFrom: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white"
              >
                <option value="">Any</option>
                {Array.from({ length: 43 }, (_, i) => i + 18).map(age => (
                  <option key={age} value={String(age)}>{age} yrs</option>
                ))}
              </select>
            </div>

            {/* Age To */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Age to</label>
              <select
                value={searchFilters.ageTo}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, ageTo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white"
              >
                <option value="">Any</option>
                {Array.from({ length: 43 }, (_, i) => i + 18).map(age => (
                  <option key={age} value={String(age)}>{age} yrs</option>
                ))}
              </select>
            </div>

            {/* Caste */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Caste</label>
              <select
                value={searchFilters.caste}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, caste: e.target.value, subcaste: '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white"
              >
                <option value="">Any</option>
                {activeCommunityList.map((c: any) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Subcaste */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Subcaste</label>
              <select
                value={searchFilters.subcaste}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, subcaste: e.target.value }))}
                disabled={!effectiveCasteName}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{effectiveCasteName ? 'Any' : 'Select Caste First'}</option>
                {availableSubCastes.map((sc: any) => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">State</label>
              <select
                value={searchFilters.state}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, state: e.target.value, city: '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white"
              >
                <option value="">Any</option>
                {indiaStates.map(s => (
                  <option key={s.isoCode} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">City / Taluka</label>
              <select
                value={searchFilters.city}
                onChange={(e) => setSearchFilters(prev => ({ ...prev, city: e.target.value }))}
                disabled={!searchFilters.state}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{searchFilters.state ? 'Any' : 'Select State First'}</option>
                {availableCities.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <div>
              <button
                onClick={handleQuickSearch}
                className="w-full bg-primary text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2 text-sm"
              >
                <Search size={16} />
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 - FEATURED MEMBERS */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">
              Most Active Members
            </h2>
            <p className="text-gray-500 mt-3 max-w-2xl mx-auto">
              Connect with verified members actively looking for their life partner.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {displayProfiles.map((member, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 hover:-translate-y-1 text-center relative">
                {/* Left Side Active Indicator */}
                {member.last_active && (
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-green-500/10 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Online
                  </div>
                )}
                
                {/* Gold Shield Badge (Verified) */}
                <div className="absolute top-4 right-4 text-secondary" title="Verified Member">
                  <ShieldCheck size={20} fill="currentColor" className="text-white" />
                  <ShieldCheck size={20} className="absolute inset-0" />
                </div>
                
                {/* Profile Photo */}
                <div className="relative w-24 h-24 mx-auto mb-4 mt-6">
                  <img 
                    src={member.photo} 
                    alt={member.name}
                    className={`w-full h-full object-cover rounded-full p-1 border-2 ${member.is_premium ? 'border-secondary' : 'border-primary'}`} 
                  />
                </div>

                <h3 className="font-bold text-lg text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{member.age} yrs | {member.city}</p>
                <div className="text-xs text-gray-400 mt-2 line-clamp-1">{member.education} • {member.occupation}</div>

                <button 
                  onClick={() => {
                    if (user) {
                      navigate('/search');
                    } else {
                      toast.success('Please register to view full profile', { icon: '🔒' });
                      navigate('/register');
                    }
                  }}
                  className="mt-6 w-full py-2 px-1 sm:px-4 rounded-full border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors text-[11px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  View Profile
                </button>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-10">
            <button
              onClick={() => navigate(user ? '/search' : '/register')}
              className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary-700 transition inline-flex items-center gap-2"
            >
              <Search size={18} />
              Browse All Profiles
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 4 - HOW IT WORKS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">{sectionHowItWorksTitle}</h2>
            <p className="text-gray-500 mt-3 text-lg">Find your life partner in {howItWorksItems.length} simple steps</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-[40%] left-[12%] right-[12%] h-0.5 bg-gray-200 border-t-2 border-dashed border-gray-300 z-0"></div>
            
            {howItWorksItems.map((item: any, idx: number) => {
              const icons = [
                <UserPlus size={40} className="text-secondary" />,
                <ShieldCheck size={40} className="text-secondary" />,
                <Search size={40} className="text-secondary" />,
                <Heart size={40} className="text-secondary" />
              ];
              return (
              <div key={item.step || idx} className="relative z-10 bg-white rounded-2xl shadow-lg p-6 lg:p-8 text-center hover:-translate-y-2 transition-transform duration-300 border border-gray-100">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md border-4 border-white">
                  {item.step || (idx + 1)}
                </div>
                <div className="flex justify-center mb-6 mt-4 opacity-90">{icons[idx % icons.length]}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* SECTION 5 - WHY CHOOSE US */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">Why 10,000+ Families Trust {siteConfig}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: 'Aadhaar Verified',
                desc: 'Every profile is verified through Aadhaar to ensure 100% genuine profiles.'
              },
              {
                icon: Lock,
                title: 'Complete Privacy',
                desc: 'Your data is safe. Control who sees your profile, photos and contact details.'
              },
              {
                icon: Filter,
                title: 'Advanced Matching',
                desc: 'Search with 20+ filters including education, income, location, lifestyle and family.'
              },
              {
                icon: Heart,
                title: 'Proven Success',
                desc: '500+ successful marriages and counting. Join our growing family of happy couples.'
              },
              {
                icon: MessageCircle,
                title: 'Secure Chat',
                desc: 'Chat safely with matches. Our AI monitors for inappropriate behavior.'
              },
              {
                icon: Users,
                title: 'Community Focused',
                desc: 'Built exclusively for our community with respect for cultural values and traditions.'
              }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-start gap-5 p-6 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0 text-primary">
                  <feature.icon size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 - SUCCESS STORIES */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">{sectionLoveStoriesTitle}</h2>
            <p className="text-gray-500 mt-3 text-lg">Real couples who found their forever through us</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {loveStoriesItems.map((story: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl shadow-md overflow-hidden relative group hover:shadow-xl transition-all duration-300">
                {/* SVG Decorative Rings Corner */}
                <div className="absolute top-4 right-4 text-secondary z-10 drop-shadow-md">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="9" cy="12" r="5" />
                    <circle cx="15" cy="12" r="5" />
                  </svg>
                </div>
                
                <div className="h-48 overflow-hidden relative">
                  <img src={story.photo} alt={`${story.groom} and ${story.bride}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-secondary font-bold text-xl">{story.groom} & {story.bride}</h3>
                    <p className="text-white/80 text-xs">Married in {story.year} • {story.location}</p>
                  </div>
                </div>
                
                <div className="p-6">
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    "{story.story.substring(0, 110)}..."
                    <button className="text-primary font-semibold ml-1 hover:underline">Read more</button>
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/success-stories" className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-700 transition-colors">
              View All Stories <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION - TESTIMONIALS */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">{sectionTestimonialsTitle}</h2>
            <p className="text-gray-500 mt-3 text-lg">Trusted by verified members everywhere</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonialsItems.map((testimonial: any, idx: number) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 hover:shadow-md transition-shadow relative">
                <div className="absolute top-6 right-6 opacity-10">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14.017 21L16.41 14.904H10.605V3H21.395V14.904L18.99 21H14.017ZM2.617 21L5.01 14.904H-0.795V3H9.995V14.904L7.59 21H2.617Z"/>
                  </svg>
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <img src={testimonial.photo} alt={testimonial.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
                  <div>
                    <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                    <p className="text-xs text-gray-500">{testimonial.occupation} • {testimonial.city}</p>
                    <div className="flex text-secondary mt-1">
                      {Array.from({length: testimonial.rating || 5}).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION - DOWNLOAD APP */}
      {!isScreenshot && (
        <section className="pt-20 pb-32 bg-white overflow-visible relative">
           {/* Background decor */}
           <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mt-8 mb-16">
            {/* Main Card Wrapper */}
            <div className="relative rounded-3xl shadow-2xl flex flex-col md:flex-row items-center justify-between">
              {/* Gradient Background Container (kept bounded) */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-primary rounded-3xl overflow-hidden pointer-events-none"></div>
              
              <div className="p-10 md:p-16 md:w-1/2 relative z-10 text-white">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">Download Our Mobile App</h2>
                <p className="text-white/80 mb-8 max-w-md">Take your partner search everywhere. Connect instantly, receive real-time notifications, and enjoy a seamless mobile experience.</p>
                <div className="flex flex-wrap gap-4">
                  <a href={appStoreLink} target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors shadow-lg cursor-pointer">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.523 15.3414C17.523 15.3414 17.5118 15.3414 17.5118 15.3414C17.5118 15.3414 17.523 15.3414 17.523 15.3414ZM16.3418 11.2331C16.3306 8.89278 18.2325 7.73468 18.3444 7.66722C17.2536 6.07062 15.4851 5.81181 14.8624 5.77809C13.4357 5.62629 12.0427 6.61575 11.3093 6.61575C10.5759 6.61575 9.43126 5.79496 8.24189 5.82307C6.7099 5.85118 5.28994 6.71133 4.49247 8.10557C2.86877 10.9278 4.0768 15.0939 5.65961 17.3876C6.43542 18.4952 7.34091 19.7433 8.5262 19.6983C9.66661 19.6534 10.1065 18.9619 11.4581 18.9619C12.8098 18.9619 13.218 19.6983 14.4103 19.6646C15.6366 19.6309 16.4173 18.5233 17.1818 17.4045C18.0699 16.1058 18.4353 14.8465 18.4526 14.7791C18.4184 14.7678 16.353 13.9751 16.3418 11.2331ZM12.1895 3.9397C12.8066 3.1976 13.2217 2.16315 13.1095 1.12871C12.2343 1.16244 11.1347 1.71339 10.4952 2.45549C9.92305 3.09639 9.42938 4.16455 9.56396 5.16526C10.5399 5.24397 11.5606 4.67616 12.1895 3.9397Z" />
                     </svg>
                     <div className="text-left">
                       <div className="text-[10px] leading-tight font-normal">Download on the</div>
                       <div className="text-sm leading-tight">App Store</div>
                     </div>
                  </a>
                  <a href={playStoreLink} target="_blank" rel="noopener noreferrer" className="bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-colors shadow-lg cursor-pointer">
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.6,9.48l1.84-3.18a.33.33,0,0,0-.12-.45.33.33,0,0,0-.45.12l-1.87,3.24a11.16,11.16,0,0,0-10,0L5.13,6a.33.33,0,0,0-.45-.12.33.33,0,0,0-.12.45L6.4,9.48C3.7,11,2,13.88,2,17.25H22C22,13.88,20.3,11,17.6,9.48ZM7,15.25a1.25,1.25,0,1,1,1.25-1.25A1.25,1.25,0,0,1,7,15.25Zm10,0a1.25,1.25,0,1,1,1.25-1.25A1.25,1.25,0,0,1,17,15.25Z" />
                     </svg>
                     <div className="text-left">
                       <div className="text-[10px] leading-tight font-normal">GET IT ON</div>
                       <div className="text-sm leading-tight">Google Play</div>
                     </div>
                  </a>
                </div>
              </div>
              
              <div className="md:w-1/2 flex justify-center py-8 relative group z-20">
                {/* CSS Phone Mockup - Now contained entirely within the box */}
                <div className="w-[280px] h-[560px] bg-black rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-[10px] border-gray-900 overflow-hidden relative transform group-hover:-translate-y-4 transition-transform duration-500 hidden md:block">
                   {/* Top Notch Area */}
                   <div className="w-[40%] h-6 bg-gray-900 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-30 flex justify-center items-center gap-2">
                     <div className="w-12 h-1.5 bg-gray-800 rounded-full"></div>
                     <div className="w-2 h-2 rounded-full bg-blue-900/50 flex justify-center items-center">
                       <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                     </div>
                   </div>
                   
                   {/* Live App Preview via iframe */}
                   <div className="bg-white h-full w-full overflow-hidden relative pointer-events-none">
                     <style>{`
                       @keyframes mobile-scroll {
                         0%   { transform: scale(0.666667) translateY(0); }
                         15%  { transform: scale(0.666667) translateY(0); }
                         45%  { transform: scale(0.666667) translateY(-35%); }
                         55%  { transform: scale(0.666667) translateY(-35%); }
                         85%  { transform: scale(0.666667) translateY(-70%); }
                         100% { transform: scale(0.666667) translateY(0); }
                       }
                       .animate-mobile-scroll {
                         animation: mobile-scroll 25s ease-in-out infinite;
                       }
                     `}</style>
                     {typeof window !== 'undefined' && window.innerWidth >= 768 && (
                       <iframe
                         src="/?screenshot=true"
                         className="absolute top-0 left-0 origin-top-left pointer-events-none select-none border-0 animate-mobile-scroll bg-gray-50"
                         style={{ width: '390px', height: '2400px' }}
                         title="Mobile App Preview"
                         scrolling="no"
                         tabIndex={-1}
                       />
                     )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 7 - MEMBERSHIP CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Premium Membership Plans</h2>
            <p className="text-gray-500 mt-3 text-lg">Unlock premium features to accelerate your partner search</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {(() => {
              // Sort paid plans by duration ascending, then pick by position
              const paidPlans = [...dynamicPlans]
                .filter(p => p.price > 0)
                .sort((a, b) => Number(a.duration_months) - Number(b.duration_months));
              const silverPlan = 
                dynamicPlans.find(p => Number(p.duration_months) === 3) ||
                dynamicPlans.find(p => p.name.toLowerCase().includes('silver')) ||
                paidPlans[0];
              const goldPlan = 
                dynamicPlans.find(p => Number(p.duration_months) === 6) ||
                dynamicPlans.find(p => p.name.toLowerCase().includes('gold')) ||
                paidPlans[1];
              const platinumPlan = 
                dynamicPlans.find(p => Number(p.duration_months) === 12) ||
                dynamicPlans.find(p => p.name.toLowerCase().includes('platinum')) ||
                paidPlans[2];
              
              return (
                <>
            {/* 3 Month Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 animate-fade-in-up flex flex-col group">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{silverPlan?.name || 'Silver'}</h3>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{silverPlan?.duration_months ? `${silverPlan.duration_months} Months Validity` : '3 Months Validity'}</span>
                <div className="text-4xl font-bold text-gray-900 mt-3 mb-2">₹{silverPlan?.price.toLocaleString() || '999'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-6 border border-gray-100 group-hover:bg-primary/5 transition-colors">
                <p className="text-sm text-gray-600 font-medium">Billed exactly ₹{Math.round((silverPlan?.price || 999) / 3)} per month</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-4 mb-8 flex-1">
                {silverPlan?.features && silverPlan.features.length > 0 ? (
                  silverPlan.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>{feature}</span></li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span><strong>5× monthly contact unlocks</strong><br/><span className="text-xs text-gray-400">View up to 50 phone numbers</span></span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Profile pinned in search</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Real-time chat with matches</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>See Full "Who Viewed My Profile" list</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Advanced search filters</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Premium badge & No expiry on paid credits</span></li>
                  </>
                )}
              </ul>
              <button 
                onClick={() => navigate(user ? '/membership' : '/register')}
                className="w-full border-2 border-primary text-primary font-bold py-3 rounded-xl hover:bg-primary hover:text-white transition-colors"
              >Select Plan</button>
            </div>
            
            {/* 6 Month Plan */}
            <div className="bg-gradient-to-b from-primary-50 to-white rounded-2xl border-2 border-primary p-8 shadow-xl relative transform md:-translate-y-4 flex flex-col hover:-translate-y-6 hover:shadow-2xl transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-secondary to-yellow-600 text-white px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-md">Most Popular</div>
              <div className="text-center mb-6 mt-4">
                <h3 className="text-xl font-bold text-primary-900 mb-1">{goldPlan?.name || 'Gold'}</h3>
                <span className="text-xs font-semibold text-primary/60 uppercase tracking-widest">{goldPlan?.duration_months ? `${goldPlan.duration_months} Months Validity` : '6 Months Validity'}</span>
                <div className="text-4xl font-bold text-primary-900 mt-3 mb-2">₹{goldPlan?.price.toLocaleString() || '1799'}</div>
              </div>
              <div className="bg-primary/5 rounded-xl p-4 text-center mb-6 border border-primary/20">
                <p className="text-sm text-primary-800 font-medium">Billed exactly ₹{Math.round((goldPlan?.price || 1799) / 6)} per month</p>
              </div>
              <ul className="text-sm text-gray-700 space-y-4 mb-8 flex-1">
                {goldPlan?.features && goldPlan.features.length > 0 ? (
                  goldPlan.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary flex-shrink-0" /> <span className={idx === 0 ? "font-semibold text-gray-900" : ""}>{feature}</span></li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary flex-shrink-0" /> <span className="font-semibold text-gray-900">Everything in 3-Month Plan</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary flex-shrink-0" /> <span>Relationship Manager email support</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary flex-shrink-0" /> <span>Featured profile option (landing page)</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary flex-shrink-0" /> <span>Maximum monthly savings</span></li>
                  </>
                )}
              </ul>
              <button 
                onClick={() => navigate(user ? '/membership' : '/register')}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-hover shadow-lg hover:shadow-xl transition-all"
              >Select Plan</button>
            </div>
            
            {/* 12 Month Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 animate-fade-in-up flex flex-col group" style={{ animationDelay: '200ms' }}>
              <div className="text-center mb-6">
                <div className="inline-block bg-gray-100 text-gray-800 font-bold px-3 py-1 rounded-md text-xs mb-3 uppercase tracking-wide">Best Value</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{platinumPlan?.name || 'Platinum'}</h3>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{platinumPlan?.duration_months ? `${platinumPlan.duration_months} Months Validity` : '12 Months Validity'}</span>
                <div className="text-4xl font-bold text-gray-900 mt-3 mb-2">₹{platinumPlan?.price.toLocaleString() || '2999'}</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-6 border border-gray-100 group-hover:bg-primary/5 transition-colors">
                <p className="text-sm text-gray-600 font-medium">Billed exactly ₹{Math.round((platinumPlan?.price || 2999) / 12)} per month</p>
              </div>
              <ul className="text-sm text-gray-600 space-y-4 mb-8 flex-1">
                {platinumPlan?.features && platinumPlan.features.length > 0 ? (
                  platinumPlan.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span className={idx === 0 ? "font-semibold text-gray-900" : ""}>{feature}</span></li>
                  ))
                ) : (
                  <>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span className="font-semibold text-gray-900">Everything in 6-Month Plan</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Priority KYC verification</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Personal matchmaking assistance</span></li>
                    <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> <span>Exclusive Diamond badge on profile</span></li>
                  </>
                )}
              </ul>
              <button 
                onClick={() => navigate(user ? '/membership' : '/register')}
                className="w-full border-2 border-primary text-primary font-bold py-3 rounded-xl hover:bg-primary hover:text-white transition-colors"
              >Select Plan</button>
            </div>
              </>
            );
          })()}
          </div>
          
          {/* FREE PLAN CTA BANNER */}
          <div className="max-w-6xl mx-auto mt-12">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex-shrink-0 text-primary">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Start Your Journey For Free</h3>
                  <p className="text-gray-600 text-sm mt-1 max-w-xl">
                    {freeJourneyText}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button 
                  onClick={() => navigate('/register')}
                  className="bg-white text-primary border border-primary/20 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary hover:text-white transition-colors shadow-sm"
                >Create Free Account</button>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-10">
            <Link to="/membership" className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-700 transition-colors">
              View All Plans & Features <ChevronRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 8 - FINAL CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary-800 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-4">Your Perfect Match is Waiting</h2>
          <p className="text-xl text-white/80 mb-10">Join {siteConfig} today — It's 100% Free!</p>
          
          {!user ? (
            <Link to="/register">
              <button className="bg-secondary text-gray-900 font-bold text-lg px-10 py-4 rounded-full hover:bg-secondary-400 transition-colors shadow-xl hover:shadow-2xl transform hover:-translate-y-1">
                Register Free Now →
              </button>
            </Link>
          ) : (
            <Link to="/search">
              <button className="bg-white text-primary font-bold text-lg px-10 py-4 rounded-full hover:bg-gray-50 transition-colors shadow-xl hover:shadow-2xl transform hover:-translate-y-1">
                Find Matches →
              </button>
            </Link>
          )}
          
          <p className="text-sm text-white/60 mt-8 font-medium">
            Trusted by 10,000+ families across India
          </p>
        </div>
      </section>
    </div>
  );
}

