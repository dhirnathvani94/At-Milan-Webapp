import { useState, useEffect } from 'react'
import { Settings, UserCheck, Heart, MapPin, Briefcase, Info } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import MultiSelect from '../ui/MultiSelect'
import TextArea from '../ui/TextArea'
import { useMasterData } from '../../store/masterDataStore'
import { 
  heightOptions, 
  maritalStatusOptions, 
  religionOptions, 
  motherTongueOptions, 
  educationOptions, 
  occupationOptions, 
  incomeOptions, 
  indianStates, 
  dietOptions, 
  manglikOptions 
} from '../../lib/constants'

interface Step6PreferencesProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
}

export default function Step6Preferences({ data, onSave, saving, saveRef }: Step6PreferencesProps) {
  const { castes, getSubCastesByCaste, admin_settings_kv } = useMasterData()

  // Determine community name from admin settings (same logic as RegisterPage)
  const rawCommunityName = admin_settings_kv?.find((s: any) => s.key === 'community_name')?.value
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;

  // Build sub-caste dropdown options from master data
  let mappedSubCastes = getSubCastesByCaste(castes.find((c: any) => c.name === communityName)?.id || '').map((s: any) => s.name)

  // Fallback if admin hasn't configured it in backend yet
  if (mappedSubCastes.length === 0) {
    mappedSubCastes = ['Halai', 'Ghoghari', 'Kutchi']
  }

  const [form, setForm] = useState({
    age_from: data?.preferences?.age_from || 18,
    age_to: data?.preferences?.age_to || 45,
    height_from_cm: data?.preferences?.height_from_cm || 140,
    height_to_cm: data?.preferences?.height_to_cm || 200,
    marital_status_pref: data?.preferences?.marital_status_pref || [],
    religion_pref: data?.preferences?.religion_pref || [],
    caste_pref: data?.preferences?.caste_pref || [],
    sub_caste_pref: data?.preferences?.sub_caste_pref || [],
    mother_tongue_pref: data?.preferences?.mother_tongue_pref || [],
    education_pref: data?.preferences?.education_pref || [],
    occupation_pref: data?.preferences?.occupation_pref || [],
    income_from: data?.preferences?.income_from || '',
    income_to: data?.preferences?.income_to || '',
    country_pref: data?.preferences?.country_pref || [],
    state_pref: data?.preferences?.state_pref || [],
    diet_pref: data?.preferences?.diet_pref || [],
    smoking_pref: data?.preferences?.smoking_pref || "Doesn't Matter",
    drinking_pref: data?.preferences?.drinking_pref || "Doesn't Matter",
    manglik_pref: data?.preferences?.manglik_pref || "Doesn't Matter",
    about_partner: data?.preferences?.about_partner || ''
  })

  const handleSave = () => {
    onSave({
      step: 6,
      data: {
        age_from: Number(form.age_from),
        age_to: Number(form.age_to),
        height_from_cm: Number(form.height_from_cm),
        height_to_cm: Number(form.height_to_cm),
        marital_status_pref: form.marital_status_pref,
        religion_pref: form.religion_pref,
        caste_pref: form.caste_pref,
        sub_caste_pref: form.sub_caste_pref,
        mother_tongue_pref: form.mother_tongue_pref,
        education_pref: form.education_pref,
        occupation_pref: form.occupation_pref,
        income_from: form.income_from,
        income_to: form.income_to,
        country_pref: form.country_pref,
        state_pref: form.state_pref,
        diet_pref: form.diet_pref,
        smoking_pref: form.smoking_pref,
        drinking_pref: form.drinking_pref,
        manglik_pref: form.manglik_pref,
        about_partner: form.about_partner
      }
    })
  }

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave
    }
  }, [form])

  const handleChange = (name: string, value: any) => {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const toggleChip = (name: string, value: string) => {
    setForm(prev => {
      const current = prev[name as keyof typeof prev] as string[]
      if (current.includes(value)) {
        return { ...prev, [name]: current.filter(v => v !== value) }
      } else {
        return { ...prev, [name]: [...current, value] }
      }
    })
  }

  const ageOptions = Array.from({ length: 43 }, (_, i) => ({ value: String(i + 18), label: String(i + 18) }))
  const countryOptions = ['India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Germany', 'Singapore', 'Other']

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <Settings className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Partner Preferences</h2>
      </div>
      <p className="text-gray-500 text-sm">Tell us about the person you're looking for</p>
      <hr className="mt-3 mb-6" />

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <UserCheck className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Basic Details</h3>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Age From</label>
            <Select 
              options={ageOptions} 
              value={String(form.age_from)} 
              onChange={(e) => handleChange('age_from', e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Age To</label>
            <Select 
              options={ageOptions} 
              value={String(form.age_to)} 
              onChange={(e) => handleChange('age_to', e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Height From</label>
            <Select 
              options={heightOptions.map(opt => ({ value: String(opt.value), label: opt.label }))} 
              value={String(form.height_from_cm)} 
              onChange={(e) => handleChange('height_from_cm', e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Height To</label>
            <Select 
              options={heightOptions.map(opt => ({ value: String(opt.value), label: opt.label }))} 
              value={String(form.height_to_cm)} 
              onChange={(e) => handleChange('height_to_cm', e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Marital Status Preference</label>
          <div className="flex flex-wrap gap-2">
            {maritalStatusOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleChip('marital_status_pref', option)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  form.marital_status_pref.includes(option)
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Heart className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Religion & Community</h3>
        </div>
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Religion Preference</label>
          <div className="flex flex-wrap gap-2">
            {['Hindu'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleChip('religion_pref', option)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  form.religion_pref.includes(option)
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <MultiSelect 
            label="Caste Preference" 
            options={[communityName]} 
            selectedValues={form.caste_pref} 
            onChange={(values) => handleChange('caste_pref', values)} 
            placeholder="Search and select castes"
          />
          <MultiSelect 
            label="Sub Caste Preference" 
            options={mappedSubCastes} 
            selectedValues={form.sub_caste_pref} 
            onChange={(values) => handleChange('sub_caste_pref', values)} 
            placeholder="Search and select sub castes"
          />
          <MultiSelect 
            label="Mother Tongue Preference" 
            options={motherTongueOptions} 
            selectedValues={form.mother_tongue_pref} 
            onChange={(values) => handleChange('mother_tongue_pref', values)} 
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Briefcase className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Education & Career</h3>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <MultiSelect 
            label="Education Preference" 
            options={educationOptions} 
            selectedValues={form.education_pref} 
            onChange={(values) => handleChange('education_pref', values)} 
          />
          <MultiSelect 
            label="Occupation Preference" 
            options={occupationOptions} 
            selectedValues={form.occupation_pref} 
            onChange={(values) => handleChange('occupation_pref', values)} 
          />
          <Select 
            label="Income Range (From)" 
            options={[{ value: '', label: 'Any' }, ...incomeOptions.map(opt => ({ value: opt, label: opt }))]} 
            value={form.income_from} 
            onChange={(e) => handleChange('income_from', e.target.value)} 
          />
          <Select 
            label="Income Range (To)" 
            options={[{ value: '', label: 'Any' }, ...incomeOptions.map(opt => ({ value: opt, label: opt }))]} 
            value={form.income_to} 
            onChange={(e) => handleChange('income_to', e.target.value)} 
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <MapPin className="text-primary" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Location & Lifestyle</h3>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <MultiSelect 
            label="Country Preference" 
            options={countryOptions} 
            selectedValues={form.country_pref} 
            onChange={(values) => handleChange('country_pref', values)} 
          />
          <MultiSelect 
            label="State Preference" 
            options={indianStates} 
            selectedValues={form.state_pref} 
            onChange={(values) => handleChange('state_pref', values)} 
          />
        </div>
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Diet Preference</label>
          <div className="flex flex-wrap gap-2">
            {dietOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleChip('diet_pref', option)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                  form.diet_pref.includes(option)
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5">
          <Select 
            label="Smoking Preference" 
            options={[
              { value: "Doesn't Matter", label: "Doesn't Matter" },
              { value: "No", label: "No" },
              { value: "Occasionally OK", label: "Occasionally OK" }
            ]} 
            value={form.smoking_pref} 
            onChange={(e) => handleChange('smoking_pref', e.target.value)} 
          />
          <Select 
            label="Drinking Preference" 
            options={[
              { value: "Doesn't Matter", label: "Doesn't Matter" },
              { value: "No", label: "No" },
              { value: "Occasionally OK", label: "Occasionally OK" }
            ]} 
            value={form.drinking_pref} 
            onChange={(e) => handleChange('drinking_pref', e.target.value)} 
          />
          <Select 
            label="Manglik Preference" 
            options={[
              { value: "Doesn't Matter", label: "Doesn't Matter" },
              ...manglikOptions.map(opt => ({ value: opt, label: opt }))
            ]} 
            value={form.manglik_pref} 
            onChange={(e) => handleChange('manglik_pref', e.target.value)} 
          />
        </div>
      </section>

      <div className="space-y-2">
        <TextArea 
          label="About Partner" 
          value={form.about_partner} 
          onChange={(e) => handleChange('about_partner', e.target.value)} 
          placeholder="Describe your ideal partner, their qualities, values, and expectations..." 
          rows={6}
        />
      </div>
    </div>
  )
}
