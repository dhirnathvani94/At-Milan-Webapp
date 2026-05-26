import { useState, useEffect } from 'react'
import { User, ChevronDown, Info } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import TextArea from '../ui/TextArea'
import { useMasterData } from '../../store/masterDataStore'
import { 
  maritalStatusOptions, 
  religionOptions, 
  motherTongueOptions, 
  heightOptions, 
  bodyTypeOptions, 
  complexionOptions, 
  bloodGroupOptions 
} from '../../lib/constants'

interface Step1PersonalProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
}

export default function Step1Personal({ data, onSave, saving, saveRef }: Step1PersonalProps) {
  const { castes, getSubCastesByCaste, admin_settings_kv } = useMasterData()

  // Determine community name from admin settings (same logic as RegisterPage)
  const rawCommunityName = admin_settings_kv?.find((s: any) => s.key === 'community_name')?.value
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;

  // Build caste dropdown options - only show the community caste
  const targetCasteOptions = [{ value: communityName, label: communityName }]

  // Build sub-caste dropdown options from master data
  let mappedSubCastes = getSubCastesByCaste(castes.find((c: any) => c.name === communityName)?.id || '').map((s: any) => ({ value: s.name, label: s.name }))

  // Fallback if admin hasn't configured it in backend yet
  if (mappedSubCastes.length === 0) {
    mappedSubCastes = [
      { value: `Halai`, label: `Halai` },
      { value: `Ghoghari`, label: `Ghoghari` },
      { value: `Kutchi`, label: `Kutchi` }
    ]
  }

  const [form, setForm] = useState({
    marital_status: data?.profile?.marital_status || '',
    religion: data?.profile?.religion || 'Hindu',
    caste: data?.profile?.caste || communityName,
    sub_caste: data?.profile?.sub_caste || '',
    gotra: data?.profile?.gotra || '',
    mother_tongue: data?.profile?.mother_tongue || '',
    height_cm: data?.profile?.height_cm || '',
    weight_kg: data?.profile?.weight_kg || '',
    body_type: data?.profile?.body_type || '',
    complexion: data?.profile?.complexion || '',
    blood_group: data?.profile?.blood_group || '',
    physical_disability: data?.profile?.physical_disability || false,
    disability_desc: data?.profile?.disability_desc || '',
    about_me: data?.profile?.about_me || ''
  })

  const handleSave = () => {
    onSave({
      step: 1,
      data: {
        marital_status: form.marital_status,
        religion: form.religion,
        caste: form.caste,
        sub_caste: form.sub_caste,
        gotra: form.gotra,
        mother_tongue: form.mother_tongue,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        body_type: form.body_type,
        complexion: form.complexion,
        blood_group: form.blood_group,
        physical_disability: form.physical_disability,
        disability_desc: form.disability_desc,
        about_me: form.about_me
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

  const bodyTypeIcons: Record<string, string> = {
    'Slim': '\u{1F3C3}',
    'Average': '\u{1F9D1}',
    'Athletic': '\u{1F4AA}',
    'Heavy': '\u{1F9F8}'
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <User className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Personal Details</h2>
      </div>
      <p className="text-gray-500 text-sm">Provide your basic personal information to help others know you better</p>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Marital Status *" 
          options={maritalStatusOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.marital_status} 
          onChange={(e) => handleChange('marital_status', e.target.value)} 
        />
        <Select 
          label="Religion *" 
          options={religionOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.religion} 
          onChange={(e) => handleChange('religion', e.target.value)} 
        />
        <Select 
          label={`Caste (${communityName}) *`}
          options={targetCasteOptions} 
          value={form.caste || communityName} 
          onChange={(e) => handleChange('caste', e.target.value)} 
          disabled={true}
        />
        <Select 
          label="Sub Caste (Optional)" 
          options={mappedSubCastes} 
          value={form.sub_caste} 
          onChange={(e) => handleChange('sub_caste', e.target.value)} 
          placeholder="Select Sub Caste"
          disabled={mappedSubCastes.length === 0}
        />
        <Input 
          label="Gotra" 
          value={form.gotra} 
          onChange={(e) => handleChange('gotra', e.target.value)} 
          placeholder="Enter gotra" 
        />
        <Select 
          label="Mother Tongue *" 
          options={motherTongueOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.mother_tongue} 
          onChange={(e) => handleChange('mother_tongue', e.target.value)} 
        />
        <Select 
          label="Height *" 
          options={heightOptions.map(opt => ({ value: String(opt.value), label: opt.label }))} 
          value={String(form.height_cm)} 
          onChange={(e) => handleChange('height_cm', e.target.value)} 
        />
        <Input 
          label="Weight (kg)" 
          type="number" 
          value={String(form.weight_kg)} 
          onChange={(e) => handleChange('weight_kg', e.target.value)} 
          placeholder="Enter weight in kg" 
        />
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-gray-700">Body Type</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {bodyTypeOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange('body_type', option)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                form.body_type === option 
                ? 'border-primary bg-primary-50 text-primary shadow-sm' 
                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <span className="text-2xl mb-2">{bodyTypeIcons[option] || '\u{1F9D1}'}</span>
              <span className="text-sm font-medium">{option}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-gray-700">Complexion</label>
        <div className="flex flex-wrap gap-3">
          {complexionOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange('complexion', option)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                form.complexion === option 
                ? 'border-primary bg-primary-50 text-primary' 
                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${
                option === 'Fair' ? 'bg-[#f5d0b4]' : 
                option === 'Very Fair' ? 'bg-[#fce5d3]' :
                option === 'Wheatish' ? 'bg-[#e6b990]' :
                option === 'Wheatish Brown' ? 'bg-[#c68642]' : 'bg-[#8d5524]'
              }`} />
              <span className="text-sm font-medium">{option}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Blood Group" 
          options={bloodGroupOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.blood_group} 
          onChange={(e) => handleChange('blood_group', e.target.value)} 
        />
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Physical Disability?</label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleChange('physical_disability', false)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all ${
                form.physical_disability === false 
                ? 'border-primary bg-primary-50 text-primary font-medium' 
                : 'border-gray-100 bg-white text-gray-600'
              }`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => handleChange('physical_disability', true)}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all ${
                form.physical_disability === true 
                ? 'border-primary bg-primary-50 text-primary font-medium' 
                : 'border-gray-100 bg-white text-gray-600'
              }`}
            >
              Yes
            </button>
          </div>
        </div>
      </div>

      {form.physical_disability && (
        <div className="space-y-2">
          <Input 
            label="Please Mention Disability *" 
            value={form.disability_desc} 
            onChange={(e) => handleChange('disability_desc', e.target.value)} 
            placeholder="Briefly describe the disability" 
          />
        </div>
      )}

      <div className="space-y-2">
        <TextArea 
          label="About Me *" 
          value={form.about_me} 
          onChange={(e) => handleChange('about_me', e.target.value)} 
          placeholder="Write a few lines about yourself, your personality, interests, and what you're looking for..." 
          rows={6}
          maxLength={1000}
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Minimum 50 characters recommended</span>
          <span>{form.about_me.length}/1000</span>
        </div>
      </div>
    </div>
  )
}
