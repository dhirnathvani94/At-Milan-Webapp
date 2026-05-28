import { useState, useEffect } from 'react'
import { Heart, Star, Languages, Music } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import MultiSelect from '../ui/MultiSelect'
import { 
  manglikOptions, 
  nakshatraOptions, 
  rashiOptions, 
  motherTongueOptions, 
  hobbiesList 
} from '../../lib/constants'

interface Step4LifestyleProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
}

export default function Step4Lifestyle({ data, onSave, saving, saveRef }: Step4LifestyleProps) {
  const [lifestyleForm, setLifestyleForm] = useState({
    diet: data?.lifestyle?.diet || '',
    smoking: data?.lifestyle?.smoking || 'No',
    drinking: data?.lifestyle?.drinking || 'No',
    hobbies: data?.lifestyle?.hobbies || [],
    languages_known: data?.lifestyle?.languages_known || []
  })

  const [horoscopeForm, setHoroscopeForm] = useState({
    manglik: data?.horoscope?.manglik || '',
    nakshatra: data?.horoscope?.nakshatra || '',
    rashi: data?.horoscope?.rashi || '',
    birth_time: data?.horoscope?.birth_time || '',
    birth_place: data?.horoscope?.birth_place || ''
  })

  const handleSave = () => {
    onSave({
      step: 4,
      lifestyleData: {
        diet: lifestyleForm.diet,
        smoking: lifestyleForm.smoking,
        drinking: lifestyleForm.drinking,
        hobbies: lifestyleForm.hobbies,
        interests: [],
        languages_known: lifestyleForm.languages_known
      },
      horoscopeData: {
        manglik: horoscopeForm.manglik,
        nakshatra: horoscopeForm.nakshatra,
        rashi: horoscopeForm.rashi,
        birth_time: horoscopeForm.birth_time,
        birth_place: horoscopeForm.birth_place
      }
    })
  }

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave
    }
  }, [lifestyleForm, horoscopeForm])

  const handleLifestyleChange = (name: string, value: any) => {
    setLifestyleForm(prev => ({ ...prev, [name]: value }))
  }

  const handleHoroscopeChange = (name: string, value: any) => {
    setHoroscopeForm(prev => ({ ...prev, [name]: value }))
  }

  const dietOptions = [
    { label: 'Vegetarian', emoji: '\u{1F96C}' },
    { label: 'Non-Vegetarian', emoji: '\u{1F357}' },
    { label: 'Eggetarian', emoji: '\u{1F95A}' },
    { label: 'Jain', emoji: '\u{1F64F}' },
    { label: 'Vegan', emoji: '\u{1F331}' }
  ]

  const frequencyOptions = ['No', 'Occasionally', 'Yes']

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Heart className="text-primary" size={24} />
          <h2 className="text-xl font-semibold text-gray-800">Lifestyle Habits</h2>
        </div>
        <p className="text-gray-500 text-sm">Your daily habits and lifestyle choices</p>
        <hr className="mt-3 mb-6" />

        <div className="space-y-4">
          <label className="text-sm font-medium text-gray-700">Dietary Preference</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {dietOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleLifestyleChange('diet', option.label)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  lifestyleForm.diet === option.label 
                  ? 'border-primary bg-primary-50 text-primary shadow-sm' 
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
              >
                <span className="text-2xl mb-2">{option.emoji}</span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">Smoking</label>
            <div className="flex gap-3">
              {frequencyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleLifestyleChange('smoking', option)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all ${
                    lifestyleForm.smoking === option 
                    ? 'border-primary bg-primary-50 text-primary font-medium' 
                    : 'border-gray-100 bg-white text-gray-600'
                  }`}
                >
                  {option === 'No' ? '\u274C No' : option === 'Occasionally' ? '\u26A0\uFE0F Occasionally' : '\u2705 Yes'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">Drinking</label>
            <div className="flex gap-3">
              {frequencyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleLifestyleChange('drinking', option)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all ${
                    lifestyleForm.drinking === option 
                    ? 'border-primary bg-primary-50 text-primary font-medium' 
                    : 'border-gray-100 bg-white text-gray-600'
                  }`}
                >
                  {option === 'No' ? '\u274C No' : option === 'Occasionally' ? '\u26A0\uFE0F Occasionally' : '\u2705 Yes'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <MultiSelect 
            label="Hobbies" 
            options={hobbiesList} 
            selectedValues={lifestyleForm.hobbies} 
            onChange={(values) => handleLifestyleChange('hobbies', values)} 
          />
          <MultiSelect 
            label="Languages Known" 
            options={motherTongueOptions} 
            selectedValues={lifestyleForm.languages_known} 
            onChange={(values) => handleLifestyleChange('languages_known', values)} 
          />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Star className="text-primary" size={24} />
          <h2 className="text-xl font-semibold text-gray-800">Horoscope Details</h2>
        </div>
        <p className="text-gray-500 text-sm">Provide your birth details for horoscope matching (optional)</p>
        <hr className="mt-3 mb-6" />

        <div className="grid grid-cols-1 gap-5">
          <Select 
            label="Manglik Status" 
            options={manglikOptions.map(opt => ({ value: opt, label: opt }))} 
            value={horoscopeForm.manglik} 
            onChange={(e) => handleHoroscopeChange('manglik', e.target.value)} 
          />
          <Select 
            label="Rashi" 
            options={rashiOptions.map(opt => ({ value: opt, label: opt }))} 
            value={horoscopeForm.rashi} 
            onChange={(e) => handleHoroscopeChange('rashi', e.target.value)} 
          />
          <Select 
            label="Nakshatra" 
            options={nakshatraOptions.map(opt => ({ value: opt, label: opt }))} 
            value={horoscopeForm.nakshatra} 
            onChange={(e) => handleHoroscopeChange('nakshatra', e.target.value)} 
          />
          <Input 
            label="Birth Time" 
            type="time" 
            value={horoscopeForm.birth_time} 
            onChange={(e) => handleHoroscopeChange('birth_time', e.target.value)} 
          />
          <Input 
            label="Birth Place" 
            value={horoscopeForm.birth_place} 
            onChange={(e) => handleHoroscopeChange('birth_place', e.target.value)} 
            placeholder="Enter city of birth" 
          />
        </div>
      </section>
    </div>
  )
}
