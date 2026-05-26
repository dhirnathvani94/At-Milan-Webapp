import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { getConversations, getUnreadMessageCount, markAllMessagesAsRead } from '../lib/actions/messageActions'
import { useSocketStore } from '../store/socketStore'
import Avatar from './ui/Avatar'
import SwipeableItem from './ui/SwipeableItem'
import { getRelativeTime } from '../lib/utils'

interface MessageDropdownProps {
  userId: string
}

function loadClearedIds(): Map<string, string> {
  try {
    const stored = localStorage.getItem('cleared_msg_convos_v2')
    if (stored) return new Map(JSON.parse(stored))
  } catch {}
  return new Map()
}

export default function MessageDropdown({ userId }: MessageDropdownProps) {
  const navigate = useNavigate()
  const { socket } = useSocketStore()
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [clearedIds, setClearedIds] = useState<Map<string, string>>(loadClearedIds)
  const dropdownRef = useRef<HTMLDivElement>(null)


  // Real-time: listen for new messages via socket
  useEffect(() => {
    if (!socket) return
    const handleNewMessage = () => {
      // Re-fetch conversations when a new message arrives for this user
      fetchData()
    }
    const handleMessageNotif = (notif: any) => {
      if (notif.type === 'new_message') fetchData()
    }
    socket.on('message:new', handleNewMessage)
    socket.on('notification:new', handleMessageNotif)
    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('notification:new', handleMessageNotif)
    }
  }, [socket])

  useEffect(() => {
    if (userId) {
      fetchData()
    }
  }, [userId])

  // Re-fetch when dropdown is opened to always show latest messages
  useEffect(() => {
    if (isOpen && userId) {
      fetchData()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      const [convs, count] = await Promise.allSettled([
        getConversations(userId),
        getUnreadMessageCount(userId)
      ])
      if (convs.status === 'fulfilled') {
        const raw = convs.value || []
        // Deduplicate by otherUserId — keep only the one with latest message
        const deduped = new Map<string, any>()
        raw.forEach((c: any) => {
          const key = c.otherUserId || c.otherUser?.id
          if (!key) return
          const existing = deduped.get(key)
          if (!existing || new Date(c.lastMessage?.created_at || 0) > new Date(existing.lastMessage?.created_at || 0)) {
            deduped.set(key, c)
          }
        })
        // Filter out conversations where last message is older than when user cleared them
        const filtered = Array.from(deduped.values()).filter(c => {
          const clearedAt = clearedIds.get(c.otherUserId)
          if (!clearedAt) return true // never cleared — show
          // Show if there's a new message AFTER the clear time
          const lastMsgTime = c.lastMessage?.created_at ? new Date(c.lastMessage.created_at).getTime() : 0
          return lastMsgTime > new Date(clearedAt).getTime()
        })
        setConversations(filtered)
      }
      if (count.status === 'fulfilled') setUnreadCount(count.value || 0)
    } catch (_) {}
  }

  const handleConversationClick = (conv: any) => {
    setIsOpen(false)
    navigate('/messages', { state: { selectedUserId: conv.otherUserId } })
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllMessagesAsRead(userId)
      setUnreadCount(0)
      setConversations(prev => prev.map(c => ({ ...c, unreadCount: 0 })))
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const handleClearAll = () => {
    const now = new Date().toISOString()
    const newCleared = new Map(clearedIds)
    conversations.forEach(c => newCleared.set(c.otherUserId, now))
    setClearedIds(newCleared)
    localStorage.setItem('cleared_msg_convos_v2', JSON.stringify(Array.from(newCleared.entries())))
    setUnreadCount(0)
    setConversations([])
    setIsOpen(false)
  }

  const handleDeleteConversation = (conv: any) => {
    const now = new Date().toISOString()
    const newCleared = new Map(clearedIds)
    newCleared.set(conv.otherUserId, now)
    setClearedIds(newCleared)
    localStorage.setItem('cleared_msg_convos_v2', JSON.stringify(Array.from(newCleared.entries())))
    if (conv.unreadCount > 0) setUnreadCount(prev => Math.max(0, prev - conv.unreadCount))
    setConversations(prev => prev.filter(c => c.otherUserId !== conv.otherUserId))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-all flex"
      >
        <MessageCircle size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-[70px] sm:absolute sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-auto sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/50 to-white/50">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2 font-heading">
              Messages
              {unreadCount > 0 && <span className="bg-gradient-to-r from-primary to-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold shadow-sm">{unreadCount} New</span>}
            </h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary font-semibold hover:text-primary-700 transition"
                  title="Mark all as read"
                >
                  Mark Read
                </button>
              )}
              {conversations.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-red-500 font-semibold hover:text-red-700 transition"
                  title="Clear all messages"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto custom-scrollbar">
            {conversations.length > 0 ? (
              conversations.map(conv => (
                <SwipeableItem
                  key={conv.otherUserId}
                  onClick={() => handleConversationClick(conv)}
                  onRead={() => {
                    if (conv.unreadCount > 0) {
                      setUnreadCount(prev => Math.max(0, prev - conv.unreadCount));
                      setConversations(prev => prev.map(c => c.otherUserId === conv.otherUserId ? { ...c, unreadCount: 0 } : c));
                    }
                  }}
                  onDelete={() => handleDeleteConversation(conv)}
                  isRead={conv.unreadCount === 0}
                  innerClassName={`flex gap-4 p-4 transition-all duration-200 hover:bg-gray-50/80 group relative bg-white ${conv.unreadCount > 0 ? 'bg-primary/5' : 'opacity-90 hover:opacity-100'}`}
                >
                  {conv.unreadCount > 0 && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-primary to-primary-600 rounded-r-md shadow-[2px_0_8px_rgba(0,0,0,0.1)]"></div>
                  )}
                  <div className="flex-shrink-0 mt-1 transition-transform duration-300 group-hover:scale-105">
                    <Avatar 
                      src={conv.otherUser.profile_photo_url} 
                      fallbackName={`${conv.otherUser.first_name} ${conv.otherUser.last_name}`}
                      gender={conv.otherUser.gender}
                      size="md"
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex justify-between items-start mb-1">
                      <p className={`text-sm tracking-tight ${conv.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                        {conv.otherUser.first_name} {conv.otherUser.last_name}
                      </p>
                      {conv.lastMessage && (
                        <p className={`text-[10px] whitespace-nowrap ml-2 flex items-center gap-1 ${conv.unreadCount > 0 ? 'text-primary font-medium' : 'text-gray-400'}`}>
                          {getRelativeTime(conv.lastMessage.created_at)}
                        </p>
                      )}
                    </div>
                    <p className={`text-xs line-clamp-2 leading-relaxed ${conv.unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                      {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="flex flex-col items-end justify-center gap-1 flex-shrink-0">
                      <div className="bg-gradient-to-r from-primary to-primary-600 text-white text-[10px] rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold px-1.5 shadow-sm">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </div>
                    </div>
                  )}
                </SwipeableItem>
              ))
            ) : (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100/50 shadow-sm">
                  <MessageCircle className="text-gray-300" size={28} />
                </div>
                <p className="text-gray-900 font-bold mb-1">No messages yet</p>
                <p className="text-gray-400 text-xs px-8">Connect with members to start chatting.</p>
              </div>
            )}
          </div>

          <div className="p-3 text-center border-t border-gray-100 bg-white">
            <button 
              onClick={() => { setIsOpen(false); navigate('/messages'); }}
              className="text-xs text-primary font-semibold hover:text-primary-700 transition flex items-center justify-center gap-1.5 mx-auto group"
            >
              View All Messages
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
