import { apiUrl, getAuthHeaders } from '../api'
import { useAuthStore } from '../../store/authStore';
import { dedupFetch } from '../apiCache';



// Check if two users can chat (mutual accepted interest)
export async function canChat(userId: string, otherUserId: string): Promise<boolean> {
  try {
    const response = await fetch(
      apiUrl(`/api/interests/status/${userId}/${otherUserId}`),
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.can_chat === true || data.status === "accepted";
  } catch {
    return false;
  }
}

// Get conversations list (accepted interests with last message)
export async function getConversations(userId: string) {
  try {
    const response = await fetch(
      apiUrl(`/api/interests/accepted/${userId}`),
      { headers: getAuthHeaders() }
    );
    if (!response.ok) return [];
    const data = await response.json();
    const interests = data.data || data.interests || data || [];
    return Array.isArray(interests) ? interests : [];
  } catch {
    return [];
  }
}

// Get messages between two users
export async function getMessages(userId: string, otherUserId: string, limit: number = 50) {
  const response = await fetch(apiUrl(`/api/messages/${userId}/${otherUserId}?t=${Date.now()}`));
  if (!response.ok) throw new Error('Failed to fetch messages');
  const raw = await response.json();
  const messages = raw.data || raw.messages || [];
  return messages.slice(-limit);
}

// Send message
export async function sendMessage(senderId: string, receiverId: string, content: string) {
  const response = await fetch(apiUrl('/api/messages'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: senderId, receiver_id: receiverId, content: content.trim() })
  });
  if (!response.ok) throw new Error('Failed to send message');
  return await response.json();
}

// Mark messages as read
export async function markMessagesAsRead(userId: string, otherUserId: string) {
  try {
    await fetch(apiUrl(`/api/messages/${userId}/${otherUserId}/read`), { method: 'POST' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

// Get total unread message count
export async function getUnreadMessageCount(userId: string) {
  return dedupFetch(`unread-msg:${userId}`, async () => {
    try {
      const response = await fetch(apiUrl(`/api/messages/unread-count/${userId}?t=${Date.now()}`));
      if (!response.ok) return 0;
      const data = await response.json();
      return data.unreadCount || data.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  });
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string) {
  return dedupFetch(`unread-notif:${userId}`, async () => {
    try {
      const response = await fetch(apiUrl(`/api/notifications/${userId}?t=${Date.now()}`));
      if (!response.ok) return 0;
      const raw = await response.json();
      const notifications = raw.data || raw.notifications || [];
      return notifications.filter((n: any) => !n.is_read).length;
    } catch (err) {
      return 0;
    }
  });
}

// Get notifications
export async function getNotifications(userId: string, limit: number = 20) {
  return dedupFetch(`notifications:${userId}:${limit}`, async () => {
    try {
      const response = await fetch(apiUrl(`/api/notifications/${userId}?t=${Date.now()}`));
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const raw = await response.json();
      const notifications = raw.data || raw.notifications || [];
      
      if (notifications.length === 0) {
        return [];
      }
      
      return notifications.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
    } catch (err) {
      return [];
    }
  });
}

// Mark notification as read
export async function markNotificationRead(notificationId: string) {
  await fetch(apiUrl(`/api/notifications/${notificationId}/read`), { method: 'POST' });
}

// Mark all notifications as read
export async function markAllNotificationsRead(userId: string) {
  try {
    await fetch(apiUrl(`/api/notifications/${userId}/read-all`), { method: 'POST' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

// Clear all notifications
export async function clearAllNotifications(userId: string) {
  try {
    await fetch(apiUrl(`/api/notifications/${userId}/clear-all`), { method: 'POST' });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
  }
}

// Delete a single notification
export async function deleteNotification(notificationId: string) {
  try {
    await fetch(apiUrl(`/api/notifications/${notificationId}`), { method: 'DELETE' });
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
}

// Mark all messages as read
export async function markAllMessagesAsRead(userId: string) {
  try {
    await fetch(apiUrl(`/api/messages/${userId}/read-all`), { method: 'POST' });
  } catch (error) {
    console.error('Error marking all messages as read:', error);
  }
}
