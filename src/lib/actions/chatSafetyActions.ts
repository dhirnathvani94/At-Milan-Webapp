import { apiUrl } from '../api'

// Patterns to detect phone numbers and emails
const PHONE_PATTERNS = [
  /\b\d{10}\b/,
  /\b\d{5}[\s-]?\d{5}\b/,
  /\+91[\s-]?\d{10}\b/,
  /\+91[\s-]?\d{5}[\s-]?\d{5}\b/,
  /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/,
]

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

// Check if message contains phone or email
export function containsContactInfo(message: string): { hasPhone: boolean, hasEmail: boolean } {
  const hasPhone = PHONE_PATTERNS.some(pattern => pattern.test(message))
  const hasEmail = EMAIL_PATTERN.test(message)
  return { hasPhone, hasEmail }
}

// Check user's warning status and if they're blocked
export async function checkUserBlockStatus(userId: string): Promise<{
  isBlocked: boolean
  isPermanentlyBlocked: boolean
  blockedUntil: string | null
  warningCount: number
  canSendMessage: boolean
}> {
  try {
    const response = await fetch(apiUrl(`/api/chat-safety/status/${userId}`));
    if (!response.ok) throw new Error('Failed to fetch block status');
    return await response.json();
  } catch (error) {
    console.error('Error checking block status:', error)
    return { isBlocked: false, isPermanentlyBlocked: false, blockedUntil: null, warningCount: 0, canSendMessage: true }
  }
}

// Process contact info violation
export async function processContactViolation(
  userId: string,
  receiverId: string,
  messageContent: string,
  detectedPattern: string
): Promise<{
  action: 'warning_1' | 'warning_2' | 'block_24h' | 'permanent_block'
  warningCount: number
}> {
  try {
    const response = await fetch(apiUrl('/api/chat-safety/violation'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, receiverId, messageContent, detectedPattern })
    });
    if (!response.ok) throw new Error('Failed to process violation');
    return await response.json();
  } catch (error) {
    console.error('Error processing violation:', error)
    return { action: 'warning_1', warningCount: 1 }
  }
}

// Report a message
export async function reportMessage(reporterId: string, reportedUserId: string, messageId: string, messageContent: string, reason: string) {
  try {
    const response = await fetch(apiUrl('/api/chat-safety/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterId, reportedUserId, messageId, messageContent, reason })
    });
    if (!response.ok) throw new Error('Failed to report message');
    return await response.json();
  } catch (error) {
    console.error('Error reporting message:', error)
    throw error;
  }
}

// Submit unblock request
export async function submitUnblockRequest(userId: string, reason: string) {
  try {
    const response = await fetch(apiUrl('/api/chat-safety/unblock-request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason })
    });
    if (!response.ok) throw new Error('Failed to submit unblock request');
    return await response.json();
  } catch (error) {
    console.error('Error submitting unblock request:', error)
    throw error;
  }
}

// Admin: Approve unblock
export async function approveUnblock(requestId: string, userId: string, adminId: string) {
  try {
    const response = await fetch(apiUrl(`/api/admin/unblock-request/${requestId}/handle`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, status: 'approved', notes: 'Approved by admin' })
    });
    if (!response.ok) throw new Error('Failed to approve unblock');
    return await response.json();
  } catch (error) {
    console.error('Error approving unblock:', error)
    throw error;
  }
}

// Admin: Reject unblock
export async function rejectUnblock(requestId: string, adminId: string, notes: string) {
  try {
    const response = await fetch(apiUrl(`/api/admin/unblock-request/${requestId}/handle`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, status: 'rejected', notes })
    });
    if (!response.ok) throw new Error('Failed to reject unblock');
    return await response.json();
  } catch (error) {
    console.error('Error rejecting unblock:', error)
    throw error;
  }
}
