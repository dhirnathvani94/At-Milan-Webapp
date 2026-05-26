import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { searchProfiles, loadAllProfiles } from '../../lib/actions/searchActions'
import { toggleShortlist, isShortlisted, checkInterestStatus } from '../../lib/actions/dashboardActions'
import { sendInterest } from '../../lib/actions/interestActions'
import { useMasterData } from '../../store/masterDataStore'
import { calculateAge, formatHeight, getRelativeTime } from '../../lib/utils'
import {
  heightOptions, maritalStatusOptions, religionOptions, castesByReligion,
  motherTongueOptions, educationOptions, occupationOptions, bodyTypeOptions
} from '../../lib/constants'
import toast from 'react-hot-toast'
import {
  Search, Filter, X, ChevronDown, ChevronUp, MapPin, GraduationCap,
  Briefcase, Heart, ShieldCheck, Star, Eye, User, SlidersHorizontal,
  RefreshCw, ChevronLeft, ChevronRight, Save, Menu
} from 'lucide-react'
import ProfileCard from '../../components/ProfileCard'
import { SearchSkeleton, ProfileGridSkeleton } from '../../components/ui/Skeletons'
const DEFAULT_FEMALE = 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'

// ── Stable sub-components defined OUTSIDE SearchPage to prevent blink on every keystroke ──
// If defined inside the component, React unmounts+remounts them on every state update.
const FilterSection = ({
  id, title, children, expandedSections, toggleSection
}: {
  id: string; title: string; children: React.ReactNode
  expandedSections: Record<string, boolean>; toggleSection: (id: string) => void
}) => (
  <div className="border-b border-gray-100 last:border-0">
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-3 px-1 text-sm font-semibold text-gray-800 hover:text-primary transition"
    >
      {title}
      {expandedSections[id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
    {expandedSections[id] && (
      <div className="pb-4 px-1 animate-slide-down">
        {children}
      </div>
    )}
  </div>
)

const ChipSelector = ({
  options, selected, onToggle, maxShow = 20
}: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; maxShow?: number
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.slice(0, maxShow).map(option => (
      <button
        key={option}
        onClick={() => onToggle(option)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition border ${
          selected.includes(option)
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
        }`}
      >
        {option}
      </button>
    ))}
  </div>
)

export default function SearchPage() {
  const { user, profile: myProfile , loading: authLoading} = useAuthStore()
  const masterData = useMasterData()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const rawCommunityName = masterData.admin_settings_kv?.find((s: any) => s.key === 'community_name')?.value;
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;

  // Filter states
  const [filters, setFilters] = useState({
    looking_for: '',
    age_from: '',
    age_to: '',
    height_from: '',
    height_to: '',
    caste: [] as string[],
    sub_caste: [] as string[],
    state: [] as string[],
    city: [] as string[],
    mother_tongue: [] as string[],
    marital_status: [] as string[],
    education: [] as string[],
    occupation: [] as string[],
    diet: [] as string[],
    smoking: '',
    drinking: '',
    family_type: [] as string[],
    complexion: [] as string[],
    body_type: [] as string[],
    manglik: '',
    nakshatra: '',
    raashi: '',
    has_photo: false,
    verified_only: false,
    near_me: false,
    profile_id: '',
    email: '',
    phone: '',
    sort_by: 'newest'
  })

  // Results states
  const [results, setResults] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showDesktopFilters, setShowDesktopFilters] = useState(true)
  const [searchDone, setSearchDone] = useState(false)

  // Collapsible filter sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    community: true,
    education: false,
    physical: false,
    profileId: false
  })

  // Load profiles on mount
  useEffect(() => {
    if (user?.id) {
      // Check for URL params from homepage quick search
      const lookingFor = searchParams.get('looking_for')
      const ageFrom = searchParams.get('age_from')
      const ageTo = searchParams.get('age_to')
      const caste = searchParams.get('caste')
      const religion = searchParams.get('religion')
      const motherTongue = searchParams.get('mother_tongue')
      const state = searchParams.get('state')
      const city = searchParams.get('city')

      if (lookingFor || ageFrom || ageTo || caste || religion || motherTongue || state || city) {
        const urlFilters = { ...filters }
        if (lookingFor) urlFilters.looking_for = lookingFor
        if (ageFrom) urlFilters.age_from = ageFrom
        if (ageTo) urlFilters.age_to = ageTo
        if (caste) urlFilters.caste = [caste]
        if (motherTongue) urlFilters.mother_tongue = [motherTongue]
        // Currently state/city filters not explicitly tracked in basic `filters` state in SearchPage for full advanced search, but added basic support for query translation if added in the future
        
        setFilters(urlFilters)
        doSearch(urlFilters)
      } else {
        // Load all opposite gender profiles by default
        loadDefault()
      }
    }
  }, [user?.id])

  async function loadDefault() {
    setLoading(true)
    try {
      const result = await loadAllProfiles((user?.id || ''), 1, 12)
      if (result && result.profiles) {
        setResults(result.profiles)
        setTotalCount(result.totalCount)
      }
    } catch (err) {
      console.error('Load error:', err)
      toast.error('Failed to load profiles. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  async function doSearch(searchFilters?: any, pageOverride?: number) {
    setLoading(true)
    setSearchDone(true)
    try {
      const filtersToUse = searchFilters || filters
      const pageToUse = pageOverride || currentPage
      const result = await searchProfiles({
        ...filtersToUse,
        page: pageToUse,
        limit: 12
      }, (user?.id || ''))
      setResults(result.profiles)
      setTotalCount(result.totalCount)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Search error:', err)
      toast.error('Search failed. Please try again.')
    } finally {
      setLoading(false)
      setShowMobileFilters(false)
    }
  }

  function clearFilters() {
    setFilters({
      looking_for: '', age_from: '', age_to: '', height_from: '', height_to: '',
      caste: [], sub_caste: [], state: [], city: [], mother_tongue: [], marital_status: [],
      education: [], occupation: [], diet: [], smoking: '', drinking: '', family_type: [],
      complexion: [], body_type: [], manglik: '', nakshatra: '', raashi: '',
      has_photo: false, verified_only: false, near_me: false, profile_id: '', email: '', phone: '', sort_by: 'newest'
    })
    setCurrentPage(1)
    setSearchDone(false)
    loadDefault()
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  function toggleArrayFilter(field: string, value: string) {
    setFilters(prev => {
      const current = (prev as any)[field] as string[]
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value]
      return { ...prev, [field]: updated }
    })
  }


  // Guard: wait for auth to be ready before rendering
  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <SearchSkeleton />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Search Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount} profiles found` : 'Find your perfect match'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toast.success('Search preferences saved!')}
            className="hidden lg:flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <Save size={16} /> Save Search
          </button>
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setShowMobileFilters(true)
              } else {
                setShowDesktopFilters(prev => !prev)
              }
            }}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Menu size={16} /> Filters
          </button>
        </div>
      </div>

      {/* Inline Quick Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          {/* Profile ID */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">Profile ID</label>
            <input
              type="text"
              value={filters.profile_id}
              onChange={(e) => setFilters(prev => ({ ...prev, profile_id: e.target.value.toUpperCase() }))}
              placeholder="e.g. AM100001"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Email */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">Email</label>
            <input
              type="text"
              value={(filters as any).email || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
              placeholder="e.g. user@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Phone */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">Phone</label>
            <input
              type="text"
              value={(filters as any).phone || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Caste */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">Caste</label>
            <select
              value={filters.caste[0] || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, caste: e.target.value ? [e.target.value] : [] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="">Any</option>
              {(masterData.castes?.length > 0 ? masterData.castes.map((c: any) => c.name) : [communityName]).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sub Caste */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">Sub Caste</label>
            <select
              value={filters.sub_caste[0] || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, sub_caste: e.target.value ? [e.target.value] : [] }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none bg-white"
            >
              <option value="">Any</option>
              {(masterData.sub_castes?.length > 0 ? masterData.sub_castes.map((c: any) => c.name) : ['Halai', 'Ghoghari', 'Kutchi', 'Vaishnav', 'Swaminarayan', 'Jain', 'Other']).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider">City</label>
            <input
              type="text"
              value={filters.city[0] || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value ? [e.target.value] : [] }))}
              placeholder="e.g. Rajkot"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            />
          </div>

          {/* Near Me Toggle */}
          <div className="flex-none">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider invisible">Near Me</label>
            <label className="flex items-center gap-2 h-[38px] px-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
              <input 
                type="checkbox" 
                checked={filters.near_me} 
                onChange={(e) => setFilters(prev => ({ ...prev, near_me: e.target.checked }))} 
                className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4" 
              />
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Near Me</span>
            </label>
          </div>

          {/* Search Button */}
          <div className="flex-none">
            <label className="block text-[11px] text-gray-500 mb-1 font-semibold uppercase tracking-wider invisible">Search</label>
            <button
              onClick={() => { setCurrentPage(1); doSearch() }}
              className="bg-primary text-white h-[38px] px-5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2 text-sm"
            >
              <Search size={16} /> Search
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* LEFT SIDEBAR - FILTERS */}
        <div className={`
          ${showMobileFilters ? 'fixed inset-0 z-50 bg-black/50' : 'hidden'} lg:static lg:bg-transparent ${showDesktopFilters ? 'lg:block' : 'lg:hidden'}
        `}>
          <div className={`
            ${showMobileFilters ? 'absolute right-0 top-0 h-full w-80 bg-white shadow-2xl overflow-y-auto' : ''}
            lg:w-72 lg:flex-shrink-0
          `}>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:sticky lg:top-20">
              {/* Filter Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Filter size={16} className="text-primary" /> Filters
                </h2>
                <div className="flex items-center gap-2">
                  <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear All</button>
                  {showMobileFilters && (
                    <button onClick={() => setShowMobileFilters(false)} className="lg:hidden text-gray-400 hover:text-gray-600">
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>

              {/* BASIC FILTERS */}
              <FilterSection id="basic" title="Basic Preferences" expandedSections={expandedSections} toggleSection={toggleSection}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Looking for</label>
                    <select
                      value={filters.looking_for}
                      onChange={(e) => setFilters(prev => ({ ...prev, looking_for: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                    >
                      <option value="">Any</option>
                      <option value="Female">Bride (Female)</option>
                      <option value="Male">Groom (Male)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Age from</label>
                      <select value={filters.age_from} onChange={(e) => setFilters(prev => ({ ...prev, age_from: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:border-primary outline-none">
                        <option value="">Any</option>
                        {Array.from({ length: 43 }, (_, i) => i + 18).map(a => <option key={a} value={String(a)}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Age to</label>
                      <select value={filters.age_to} onChange={(e) => setFilters(prev => ({ ...prev, age_to: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:border-primary outline-none">
                        <option value="">Any</option>
                        {Array.from({ length: 43 }, (_, i) => i + 18).map(a => <option key={a} value={String(a)}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Height from</label>
                      <select value={filters.height_from} onChange={(e) => setFilters(prev => ({ ...prev, height_from: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:border-primary outline-none">
                        <option value="">Any</option>
                        {heightOptions.map(h => <option key={h.value} value={String(h.value)}>{h.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Height to</label>
                      <select value={filters.height_to} onChange={(e) => setFilters(prev => ({ ...prev, height_to: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:border-primary outline-none">
                        <option value="">Any</option>
                        {heightOptions.map(h => <option key={h.value} value={String(h.value)}>{h.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Marital Status</label>
                    <ChipSelector options={maritalStatusOptions} selected={filters.marital_status} onToggle={(v) => toggleArrayFilter('marital_status', v)} />
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filters.has_photo} onChange={(e) => setFilters(prev => ({ ...prev, has_photo: e.target.checked }))} className="rounded border-gray-300 text-primary focus:ring-primary" />
                      With photo only
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={filters.near_me} onChange={(e) => setFilters(prev => ({ ...prev, near_me: e.target.checked }))} className="rounded border-gray-300 text-primary focus:ring-primary" />
                      Near Me (Same City)
                    </label>
                  </div>
                </div>
              </FilterSection>

              {/* COMMUNITY FILTERS */}
              <FilterSection id="community" title="Community" expandedSections={expandedSections} toggleSection={toggleSection}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Caste</label>
                    <ChipSelector
                      options={[communityName]}
                      selected={filters.caste}
                      onToggle={(v) => toggleArrayFilter('caste', v)}
                      maxShow={15}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Sub Caste</label>
                    <ChipSelector
                      options={masterData.sub_castes?.length > 0 ? masterData.sub_castes.map((c: any) => c.name) : ['Halai', 'Ghoghari', 'Kutchi', 'Vaishnav', 'Swaminarayan', 'Jain', 'Other']}
                      selected={filters.sub_caste}
                      onToggle={(v) => toggleArrayFilter('sub_caste', v)}
                      maxShow={15}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Mother Tongue</label>
                    <ChipSelector options={motherTongueOptions.slice(0, 12)} selected={filters.mother_tongue} onToggle={(v) => toggleArrayFilter('mother_tongue', v)} />
                  </div>
                </div>
              </FilterSection>

              {/* EDUCATION FILTERS */}
              <FilterSection id="education" title="Education & Career" expandedSections={expandedSections} toggleSection={toggleSection}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Education</label>
                    <ChipSelector options={educationOptions.slice(0, 10)} selected={filters.education} onToggle={(v) => toggleArrayFilter('education', v)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Occupation</label>
                    <ChipSelector options={occupationOptions.slice(0, 10)} selected={filters.occupation} onToggle={(v) => toggleArrayFilter('occupation', v)} />
                  </div>
                </div>
              </FilterSection>

              {/* PHYSICAL FILTERS */}
              <FilterSection id="physical" title="Physical Appearance" expandedSections={expandedSections} toggleSection={toggleSection}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Body Type</label>
                    <ChipSelector options={bodyTypeOptions} selected={filters.body_type} onToggle={(v) => toggleArrayFilter('body_type', v)} />
                  </div>
                </div>
              </FilterSection>

              {/* PROFILE ID SEARCH */}
              <FilterSection id="profileId" title="Search by Profile ID" expandedSections={expandedSections} toggleSection={toggleSection}>
                <input
                  type="text"
                  value={filters.profile_id}
                  onChange={(e) => setFilters(prev => ({ ...prev, profile_id: e.target.value.toUpperCase() }))}
                  placeholder="e.g., AM100001"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                />
              </FilterSection>

              {/* Search Button */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { setCurrentPage(1); doSearch() }}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2 text-sm"
                >
                  <Search size={16} /> Search Profiles
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full border border-gray-200 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw size={14} /> Reset All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - RESULTS */}
        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-gray-100 px-4 py-2.5">
            <p className="text-sm text-gray-600">
              {loading ? 'Searching...' : `${totalCount} profiles found`}
            </p>
            <select
              value={filters.sort_by}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, sort_by: e.target.value }))
                doSearch({ ...filters, sort_by: e.target.value })
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:border-primary outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="last_active">Last Active</option>
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              <ProfileGridSkeleton count={6} />
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {results.map(profile => (
                  <ProfileCard key={(profile?.id || '')} profile={profile} currentUserId={(user?.id || '')} />
                ))}
              </div>

              {/* Pagination */}
              {totalCount > 12 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button
                    onClick={() => { if (currentPage > 1) { setCurrentPage(p => p - 1); doSearch(filters, currentPage - 1) } }}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {currentPage} of {Math.ceil(totalCount / 12)}
                  </span>
                  <button
                    onClick={() => { if (currentPage < Math.ceil(totalCount / 12)) { setCurrentPage(p => p + 1); doSearch(filters, currentPage + 1) } }}
                    disabled={currentPage >= Math.ceil(totalCount / 12)}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* No Results */}
          {!loading && results.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Search size={48} className="mx-auto text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 mt-4">
                {searchDone ? 'No profiles found' : 'Start searching'}
              </h3>
              <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
                {searchDone
                  ? 'Try adjusting your filters or clearing some selections to see more results.'
                  : 'Use the filters on the left to find your perfect match, or browse all profiles.'}
              </p>
              {searchDone && (
                <button onClick={clearFilters} className="mt-4 bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition">
                  Clear Filters & Show All
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
