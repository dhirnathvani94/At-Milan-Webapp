import { useState, useEffect } from 'react'
import { GraduationCap, Briefcase, MapPin, IndianRupee } from 'lucide-react'
import { State, City } from 'country-state-city'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { 
  educationOptions, 
  occupationOptions, 
  incomeOptions
} from '../../lib/constants'

interface Step2EducationProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
}

export default function Step2Education({ data, onSave, saving, saveRef }: Step2EducationProps) {
  const [form, setForm] = useState({
    highest_education: data?.education?.highest_education || '',
    education_field: data?.education?.education_field || '',
    college_name: data?.education?.college_name || '',
    occupation: data?.education?.occupation || '',
    company_name: data?.education?.company_name || '',
    designation: data?.education?.designation || '',
    annual_income: data?.education?.annual_income || '',
    working_city: data?.education?.working_city || '',
    working_state: data?.education?.working_state || '',
    working_country: data?.education?.working_country || 'India'
  })

  const handleSave = () => {
    onSave({
      step: 2,
      data: {
        highest_education: form.highest_education,
        education_field: form.education_field,
        college_name: form.college_name,
        occupation: form.occupation,
        company_name: form.company_name,
        designation: form.designation,
        annual_income: form.annual_income,
        working_city: form.working_city,
        working_state: form.working_state,
        working_country: form.working_country
      }
    })
  }

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave
    }
  }, [form])

  const handleChange = (name: string, value: any) => {
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'working_state') updated.working_city = ''
      return updated
    })
  }

  const countryOptions = [
    'India', 'USA', 'UK', 'Canada', 'Australia', 'UAE', 'Germany', 'Singapore', 'Other'
  ]

  const indiaStates = State.getStatesOfCountry('IN')
  const mappedStates = indiaStates.map(s => ({ value: s.name, label: s.name }))
  
  const selectedStateObj = form.working_state ? indiaStates.find(s => s.name === form.working_state) : null
  const mappedCities = selectedStateObj 
    ? City.getCitiesOfState('IN', selectedStateObj.isoCode).map(c => ({ value: c.name, label: c.name }))
    : []

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <GraduationCap className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Education Details</h2>
      </div>
      <p className="text-gray-500 text-sm">Tell us about your educational background</p>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Highest Education *" 
          options={educationOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.highest_education} 
          onChange={(e) => handleChange('highest_education', e.target.value)} 
        />
        <Input 
          label="Education Field/Specialization" 
          value={form.education_field} 
          onChange={(e) => handleChange('education_field', e.target.value)} 
          placeholder="e.g., Computer Science" 
        />
        <Input 
          label="College/University Name" 
          value={form.college_name} 
          onChange={(e) => handleChange('college_name', e.target.value)} 
          placeholder="Enter college name" 
        />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Briefcase className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Career Details</h2>
      </div>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Occupation *" 
          options={occupationOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.occupation} 
          onChange={(e) => handleChange('occupation', e.target.value)} 
        />
        <Input 
          label="Company Name" 
          value={form.company_name} 
          onChange={(e) => handleChange('company_name', e.target.value)} 
          placeholder="Enter company name" 
        />
        <Input 
          label="Designation" 
          value={form.designation} 
          onChange={(e) => handleChange('designation', e.target.value)} 
          placeholder="e.g., Software Engineer" 
        />
        <Select 
          label="Annual Income *" 
          options={incomeOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.annual_income} 
          onChange={(e) => handleChange('annual_income', e.target.value)} 
        />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <MapPin className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Work Location</h2>
      </div>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Working State" 
          options={mappedStates} 
          value={form.working_state} 
          onChange={(e) => handleChange('working_state', e.target.value)} 
          placeholder="Select State"
        />
        <Select 
          label="Working City / Taluka" 
          options={mappedCities}
          value={form.working_city} 
          onChange={(e) => handleChange('working_city', e.target.value)} 
          placeholder="Select City / Taluka"
          disabled={!form.working_state}
        />
        <Select 
          label="Working Country" 
          options={countryOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.working_country} 
          onChange={(e) => handleChange('working_country', e.target.value)} 
        />
      </div>
    </div>
  )
}
