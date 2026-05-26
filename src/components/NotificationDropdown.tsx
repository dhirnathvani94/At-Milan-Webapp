import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Heart, CheckCircle, XCircle, MessageCircle, ShieldCheck, AlertCircle, Clock, Gift, Tag, Zap, Star, Megaphone } from 'lucide-react'
import { 
  getNotifications, 
  getUnreadNotificationCount, 
  markNotificationRead, 
  markAllNotificationsRead,
  clearAllNotifications,
  deleteNotification
} from '../lib/actions/messageActions'
import { useSocketStore } from '../store/socketStore'
import Avatar from './ui/Avatar'
import SwipeableItem from './ui/SwipeableItem'
import { getRelativeTime } from '../lib/utils'
import toast from 'react-hot-toast'

interface NotificationDropdownProps {
  userId: string
}

function loadClearedAt(): string | null {
  try { return localStorage.getItem('notif_cleared_at_v1') } catch { return null }
}

export default function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const navigate = useNavigate()
  const { socket } = useSocketStore()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [clearedAt, setClearedAt] = useState<string | null>(loadClearedAt)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (userId) {
      fetchData()
    }
  }, [userId])

  // Re-fetch when dropdown is opened to always show latest
  useEffect(() => {
    if (isOpen && userId) {
      fetchData()
    }
  }, [isOpen])

  // Real-time: listen for new notifications via socket
  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (notif: any) => {
      const cleared = localStorage.getItem('notif_cleared_at_v1')
      if (cleared && notif.created_at &&
          new Date(notif.created_at).getTime() <= new Date(cleared).getTime())
        return
      // Only show if it's for this user
      if (notif.user_id && notif.user_id !== userId) return
      setNotifications(prev => {
        // Prevent duplicates
        if (prev.find(n => n.id === notif.id)) return prev
        return [notif, ...prev]
      })
      setUnreadCount(prev => prev + 1)
    }

    // Handle admin broadcast push notifications with rich toast
    const handleAdminPush = (notif: any) => {
      setNotifications(prev => [{ ...notif, type: 'admin_broadcast' }, ...prev])
      setUnreadCount(prev => prev + 1)
      // Show rich styled toast
      const icon = notif.icon || '🔔'
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-gray-100`}
          style={{ animation: t.visible ? 'slideInDown 0.4s ease' : 'slideOutUp 0.3s ease' }}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 text-2xl w-10 h-10 flex items-center justify-center bg-primary/10 rounded-xl">
                {icon}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900 line-clamp-1">{notif.title}</p>
                <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{notif.body}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-100">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-medium text-primary hover:text-primary/80 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 6000, position: 'top-right' })
    }

    socket.on('notification:new', handleNewNotification)
    socket.on('notification:broadcast', handleNewNotification)
    socket.on('admin:push-notification', handleAdminPush)
    return () => {
      socket.off('notification:new', handleNewNotification)
      socket.off('notification:broadcast', handleNewNotification)
      socket.off('admin:push-notification', handleAdminPush)
    }
  }, [socket])

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
      const [notifs, count] = await Promise.all([
        getNotifications(userId),
        getUnreadNotificationCount(userId)
      ])
      const rawNotifs = notifs || []
      const cleared = localStorage.getItem('notif_cleared_at_v1')
      const filtered = cleared
        ? rawNotifs.filter((n: any) =>
            new Date(n.created_at).getTime() > new Date(cleared).getTime()
          )
        : rawNotifs
      setNotifications(filtered)
      setUnreadCount(filtered.filter((n: any) => !n.is_read).length)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userId)
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.error('Error marking all read:', error)
    }
  }

  const handleClearAll = async () => {
    try {
      await clearAllNotifications(userId)
      setUnreadCount(0)
      setNotifications([])
      const now = new Date().toISOString()
      setClearedAt(now)
      localStorage.setItem('notif_cleared_at_v1', now)
      setIsOpen(false)
    } catch (error) {
      console.error('Error clearing all:', error)
    }
  }

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      }
      
      setIsOpen(false)
      
      // Navigate based on type
      switch (notif.type) {
        case 'interest_received':
        case 'interest_accepted':
        case 'interest_declined':
          navigate('/interests')
          break
        case 'new_message':
          navigate('/messages')
          break
        case 'verification_approved':
        case 'verification_rejected':
          navigate('/my-profile')
          break
        default:
          break
      }
    } catch (error) {
      console.error('Error handling notification click:', error)
    }
  }

  const getIcon = (type: string, notif?: any) => {
    // Admin broadcast — use emoji icon or type-based icon
    if (type === 'admin_broadcast') {
      const iconMap: Record<string, any> = {
        offer: <Gift size={18} />, promo: <Tag size={18} />, update: <Zap size={18} />,
        alert: <AlertCircle size={18} />, feature: <Star size={18} />, general: <Megaphone size={18} />
      }
      const nt = notif?.notif_type || 'general'
      const colorMap: Record<string, string> = {
        offer: 'bg-green-100 text-green-600 border-green-200/50',
        promo: 'bg-purple-100 text-purple-600 border-purple-200/50',
        update: 'bg-blue-100 text-blue-600 border-blue-200/50',
        alert: 'bg-orange-100 text-orange-600 border-orange-200/50',
        feature: 'bg-yellow-100 text-yellow-600 border-yellow-200/50',
        general: 'bg-primary/10 text-primary border-primary/20',
      }
      return <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border text-xl font-bold ${colorMap[nt] || colorMap.general}`}>
        {notif?.icon && notif.icon.length <= 4 ? notif.icon : (iconMap[nt] || <Bell size={18} />)}
      </div>
    }
    switch (type) {
      case 'interest_received':
        return <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shadow-sm border border-pink-200/50"><Heart size={18} className="fill-pink-600/20" /></div>
      case 'interest_accepted':
        return <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50"><CheckCircle size={18} /></div>
      case 'interest_declined':
        return <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm border border-rose-200/50"><XCircle size={18} /></div>
      case 'new_message':
        return <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200/50"><MessageCircle size={18} className="fill-blue-600/20" /></div>
      case 'verification_approved':
        return <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm border border-green-200/50"><ShieldCheck size={18} className="fill-green-600/20" /></div>
      case 'verification_rejected':
        return <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200/50"><AlertCircle size={18} /></div>
      default:
        return <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shadow-sm border border-gray-200/50"><Bell size={18} /></div>
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-all"
      >
        <Bell size={20} className="text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-4 right-4 top-[70px] sm:absolute sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-auto sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100/80 bg-gradient-to-r from-gray-50/50 to-white/50">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2 font-heading">
              Notifications
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
              {notifications.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-red-500 font-semibold hover:text-red-700 transition"
                  title="Clear all notifications"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto custom-scrollbar">
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <SwipeableItem
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  onRead={async () => {
                    if (!notif.is_read) {
                      await markNotificationRead(notif.id);
                      setUnreadCount(prev => Math.max(0, prev - 1));
                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                    }
                  }}
                  onDelete={async () => {
                    if (!notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
                    setNotifications(prev => prev.filter(n => n.id !== notif.id));
                    await deleteNotification(notif.id);
                  }}
                  isRead={notif.is_read}
                  innerClassName={`flex gap-4 p-4 transition-all duration-200 hover:bg-gray-50/80 group relative bg-white ${!notif.is_read ? 'bg-primary/5' : 'opacity-90 hover:opacity-100'}`}
                >
                  {!notif.is_read && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-primary to-primary-600 rounded-r-md shadow-[2px_0_8px_rgba(0,0,0,0.1)]"></div>
                  )}
                  <div className="flex-shrink-0 mt-1 transition-transform duration-300 group-hover:scale-110">
                    {getIcon(notif.type, notif)}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={`text-sm tracking-tight ${!notif.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {notif.title}
                    </p>
                    <p className={`text-xs line-clamp-2 mt-1 leading-relaxed ${!notif.is_read ? 'text-gray-700' : 'text-gray-500'}`}>
                      {notif.body}
                    </p>
                    <p className={`text-[10px] mt-2 flex items-center gap-1.5 ${!notif.is_read ? 'text-primary font-medium' : 'text-gray-400'}`}>
                      <Clock size={12} className={!notif.is_read ? 'text-primary/70' : ''} /> {getRelativeTime(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.2)]" />
                  )}
                </SwipeableItem>
              ))
            ) : (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100/50 shadow-sm">
                  <Bell className="text-gray-300" size={28} />
                </div>
                <p className="text-gray-900 font-bold mb-1">No notifications yet</p>
                <p className="text-gray-400 text-xs px-8">When you get matches or messages, they will show up here.</p>
              </div>
            )}
          </div>

          <div className="p-3 text-center border-t border-gray-100 bg-white">
            <button className="text-xs text-primary font-semibold hover:text-primary-700 transition flex items-center justify-center gap-1.5 mx-auto group">
              View All Notifications
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
