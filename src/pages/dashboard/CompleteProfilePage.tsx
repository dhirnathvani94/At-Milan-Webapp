import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { 
  getCompleteProfile, 
  savePersonalDetails, 
  saveEducationCareer, 
  saveFamilyDetails, 
  saveLifestyle, 
  savePartnerPreferences 
} from '../../lib/actions/profileActions'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Step1Personal from '../../components/profile-steps/Step1Personal'
import Step2Education from '../../components/profile-steps/Step2Education'
import Step3Family from '../../components/profile-steps/Step3Family'
import Step4Lifestyle from '../../components/profile-steps/Step4Lifestyle'
import Step5Photos from '../../components/profile-steps/Step5Photos'
import Step6Preferences from '../../components/profile-steps/Step6Preferences'
import { 
  CheckCircle, 
  User, 
  GraduationCap, 
  Users, 
  Heart, 
  Camera, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Loader2 
} from 'lucide-react'
import { PageSkeleton } from '../../components/ui/Skeletons'

const steps = [
  { number: 1, title: 'Personal Info', icon: User },
  { number: 2, title: 'Professional Info', icon: GraduationCap },
  { number: 3, title: 'Family Detail', icon: Users },
  { number: 4, title: 'Lifestyle Info', icon: Heart },
  { number: 5, title: 'Photos', icon: Camera },
  { number: 6, title: 'Partner Pref.', icon: Settings }
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, setProfile , loading: authLoading} = useAuthStore()
  const stepParam = parseInt(searchParams.get('step') || '0', 10)
  const [currentStep, setCurrentStep] = useState(stepParam >= 1 && stepParam <= 6 ? stepParam : 1)
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveRef = useRef<(() => void) | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchProfileData()
    }
  }, [user?.id])

  useEffect(() => {
    const stepParam = parseInt(searchParams.get('step') || '0', 10)
    if (stepParam >= 1 && stepParam <= 6) {
      setCurrentStep(stepParam)
    }
  }, [searchParams])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      const data = await getCompleteProfile((user?.id || ''))
      setProfileData(data)
      
      // Determine current step based on completion ONLY if no explicit step in URL
      const stepParam = parseInt(searchParams.get('step') || '0', 10)
      if (!stepParam) {
        if (data.profile?.profile_completion >= 100) {
          // If already 100%, maybe they just want to edit. Default to 1.
        } else if (!data.profile?.about_me) {
          setCurrentStep(1)
        } else if (!data.education?.highest_education) {
          setCurrentStep(2)
        } else if (!data.family?.family_type) {
          setCurrentStep(3)
        } else if (!data.lifestyle?.diet) {
          setCurrentStep(4)
        } else if (!data.profile?.profile_photo_url) {
          setCurrentStep(5)
        } else if (!data.preferences?.age_from) {
          setCurrentStep(6)
        }
      }
    } catch (error) {
      toast.error('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAndNext = () => {
    setShowConfirm(true)
  }

  const confirmSave = () => {
    if (saveRef.current) {
      saveRef.current()
    }
  }

  const handleStepSave = async (stepData: any) => {
    setSaving(true)
    try {
      const userId = (user?.id || '')
      
      switch (stepData.step) {
        case 1:
          await savePersonalDetails(userId, stepData.data)
          break
        case 2:
          await saveEducationCareer(userId, stepData.data)
          break
        case 3:
          await saveFamilyDetails(userId, stepData.data)
          if (stepData.childrenData) {
            await savePersonalDetails(userId, stepData.childrenData)
          }
          break
        case 4:
          await saveLifestyle(userId, stepData.lifestyleData, stepData.horoscopeData)
          break
        case 5:
          // Photos save themselves, just proceed
          break
        case 6:
          await savePartnerPreferences(userId, stepData.data)
          break
      }
      
      toast.success('Saved successfully! ✓')
      
      // Refetch profile data
      const updated = await getCompleteProfile(userId)
      setProfileData(updated)
      
      // Update auth store profile
      if (updated.profile) {
        setProfile(updated.profile)
      }
      
      if (currentStep < 6) {
        setCurrentStep(prev => prev + 1)
        window.scrollTo(0, 0)
      } else {
        // Last step - complete! Go to my-profile (avoids ProtectedRoute pending-approval redirect)
        toast.success('🎉 Profile completed! Redirecting...')
        setTimeout(() => navigate('/my-profile'), 2000)
      }
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error('Failed: ' + (error?.message || 'Unknown error. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  // Guard: wait for auth to be ready before rendering
  if (authLoading || loading) {
    return <PageSkeleton />
  }
  if (!user) return null

  const CurrentStepIcon = steps[currentStep - 1].icon

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CurrentStepIcon className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Complete Your Profile</h1>
              <p className="text-xs text-gray-500">Step {currentStep} of 6: {steps[currentStep - 1].title}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</p>
              <p className="text-sm font-bold text-primary">{profileData?.profile?.profile_completion || 10}%</p>
            </div>
            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: `${profileData?.profile?.profile_completion || 10}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 sticky top-24">
              <nav className="space-y-1">
                {steps.map((step) => {
                  const Icon = step.icon
                  const isCompleted = currentStep > step.number
                  const isActive = currentStep === step.number
                  
                  return (
                    <button
                      key={step.number}
                      onClick={() => step.number < currentStep && setCurrentStep(step.number)}
                      disabled={step.number > currentStep}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isActive 
                        ? 'bg-primary text-white shadow-md' 
                        : isCompleted 
                        ? 'text-green-600 hover:bg-green-50' 
                        : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-white text-primary' : isCompleted ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {isCompleted ? <CheckCircle size={14} /> : step.number}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap">{step.title}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Step Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100">
              {currentStep === 1 && (
                <Step1Personal 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                />
              )}
              {currentStep === 2 && (
                <Step2Education 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                />
              )}
              {currentStep === 3 && (
                <Step3Family 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                />
              )}
              {currentStep === 4 && (
                <Step4Lifestyle 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                />
              )}
              {currentStep === 5 && (
                <Step5Photos 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                  userId={(user?.id || '')}
                />
              )}
              {currentStep === 6 && (
                <Step6Preferences 
                  data={profileData} 
                  onSave={handleStepSave} 
                  saving={saving} 
                  saveRef={saveRef} 
                />
              )}

              {/* Navigation Buttons */}
              <div className="mt-12 pt-8 border-t flex items-center justify-between">
                <button
                  onClick={() => currentStep > 1 && setCurrentStep(prev => prev - 1)}
                  disabled={currentStep === 1 || saving}
                  className="flex items-center gap-2 px-6 py-3 text-gray-600 font-medium hover:text-primary disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                
                <button
                  onClick={handleSaveAndNext}
                  disabled={saving}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Saving...
                    </>
                  ) : (
                    <>
                      {currentStep === 6 ? 'Finish' : 'Save & Next'}
                      <ChevronRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm}
        title={currentStep === 6 ? "Finish Profile" : "Save Changes"}
        message={currentStep === 6 ? "Are you sure you want to finish setting up your profile?" : "Are you sure you want to save these changes and proceed?"}
        confirmText="Yes, Save"
        variant="primary"
        onConfirm={confirmSave}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  )
}
