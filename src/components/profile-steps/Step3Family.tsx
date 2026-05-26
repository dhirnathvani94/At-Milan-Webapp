import { useState, useEffect } from 'react'
import { Users, Home, Heart, MapPin } from 'lucide-react'
import { State, City } from 'country-state-city'
import Input from '../ui/Input'
import Select from '../ui/Select'
import TextArea from '../ui/TextArea'
import { 
  familyStatusOptions,
  incomeOptions
} from '../../lib/constants'

interface Step3FamilyProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
}

export default function Step3Family({ data, onSave, saving, saveRef }: Step3FamilyProps) {
  const [form, setForm] = useState({
    children_count: data?.profile?.children_count || 0,
    children: data?.profile?.children || ([] as {name: string, gender: string, age: string}[]),
    father_name: data?.family?.father_name || '',
    father_occupation: data?.family?.father_occupation || '',
    mother_name: data?.family?.mother_name || '',
    mother_occupation: data?.family?.mother_occupation || '',
    num_brothers: data?.family?.num_brothers ?? 0,
    brothers_married: data?.family?.brothers_married ?? 0,
    num_sisters: data?.family?.num_sisters ?? 0,
    sisters_married: data?.family?.sisters_married ?? 0,
    family_type: data?.family?.family_type || '',
    family_status: data?.family?.family_status || '',
    family_values: data?.family?.family_values || '',
    native_place: data?.family?.native_place || '',
    family_city: data?.family?.family_city || '',
    family_state: data?.family?.family_state || '',
    mosal_name: data?.family?.mosal_name || '',
    mosal_address: data?.family?.mosal_address || '',
    mosal_state: data?.family?.mosal_state || '',
    mosal_city: data?.family?.mosal_city || '',
    family_income: data?.family?.family_income || '',
    about_family: data?.family?.about_family || ''
  })

  const handleSave = () => {
    const b = Number(form.num_brothers) || 0;
    const mb = Number(form.brothers_married) || 0;
    const s = Number(form.num_sisters) || 0;
    const ms = Number(form.sisters_married) || 0;
    
    if (b < 0 || mb < 0 || s < 0 || ms < 0) {
      alert('Counts cannot be negative');
      return;
    }
    if (mb > b) {
      alert('Married brothers cannot be greater than total brothers');
      return;
    }
    if (ms > s) {
      alert('Married sisters cannot be greater than total sisters');
      return;
    }

    if (['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(data?.profile?.marital_status)) {
      if (form.children_count < 0) {
        alert('Children count cannot be negative');
        return;
      }
      for (const child of form.children) {
        if (!child.name || !child.gender || child.age === '' || Number(child.age) < 0) {
          alert('Please fill out all children details correctly');
          return;
        }
      }
    }

    onSave({
      step: 3,
      data: Object.fromEntries(
        Object.entries(form)
          .filter(([k]) => !['children', 'children_count'].includes(k)) 
          .map(([k, v]) => 
            k.includes('brothers') || k.includes('sisters') ? [k, Number(v) || 0] : [k, v]
          )
      ),
      childrenData: ['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(data?.profile?.marital_status) ? {
        children_count: form.children_count,
        children: form.children
      } : null
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
      if (name === 'family_state') updated.family_city = ''
      if (name === 'mosal_state') updated.mosal_city = ''
      return updated
    })
  }

  const indiaStates = State.getStatesOfCountry('IN')
  const mappedStates = indiaStates.map(s => ({ value: s.name, label: s.name }))
  
  const selectedFamilyStateObj = form.family_state ? indiaStates.find(s => s.name === form.family_state) : null
  const mappedFamilyCities = selectedFamilyStateObj 
    ? City.getCitiesOfState('IN', selectedFamilyStateObj.isoCode).map(c => ({ value: c.name, label: c.name }))
    : []

  const selectedMosalStateObj = form.mosal_state ? indiaStates.find(s => s.name === form.mosal_state) : null
  const mappedMosalCities = selectedMosalStateObj 
    ? City.getCitiesOfState('IN', selectedMosalStateObj.isoCode).map(c => ({ value: c.name, label: c.name }))
    : []

  const familyTypeOptions = [
    { label: 'Joint', emoji: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}' },
    { label: 'Nuclear', emoji: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}' },
    { label: 'Other', emoji: '\u{1F3E0}' }
  ]

  const familyValuesOptions = [
    { label: 'Orthodox', emoji: '\u{1F64F}' },
    { label: 'Moderate', emoji: '\u2696\uFE0F' },
    { label: 'Liberal', emoji: '\u{1F31F}' }
  ]

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <Users className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Family Details</h2>
      </div>
      <p className="text-gray-500 text-sm">Tell us about your family background and values</p>
      <hr className="mt-3 mb-6" />

      {['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(data?.profile?.marital_status) && (
        <div className="mb-8 p-5 border rounded-xl bg-gray-50 border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="text-primary" size={18} />
            Children Details
          </h4>
          <Input 
            label="Number of Children" 
            type="number" 
            min="0"
            value={String(form.children_count)} 
            onChange={(e) => {
              const count = parseInt(e.target.value) || 0;
              if (count < 0) return;
              const newChildren = Array.from({length: count}).map(() => ({name: '', gender: 'Boy', age: ''}));
              setForm(prev => ({...prev, children_count: count, children: newChildren.map((nc, idx) => prev.children[idx] || nc)}));
            }} 
          />
          
          {form.children_count > 0 && form.children.map((child, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 mt-4 pt-4 border-t border-gray-200">
              <Input label={`Child ${index+1} Name`} value={child.name} onChange={(e) => {
                const nc = [...form.children]; nc[index] = {...nc[index], name: e.target.value}; setForm({...form, children: nc});
              }} />
              <Select label={`Child ${index+1} Gender`} options={[{value: 'Boy', label: 'Boy'}, {value: 'Girl', label: 'Girl'}]} value={child.gender} onChange={(e) => {
                const nc = [...form.children]; nc[index] = {...nc[index], gender: e.target.value}; setForm({...form, children: nc});
              }} />
              <Input label={`Child ${index+1} Age (Years)`} type="number" min="0" value={child.age} onChange={(e) => {
                const nc = [...form.children]; nc[index] = {...nc[index], age: e.target.value}; setForm({...form, children: nc});
              }} />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <Input 
          label="Father's Name" 
          value={form.father_name} 
          onChange={(e) => handleChange('father_name', e.target.value)} 
          placeholder="Enter father's name" 
        />
        <Select 
          label="Father's Occupation" 
          options={['Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(opt => ({ value: opt, label: opt }))}
          value={form.father_occupation} 
          onChange={(e) => handleChange('father_occupation', e.target.value)} 
        />
        <Input 
          label="Mother's Name" 
          value={form.mother_name} 
          onChange={(e) => handleChange('mother_name', e.target.value)} 
          placeholder="Enter mother's name" 
        />
        <Select 
          label="Mother's Occupation" 
          options={['Housewife', 'Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(opt => ({ value: opt, label: opt }))}
          value={form.mother_occupation} 
          onChange={(e) => handleChange('mother_occupation', e.target.value)} 
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Brothers</label>
          <div className="grid grid-cols-1 gap-4">
            <Input 
              label="Total" 
              type="number" 
              min={0} 
              max={10}
              value={String(form.num_brothers)} 
              onChange={(e) => handleChange('num_brothers', Number(e.target.value))} 
            />
            <Input 
              label="Married" 
              type="number" 
              min={0} 
              max={form.num_brothers}
              value={String(form.brothers_married)} 
              onChange={(e) => handleChange('brothers_married', Number(e.target.value))} 
            />
          </div>
        </div>
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Sisters</label>
          <div className="grid grid-cols-1 gap-4">
            <Input 
              label="Total" 
              type="number" 
              min={0} 
              max={10}
              value={String(form.num_sisters)} 
              onChange={(e) => handleChange('num_sisters', Number(e.target.value))} 
            />
            <Input 
              label="Married" 
              type="number" 
              min={0} 
              max={form.num_sisters}
              value={String(form.sisters_married)} 
              onChange={(e) => handleChange('sisters_married', Number(e.target.value))} 
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-gray-700">Family Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {familyTypeOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleChange('family_type', option.label)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                form.family_type === option.label 
                ? 'border-primary bg-primary-50 text-primary shadow-sm' 
                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              <span className="text-2xl mb-2">{option.emoji}</span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Select 
          label="Family Status *" 
          options={familyStatusOptions.map(opt => ({ value: opt, label: opt }))} 
          value={form.family_status} 
          onChange={(e) => handleChange('family_status', e.target.value)} 
        />
        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Family Values</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {familyValuesOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleChange('family_values', option.label)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  form.family_values === option.label 
                  ? 'border-primary bg-primary-50 text-primary shadow-sm' 
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                <span className="text-2xl mb-2">{option.emoji}</span>
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2">
        <MapPin className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Location Details</h2>
      </div>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Input 
          label="Native Place" 
          value={form.native_place} 
          onChange={(e) => handleChange('native_place', e.target.value)} 
          placeholder="Enter native place" 
        />
        <Select 
          label="Family State" 
          options={mappedStates} 
          value={form.family_state} 
          onChange={(e) => handleChange('family_state', e.target.value)} 
          placeholder="Select state"
        />
        <Select 
          label="Family City / Taluka" 
          options={mappedFamilyCities}
          value={form.family_city} 
          onChange={(e) => handleChange('family_city', e.target.value)} 
          placeholder="Select city" 
          disabled={!form.family_state}
        />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Users className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Mosal (Maternal) Details</h2>
      </div>
      <hr className="mt-3 mb-6" />

      <div className="grid grid-cols-1 gap-5">
        <Input 
          label="Mosal Name" 
          value={form.mosal_name} 
          onChange={(e) => handleChange('mosal_name', e.target.value)} 
          placeholder="Enter maternal family name" 
        />
        <Select 
          label="Family Income" 
          options={incomeOptions.map(opt => ({ value: opt, label: opt }))}
          value={form.family_income} 
          onChange={(e) => handleChange('family_income', e.target.value)} 
        />
        <Select 
          label="Mosal State" 
          options={mappedStates} 
          value={form.mosal_state} 
          onChange={(e) => handleChange('mosal_state', e.target.value)} 
          placeholder="Select state"
        />
        <Select 
          label="Mosal City / Taluka" 
          options={mappedMosalCities}
          value={form.mosal_city} 
          onChange={(e) => handleChange('mosal_city', e.target.value)} 
          placeholder="Select city" 
          disabled={!form.mosal_state}
        />
        <div className="md:col-span-2">
          <Input 
            label="Mosal Valid Address" 
            value={form.mosal_address} 
            onChange={(e) => handleChange('mosal_address', e.target.value)} 
            placeholder="Enter full address" 
          />
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <TextArea 
          label="About Family" 
          value={form.about_family} 
          onChange={(e) => handleChange('about_family', e.target.value)} 
          placeholder="Tell us more about your family members, their background, and your relationship with them..." 
          rows={4} 
        />
      </div>
    </div>
  )
}
