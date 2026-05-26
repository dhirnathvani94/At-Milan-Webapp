import { apiUrl } from '../api'


// Get received interests (people who sent interest to me)
export async function getReceivedInterests(userId: string) {
  const response = await fetch(apiUrl(`/api/interests/received/${userId}?t=${Date.now()}`));
  if (!response.ok) throw new Error('Failed to fetch received interests');
  return await response.json();
}

// Get sent interests
export async function getSentInterests(userId: string) {
  const response = await fetch(apiUrl(`/api/interests/sent/${userId}?t=${Date.now()}`));
  if (!response.ok) throw new Error('Failed to fetch sent interests');
  return await response.json();
}

// Get accepted interests (for chat)
export async function getAcceptedInterests(userId: string) {
  // Local implementation: filter sent and received interests for 'accepted' status
  const [received, sent] = await Promise.all([
    getReceivedInterests(userId),
    getSentInterests(userId)
  ]);
  
  const acceptedReceived = received.filter((i: any) => i.status === 'accepted');
  const acceptedSent = sent.filter((i: any) => i.status === 'accepted');
  
  return [...acceptedReceived, ...acceptedSent];
}

// Get rejected/declined interests
export async function getRejectedInterests(userId: string) {
  const [received, sent] = await Promise.all([
    getReceivedInterests(userId),
    getSentInterests(userId)
  ]);
  
  const declinedReceived = received.filter((i: any) => i.status === 'declined');
  const declinedSent = sent.filter((i: any) => i.status === 'declined');
  
  return [...declinedReceived, ...declinedSent];
}

// Accept interest
export async function acceptInterest(interestId: string, senderId: string, receiverName: string) {
  const response = await fetch(apiUrl(`/api/interests/${interestId}/status`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'accepted', receiverName })
  });
  if (!response.ok) throw new Error('Failed to accept interest');
}

// Decline interest
export async function declineInterest(interestId: string, senderId: string, receiverName: string) {
  const response = await fetch(apiUrl(`/api/interests/${interestId}/status`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'declined', receiverName })
  });
  if (!response.ok) throw new Error('Failed to decline interest');
}

// Cancel sent interest
export async function cancelInterest(interestId: string) {
  // Local implementation: we need a delete endpoint or status update
  const response = await fetch(apiUrl(`/api/interests/${interestId}`), {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to cancel interest');
}

// Get interest counts
export async function getInterestCounts(userId: string) {
  const [received, sent] = await Promise.all([
    getReceivedInterests(userId),
    getSentInterests(userId)
  ]);
  
  return {
    received: received.filter((i: any) => i.status === 'pending').length,
    sent: sent.length,
    accepted: [...received, ...sent].filter((i: any) => i.status === 'accepted').length,
    rejected: [...received, ...sent].filter((i: any) => i.status === 'declined').length
  }
}

export async function sendInterest(senderId: string, receiverId: string) {
  const response = await fetch(apiUrl('/api/interests'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: senderId, receiver_id: receiverId })
  });
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const err: any = new Error(data.error || data.message || 'Failed to send interest');
    err.code = data.error; // 'COOLDOWN' | 'REJECTED' | etc.
    err.hoursLeft = data.hoursLeft;
    throw err;
  }
  return await response.json();
}

export function getAcceptedInterestsFromData(received: any[], sent: any[]) {
  const acceptedReceived = received.filter((i: any) => i.status === 'accepted');
  const acceptedSent = sent.filter((i: any) => i.status === 'accepted');
  return [...acceptedReceived, ...acceptedSent];
}

export function getRejectedInterestsFromData(received: any[], sent: any[]) {
  const declinedReceived = received.filter((i: any) => i.status === 'declined');
  const declinedSent = sent.filter((i: any) => i.status === 'declined');
  return [...declinedReceived, ...declinedSent];
}

export function getInterestCountsFromData(received: any[], sent: any[]) {
  return {
    received: received.filter((i: any) => i.status === 'pending').length,
    sent: sent.filter((i: any) => i.status === 'pending').length,
    accepted: [...received, ...sent].filter((i: any) => i.status === 'accepted').length,
    rejected: [...received, ...sent].filter((i: any) => i.status === 'declined').length
  }
}
