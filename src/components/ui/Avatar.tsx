import { useState } from 'react'

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fallbackName?: string
  gender?: string
  online?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl'
}

const DEFAULT_MALE = 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg'
const DEFAULT_FEMALE = 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'

export default function Avatar({ src, alt, size = 'md', fallbackName, gender, online, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  
  const defaultSrc = gender === 'Female' ? DEFAULT_FEMALE : DEFAULT_MALE
  const imageSrc = src && !imgError ? src : defaultSrc
  
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    return parts.map(p => p[0]?.toUpperCase() || '').slice(0, 2).join('')
  }

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      <img
        src={imageSrc}
        alt={alt || fallbackName || 'Avatar'}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-100`}
        onError={() => setImgError(true)}
      />
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
      )}
    </div>
  )
}
