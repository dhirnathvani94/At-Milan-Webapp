import { apiFetch } from '../api'

export async function getAdminStats() {
  try {
    const response = await apiFetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to fetch admin stats');
    return await response.json();
  } catch (error) {
    console.error('Admin stats error:', error)
    return { totalUsers: 0, activeUsers: 0, premiumUsers: 0, verifiedUsers: 0, pendingDocs: 0, pendingReports: 0, totalInterests: 0, acceptedInterests: 0 }
  }
}

export async function getAdminUsers(page: number = 1, limit: number = 20, filters?: { search?: string, search_field?: string, gender?: string, verified?: string, active?: string, premium?: string, blocked?: string, caste?: string, city?: string, age_min?: string, age_max?: string, email_verified?: string, doc_verified?: string }) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      _t: String(Date.now()),
    });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key, value);
      });
    }
    const response = await apiFetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch admin users');
    return await response.json();
  } catch (error) {
    console.error('Admin users error:', error)
    return { users: [], totalCount: 0 }
  }
}

export async function updateUserField(userId: string, field: string, value: any) {
  try {
    const response = await apiFetch(`/api/profiles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    if (!response.ok) throw new Error('Failed to update user field');
    return await response.json();
  } catch (error) {
    console.error('Update user field error:', error)
    throw error;
  }
}

export async function adminBulkUpdateProfile(userId: string, updates: Record<string, any>) {
  try {
    const response = await apiFetch(`/api/profiles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return await response.json();
  } catch (error) {
    console.error('Bulk update profile error:', error);
    throw error;
  }
}

export async function getAdminReports(page: number = 1, statusFilter?: string) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      status: statusFilter || ''
    });
    const response = await apiFetch(`/api/admin/reports?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch admin reports');
    const d = await response.json();
    return { reports: d.reports || d.data || [], totalCount: d.totalCount || d.total || 0 };
  } catch (error) {
    console.error('Admin reports error:', error)
    return { reports: [], totalCount: 0 }
  }
}

export async function updateReportStatus(reportId: string, status: string) {
  try {
    const response = await apiFetch(`/api/admin/reports/${reportId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update report status');
    return await response.json();
  } catch (error) {
    console.error('Update report status error:', error)
    throw error;
  }
}

export async function getAdminSuccessStories(page: number = 1) {
  try {
    const response = await apiFetch(`/api/admin/success-stories?page=${page}&_t=${Date.now()}`);
    if (!response.ok) throw new Error('Failed to fetch admin success stories');
    const d = await response.json();
    return { stories: d.stories || d.data || [], totalCount: d.totalCount || d.total || 0 };
  } catch (error) {
    console.error('Admin success stories error:', error)
    return { stories: [], totalCount: 0 }
  }
}

export async function updateStoryApproval(storyId: string, approved: boolean) {
  try {
    const response = await apiFetch(`/api/admin/success-stories/${storyId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved })
    });
    if (!response.ok) throw new Error('Failed to update story approval');
    return await response.json();
  } catch (error) {
    console.error('Update story approval error:', error)
    throw error;
  }
}

export async function editSuccessStory(storyId: string, data: any) {
  try {
    const isFormData = data instanceof FormData;
    const response = await apiFetch(`/api/admin/success-stories/${storyId}`, {
      method: 'PUT',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? data : JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to edit story');
    return await response.json();
  } catch (error) {
    console.error('Edit story error:', error)
    throw error;
  }
}

export async function adminAddSuccessStory(data: any) {
  try {
    const isFormData = data instanceof FormData;
    const response = await apiFetch('/api/admin/success-stories', {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: isFormData ? data : JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to add story');
    return await response.json();
  } catch (error) {
    console.error('Add story error:', error);
    throw error;
  }
}

export async function toggleStoryVisibility(storyId: string, is_hidden: boolean) {
  try {
    const response = await apiFetch(`/api/admin/success-stories/${storyId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden })
    });
    if (!response.ok) throw new Error('Failed to toggle visibility');
    return await response.json();
  } catch (error) {
    console.error('Toggle visibility error:', error);
    throw error;
  }
}

export async function deleteSuccessStory(storyId: string) {
  try {
    const response = await apiFetch(`/api/admin/success-stories/${storyId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete story');
    return await response.json();
  } catch (error) {
    console.error('Delete story error:', error);
    throw error;
  }
}

export async function getAdminContacts(page: number = 1) {
  try {
    const response = await apiFetch(`/api/admin/tickets?page=${page}`);
    if (!response.ok) throw new Error('Failed to fetch admin contacts');
    const d = await response.json();
    const contacts = Array.isArray(d) ? d : (d.contacts || d.data || []);
    const totalCount = d.totalCount || d.total || (Array.isArray(d) ? d.length : 0);
    return { contacts, totalCount };
  } catch (error) {
    console.error('Admin contacts error:', error)
    return { contacts: [], totalCount: 0 }
  }
}

export async function markContactResolved(id: string, formData: FormData) {
  try {
    const response = await apiFetch(`/api/admin/tickets/${id}/close`, {
      method: 'PUT',
      body: formData
    });
    if (!response.ok) throw new Error('Failed to resolve contact');
    return await response.json();
  } catch (error) {
    console.error('Resolve contact error:', error)
    throw error;
  }
}

export async function markContactRejected(id: string, formData: FormData) {
  try {
    const response = await apiFetch(`/api/admin/tickets/${id}/reject`, {
      method: 'PUT',
      body: formData
    });
    if (!response.ok) throw new Error('Failed to reject contact');
    return await response.json();
  } catch (error) {
    console.error('Reject contact error:', error)
    throw error;
  }
}

export async function reopenContactTicket(id: string) {
  try {
    const response = await apiFetch(`/api/admin/tickets/${id}/reopen`, {
      method: 'PUT'
    });
    if (!response.ok) throw new Error('Failed to reopen ticket');
    return await response.json();
  } catch (error) {
    console.error('Reopen ticket error:', error);
    throw error;
  }
}

export async function getPendingVerifications() {
  const response = await apiFetch(`/api/verification/pending?_t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch pending verifications');
  const data = await response.json();
  return Array.isArray(data) ? data : (data.data || data.documents || []);
}

export async function approveDocument(docId: string, adminId: string) {
  const response = await apiFetch(`/api/verification/approve/${docId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId })
  });
  if (!response.ok) throw new Error('Failed to approve document');
}

export async function rejectDocument(docId: string, adminId: string, reason: string) {
  const response = await apiFetch(`/api/verification/reject/${docId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId, reason })
  });
  if (!response.ok) throw new Error('Failed to reject document');
}

export async function updateVerificationStatus(userId: string, docType: string, status: string, reason?: string) {
  const response = await apiFetch(`/api/admin/users/${userId}/documents/${docType}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason })
  });
  if (!response.ok) throw new Error('Failed to update verification status');
  return await response.json();
}

export async function approveAllDocuments(userId: string, adminId: string) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/approve-all-docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId })
    });
    if (!response.ok) throw new Error('Failed to approve all documents');
    return await response.json();
  } catch (error) {
    console.error('Approve all documents error:', error);
    throw error;
  }
}

export async function getAdminUserFullDetail(userId: string) {
  const response = await apiFetch(`/api/profiles/${userId}/complete?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });
  if (!response.ok) throw new Error('Failed to fetch profile');
  const data = await response.json();

  let documents = [];
  try {
    const docsResponse = await apiFetch(`/api/documents/${userId}?_t=${Date.now()}`, { cache: 'no-store' });
    if (docsResponse.ok) {
      documents = await docsResponse.json();
    }
  } catch(e) {}

  let creditsData: any = {};
  try {
    const creditsResponse = await apiFetch(`/api/credits/${userId}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (creditsResponse.ok) {
      const cd = await creditsResponse.json();
      creditsData = cd || {};
    }
  } catch(e) {}

  const docData: any = {};
  documents.forEach((doc: any) => {
    if (doc.document_type === 'aadhaar_front') {
      docData.aadhaar_front_id = doc.id;
      docData.aadhaar_front_url = doc.file_url;
      docData.aadhaar_front_verified = doc.verification_status === 'approved';
      docData.aadhaar_front_rejected = doc.verification_status === 'rejected';
      docData.aadhaar_front_reason = doc.admin_notes;
    } else if (doc.document_type === 'aadhaar_back') {
      docData.aadhaar_back_id = doc.id;
      docData.aadhaar_back_url = doc.file_url;
      docData.aadhaar_back_verified = doc.verification_status === 'approved';
      docData.aadhaar_back_rejected = doc.verification_status === 'rejected';
      docData.aadhaar_back_reason = doc.admin_notes;
    } else if (doc.document_type === 'biodata') {
      docData.biodata_id = doc.id;
      docData.biodata_url = doc.file_url;
      docData.biodata_verified = doc.verification_status === 'approved';
    }
  });

  return {
    ...data.education,
    ...data.family,
    ...data.lifestyle,
    ...data.horoscope,
    ...data.preferences,
    ...data.profile,
    ...docData,
    free_views_remaining: creditsData.free_views_remaining ?? creditsData.free_credits_remaining ?? 0,
    free_monthly_limit: creditsData.free_monthly_limit ?? 10,
    paid_views_balance: creditsData.paid_views_balance ?? creditsData.paid_credits ?? 0,
    paid_credits_expiry: creditsData.paid_credits_expiry ?? null,
    photos: data.photos || [],
    documents: documents,
    chat_warnings: data.chat_warnings || [],
    reports_received: data.reports_received || [],
    message_reports: data.message_reports || [],
    user_reports_received: data.user_reports_received || [],
    user_reports_sent: data.user_reports_sent || [],
    purchases: data.purchases || [],
    membership_purchases: data.membership_purchases || [],
    deleted_messages: data.deleted_messages || [],
    interests_sent: data.interests_sent || [],
    interests_received: data.interests_received || []
  }
}

export async function getUserAllChats(userId: string) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/chats`);
    if (!response.ok) throw new Error('Failed to fetch chats');
    return await response.json();
  } catch (error) {
    console.error('Get user chats error:', error);
    return [];
  }
}

export async function getUserChatHistory(userId: string, otherUserId: string) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/chats/${otherUserId}?include_deleted=true`);
    if (!response.ok) throw new Error('Failed to fetch chat history');
    return await response.json();
  } catch (error) {
    console.error('Get chat history error:', error);
    return { messages: [], otherUser: null };
  }
}

export async function getUnblockRequestDetail(requestId: string) {
  try {
    const response = await apiFetch(`/api/admin/unblock-request/${requestId}/detail`);
    if (!response.ok) throw new Error('Failed to fetch request detail');
    return await response.json();
  } catch (error) {
    console.error('Unblock request detail error:', error);
    return null;
  }
}

export async function getAdminUserDetail(userId: string) {
  return getAdminUserFullDetail(userId)
}

export async function adminBlockUser(userId: string, duration: 'temp' | 'permanent', reason: string) {
  try {
    const blockedUntil = duration === 'temp' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const isPermanentlyBlocked = duration === 'permanent';
    const response = await apiFetch(`/api/profiles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocked_until: blockedUntil,
        is_permanently_blocked: isPermanentlyBlocked,
        admin_notes: reason
      })
    });
    if (!response.ok) throw new Error('Failed to block user');
    return await response.json();
  } catch (error) {
    console.error('Admin block user error:', error)
    throw error;
  }
}

export async function adminUnblockUser(userId: string) {
  try {
    const response = await apiFetch(`/api/profiles/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocked_until: null,
        is_permanently_blocked: false
      })
    });
    if (!response.ok) throw new Error('Failed to unblock user');
    return await response.json();
  } catch (error) {
    console.error('Admin unblock user error:', error)
    throw error;
  }
}

export async function adminDeleteUser(userId: string) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete user');
    return await response.json();
  } catch (error) {
    console.error('Delete user error:', error);
    throw error;
  }
}

export async function adminAddProfile(data: any) {
  try {
    const response = await apiFetch('/api/admin/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add profile');
    }
    return await response.json();
  } catch (error) {
    console.error('Admin add profile error:', error);
    throw error;
  }
}

export async function getMessageReports(page: number = 1, statusFilter?: string) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      status: statusFilter || ''
    });
    const response = await apiFetch(`/api/admin/message-reports?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch message reports');
    const d = await response.json();
    return { reports: d.reports || d.data || [], totalCount: d.totalCount || d.total || 0 };
  } catch (error) {
    console.error('Message reports error:', error)
    return { reports: [], totalCount: 0 }
  }
}

export async function handleMessageReport(reportId: string, adminId: string, action: string, notes: string) {
  try {
    const response = await apiFetch(`/api/admin/message-report/${reportId}/handle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, action, notes })
    });
    if (!response.ok) throw new Error('Failed to handle message report');
    return await response.json();
  } catch (error) {
    console.error('Handle message report error:', error)
    throw error;
  }
}

export async function getUnblockRequests(statusFilter?: string) {
  try {
    const params = new URLSearchParams({
      status: statusFilter || '',
      t: Date.now().toString()
    });
    const response = await apiFetch(`/api/admin/unblock-requests?${params.toString()}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    if (!response.ok) throw new Error('Failed to fetch unblock requests');
    const data = await response.json();
    return data.requests || data.data || [];
  } catch (error) {
    console.error('Unblock requests error:', error)
    return []
  }
}

export async function handleUnblockRequest(requestId: string, adminId: string, status: string, notes: string) {
  try {
    const response = await apiFetch(`/api/admin/unblock-request/${requestId}/handle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, status, notes })
    });
    if (!response.ok) throw new Error('Failed to handle unblock request');
    return await response.json();
  } catch (error) {
    console.error('Handle unblock request error:', error)
    throw error;
  }
}

export async function getSiteSettings() {
  try {
    const response = await apiFetch('/api/admin/settings');
    if (!response.ok) throw new Error('Failed to fetch site settings');
    return await response.json();
  } catch (error) {
    console.error('Site settings error:', error)
    return []
  }
}

export async function updateSiteSetting(key: string, value: string, adminId: string) {
  try {
    const response = await apiFetch(`/api/admin/settings/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, adminId })
    });
    if (!response.ok) throw new Error('Failed to update site setting');
    return await response.json();
  } catch (error) {
    console.error('Update site setting error:', error)
    throw error;
  }
}

export async function getMembershipPurchases(page: number = 1) {
  return { purchases: [], totalCount: 0 }
}

export async function getMembershipPlans() {
  try {
    const response = await apiFetch('/api/plans/membership');
    if (!response.ok) throw new Error('Failed to fetch membership plans');
    const data = await response.json();
    return data.plans || data;
  } catch (error) {
    console.error('Membership plans error:', error)
    return []
  }
}

export async function adminUpdateCredits(userId: string, action: 'add' | 'remove', credit_type: 'free' | 'paid', amount: number) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, credit_type, amount })
    });
    if (!response.ok) throw new Error('Failed to update credits');
    return await response.json();
  } catch (error) {
    console.error('Update credits error:', error);
    throw error;
  }
}

export async function adminAssignPremium(userId: string, plan_id: string, duration_months?: number) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id, duration_months })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Failed to assign premium');
    }
    return await response.json();
  } catch (error) {
    console.error('Assign premium error:', error);
    throw error;
  }
}

export async function adminRemovePremium(userId: string) {
  try {
    const response = await apiFetch(`/api/admin/users/${userId}/remove-premium`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || 'Failed to remove premium');
    }
    return await response.json();
  } catch (error) {
    console.error('Remove premium error:', error);
    throw error;
  }
}

export async function updateMembershipPlan(planId: string, data: any) {
  try {
    const response = await apiFetch(`/api/admin/membership-plans/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update membership plan');
    return await response.json();
  } catch (error) {
    console.error('Update membership plan error:', error)
    throw error;
  }
}

export async function getVerifiedUsers(search?: string) {
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('_t', String(Date.now()));
    const response = await apiFetch(`/api/verification/verified-users?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch verified users');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.data || data.users || []);
  } catch (error) {
    console.error('Verified users error:', error);
    return [];
  }
}

export async function getAllVerificationDocs(status?: string, search?: string) {
  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    params.set('_t', Date.now().toString());

    const response = await apiFetch(`/api/verification/all?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : (data.data || data.documents || []);
  } catch {
    return [];
  }
}

export async function getFinancialAnalytics(fromDate?: string, toDate?: string) {
  try {
    const params = new URLSearchParams();
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    const response = await apiFetch(`/api/admin/financial/analytics?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch financial analytics');
    return await response.json();
  } catch (error) {
    console.error('Financial analytics error:', error);
    return { totalRevenue: 0, creditRevenue: 0, membershipRevenue: 0, totalTransactions: 0, activeSubscriptions: 0, monthlyRevenue: [], paymentMethods: {} };
  }
}

export async function replaceVerificationDoc(docId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch(`/api/verification/replace/${docId}`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) throw new Error('Failed to replace document');
  return await response.json();
}

export async function changeDocVerificationStatus(docId: string, status: string, adminId: string, reason?: string) {
  const response = await apiFetch(`/api/verification/change-status/${docId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, adminId, reason })
  });
  if (!response.ok) throw new Error('Failed to change document status');
  return await response.json();
}

export async function adminTestSMS(phone: string, message: string, provider: { url: string; api_key: string; name: string }) {
  try {
    const response = await apiFetch('/api/admin/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message, provider_url: provider.url, api_key: provider.api_key, provider_name: provider.name })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'SMS test failed');
    }
    return await response.json();
  } catch (error) {
    console.error('Test SMS error:', error);
    throw error;
  }
}
