import { useState, useEffect } from 'react'
import { Camera, Plus, Trash2, Info, CheckCircle, Star, FileText, Upload, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadProfilePhoto, uploadAdditionalPhoto, deletePhoto, setAsProfilePhoto, getUserPhotos } from '../../lib/actions/profileActions'
import { uploadDocument } from '../../lib/actions/authActions'
import { getVerificationStatus } from '../../lib/actions/documentActions'

interface Step5PhotosProps {
  data: any
  onSave: (stepData: any) => Promise<void>
  saving: boolean
  saveRef: React.MutableRefObject<(() => void) | null>
  userId: string
}

export default function Step5Photos({ data, onSave, saving, saveRef, userId }: Step5PhotosProps) {
  const [profilePhoto, setProfilePhoto] = useState<string | null>(data?.profile?.profile_photo_url || null)
  const [additionalPhotos, setAdditionalPhotos] = useState<any[]>(data?.photos?.filter((p: any) => !p.is_profile_photo) || [])
  const [uploading, setUploading] = useState<string | null>(null)
  const [biodataDoc, setBiodataDoc] = useState<any>(null)
  const [uploadingBiodata, setUploadingBiodata] = useState(false)

  const handleSave = () => {
    onSave({ step: 5, data: {} })
  }

  useEffect(() => {
    if (saveRef) {
      saveRef.current = handleSave
    }
  }, [])

  useEffect(() => {
    fetchBiodataStatus()
  }, [userId])

  const fetchBiodataStatus = async () => {
    try {
      const status = await getVerificationStatus(userId)
      if (status?.biodata) {
        setBiodataDoc(status.biodata)
      }
    } catch (e) {
      // silently ignore
    }
  }

  const handleBiodataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB')
      return
    }
    setUploadingBiodata(true)
    try {
      await uploadDocument(userId, file, 'biodata')
      await fetchBiodataStatus()
      toast.success('Biodata uploaded successfully!')
    } catch (error) {
      toast.error('Failed to upload biodata')
    } finally {
      setUploadingBiodata(false)
      // Reset input
      e.target.value = ''
    }
  }

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    setUploading('profile')
    try {
      const url = await uploadProfilePhoto(userId, file)
      
      // If there was a previous profile photo, we might want to move it to additional photos
      // But for simplicity, we just update the profile photo state
      setProfilePhoto(url)
      
      // Refresh additional photos to ensure we don't show the new profile photo there
      const photos = await getUserPhotos(userId)
      if (photos) {
        setAdditionalPhotos(photos.filter((p: any) => !p.is_profile_photo))
      }
      
      toast.success('Profile photo updated!')
    } catch (error) {
      toast.error('Failed to upload profile photo')
    } finally {
      setUploading(null)
    }
  }

  const handleAdditionalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (additionalPhotos.length >= 10) {
      toast.error('You can upload up to 10 additional photos')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB')
      return
    }

    setUploading('additional')
    try {
      const { url, photo } = await uploadAdditionalPhoto(userId, file)
      setAdditionalPhotos(prev => [...prev, photo])
      toast.success('Photo added!')
    } catch (error) {
      toast.error('Failed to upload photo')
    } finally {
      setUploading(null)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId)
      setAdditionalPhotos(prev => prev.filter(p => p.id !== photoId))
      toast.success('Photo deleted')
    } catch (error) {
      toast.error('Failed to delete photo')
    }
  }

  const handleSetAsProfilePhoto = async (photoId: string, photoUrl: string) => {
    try {
      await setAsProfilePhoto(userId, photoId, photoUrl)

      setProfilePhoto(photoUrl)
      
      // Refresh additional photos
      const photos = await getUserPhotos(userId)
      if (photos) {
        setAdditionalPhotos(photos.filter((p: any) => !p.is_profile_photo))
      }
      
      toast.success('Profile photo updated!')
    } catch (error) {
      console.error('Error setting profile photo:', error)
      toast.error('Failed to set profile photo')
    }
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2">
        <Camera className="text-primary" size={24} />
        <h2 className="text-xl font-semibold text-gray-800">Profile Photos</h2>
      </div>
      <p className="text-gray-500 text-sm">Add photos to make your profile more attractive and trustworthy</p>
      <hr className="mt-3 mb-6" />

      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="relative group">
          <div className={`w-48 h-48 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100 flex items-center justify-center ${uploading === 'profile' ? 'opacity-50' : ''}`}>
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <Camera size={48} className="text-gray-300" />
            )}
            
            {uploading === 'profile' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          <label className="absolute bottom-2 right-2 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-primary-dark transition-colors">
            <Plus size={24} />
            <input type="file" className="hidden" accept="image/*" onChange={handleProfilePhotoUpload} disabled={!!uploading} />
          </label>
        </div>
        <div className="text-center">
          <h3 className="font-medium text-gray-800">Main Profile Photo</h3>
          <p className="text-xs text-gray-500 mt-1">This will be your primary photo shown to others</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Additional Photos ({additionalPhotos.length}/10)</h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {additionalPhotos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group shadow-sm border border-gray-200">
              <img src={photo.photo_url} alt="Additional" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <button 
                  onClick={() => handleSetAsProfilePhoto(photo.id, photo.photo_url)}
                  className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                  title="Set as Profile Photo"
                >
                  <Star size={18} />
                </button>
                <button 
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                  title="Delete Photo"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          
          {additionalPhotos.length < 10 && (
            <label className={`aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary-50 transition-all ${uploading === 'additional' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Plus size={24} className="text-gray-400 mb-2" />
              <span className="text-xs font-medium text-gray-500">Add Photo</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleAdditionalPhotoUpload} disabled={!!uploading} />
            </label>
          )}
        </div>
      </div>

      {/* Biodata Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="text-primary" size={24} />
          <h3 className="text-xl font-semibold text-gray-800">Biodata Document</h3>
        </div>
        <p className="text-gray-500 text-sm">Upload your biodata PDF or image. This will be visible to accepted matches in the Contact Details section.</p>
        <hr className="mb-2" />

        <div className="p-5 border rounded-2xl bg-gray-50 border-gray-200 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <FileText size={28} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {biodataDoc ? (
              <>
                <p className="font-semibold text-gray-800 text-sm truncate">{biodataDoc.file_name || 'Biodata uploaded'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Uploaded on {new Date(biodataDoc.uploaded_at).toLocaleDateString()} &nbsp;·&nbsp;
                  <span className={`font-semibold capitalize ${
                    biodataDoc.verification_status === 'approved' ? 'text-green-600' :
                    biodataDoc.verification_status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {biodataDoc.verification_status === 'approved' ? '✓ Approved' :
                     biodataDoc.verification_status === 'rejected' ? '✗ Rejected' : '⏳ Pending Review'}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-gray-500 text-sm italic">No biodata uploaded yet.</p>
            )}
          </div>
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition shrink-0 ${
            uploadingBiodata
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-700'
          }`}>
            {uploadingBiodata ? (
              <><RefreshCw size={16} className="animate-spin" /> Uploading...</>
            ) : (
              <><Upload size={16} /> {biodataDoc ? 'Re-upload Biodata' : 'Upload Biodata'}</>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleBiodataUpload}
              disabled={uploadingBiodata}
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">Accepted formats: PDF, JPG, PNG · Max size: 10MB</p>
      </div>

      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Info className="text-blue-600" size={20} />
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-blue-900 text-sm">Photo Tips for Better Response</h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4 opacity-80">
            <li>Upload clear, high-quality recent photos</li>
            <li>Use photos with good lighting and simple backgrounds</li>
            <li>Include at least one full-length and one close-up photo</li>
            <li>Avoid group photos or photos with sunglasses/filters</li>
            <li>Profiles with photos get 10x more responses</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
