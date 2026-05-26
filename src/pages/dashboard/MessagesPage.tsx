import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageCircle, Send, ArrowLeft, Check, CheckCheck, Search, AlertTriangle, AlertOctagon, ShieldOff, Ban, MoreVertical, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useSocketStore } from '../../store/socketStore'
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  markMessagesAsRead 
} from '../../lib/actions/messageActions'
import {
  containsContactInfo,
  checkUserBlockStatus,
  processContactViolation,
  reportMessage,
  submitUnblockRequest
} from '../../lib/actions/chatSafetyActions'
import { reportUser } from '../../lib/actions/dashboardActions'
import Avatar from '../../components/ui/Avatar'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import ReportUserModal from '../../components/ReportUserModal'
import { getRelativeTime } from '../../lib/utils'
import { ChatSkeleton } from '../../components/ui/Skeletons'

export default function MessagesPage() {
  const { user } = useAuthStore()
  const { socket, connected, typingUsers, onlineUsers, joinConversation, leaveConversation, emitTypingStart, emitTypingStop, isUserOnline } = useSocketStore()
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()
  
  // Chat Safety States
  const [blockStatus, setBlockStatus] = useState<any>(null)
  const [warningModal, setWarningModal] = useState({ show: false, type: '', message: '' })
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportingMessage, setReportingMessage] = useState<any>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [showUserReportModal, setShowUserReportModal] = useState(false)
  const [unblockReason, setUnblockReason] = useState('')
  const [submittingUnblock, setSubmittingUnblock] = useState(false)
  
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user?.id) {
      fetchConversations()
      checkBlockStatus()
    }
  }, [user?.id])

  const checkBlockStatus = async () => {
    if (!user) return
    const status = await checkUserBlockStatus((user?.id || ''))
    setBlockStatus(status)
  }

  useEffect(() => {
    if (selectedConversation && user) {
      fetchMessages()
      markMessagesAsRead((user?.id || ''), selectedConversation.otherUserId)
      joinConversation(selectedConversation.otherUserId)
      
      // Update unread count locally
      setConversations(prev => prev.map(conv => 
        conv.otherUserId === selectedConversation.otherUserId 
          ? { ...conv, unreadCount: 0 } 
          : conv
      ))
    }
    return () => {
      if (selectedConversation) {
        leaveConversation(selectedConversation.otherUserId)
      }
    }
  }, [selectedConversation, user?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Real-time: listen for new messages via socket
  useEffect(() => {
    if (!socket || !selectedConversation) return

    const handleNewMessage = (msg: any) => {
      // Only add if it belongs to current conversation
      const isRelevant = 
        (msg.sender_id === selectedConversation.otherUserId && msg.receiver_id === user?.id) ||
        (msg.sender_id === user?.id && msg.receiver_id === selectedConversation.otherUserId)
      if (isRelevant) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        // Mark as read if we're in this conversation
        if (msg.sender_id === selectedConversation.otherUserId && user?.id) {
          markMessagesAsRead((user?.id || ''), selectedConversation.otherUserId)
        }
        // Refresh conversation list for last message preview
        fetchConversations()
      }
    }

    socket.on('message:new', handleNewMessage)
    return () => { socket.off('message:new', handleNewMessage) }
  }, [socket, selectedConversation, user?.id])

  // Real-time: typing indicator for current conversation
  useEffect(() => {
    if (!selectedConversation) return
    const isTyping = typingUsers[selectedConversation.otherUserId] || false
    setIsOtherTyping(isTyping)
  }, [typingUsers, selectedConversation])

  // Fallback: periodic refresh (socket handles most real-time updates)
  useEffect(() => {
    if (!user?.id || !selectedConversation) return
    const interval = setInterval(() => {
      fetchMessages()
      fetchConversations()
    }, 60000) // Poll every 60s as fallback
    return () => clearInterval(interval)
  }, [user?.id, selectedConversation?.otherUserId])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const data = await getConversations((user?.id || ''))
      setConversations(data)
      
      // Select conversation if passed in location state
      if (location.state?.selectedUserId) {
        const conv = data.find((c: any) => c.otherUserId === location.state.selectedUserId)
        if (conv) {
          setSelectedConversation(conv)
          // Clear location state to prevent re-selection on every render/reload
          window.history.replaceState({}, document.title)
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    try {
      const data = await getMessages((user?.id || ''), selectedConversation.otherUserId)
      setMessages(data)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return

    // Stop typing indicator when sending
    emitTypingStop(selectedConversation.otherUserId)

    // Check if user is blocked
    const currentBlockStatus = await checkUserBlockStatus((user?.id || ''))
    if (!currentBlockStatus.canSendMessage) {
      setBlockStatus(currentBlockStatus)
      if (currentBlockStatus.isPermanentlyBlocked) {
        setWarningModal({ show: true, type: 'permanent', message: '🚫 Your account has been PERMANENTLY BLOCKED for repeatedly violating our safety policy. You can submit an unblock request to admin.' })
        return
      }
      if (currentBlockStatus.isBlocked) {
        setWarningModal({ show: true, type: 'blocked', message: '🚫 Your account has been BLOCKED for 24 hours for repeatedly sharing contact information. You cannot send messages during this period.' })
        return
      }
    }

    // Check for contact information
    const { hasPhone, hasEmail } = containsContactInfo(newMessage)
    if (hasPhone || hasEmail) {
      const detectedPattern = hasPhone ? 'phone' : 'email'
      const result = await processContactViolation((user?.id || ''), selectedConversation.otherUserId, newMessage, detectedPattern)
      
      switch (result.action) {
        case 'warning_1':
          setWarningModal({ show: true, type: 'first', message: 'Sharing personal contact information (phone numbers, email) is not allowed in chat. This is your 1st warning.' })
          return // Don't send the message
        case 'warning_2':
          setWarningModal({ show: true, type: 'last', message: '⚠️ LAST WARNING! Sharing contact information again will result in your account being BLOCKED for 24 hours.' })
          return
        case 'block_24h':
          setWarningModal({ show: true, type: 'blocked', message: '🚫 Your account has been BLOCKED for 24 hours for repeatedly sharing contact information. You cannot send messages during this period.' })
          setBlockStatus(await checkUserBlockStatus((user?.id || '')))
          return
        case 'permanent_block':
          setWarningModal({ show: true, type: 'permanent', message: '🚫 Your account has been PERMANENTLY BLOCKED for repeatedly violating our safety policy. You can submit an unblock request to admin.' })
          setBlockStatus(await checkUserBlockStatus((user?.id || '')))
          return
      }
    }

    const content = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)

    try {
      const sentMsg = await sendMessage((user?.id || ''), selectedConversation.otherUserId, content)
      
      // Optimistic update
      setMessages(prev => [...prev, sentMsg])
      
      // Update conversations list last message
      setConversations(prev => {
        const updated = prev.map(conv => 
          conv.otherUserId === selectedConversation.otherUserId 
            ? { ...conv, lastMessage: sentMsg } 
            : conv
        )
        updated.sort((a, b) => {
          if (!a.lastMessage && !b.lastMessage) return 0
          if (!a.lastMessage) return 1
          if (!b.lastMessage) return -1
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
        })
        return updated
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setNewMessage(content) // Restore message
    } finally {
      setSendingMessage(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const filteredConversations = conversations.filter(conv => {
    const nameMatch = `${conv.otherUser.first_name} ${conv.otherUser.last_name}`.toLowerCase().includes(searchQuery.toLowerCase());
    const messageMatch = conv.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || messageMatch;
  });

  const handleReportSubmit = async () => {
    if (!reportReason || !reportingMessage) return
    try {
      await reportMessage(
        (user?.id || ''),
        reportingMessage.sender_id,
        reportingMessage.id,
        reportingMessage.content,
        `${reportReason}: ${reportDetails}`
      )
      toast.success("Message reported. Our team will review it.")
      setShowReportModal(false)
      setReportingMessage(null)
      setReportReason('')
      setReportDetails('')
    } catch (error) {
      console.error('Error reporting message:', error)
      toast.error('Failed to report message')
    }
  }

  const handleUserReportSubmit = async (reason: string, note: string) => {
    if (!user || !selectedConversation) return
    try {
      await reportUser((user?.id || ''), selectedConversation.otherUserId, reason, note, 'messages')
      toast.success('User reported successfully. Our team will review the chat history.')
      setShowUserReportModal(false)
      setSelectedConversation(null) // Close chat as they are now blocked
      fetchConversations() // Refresh list
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report')
      throw err
    }
  }

  const handleUnblockRequest = async () => {
    if (!unblockReason.trim()) return
    setSubmittingUnblock(true)
    try {
      await submitUnblockRequest((user?.id || ''), unblockReason)
      toast.success("Unblock request submitted successfully.")
      setWarningModal({ show: false, type: '', message: '' })
    } catch (error) {
      console.error('Error submitting unblock request:', error)
      toast.error('Failed to submit request')
    } finally {
      setSubmittingUnblock(false)
    }
  }

  if (loading || !blockStatus) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ChatSkeleton />
    </div>
  )

  if (blockStatus.isBlocked || blockStatus.isPermanentlyBlocked) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldOff size={40} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {blockStatus.isPermanentlyBlocked ? 'Account Permanently Blocked' : 'Account Temporarily Blocked'}
          </h2>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto">
            {blockStatus.isPermanentlyBlocked 
              ? 'Your account has been permanently blocked for repeatedly violating our safety policy regarding sharing contact information.'
              : `Your account is temporarily blocked until ${new Date(blockStatus.blockedUntil).toLocaleString()}. You can send messages again after the block expires.`}
          </p>

          <div className="bg-gray-50 rounded-xl p-6 text-left max-w-lg mx-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Request Unblock</h3>
            <textarea
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder="Explain why your account should be unblocked..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none mb-4"
            />
            <Button 
              onClick={handleUnblockRequest} 
              disabled={!unblockReason.trim() || submittingUnblock}
              className="w-full"
            >
              {submittingUnblock ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex h-[calc(100vh-160px)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* LEFT PANEL - CONVERSATIONS */}
        <div className={`w-full lg:w-96 border-r border-gray-100 flex flex-col ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-5 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length > 0 ? (
              filteredConversations.map(conv => (
                <div 
                  key={conv.otherUserId} 
                  onClick={() => setSelectedConversation(conv)}
                  className={`flex items-center gap-4 p-4 cursor-pointer transition-all border-b border-gray-50 hover:bg-gray-50 ${selectedConversation?.otherUserId === conv.otherUserId ? 'bg-primary-50 border-l-4 border-l-primary' : ''}`}
                >
                  <div className="relative">
                    <Avatar 
                      size="md" 
                      src={conv.otherUser.profile_photo_url} 
                      fallbackName={`${conv.otherUser.first_name} ${conv.otherUser.last_name}`} 
                      gender={conv.otherUser.gender}
                    />
                    {isUserOnline(conv.otherUserId) && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="font-bold text-gray-900 truncate">{conv.otherUser.first_name} {conv.otherUser.last_name}</p>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {getRelativeTime(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500 truncate">
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-primary text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold ml-2 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No conversations found</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - CHAT WINDOW */}
        <div className={`flex-1 flex flex-col bg-gray-50/30 ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* CHAT HEADER */}
              <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-4 shadow-sm">
                <button 
                  onClick={() => setSelectedConversation(null)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="relative">
                  <Avatar 
                    size="md" 
                    src={selectedConversation.otherUser.profile_photo_url} 
                    fallbackName={`${selectedConversation.otherUser.first_name} ${selectedConversation.otherUser.last_name}`} 
                    gender={selectedConversation.otherUser.gender}
                  />
                  {isUserOnline(selectedConversation.otherUserId) && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">
                    {selectedConversation.otherUser.first_name} {selectedConversation.otherUser.last_name}
                  </p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    {isUserOnline(selectedConversation.otherUserId) 
                      ? <><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Online</>
                      : (selectedConversation.otherUser.is_verified ? 'Verified Profile' : `#${selectedConversation.otherUser.profile_id}`)
                    }
                  </p>
                </div>
                <button 
                  onClick={() => setShowUserReportModal(true)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Report User"
                >
                  <AlertOctagon size={20} />
                </button>
                <Link to={`/profile/${selectedConversation.otherUserId}`}>
                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary-50">
                    View Profile
                  </Button>
                </Link>
              </div>

              {/* MESSAGES AREA */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
                {messages.length > 0 ? (
                  messages.map((msg, idx) => {
                    const isMyMessage = msg.sender_id === (user?.id || '')
                    const showDate = idx === 0 || formatMessageDate(messages[idx-1].created_at) !== formatMessageDate(msg.created_at)
                    
                    return (
                      <div key={msg.id} className="space-y-4">
                        {showDate && (
                          <div className="flex items-center gap-4 my-6">
                            <hr className="flex-1 border-gray-200" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white px-3 py-1 rounded-full border border-gray-100">
                              {formatMessageDate(msg.created_at)}
                            </span>
                            <hr className="flex-1 border-gray-200" />
                          </div>
                        )}
                        
                        <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} group`}>
                          {!isMyMessage && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center mr-2 relative">
                              <button 
                                onClick={() => {
                                  setReportingMessage(msg)
                                  setShowReportModal(true)
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="Report Message"
                              >
                                <Flag size={14} />
                              </button>
                            </div>
                          )}
                          <div className={`max-w-[85%] lg:max-w-[70%] px-4 py-3 shadow-sm ${
                            isMyMessage 
                              ? 'bg-primary text-white rounded-2xl rounded-tr-none' 
                              : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
                          }`}>
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                            <div className={`flex items-center gap-1 mt-1.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${isMyMessage ? 'text-white/70' : 'text-gray-400'}`}>
                                {formatMessageTime(msg.created_at)}
                              </span>
                              {isMyMessage && (
                                msg.is_read ? <CheckCheck size={12} className="text-white/70" /> : <Check size={12} className="text-white/70" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                      <MessageCircle className="text-primary" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Start a conversation</h3>
                    <p className="text-sm text-gray-500 max-w-xs mt-1">
                      Say hello to {selectedConversation.otherUser.first_name}! You both have accepted each other's interest.
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
                {isOtherTyping && (
                  <div className="px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-gray-400 italic">typing...</span>
                  </div>
                )}
              </div>

              {/* INPUT AREA */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                  <textarea 
                    rows={1}
                    placeholder="Type a message..." 
                    className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none max-h-32 transition-all"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      if (selectedConversation) {
                        emitTypingStart(selectedConversation.otherUserId)
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                        typingTimeoutRef.current = setTimeout(() => {
                          emitTypingStop(selectedConversation.otherUserId)
                        }, 2000)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || sendingMessage}
                    className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-700 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none flex-shrink-0"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-8 text-center">
              <EmptyState 
                icon={<MessageCircle size={64} className="text-gray-200" />} 
                title="Your Messages" 
                description="Select a conversation from the list to start chatting with your connections." 
              />
            </div>
          )}
        </div>
      </div>

      {/* Warning Modal */}
      {warningModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              warningModal.type === 'first' ? 'bg-yellow-100 text-yellow-600' :
              warningModal.type === 'last' ? 'bg-orange-100 text-orange-600' :
              warningModal.type === 'blocked' ? 'bg-red-100 text-red-600' :
              'bg-red-900 text-white'
            }`}>
              {warningModal.type === 'first' && <AlertTriangle size={32} />}
              {warningModal.type === 'last' && <AlertOctagon size={32} />}
              {warningModal.type === 'blocked' && <ShieldOff size={32} />}
              {warningModal.type === 'permanent' && <Ban size={32} />}
            </div>
            
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
              {warningModal.type === 'first' ? 'Warning' :
               warningModal.type === 'last' ? 'Last Warning!' :
               warningModal.type === 'blocked' ? 'Account Blocked' :
               'Permanently Blocked'}
            </h3>
            
            <p className="text-center text-gray-600 mb-6">
              {warningModal.message}
            </p>
            
            {warningModal.type === 'permanent' ? (
              <div className="space-y-4">
                <textarea
                  value={unblockReason}
                  onChange={(e) => setUnblockReason(e.target.value)}
                  placeholder="Explain why your account should be unblocked..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setWarningModal({ show: false, type: '', message: '' })} className="flex-1">Close</Button>
                  <Button onClick={handleUnblockRequest} disabled={!unblockReason.trim() || submittingUnblock} className="flex-1">
                    {submittingUnblock ? 'Submitting...' : 'Request Unblock'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setWarningModal({ show: false, type: '', message: '' })}
                className="w-full"
                variant={warningModal.type === 'first' ? 'primary' : 'danger'}
              >
                I Understand
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && reportingMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Report This Message</h3>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-sm text-gray-700 italic">
              "{reportingMessage.content}"
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for reporting</label>
                <select 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Select a reason...</option>
                  <option value="Abusive Language">Abusive Language</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Spam">Spam</option>
                  <option value="Sharing Contact Info">Sharing Contact Info</option>
                  <option value="Threatening">Threatening</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                  placeholder="Provide more context..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => {
                setShowReportModal(false)
                setReportingMessage(null)
                setReportReason('')
              }} className="flex-1">Cancel</Button>
              <Button 
                variant="danger" 
                onClick={handleReportSubmit} 
                disabled={!reportReason}
                className="flex-1"
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report User Modal */}
      {selectedConversation && (
        <ReportUserModal
          isOpen={showUserReportModal}
          onClose={() => setShowUserReportModal(false)}
          onSubmit={handleUserReportSubmit}
          reportedUserName={`${selectedConversation.otherUser.first_name} ${selectedConversation.otherUser.last_name}`}
        />
      )}
    </div>
  )
}
