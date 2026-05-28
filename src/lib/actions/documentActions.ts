import { apiUrl, apiFetch, getAuthHeaders } from '../api'

export async function getVerificationStatus(userId: string) {
  const response = await fetch(
    apiUrl(`/api/verification/status/${userId}`),
    { headers: getAuthHeaders() }
  );
  if (!response.ok) throw new Error('Failed to fetch verification status');
  const data = await response.json();
  const docs = data?.documents || data || [];
  const arr = Array.isArray(docs) ? docs : [];

  const front   = arr.find((d: any) =>
    (d.document_type || d.type) === 'aadhaar_front') || null;
  const back    = arr.find((d: any) =>
    (d.document_type || d.type) === 'aadhaar_back') || null;
  const biodata = arr.find((d: any) =>
    (d.document_type || d.type) === 'biodata') || null;

  const isFullyVerified =
    (front?.verification_status  || front?.status)  === 'approved' &&
    (back?.verification_status   || back?.status)   === 'approved';

  return {
    aadhaar_front:  front,
    aadhaar_back:   back,
    biodata,
    isFullyVerified,
    hasUploaded:    !!(front || back),
    hasPending:     arr.some((d: any) =>
      (d.verification_status || d.status) === 'pending'),
    hasRejected:    arr.some((d: any) =>
      (d.verification_status || d.status) === 'rejected'),
  };
}

export async function getPendingVerifications() {
  const response = await apiFetch(
    `/api/verification/pending?_t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!response.ok) throw new Error('Failed to fetch pending verifications');
  const data = await response.json();
  return Array.isArray(data) ? data : (data.data || data.documents || []);
}

export async function approveDocument(
  documentId: string,
  adminId: string
) {
  const response = await apiFetch(
    `/api/verification/approve/${documentId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId }),
    }
  );
  if (!response.ok) throw new Error('Failed to approve document');
  return await response.json();
}

export async function rejectDocument(
  documentId: string,
  adminId: string,
  reason: string
) {
  const response = await apiFetch(
    `/api/verification/reject/${documentId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, reason }),
    }
  );
  if (!response.ok) throw new Error('Failed to reject document');
  return await response.json();
}
