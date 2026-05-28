import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { useMasterData } from '../store/masterDataStore'
import { registerUser, uploadDocument } from '../lib/actions/authActions'
import { apiUrl } from '../lib/api'
import { savePersonalDetails, saveEducationCareer, saveFamilyDetails, saveLifestyle } from '../lib/actions/profileActions'
import { uploadProfilePhoto } from '../lib/actions/profileActions'
import { signInWithSocial } from '../lib/firebase'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import MultiSelect from '../components/ui/MultiSelect'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { 
  User, Mail, Lock, Phone, Upload, FileText, X, CheckCircle, 
  ShieldCheck, Heart, Camera, ChevronDown, MapPin, Briefcase, Users, Star
} from 'lucide-react'
import { 
  profileForOptions, maritalStatusOptions, heightOptions, religionOptions, 
  motherTongueOptions, educationOptions, occupationOptions, incomeOptions, 
  familyTypeOptions, bodyTypeOptions, manglikOptions, rashiOptions, nakshatraOptions,
  dietOptions, smokingDrinkingOptions, hobbiesList, complexionOptions, familyStatusOptions,
  familyValuesOptions, bloodGroupOptions
} from '../lib/constants'
import { State, City } from 'country-state-city'

const CAS_STEPS = [
  { id: 1, title: 'Profile details', icon: User, desc: 'Who is this profile for?' },
  { id: 2, title: 'Personal info', icon: Heart, desc: 'Name & Date of birth' },
  { id: 3, title: 'Contact setup', icon: Mail, desc: 'Email, phone & security' },
  { id: 4, title: 'Community Info', icon: Users, desc: 'Religion & caste details' },
  { id: 5, title: 'Location', icon: MapPin, desc: 'Where do you live' },
  { id: 6, title: 'Professional Info', icon: Briefcase, desc: 'Education & career' },
  { id: 7, title: 'Physical Info', icon: User, desc: 'Height & marital status' },
  { id: 8, title: 'Family Detail', icon: Users, desc: 'Family background' },
  { id: 9, title: 'Verification', icon: ShieldCheck, desc: 'Photo & identity' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { castes, states, getCitiesByState, getSubCastesByCaste, admin_settings_kv, communities } = useMasterData()
  const location = useLocation()
  
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get('ref') || ''
  
  const communityNameSetting = admin_settings_kv?.find((s: any) => s.key === 'community_name');
  const rawCommunityName = communityNameSetting?.value;
  const isPlaceholder = !rawCommunityName || rawCommunityName === 'Your Community';
  const communityName = isPlaceholder ? 'Lohana' : rawCommunityName;
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan';

  // Active communities — use store (auto-updates via socket when admin changes communities)
  // Falls back to local fetch if store is empty
  const [activeCommunities, setActiveCommunities] = React.useState<Array<{id: string; name: string; sub_castes: string[]; gotras: string[]}>>([]);

  // Sync activeCommunities from store whenever store.communities changes
  // This handles Test 8: when admin deactivates a community, socket fires → store updates → this runs
  React.useEffect(() => {
    if (communities && communities.length > 0) {
      setActiveCommunities(communities);
      // If only 1 community active, auto-set form.caste to it so the field is always populated
      if (communities.length === 1) {
        setForm((prev: any) => ({ ...prev, caste: communities[0].name }));
      }
    }
  }, [communities]);

  useEffect(() => {
    // Initial fetch — also runs if store hasn't loaded yet
    fetch(apiUrl('/api/communities/active'))
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.communities) && data.communities.length > 0) {
          setActiveCommunities(data.communities);
        } else {
          const fallbackName = admin_settings_kv?.find((s: any) => s.key === 'community_name')?.value || 'Lohana';
          setActiveCommunities([{ id: 'default', name: fallbackName, sub_castes: [], gotras: [] }]);
        }
      })
      .catch(() => {
        const fallbackName = admin_settings_kv?.find((s: any) => s.key === 'community_name')?.value || 'Lohana';
        setActiveCommunities([{ id: 'default', name: fallbackName, sub_castes: [], gotras: [] }]);
      });
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const [activeStep, setActiveStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [showSuccess, setShowSuccess] = useState(false)

  // OTP State
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => setOtpCountdown(prev => prev - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [otpCountdown])

  const handleSendOTP = async () => {
    if (!/^\d{10}$/.test(form.phone)) {
      toast.error('Please enter a valid 10-digit phone number')
      return
    }

    // Check if phone is already registered BEFORE sending OTP
    try {
      const checkRes = await fetch(apiUrl('/api/auth/check-duplicate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone })
      })
      const checkData = await checkRes.json()
      if (checkRes.status === 409 || checkData.duplicate) {
        setDuplicateError({ field: 'phone', message: checkData.message || `Phone number (${form.phone}) is already registered. Please login instead.` })
        return // Don't send OTP
      }
    } catch {
      // Network error — proceed with OTP send, server will catch later
    }

    setOtpLoading(true)
    try {
      const res = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'OTP Sent successfully')
        setOtpSent(true)
        setOtpCountdown(90) // 90 seconds
      } else {
        toast.error(data.error || 'Failed to send OTP')
      }
    } catch (err) {
      toast.error('Network error. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    const code = otpValues.join('')
    if (code.length !== 6) return

    setOtpLoading(true)
    try {
      const res = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, otp: code })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Phone verified successfully!')
        setOtpVerified(true)
        setErrors(prev => ({ ...prev, phone: '' }))
      } else {
        toast.error(data.error || 'Invalid OTP')
      }
    } catch (err) {
      toast.error('Network error. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpValues];
    newOtp[index] = value.substring(value.length - 1);
    setOtpValues(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm({ ...form, phone: val });
    if (otpVerified) {
      setOtpVerified(false);
      setOtpSent(false);
      setOtpValues(['', '', '', '', '', '']);
    }
    if (errors.phone) setErrors({ ...errors, phone: '' });
  };

  const [form, setForm] = useState({
    profile_for: location.state?.prefillData?.profile_for || 'Self', 
    gender: location.state?.prefillData?.gender || '',
    first_name: location.state?.prefillData?.first_name || '', 
    last_name: location.state?.prefillData?.last_name || '', 
    date_of_birth: location.state?.prefillData?.date_of_birth || '',
    email: location.state?.prefillData?.email || '', 
    phone: location.state?.prefillData?.phone || '', 
    password: location.state?.prefillData?.password || '', 
    confirm_password: location.state?.prefillData?.confirm_password || '',
    religion: 'Hindu', caste: communityName, sub_caste: '', gotra: '', mother_tongue: 'Gujarati',
    manglik: '', rashi: '', nakshatra: '', birth_time: '', birth_place: '',
    state: '', city: '',
    highest_education: '', occupation: '', annual_income: '',
    height_cm: '', weight_kg: '', body_type: '', complexion: '', blood_group: '', physical_disability: 'No', disability_desc: '', marital_status: 'Never Married', 
    diet: '', smoking: '', drinking: '', hobbies: [] as string[],
    children_count: '0', children: [] as {name: string, gender: string, age: string}[],
    family_type: '', family_status: '', family_values: '', father_name: '', father_occupation: '', mother_name: '', mother_occupation: '',
    brothers: '0', married_brothers: '0', sisters: '0', married_sisters: '0',
    mosal_name: '', mosal_state: '', mosal_city: '', mosal_address: '', family_income: '',
    agreeTerms: false
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [duplicateError, setDuplicateError] = useState<{ field: string; message: string } | null>(null)
  
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('')
  const profilePhotoRef = useRef<HTMLInputElement>(null)

  const [aadhaarFront, setAadhaarFront] = useState<File | null>(null)
  const [aadhaarBack, setAadhaarBack] = useState<File | null>(null)
  const aadhaarFrontRef = useRef<HTMLInputElement>(null)
  const aadhaarBackRef = useRef<HTMLInputElement>(null)

  const [biodataFile, setBiodataFile] = useState<File | null>(null)
  const biodataFileRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.target.name === 'phone') {
      handlePhoneChange(e as React.ChangeEvent<HTMLInputElement>);
      return;
    }
    setForm({ ...form, [e.target.name]: e.target.value })
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' })
    }
  }

  const handleSocialSignup = async (provider: 'google' | 'facebook') => {
    try {
      const socialUser = await signInWithSocial(provider)
      if (!socialUser || !socialUser.email) throw new Error('Could not retrieve email from provider')
      
      setForm(prev => ({
        ...prev,
        email: socialUser.email,
        first_name: socialUser.firstName,
        last_name: socialUser.lastName
      }))
      
      // Auto-advance to Step 2 since step 2 has the names
      setActiveStep(2)
      setCompletedSteps(prev => Array.from(new Set([...prev, 1])))
      
      toast.success('Profile details auto-filled! Please complete the remaining steps.')
    } catch (error: any) {
      if (error.message.includes('not configured')) {
        toast.error('Social Login is not configured. Admin needs to add Firebase credentials.')
      } else {
        toast.error(error.message || `Failed to connect with ${provider}`)
      }
    }
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    if (step === 1) {
      if (!form.profile_for) newErrors.profile_for = 'Required'
      if (!form.gender) newErrors.gender = 'Please select gender'
    } else if (step === 2) {
      if (!form.first_name || form.first_name.length < 2) newErrors.first_name = 'Required'
      if (!form.last_name || form.last_name.length < 2) newErrors.last_name = 'Required'
      if (!form.date_of_birth) newErrors.date_of_birth = 'Required'
      else {
        const age = new Date().getFullYear() - new Date(form.date_of_birth).getFullYear()
        if (age < 18 || age > 70) newErrors.date_of_birth = 'Must be 18 to 70 years old'
      }
    } else if (step === 3) {
      if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) newErrors.email = 'Valid email required'
      if (!form.phone || !/^\d{10}$/.test(form.phone)) newErrors.phone = '10 digits required'
      else if (!otpVerified) newErrors.phone = 'Verify OTP First'
      
      if (!form.password || form.password.length < 4) newErrors.password = 'Min 4 characters'
      if (form.password !== form.confirm_password) newErrors.confirm_password = 'Passwords must match'
    } else if (step === 4) {
      if (!form.religion) newErrors.religion = 'Required'
      // Don't validate caste string rigidly, as it might auto-inject 
      if (!form.caste) newErrors.caste = 'Required'
      if (!form.manglik) newErrors.manglik = 'Required'
    } else if (step === 5) {
      if (!form.state) newErrors.state = 'Required'
      if (!form.city) newErrors.city = 'Required'
    } else if (step === 6) {
      if (!form.highest_education) newErrors.highest_education = 'Required'
      if (!form.occupation) newErrors.occupation = 'Required'
    } else if (step === 7) {
      if (!form.height_cm) newErrors.height_cm = 'Required'
      if (!form.weight_kg) newErrors.weight_kg = 'Required'
      if (!form.body_type) newErrors.body_type = 'Required'
      if (form.physical_disability === 'Yes' && !form.disability_desc) newErrors.disability_desc = 'Required'
      if (!form.marital_status) newErrors.marital_status = 'Required'
    } else if (step === 8) {
      if (!form.family_type) newErrors.family_type = 'Required'
      if (!form.father_name) newErrors.father_name = 'Required'
      if (!form.mother_name) newErrors.mother_name = 'Required'
      
      if (['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(form.marital_status)) {
        if (parseInt(form.children_count) < 0) newErrors.children_count = 'Cannot be negative'
        if (parseInt(form.children_count) > 0) {
          form.children.forEach((child, index) => {
            if (!child.name) newErrors[`child_${index}_name`] = 'Required'
            if (!child.gender) newErrors[`child_${index}_gender`] = 'Required'
            if (!child.age || parseInt(child.age) < 0) newErrors[`child_${index}_age`] = 'Invalid age'
          })
        }
      }

      const b = parseInt(form.brothers) || 0;
      const mb = parseInt(form.married_brothers) || 0;
      const s = parseInt(form.sisters) || 0;
      const ms = parseInt(form.married_sisters) || 0;
      if (b < 0) newErrors.brothers = 'Cannot be negative';
      if (s < 0) newErrors.sisters = 'Cannot be negative';
      if (mb < 0) newErrors.married_brothers = 'Cannot be negative';
      if (ms < 0) newErrors.married_sisters = 'Cannot be negative';
      if (mb > b) newErrors.married_brothers = 'Married brothers cannot be greater than total brothers';
      if (ms > s) newErrors.married_sisters = 'Married sisters cannot be greater than total sisters';
    } else if (step === 9) {
      if (!aadhaarFront || !aadhaarBack) newErrors.aadhaar = 'Aadhaar front and back are required'
      if (newErrors.aadhaar) toast.error('Please upload both sides of your Aadhaar card')
      if (!form.agreeTerms) newErrors.agreeTerms = 'You must agree to terms'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      isValid = false
    }
    return isValid
  }

  const nextStep = async (step: number) => {
    if (!validateStep(step)) return;

    // Step 3 has email + phone — check for duplicates before proceeding
    if (step === 3) {
      try {
        const res = await fetch(apiUrl('/api/auth/check-duplicate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, phone: form.phone }),
        });
        const data = await res.json();
        if (res.status === 409 || data.duplicate) {
          setDuplicateError({ field: 'both', message: data.message || 'This email or phone is already registered.' });
          return; // STOP — don't proceed to next step
        }
      } catch {
        // Network error — allow to proceed, server will catch at registration time
      }
    }

    setCompletedSteps(prev => Array.from(new Set([...prev, step])))
    setActiveStep(step + 1)
    window.scrollTo({ top: Math.max(0, (step * 80) - 100), behavior: 'smooth' })
  }

  const prevStep = (step: number) => {
    setActiveStep(step - 1)
  }

  const triggerSubmit = () => {
    if (validateStep(9)) {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(9)) return
    
    setLoading(true)
    try {
      // 1. Create Core Account
      const authData = await registerUser({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender,
        profile_for: form.profile_for,
        date_of_birth: form.date_of_birth,
        phone: form.phone
      })
      
      const userId = authData.user?.id
      if (userId) {
        // 2. Setup initial master auth state so next requests succeed with token
        if (authData.token) localStorage.setItem('atmilan-token', authData.token)

        // 3. Save additional detailed profile sections
        await savePersonalDetails(userId, {
          marital_status: form.marital_status,
          children_count: parseInt(form.children_count) || 0,
          children: form.children,
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
          physical_disability: form.physical_disability === 'Yes',
          disability_desc: form.disability_desc
        }).catch(console.error)

        await saveLifestyle(userId, {
          diet: form.diet,
          smoking: form.smoking,
          drinking: form.drinking,
          hobbies: form.hobbies
        }, {
          manglik: form.manglik,
          nakshatra: form.nakshatra,
          rashi: form.rashi,
          birth_time: form.birth_time,
          birth_place: form.birth_place
        }).catch(console.error)

        await saveEducationCareer(userId, {
          highest_education: form.highest_education,
          occupation: form.occupation,
          annual_income: form.annual_income,
          working_city: form.city,
          working_state: form.state
        }).catch(console.error)

        await saveFamilyDetails(userId, {
          family_type: form.family_type,
          family_status: form.family_status,
          family_values: form.family_values,
          father_name: form.father_name,
          father_occupation: form.father_occupation,
          mother_name: form.mother_name,
          mother_occupation: form.mother_occupation,
          brothers: parseInt(form.brothers) || 0,
          married_brothers: parseInt(form.married_brothers) || 0,
          sisters: parseInt(form.sisters) || 0,
          married_sisters: parseInt(form.married_sisters) || 0,
          mosal_name: form.mosal_name,
          mosal_state: form.mosal_state,
          mosal_city: form.mosal_city,
          mosal_address: form.mosal_address,
          family_income: form.family_income,
        }).catch(console.error)

        // 4. Upload Files
        if (profilePhotoFile) await uploadProfilePhoto(userId, profilePhotoFile).catch(console.error)
        if (aadhaarFront) await uploadDocument(userId, aadhaarFront, 'aadhaar_front').catch(console.error)
        if (aadhaarBack) await uploadDocument(userId, aadhaarBack, 'aadhaar_back').catch(console.error)
        if (biodataFile) await uploadDocument(userId, biodataFile, 'biodata').catch(console.error)

        // Apply referral code if present in URL
        if (referralCode && userId) {
          try {
            await fetch(apiUrl('/api/referral/use'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: referralCode, newUserId: userId })
            })
            // Don't throw on error — referral failure shouldn't block registration
          } catch {}
        }

        // Complete!
        // Reset initialization state and forcefully re-initialize all user context
        useAuthStore.setState({ initialized: false })
        await useAuthStore.getState().initialize()
        
        setShowSuccess(true)
        
        setTimeout(() => {
           setShowSuccess(false)
           navigate('/dashboard')
        }, 5000)
      }
    } catch (error: any) {
      // Check if it's a duplicate registration error (email or phone already exists)
      if (error.message?.includes('already_registered') || error.message?.includes('already registered') || error.field) {
        setDuplicateError({
          field: error.field || 'email',
          message: error.userMessage || error.message || 'This account is already registered. Please login instead.'
        });
      } else {
        toast.error(error.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Helper mappings
  const indiaStates = State.getStatesOfCountry('IN')
  const mappedStates = indiaStates.map(s => ({ value: s.name, label: s.name }))
  
  const selectedStateObj = form.state ? indiaStates.find(s => s.name === form.state) : null
  const mappedCities = selectedStateObj 
    ? City.getCitiesOfState('IN', selectedStateObj.isoCode).map(c => ({ value: c.name, label: c.name }))
    : []
  
  const targetCasteOptions = activeCommunities.length > 0
    ? activeCommunities.map(c => ({ value: c.name, label: c.name }))
    : [{ value: communityName, label: communityName }];

  const selectedCommunityData = activeCommunities.find(c => c.name === (form.caste || communityName));
  let mappedSubCastes = selectedCommunityData?.sub_castes?.map(s => ({ value: s, label: s })) ||
    getSubCastesByCaste(castes.find(c => c.name === communityName)?.id || '').map(s => ({ value: s.name, label: s.name }));

  // Fallback if admin hasn't configured it in backend yet
  if (mappedSubCastes.length === 0) {
     mappedSubCastes = [
       { value: `Halai`, label: `Halai` },
       { value: `Ghoghari`, label: `Ghoghari` },
       { value: `Kutchi`, label: `Kutchi` }
     ];
  }

  const getStepSummary = (stepId: number) => {
    switch(stepId) {
      case 1: return `${form.profile_for} • ${form.gender || 'Pending'}`
      case 2: return form.first_name ? `${form.first_name} ${form.last_name} • ${form.date_of_birth}` : ''
      case 3: return form.email ? `${form.email} • +91 ${form.phone}` : ''
      case 4: return form.caste ? `${form.religion} • ${form.caste}` : ''
      case 5: return form.city ? `${form.city}, ${form.state}` : ''
      case 6: return form.occupation ? `${form.highest_education} • ${form.occupation}` : ''
      case 7: return form.marital_status ? `${form.marital_status} • ${form.height_cm || ''} cm` : ''
      case 8: return form.family_type ? form.family_type : ''
      case 9: return profilePhotoFile ? 'Photo & Docs attached' : 'No docs attached'
      default: return ''
    }
  }

  const renderStepContent = (stepId: number) => {
    switch (stepId) {
      case 1:
        return (
          <div className="space-y-4 py-4">
            <Select name="profile_for" label="Profile For *" options={profileForOptions.map(opt => ({ value: opt, label: opt }))} value={form.profile_for} onChange={handleChange} error={errors.profile_for} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gender *</label>
              <div className="grid grid-cols-2 gap-4">
                <div onClick={() => { setForm({...form, gender: 'Male'}); setErrors({...errors, gender: ''}) }} className={`border-2 rounded-xl p-4 cursor-pointer text-center transition-all relative ${form.gender === 'Male' ? 'border-primary bg-primary-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl">👨</div>
                  <div className="font-medium mt-1">Male</div>
                  {form.gender === 'Male' && <CheckCircle className="absolute top-2 right-2 text-primary" size={18} />}
                </div>
                <div onClick={() => { setForm({...form, gender: 'Female'}); setErrors({...errors, gender: ''}) }} className={`border-2 rounded-xl p-4 cursor-pointer text-center transition-all relative ${form.gender === 'Female' ? 'border-primary bg-primary-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl">👩</div>
                  <div className="font-medium mt-1">Female</div>
                  {form.gender === 'Female' && <CheckCircle className="absolute top-2 right-2 text-primary" size={18} />}
                </div>
              </div>
              {errors.gender && <p className="text-red-500 text-sm mt-1">{errors.gender}</p>}
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input name="first_name" label="First Name *" value={form.first_name} onChange={handleChange} error={errors.first_name} />
              <Input name="last_name" label="Last Name *" value={form.last_name} onChange={handleChange} error={errors.last_name} />
            </div>
            <Input name="date_of_birth" label="Date of Birth *" type="date" value={form.date_of_birth} onChange={handleChange} error={errors.date_of_birth} helpText="Must be between 18-70 years old" />
          </div>
        )
      case 3:
        return (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input name="email" label="Email Address *" type="email" value={form.email} onChange={handleChange} error={errors.email} disabled={otpVerified}
                  onBlur={async () => {
                    if (!form.email || !/^\S+@\S+\.\S+$/.test(form.email)) return;
                    try {
                      const r = await fetch(apiUrl('/api/auth/check-duplicate'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email }) });
                      const d = await r.json();
                      if (r.status === 409 || d.duplicate) setDuplicateError({ field: 'email', message: d.message || `Email (${form.email}) is already registered.` });
                    } catch {}
                  }}
                />
              </div>
              
              <div className="relative">
                <Input name="phone" label="Phone Number *" type="tel" value={form.phone} onChange={handleChange} error={errors.phone} disabled={otpVerified} />
                {otpVerified && <CheckCircle className="absolute right-3 top-9 text-green-500" size={18} />}
                
                {!otpVerified && form.phone.length === 10 && !otpSent && (
                  <Button variant="primary" size="sm" type="button" className="mt-2 w-full" onClick={handleSendOTP} loading={otpLoading}>
                    Send OTP to Verify
                  </Button>
                )}
              </div>
            </div>

            {otpSent && !otpVerified && (
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 animate-in fade-in zoom-in duration-300">
                <label className="block text-sm font-bold text-gray-800 mb-2 text-center">Enter 6-Digit OTP</label>
                <div className="flex justify-center gap-2 mb-4">
                  {otpValues.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => otpRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      value={digit}
                      onChange={e => handleOtpChange(index, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm font-medium text-gray-500">
                    {otpCountdown > 0 ? (
                      <span>Resend OTP in <span className="text-primary font-bold">{otpCountdown}s</span></span>
                    ) : (
                      <button type="button" onClick={handleSendOTP} className="text-primary hover:underline font-bold" disabled={otpLoading}>
                        Resend OTP
                      </button>
                    )}
                  </div>
                  <Button variant="primary" type="button" onClick={handleVerifyOTP} loading={otpLoading} disabled={otpValues.join('').length !== 6}>
                    Verify OTP
                  </Button>
                </div>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!otpVerified ? 'opacity-50 pointer-events-none' : ''}`}>
              <Input name="password" label="Password *" type="password" value={form.password} onChange={handleChange} error={errors.password} />
              <Input name="confirm_password" label="Confirm Password *" type="password" value={form.confirm_password} onChange={handleChange} error={errors.confirm_password} />
            </div>
            {!otpVerified && form.phone.length === 10 && <p className="text-sm text-amber-600 font-medium text-center bg-amber-50 p-2 rounded-lg mt-2">Please verify your phone number to proceed.</p>}
          </div>
        )
      case 4:
        return (
          <div className="space-y-4 py-4">
            <Select name="religion" label="Religion *" options={[{ value: 'Hindu', label: 'Hindu' }]} value={form.religion} onChange={handleChange} error={errors.religion} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                name="caste"
                label="Community / Caste *"
                options={targetCasteOptions}
                value={form.caste || communityName}
                onChange={handleChange}
                error={errors.caste}
                placeholder="Select Community"
              />
              <Select name="sub_caste" label="Sub Caste (Optional)" options={mappedSubCastes} value={form.sub_caste} onChange={handleChange} placeholder="Select Sub Caste" disabled={mappedSubCastes.length === 0} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input name="gotra" label="Gotra (Optional)" value={form.gotra} onChange={handleChange} />
              <Select name="mother_tongue" label="Mother Tongue" options={motherTongueOptions.map(opt => ({ value: opt, label: opt }))} value={form.mother_tongue} onChange={handleChange} />
            </div>

            <div className="border-t border-gray-100 mt-6 pt-6">
              <h3 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2"><Star size={18} className="text-primary" /> Astrological Details</h3>
              
              <div className="space-y-4">
                <Select name="manglik" label="Manglik Status *" options={manglikOptions.map(opt => ({ value: opt, label: opt }))} value={form.manglik} onChange={handleChange} error={errors.manglik} placeholder="Select Status" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select name="rashi" label="Rashi / Moon Sign (Optional)" options={rashiOptions.map(opt => ({ value: opt, label: opt }))} value={form.rashi} onChange={handleChange} placeholder="Select Rashi" />
                  <Select name="nakshatra" label="Nakshatra (Optional)" options={nakshatraOptions.map(opt => ({ value: opt, label: opt }))} value={form.nakshatra} onChange={handleChange} placeholder="Select Nakshatra" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input name="birth_time" label="Birth Time (Optional)" type="time" value={form.birth_time} onChange={handleChange} />
                  <Input name="birth_place" label="Birth Place (Optional)" value={form.birth_place} onChange={handleChange} placeholder="City, State" />
                </div>
              </div>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-4 py-4">
            <Select name="state" label="State *" options={mappedStates} value={form.state} onChange={handleChange} error={errors.state} placeholder="Select State" />
            <Select name="city" label="City / Taluka *" options={mappedCities} value={form.city} onChange={handleChange} error={errors.city} placeholder="Select City or Taluka" disabled={!form.state} />
          </div>
        )
      case 6:
        return (
          <div className="space-y-4 py-4">
            <Select name="highest_education" label="Highest Education *" options={educationOptions.map(opt => ({ value: opt, label: opt }))} value={form.highest_education} onChange={handleChange} error={errors.highest_education} placeholder="Select Education" />
            <Select name="occupation" label="Occupation *" options={occupationOptions.map(opt => ({ value: opt, label: opt }))} value={form.occupation} onChange={handleChange} error={errors.occupation} placeholder="Select Occupation" />
             <Select name="annual_income" label="Annual Income (Optional)" options={incomeOptions.map(opt => ({ value: opt, label: opt }))} value={form.annual_income} onChange={handleChange} placeholder="Select Income" />
          </div>
        )
      case 7:
        return (
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Physical Attributes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select name="marital_status" label="Marital Status *" options={maritalStatusOptions.map(opt => ({ value: opt, label: opt }))} value={form.marital_status} onChange={handleChange} error={errors.marital_status} placeholder="Select Marital Status" />
                <Select name="height_cm" label="Height (cm) *" options={heightOptions.map(opt => ({ value: opt.value.toString(), label: opt.label }))} value={form.height_cm} onChange={handleChange} error={errors.height_cm} placeholder="Select height" />
                <Input name="weight_kg" label="Weight (kg) *" type="number" min="0" value={form.weight_kg} onChange={handleChange} error={errors.weight_kg} placeholder="e.g. 65" />
                <Select name="body_type" label="Body Type *" options={bodyTypeOptions.map(opt => ({ value: opt, label: opt }))} value={form.body_type} onChange={handleChange} error={errors.body_type} placeholder="Select Body Type" />
                <Select name="complexion" label="Complexion (Optional)" options={complexionOptions.map(opt => ({ value: opt, label: opt }))} value={form.complexion} onChange={handleChange} placeholder="Select Complexion" />
                <Select name="blood_group" label="Blood Group (Optional)" options={bloodGroupOptions.map(opt => ({ value: opt, label: opt }))} value={form.blood_group} onChange={handleChange} placeholder="Select Blood Group" />
                <Select name="physical_disability" label="Any Disability? *" options={[{value: 'No', label: 'No'}, {value: 'Yes', label: 'Yes'}]} value={form.physical_disability} onChange={handleChange} />
              </div>
              {form.physical_disability === 'Yes' && (
                <div className="mt-2 text-sm">
                  <Input name="disability_desc" label="Please Mention Disability *" value={form.disability_desc} onChange={handleChange} error={errors.disability_desc} placeholder="Describe briefly" />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Lifestyle Habits</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select name="diet" label="Diet (Optional)" options={dietOptions.map(opt => ({ value: opt, label: opt }))} value={form.diet} onChange={handleChange} placeholder="Select Diet" />
                <Select name="smoking" label="Smoking (Optional)" options={smokingDrinkingOptions.map(opt => ({ value: opt, label: opt }))} value={form.smoking} onChange={handleChange} placeholder="Select Option" />
                <Select name="drinking" label="Drinking (Optional)" options={smokingDrinkingOptions.map(opt => ({ value: opt, label: opt }))} value={form.drinking} onChange={handleChange} placeholder="Select Option" />
              </div>
              <div className="mt-4">
                <MultiSelect 
                  label="Hobbies & Interests (Optional)" 
                  options={hobbiesList} 
                  selectedValues={form.hobbies} 
                  onChange={(values) => setForm(prev => ({ ...prev, hobbies: values }))}
                  placeholder="Select hobbies..."
                  maxSelect={10}
                />
              </div>
            </div>
          </div>
        )
      case 8:
        const mappedMosalCities = form.mosal_state 
          ? City.getCitiesOfState('IN', indiaStates.find(s => s.name === form.mosal_state)?.isoCode || '').map(c => ({ value: c.name, label: c.name }))
          : []
        
        return (
          <div className="space-y-4 py-4 px-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select name="family_type" label="Family Type *" options={familyTypeOptions.map(opt => ({ value: opt, label: opt }))} value={form.family_type} onChange={handleChange} error={errors.family_type} placeholder="Select Family Type" />
              <Select name="family_status" label="Family Status (Optional)" options={familyStatusOptions.map(opt => ({ value: opt, label: opt }))} value={form.family_status} onChange={handleChange} placeholder="Select Status" />
              <Select name="family_values" label="Family Values (Optional)" options={familyValuesOptions.map(opt => ({ value: opt, label: opt }))} value={form.family_values} onChange={handleChange} placeholder="Select Values" />
            </div>
            
            {['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled', 'Engagement Broken'].includes(form.marital_status) && (
               <div className="mt-2 mb-4 p-4 border rounded-lg bg-gray-50 border-gray-100">
                 <h4 className="font-medium text-sm text-gray-700 mb-3">Children Details</h4>
                 <Input name="children_count" label="Number of Children" type="number" min="0" value={form.children_count} onChange={(e) => {
                   const count = parseInt(e.target.value) || 0;
                   if (count < 0) return;
                   const newChildren = Array.from({length: count}).map(() => ({name: '', gender: 'Boy', age: ''}));
                   setForm(prev => ({...prev, children_count: e.target.value, children: newChildren.map((nc, idx) => prev.children[idx] || nc)}));
                 }} error={errors.children_count} />
                 
                 {parseInt(form.children_count) > 0 && form.children.map((child, index) => (
                   <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 border-t pt-3">
                     <Input name={`child_${index}_name`} label={`Child ${index+1} Name`} value={child.name} onChange={(e) => {
                       const nc = [...form.children]; nc[index] = {...nc[index], name: e.target.value}; setForm({...form, children: nc});
                     }} error={errors[`child_${index}_name`]} />
                     <Select name={`child_${index}_gender`} label={`Child ${index+1} Gender`} options={[{value: 'Boy', label: 'Boy'}, {value: 'Girl', label: 'Girl'}]} value={child.gender} onChange={(e) => {
                       const nc = [...form.children]; nc[index] = {...nc[index], gender: e.target.value}; setForm({...form, children: nc});
                     }} error={errors[`child_${index}_gender`]} />
                     <Input name={`child_${index}_age`} label={`Child ${index+1} Age (Years)`} type="number" min="0" value={child.age} onChange={(e) => {
                       const nc = [...form.children]; nc[index] = {...nc[index], age: e.target.value}; setForm({...form, children: nc});
                     }} error={errors[`child_${index}_age`]} />
                   </div>
                 ))}
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input name="father_name" label="Father's Name *" value={form.father_name} onChange={handleChange} error={errors.father_name} />
              <Select name="father_occupation" label="Father's Business/Occ" options={['Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(opt => ({ value: opt, label: opt }))} value={form.father_occupation} onChange={handleChange} placeholder="Select Occupation" />
              <Input name="mother_name" label="Mother's Name *" value={form.mother_name} onChange={handleChange} error={errors.mother_name} />
              <Select name="mother_occupation" label="Mother's Business/Housewife" options={['Housewife', 'Business', 'Service', 'Private Job', 'Government Job', 'Retired', 'Other'].map(opt => ({ value: opt, label: opt }))} value={form.mother_occupation} onChange={handleChange} placeholder="Select Occupation" />
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <Input name="brothers" label="Total Brothers" type="number" min="0" value={form.brothers} onChange={handleChange} error={errors.brothers} />
              <Input name="married_brothers" label="Married Brothers" type="number" min="0" value={form.married_brothers} onChange={handleChange} error={errors.married_brothers} />
              <Input name="sisters" label="Total Sisters" type="number" min="0" value={form.sisters} onChange={handleChange} error={errors.sisters} />
              <Input name="married_sisters" label="Married Sisters" type="number" min="0" value={form.married_sisters} onChange={handleChange} error={errors.married_sisters} />
            </div>

            <h4 className="font-semibold text-sm text-primary mt-4 border-b pb-1">Mosal (Maternal) Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input name="mosal_name" label="Mosal Name" value={form.mosal_name} onChange={handleChange} />
              <Select name="mosal_state" label="Mosal State" options={mappedStates} value={form.mosal_state} onChange={(e) => { setForm(prev => ({...prev, mosal_state: e.target.value, mosal_city: ''})) }} placeholder="Select State" />
              <Select name="mosal_city" label="Mosal City/Taluka" options={mappedMosalCities} value={form.mosal_city} onChange={handleChange} disabled={!form.mosal_state} placeholder="Select City" />
              <Select name="family_income" label="Family Income" options={incomeOptions.map(opt => ({ value: opt, label: opt }))} value={form.family_income} onChange={handleChange} placeholder="Select Income" />
            </div>
            <Input name="mosal_address" label="Mosal Valid Address" value={form.mosal_address} onChange={handleChange} />
          </div>
        )
      case 9:
        return (
          <div className="space-y-4 py-4">
            <h4 className="font-semibold text-gray-800">Add a Profile Photo <span className="text-gray-400 font-normal text-sm border px-2 py-0.5 rounded ml-2">Optional</span></h4>
            <div className="flex gap-4 items-center">
              <div className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden cursor-pointer hover:border-primary transition group" onClick={() => profilePhotoRef.current?.click()}>
                {profilePhotoPreview ? <img src={profilePhotoPreview} className="w-full h-full object-cover" alt="Profile" /> : <Camera className="text-gray-400 group-hover:text-primary" />}
                <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; 
                  if(f) { setProfilePhotoFile(f); setProfilePhotoPreview(URL.createObjectURL(f)) }
                }} />
              </div>
              <p className="text-xs text-gray-500 max-w-[200px]">Profiles with photos get 10x more responses. You can change this later.</p>
            </div>

            <h4 className="font-semibold text-gray-800 mt-6 pt-4 border-t">Aadhaar Card Upload <span className="text-red-500 font-bold ml-1">* Required</span></h4>
            <p className="text-xs text-gray-500 mb-2">Build trust instantly by verifying your profile. Both sides must be uploaded.</p>
            <div className="grid grid-cols-2 gap-4">
                <div onClick={() => !aadhaarFront && aadhaarFrontRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition relative ${errors.aadhaar && !aadhaarFront ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'}`}>
                  {!aadhaarFront ? <><Upload className="text-gray-400 mx-auto mb-2" size={24} /><span className="text-xs font-medium">Add Front Side</span></> : <><FileText className="text-primary mx-auto mb-2" size={24}/><span className="text-xs text-green-600 font-bold truncate block">{aadhaarFront.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarFront(null) }}><X size={16}/></button></>}
                  <input ref={aadhaarFrontRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarFront(e.target.files[0]); setErrors({...errors, aadhaar: ''}) }} />
                </div>
                <div onClick={() => !aadhaarBack && aadhaarBackRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition relative ${errors.aadhaar && !aadhaarBack ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-primary hover:bg-primary-50'}`}>
                  {!aadhaarBack ? <><Upload className="text-gray-400 mx-auto mb-2" size={24} /><span className="text-xs font-medium">Add Back Side</span></> : <><FileText className="text-primary mx-auto mb-2" size={24}/><span className="text-xs text-green-600 font-bold truncate block">{aadhaarBack.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setAadhaarBack(null) }}><X size={16}/></button></>}
                  <input ref={aadhaarBackRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { e.target.files?.[0] && setAadhaarBack(e.target.files[0]); setErrors({...errors, aadhaar: ''}) }} />
                </div>
            </div>

            <h4 className="font-semibold text-gray-800 mt-6 pt-4 border-t">Biodata Document <span className="text-gray-400 font-normal text-sm border px-2 py-0.5 rounded ml-2">Optional</span></h4>
            <div onClick={() => !biodataFile && biodataFileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-primary hover:bg-primary-50 transition relative">
              {!biodataFile ? <><Upload className="text-gray-400 mx-auto mb-2" size={24} /><span className="text-xs font-medium">Upload PDF/Image Biodata</span></> : <><FileText className="text-primary mx-auto mb-2" size={24}/><span className="text-xs text-green-600 font-bold truncate block">{biodataFile.name}</span><button type="button" className="absolute top-1 right-1 text-red-500" onClick={(e) => { e.stopPropagation(); setBiodataFile(null) }}><X size={16}/></button></>}
              <input ref={biodataFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setBiodataFile(e.target.files[0])} />
            </div>

            <div className="mt-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="agreeTerms" className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary" checked={form.agreeTerms} onChange={(e) => { setForm(prev => ({...prev, agreeTerms: e.target.checked})); setErrors({...errors, agreeTerms: ''}) }} />
                <span className="text-sm text-gray-600">I confirm that all information provided is accurate and I agree to the <Link to="/terms" className="text-primary hover:underline font-medium">Terms of Service</Link> and <Link to="/privacy-policy" className="text-primary hover:underline font-medium">Privacy Policy</Link>.</span>
              </label>
              {errors.agreeTerms && <p className="text-red-500 text-sm mt-2 ml-8 font-medium">{errors.agreeTerms}</p>}
            </div>
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row items-start relative">

      {/* ── Already Registered Popup ── */}
      {duplicateError && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDuplicateError(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Already Registered!</h3>
            <p className="text-gray-600 text-sm mb-6">{duplicateError.message}</p>
            <div className="space-y-3">
              <a href="/login" className="block w-full px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-center">
                Login Now
              </a>
              <a href="/forgot-password" className="block w-full px-6 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-center">
                Forgot Password?
              </a>
              <button onClick={() => setDuplicateError(null)} className="text-sm text-gray-400 hover:text-gray-600 mt-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Panel - Premium Matrimonial Branding */}
      <div className="w-full md:w-5/12 lg:w-1/3 bg-primary text-white p-6 md:p-12 relative flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden z-10 shadow-lg">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
           <div className="absolute top-[-20%] left-[-20%] w-96 h-96 bg-white rounded-full blur-3xl"></div>
           <div className="absolute bottom-[10%] right-[-10%] w-64 h-64 bg-secondary rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex-shrink-0">
          <Link to="/" className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all">
            <Heart className="text-secondary" size={20} fill="currentColor" />
            <span className="font-heading font-bold text-xl">{siteName}</span>
          </Link>
        </div>

        <div className="relative z-10 mt-10 mb-8 md:my-16 flex-1 flex flex-col justify-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold leading-tight mb-6 hidden md:block">
            Find Your <br/><span className="text-secondary">Perfect Match</span>
          </h1>
          <h1 className="text-3xl font-heading font-bold leading-tight mb-2 md:hidden">
            Create Your Profile
          </h1>
          <p className="text-white/80 text-lg max-w-sm md:mb-10">Join {communityName}'s most trusted matrimonial platform with thousands of verified profiles.</p>
          
          <div className="space-y-6 hidden md:block mt-8">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 text-secondary">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold">100% Verified</h4>
                <p className="text-sm text-white/70">Aadhaar verified genuine profiles only.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 text-secondary">
                <Star size={24} />
              </div>
              <div>
                <h4 className="font-bold">Premium Features</h4>
                <p className="text-sm text-white/70">Get 10 contact unlocks free every month.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 hidden md:block text-sm text-white/50">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Cascading Wizard */}
      <div className="w-full md:w-7/12 lg:w-2/3 px-4 py-8 md:p-12 lg:p-16 relative z-0">
        <div className="max-w-2xl mx-auto">
          
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 font-heading mb-2">Create Your Account</h2>
            <p className="text-gray-500">Already a member? <Link to="/login" className="text-primary font-bold hover:underline">Log In</Link></p>
          </div>

          {/* Centered Social Sign Up Options */}
          <div className="mb-8 max-w-md mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSocialSignup('google')}
                className="w-full border border-gray-300 bg-white hover:bg-gray-50 rounded-xl py-3 flex items-center justify-center gap-3 font-medium text-gray-700 shadow-sm transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => handleSocialSignup('facebook')}
                className="w-full border border-[#1877F2] bg-[#1877F2] hover:bg-[#166FE5] rounded-xl py-3 flex items-center justify-center gap-3 font-medium text-white shadow-sm transition"
              >
                <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
            </div>
            
            <div className="mt-8 flex items-center gap-4">
              <hr className="flex-1 border-gray-200" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">or sign up with email</span>
              <hr className="flex-1 border-gray-200" />
            </div>
          </div>
          
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Registration Details</h3>
            <div className="bg-primary/5 text-primary font-bold px-4 py-1.5 rounded-full border border-primary/20 flex items-center gap-2 text-xs shadow-sm">
              Step {activeStep} of {CAS_STEPS.length}
            </div>
          </div>

          <div className="space-y-4 pb-24">
            {CAS_STEPS.map((step) => {
              const isActive = activeStep === step.id
              const isCompleted = completedSteps.includes(step.id) || activeStep > step.id // visually complete if prior

              return (
                <motion.div 
                  key={step.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`bg-white rounded-2xl border overflow-hidden transition-shadow ${isActive ? 'border-primary/40 shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-primary/20' : isCompleted ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                >
                  <div 
                    className={`flex items-center justify-between p-5 md:p-6 ${isCompleted && !isActive ? 'cursor-pointer hover:bg-gray-50' : ''} ${isActive ? 'bg-primary/5 border-b border-primary/10' : ''}`}
                    onClick={() => { if (isCompleted && !isActive) setActiveStep(step.id) }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isActive ? 'bg-primary text-white shadow-md shadow-primary/30' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {isCompleted && !isActive ? <CheckCircle size={20} /> : step.id}
                      </div>
                      <div>
                        <h3 className={`font-bold transition-colors ${isActive ? 'text-primary text-lg' : 'text-gray-900 text-base'}`}>{step.title}</h3>
                        {!isActive && <p className="text-xs text-gray-500 mt-0.5">{isCompleted ? getStepSummary(step.id) : step.desc}</p>}
                      </div>
                    </div>
                    {isCompleted && !isActive && (
                      <button className="text-primary text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-primary/10 transition">
                        Edit
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        <div className="p-5 md:p-6 bg-white">
                          {renderStepContent(step.id)}
                          
                          <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                             {step.id > 1 && (
                               <Button variant="outline" type="button" onClick={() => prevStep(step.id)}>
                                 Back
                               </Button>
                             )}
                             
                             {step.id < CAS_STEPS.length ? (
                               <Button variant="primary" type="button" onClick={() => nextStep(step.id)} className="px-8 shadow-lg shadow-primary/30">
                                 Continue
                               </Button>
                             ) : (
                               <Button variant="primary" type="button" onClick={triggerSubmit} loading={loading} className="px-8 shadow-lg shadow-primary/30 bg-secondary hover:bg-secondary-600 border-none">
                                 {loading ? 'Creating Account...' : 'Complete Registration 🎉'}
                               </Button>
                             )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>

        </div>
      </div>

      <ConfirmDialog 
        isOpen={showSuccess}
        title={`Thank you for Registration with ${siteName}`}
        message="Please wait until your Profile approved by our team."
        confirmText="Yes, understood"
        variant="primary"
        hideCancel={true}
        onConfirm={() => {
          setShowSuccess(false)
          navigate('/dashboard')
        }}
        onClose={() => {
          setShowSuccess(false)
          navigate('/dashboard')
        }}
      />
    </div>
  )
}
