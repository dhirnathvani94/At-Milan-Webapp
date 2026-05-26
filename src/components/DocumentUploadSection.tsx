import { useState, useEffect } from 'react'
import { Upload, FileText, CheckCircle, Clock, XCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUserDocuments, uploadDocument } from '../lib/actions/authActions'
import { VerificationDocument } from '../lib/types'
import Button from './ui/Button'
import Spinner from './ui/Spinner'
import { useAuthStore } from '../store/authStore'

interface DocumentUploadSectionProps {
  userId: string
  onUploadComplete?: () => void
}

export default function DocumentUploadSection({ userId, onUploadComplete }: DocumentUploadSectionProps) {
  const { profile } = useAuthStore()
  const [documents, setDocuments] = useState<VerificationDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)

  const fetchDocs = async () => {
    try {
      setLoading(true)
      const docs = await getUserDocuments(userId)
      setDocuments(docs || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId && profile?.role !== 'admin') fetchDocs()
  }, [userId])

  // Admins never see document upload section — it's for regular users only
  if (profile?.role === 'admin') return null

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'aadhaar_front' | 'aadhaar_back' | 'biodata') => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxSize = type === 'biodata' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`File too large. Max size is ${type === 'biodata' ? '10MB' : '5MB'}`)
      return
    }

    try {
      setUploading(type)
      await uploadDocument(userId, file, type)
      toast.success(`${type.replace('_', ' ')} uploaded successfully!`)
      await fetchDocs()
      if (onUploadComplete) onUploadComplete()
    } catch (error: any) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  const getDoc = (type: string) => documents.find(d => d.document_type === type)

  const renderDocCard = (type: 'aadhaar_front' | 'aadhaar_back' | 'biodata', title: string, accept: string) => {
    const doc = getDoc(type)
    const isUploading = uploading === type

    if (doc) {
    return (
        <div className="border rounded-xl p-4 bg-gray-50 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              doc.verification_status === 'approved' ? 'bg-green-100 text-green-600' :
              doc.verification_status === 'rejected' ? 'bg-red-100 text-red-600' :
              'bg-yellow-100 text-yellow-600'
            }`}>
              {doc.verification_status === 'approved' ? <CheckCircle size={20} /> :
               doc.verification_status === 'rejected' ? <XCircle size={20} /> :
               <Clock size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-gray-900 truncate">{title}</h4>
              <p className="text-xs text-gray-500 truncate max-w-full">{doc.file_name}</p>
              {doc.verification_status === 'rejected' && doc.admin_notes && (
                <p className="text-xs text-red-600 mt-1 bg-red-50 p-1.5 rounded border border-red-100">
                  Reason: {doc.admin_notes}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
              doc.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
              doc.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {doc.verification_status.charAt(0).toUpperCase() + doc.verification_status.slice(1)}
            </span>
            
            {doc.verification_status !== 'approved' && (
              <div className="relative shrink-0">
                <input
                  type="file"
                  accept={accept}
                  onChange={(e) => handleUpload(e, type)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" size="sm" loading={isUploading}>
                  {doc.verification_status === 'rejected' ? 'Re-upload' : 'Replace'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors group">
        <input
          type="file"
          accept={accept}
          onChange={(e) => handleUpload(e, type)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isUploading}
        />
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Spinner size="md" className="mb-2" />
            <p className="text-sm text-gray-600">Uploading...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-primary-50 text-primary rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              {type === 'biodata' ? <FileText size={24} /> : <Upload size={24} />}
            </div>
            <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
            <p className="text-xs text-gray-500 text-center mb-3">
              {type === 'biodata' ? 'PDF only, max 10MB' : 'JPG, PNG or PDF, max 5MB'}
            </p>
            <Button variant="outline" size="sm" className="pointer-events-none">Select File</Button>
          </>
        )}
      </div>
    )
  }

  if (loading) return <div className="py-8 flex justify-center"><Spinner size="lg" /></div>

  const front = getDoc('aadhaar_front')
  const back = getDoc('aadhaar_back')
  const isVerified = front?.verification_status === 'approved' && back?.verification_status === 'approved'
  const hasPending = documents.some(d => d.verification_status === 'pending')
  const hasRejected = documents.some(d => d.verification_status === 'rejected')

  return (
    <div className="space-y-6">
      {isVerified ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-green-800">Your profile is verified!</h4>
            <p className="text-sm text-green-700 mt-1">Your Aadhaar documents have been approved. You now have a verified badge.</p>
          </div>
        </div>
      ) : hasRejected ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-red-800">Document rejected</h4>
            <p className="text-sm text-red-700 mt-1">Please check the notes below and re-upload valid documents.</p>
          </div>
        </div>
      ) : hasPending ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="text-yellow-600 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-yellow-800">Documents under review</h4>
            <p className="text-sm text-yellow-700 mt-1">Our team is reviewing your documents. This usually takes 24-48 hours.</p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="text-blue-500 shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-bold text-blue-800">Upload Aadhaar to get verified</h4>
            <p className="text-sm text-blue-700 mt-1">Verified profiles get 5x more responses! Upload front and back of your Aadhaar card.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderDocCard('aadhaar_front', 'Aadhaar Card - Front', 'image/*,.pdf')}
        {renderDocCard('aadhaar_back', 'Aadhaar Card - Back', 'image/*,.pdf')}
      </div>

      <div className="mt-8">
        <h4 className="font-medium text-gray-900 mb-4">Additional Documents (Optional)</h4>
        {renderDocCard('biodata', 'Biodata (PDF)', '.pdf')}
      </div>
    </div>
  )
}
