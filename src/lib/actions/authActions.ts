import { apiUrl } from '../api'

export async function registerUser(data: {
  email: string
  password: string
  first_name: string
  last_name: string
  gender: string
  profile_for: string
  date_of_birth: string
  phone?: string
}) {
  const response = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const err = await response.json()
    // Pass structured error for duplicate detection
    if (err.error === 'already_registered') {
      const error: any = new Error(err.message || 'Already registered');
      error.field = err.field;
      error.userMessage = err.message;
      throw error;
    }
    throw new Error(err.error || err.message || 'Registration failed')
  }
  
  const authData = await response.json()
  if (authData.token) {
    localStorage.setItem('atmilan-token', authData.token)
  }
  return authData
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Login failed')
  }
  
  const data = await response.json()
  if (data.token) {
    localStorage.setItem('atmilan-token', data.token)
  }
  return data
}

export async function socialLoginUser(email: string, provider: 'google' | 'facebook') {
  const response = await fetch(apiUrl('/api/auth/social-login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, provider })
  })
  
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || `Failed to login via ${provider}`)
  }
  
  const data = await response.json()
  if (data.token) {
    localStorage.setItem('atmilan-token', data.token)
  }
  return data
}

export async function uploadDocument(
  userId: string,
  file: File,
  documentType: 'aadhaar_front' | 'aadhaar_back' | 'biodata'
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('userId', userId)
  formData.append('documentType', documentType)

  const response = await fetch(apiUrl('/api/upload'), {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Upload failed')
  }

  return response.json()
}

export async function getUserDocuments(userId: string) {
  const response = await fetch(apiUrl(`/api/documents/${userId}`))
  if (!response.ok) throw new Error('Failed to fetch documents')
  return response.json()
}

export async function updatePassword(newPassword: string) {
  // Local placeholder
  console.log('Update password locally:', newPassword)
}

export async function resetPassword(email: string) {
  const response = await fetch(apiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to send OTP')
  }
  return response.json()
}

export async function verifyResetOTP(email: string, otp: string) {
  const response = await fetch(apiUrl('/api/auth/verify-reset-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Invalid OTP')
  }
  return response.json() // returns { resetToken }
}

export async function confirmPasswordReset(email: string, resetToken: string, newPassword: string) {
  const response = await fetch(apiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, resetToken, newPassword })
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Failed to reset password')
  }
  return response.json()
}

export async function updateProfileField(userId: string, updates: Record<string, any>) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/personal`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!response.ok) throw new Error('Failed to update profile field')
}

export async function deactivateAccount(userId: string) {
  const response = await fetch(apiUrl(`/api/profiles/${userId}/personal`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false })
  })
  if (!response.ok) throw new Error('Failed to deactivate account')
  localStorage.removeItem('atmilan-token')
}

export async function deleteAccount(userId: string) {
  // Local implementation: just deactivate for now
  const response = await fetch(apiUrl(`/api/profiles/${userId}/personal`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false })
  })
  localStorage.removeItem('atmilan-token')
}
