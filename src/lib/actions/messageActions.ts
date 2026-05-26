import { apiUrl } from '../api'
import { useAuthStore } from '../../store/authStore';
import { dedupFetch } from '../apiCache';



// Check if two users can chat (mutual accepted interest)
export async function canChat(userId: string, otherUserId: string) {
  const response = await fetch(apiUrl(`/api/interests/received/${userId}`));
  if (!response.ok) return false;
  const received = await response.json();
  
  const sentResponse = await fetch(apiUrl(`/api/interests/sent/${userId}`));
  if (!sentResponse.ok) return false;
  const sent = await sentResponse.json();
  
  const mutual = [...received, ...sent].find((i: any) => 
    i.status === 'accepted' && 
    ((i.sender_id === userId && i.receiver_id === otherUserId) || 
     (i.sender_id === otherUserId && i.receiver_id === userId))
  );

  return !!mutual;
}

// Get conversations list (accepted interests with last message)
export async function getConversations(userId: string) {
  return dedupFetch(`conversations:${userId}`, async () => {
  const response = await fetch(apiUrl(`/api/interests/received/${userId}?t=${Date.now()}`));
  if (!response.ok) return [];
  const received = await response.json();
  
  const sentResponse = await fetch(apiUrl(`/api/interests/sent/${userId}?t=${Date.now()}`));
  if (!sentResponse.ok) return [];
  const sent = await sentResponse.json();
  
  const acceptedInterests = [...received, ...sent].filter((i: any) => i.status === 'accepted');

  if (acceptedInterests.length === 0) {
    return [];
  }

  // Deduplicate interests by otherUserId — same user may appear in both sent and received
  const seenUsers = new Set<string>();
  const uniqueInterests = acceptedInterests.filter((interest: any) => {
    const otherUserId = interest.sender_id === userId ? interest.receiver_id : interest.sender_id;
    if (seenUsers.has(otherUserId)) return false;
    seenUsers.add(otherUserId);
    return true;
  });

  const conversations = await Promise.all(
    uniqueInterests.map(async (interest) => {
      const otherUser = interest.sender_id === userId ? interest.receiver : interest.sender
      const otherUserId = interest.sender_id === userId ? interest.receiver_id : interest.sender_id

      const msgRes = await fetch(apiUrl(`/api/messages/${userId}/${otherUserId}?t=${Date.now()}`));
      const messages = msgRes.ok ? await msgRes.json() : [];
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

      const unreadCount = messages.filter((m: any) => m.receiver_id === userId && !m.is_read).length;

      return {
        interestId: interest.id,
        otherUser,
        otherUserId,
        lastMessage: lastMsg,
        unreadCount
      }
    })
  )

  conversations.sort((a, b) => {
    if (!a.lastMessage && !b.lastMessage) return 0
    if (!a.lastMessage) return 1
    if (!b.lastMessage) return -1
    return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  })

  return conversations
  });
}

// Get messages between two users
export async function getMessages(userId: string, otherUserId: string, limit: number = 50) {
  const response = await fetch(apiUrl(`/api/messages/${userId}/${otherUserId}?t=${Date.now()}`));
  if (!response.ok) throw new Error('Failed to fetch messages');
  const messages = await response.json();
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
      return data.count > 0 ? data.count : 0;
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
      const notifications = await response.json();
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
      const notifications = await response.json();
      
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
