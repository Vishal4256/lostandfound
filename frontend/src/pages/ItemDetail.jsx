import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Calendar,
  Tag,
  ChevronLeft,
  Send,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
  Clock
} from 'lucide-react'
import Tilt from 'react-parallax-tilt'
import axios from 'axios'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { socket } = useSocket()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  // Chat state
  const [conversation, setConversation] = useState(null)
  const [conversations, setConversations] = useState([]) // If owner, list of inquiries
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherTyping, setOtherTyping] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // 1. Fetch Item Data
  const fetchItem = async () => {
    try {
      const { data } = await axios.get(`/api/items/${id}`)
      setItem(data.data)
    } catch {
      toast.error('Could not load item details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItem()
  }, [id])

  const isOwner = user && item && (
    (typeof item.reporterId === 'object' && item.reporterId?._id === user._id) ||
    item.reporterId === user._id
  )

  // 2. Setup Chat & Conversations
  useEffect(() => {
    if (!isAuthenticated || !item) return

    const initChat = async () => {
      try {
        if (!isOwner) {
          // Normal user: get or create conversation with the reporter
          const recipientId = typeof item.reporterId === 'object' ? item.reporterId?._id : item.reporterId
          if (!recipientId) return

          const { data } = await axios.post('/api/chat/conversations', {
            itemId: item._id,
            recipientId
          })

          if (data.success && data.conversation) {
            setConversation(data.conversation)
            // Fetch messages
            const msgRes = await axios.get(`/api/chat/conversations/${data.conversation._id}/messages`)
            if (msgRes.data.success) {
              setMessages(msgRes.data.messages || [])
            }
          }
        } else {
          // Reporter/Owner: fetch all conversations relating to this item
          const { data } = await axios.get('/api/chat/conversations')
          if (data.success) {
            const itemConvos = (data.conversations || []).filter(
              c => (c.item?._id || c.item) === item._id
            )
            setConversations(itemConvos)
            if (itemConvos.length > 0) {
              // Default to first conversation
              setConversation(itemConvos[0])
              const msgRes = await axios.get(`/api/chat/conversations/${itemConvos[0]._id}/messages`)
              if (msgRes.data.success) {
                setMessages(msgRes.data.messages || [])
              }
            }
          }
        }
      } catch (err) {
        console.error('Chat init error:', err)
      }
    }

    initChat()
  }, [item?._id, isAuthenticated, isOwner])

  // 3. Socket.io Real-time events for the active conversation
  useEffect(() => {
    if (!socket || !conversation?._id) return

    socket.emit('join_conversation', conversation._id)

    const handleNewMessage = (newMsg) => {
      if (newMsg.conversation === conversation._id) {
        setMessages((prev) => {
          if (prev.some(m => m._id === newMsg._id)) return prev
          return [...prev, newMsg]
        })
      }
    }

    const handleTyping = ({ userName, isTyping }) => {
      if (isTyping) {
        setOtherTyping(userName)
      } else {
        setOtherTyping(null)
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('user_typing', handleTyping)

    return () => {
      socket.emit('leave_conversation', conversation._id)
      socket.off('new_message', handleNewMessage)
      socket.off('user_typing', handleTyping)
    }
  }, [socket, conversation?._id])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, otherTyping])

  // Switch conversation for owner
  const selectConversation = async (convo) => {
    setConversation(convo)
    try {
      const { data } = await axios.get(`/api/chat/conversations/${convo._id}/messages`)
      if (data.success) {
        setMessages(data.messages || [])
      }
    } catch {
      toast.error('Failed to load messages')
    }
  }

  // Handle typing input
  const handleInputChange = (e) => {
    setMsgText(e.target.value)
    if (!socket || !conversation?._id) return

    socket.emit('typing', {
      conversationId: conversation._id,
      userName: user?.name || 'Someone',
      isTyping: true
    })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        conversationId: conversation._id,
        userName: user?.name || 'Someone',
        isTyping: false
      })
    }, 1500)
  }

  // Send message
  const handleSend = async (e) => {
    e?.preventDefault()
    if (!msgText.trim() || !conversation?._id || sending) return

    const text = msgText.trim()
    setMsgText('')
    setSending(true)

    if (socket) {
      socket.emit('typing', {
        conversationId: conversation._id,
        userName: user?.name || 'Someone',
        isTyping: false
      })
    }

    try {
      const { data } = await axios.post(`/api/chat/conversations/${conversation._id}/messages`, {
        text
      })
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some(m => m._id === data.message._id)) return prev
          return [...prev, data.message]
        })
      }
    } catch (err) {
      toast.error('Could not deliver message')
      setMsgText(text)
    } finally {
      setSending(false)
    }
  }

  // Toggle Item Status (Active <-> Resolved)
  const handleToggleStatus = async () => {
    if (!item) return
    const newStatus = item.status === 'Resolved' ? 'Active' : 'Resolved'
    setUpdatingStatus(true)
    try {
      const { data } = await axios.patch(`/api/items/${item._id}/status`, { status: newStatus })
      if (data.success) {
        setItem(data.data)
        toast.success(`Status updated to ${newStatus}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!item) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Item Not Found</h2>
        <p style={{ color: 'var(--text-3)', marginTop: 8, marginBottom: 24 }}>This listing might have been removed.</p>
        <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, cursor: 'pointer' }}>
          Back to Listings
        </button>
      </div>
    )
  }

  const type = item.type === 'lost'
    ? { label: 'Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' }
    : { label: 'Found', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' }

  const isResolved = item.status === 'Resolved'
  const reporterName = item.reporterId?.name || 'Community Member'
  const reporterInitial = reporterName.charAt(0).toUpperCase()

  const otherParticipant = conversation?.participants?.find(p => p._id !== user?._id)

  return (
    <div style={{ padding: '36px 0 60px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, marginBottom: 24, padding: 0, fontFamily: 'Inter, sans-serif', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
      >
        <ChevronLeft size={18} /> Back to listings
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 32 }} className="item-detail-grid">
        {/* Left Column: Image & Details */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Image */}
          <Tilt glareEnable glareMaxOpacity={0.05} scale={1.01} tiltMaxAngleX={4} tiltMaxAngleY={4}>
            <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)', position: 'relative' }}>
              <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: 420, objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,11,0.6) 0%, transparent 50%)' }} />

              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
                <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: type.color, background: type.bg, border: `1px solid ${type.border}`, backdropFilter: 'blur(8px)' }}>
                  {type.label}
                </span>
                <span style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isResolved ? '#10B981' : 'var(--accent)', background: isResolved ? 'rgba(16,185,129,0.1)' : 'var(--accent-dim)', border: `1px solid ${isResolved ? 'rgba(16,185,129,0.3)' : 'var(--accent-border)'}`, backdropFilter: 'blur(8px)' }}>
                  {item.status || 'Active'}
                </span>
              </div>
            </div>
          </Tilt>

          {/* Info Card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 8 }}>
                  {item.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: 'var(--text-3)', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={14} color="var(--accent)" />
                    <span>{item.location?.addressText || item.location || 'Unknown location'}</span>
                  </div>
                  <span>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={14} />
                    <span>{new Date(item.date || item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Tag size={14} />
                    <span>{item.category}</span>
                  </div>
                </div>
              </div>

              {/* Status Action for Reporter */}
              {isOwner && (
                <button
                  onClick={handleToggleStatus}
                  disabled={updatingStatus}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    background: isResolved ? 'var(--bg-surface)' : 'rgba(16,185,129,0.15)',
                    border: `1px solid ${isResolved ? 'var(--border)' : '#10B981'}`,
                    color: isResolved ? 'var(--text-2)' : '#10B981',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                  }}
                >
                  <CheckCircle2 size={14} />
                  {isResolved ? 'Re-open Listing' : 'Mark Resolved'}
                </button>
              )}
            </div>

            <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginTop: 16, whiteSpace: 'pre-line' }}>
              {item.description || 'No additional description provided.'}
            </p>

            {/* Reporter Profile Pill */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: 'var(--accent)', fontSize: 16
              }}>
                {reporterInitial}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Reported by {reporterName} {isOwner && <span style={{ color: 'var(--accent)', fontSize: 12 }}>(You)</span>}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Verified community member
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Live Chat & Messaging */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20,
            display: 'flex', flexDirection: 'column', height: 600, overflow: 'hidden'
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    {isOwner
                      ? `Inquiries (${conversations.length})`
                      : `Chat with ${reporterName}`}
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Real-time Socket.IO secure message channel
                  </p>
                </div>
              </div>
              <MessageCircle size={18} color="var(--accent)" />
            </div>

            {/* If Owner: Inquiries Selector List */}
            {isOwner && conversations.length > 1 && (
              <div style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto', background: 'var(--bg-surface)' }}>
                {conversations.map((c) => {
                  const other = c.participants?.find(p => p._id !== user?._id)
                  const isCurrent = conversation?._id === c._id
                  return (
                    <button
                      key={c._id}
                      onClick={() => selectConversation(c)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isCurrent ? 'var(--accent-dim)' : 'transparent',
                        color: isCurrent ? 'var(--accent)' : 'var(--text-2)',
                        cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      {other?.name || 'Inquirer'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Chat Body */}
            <div style={{ flex: 1, padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!isAuthenticated ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
                  <ShieldCheck size={36} color="var(--accent)" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Sign in to Contact Reporter</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 260, marginBottom: 18 }}>
                    Create an account or sign in to verify details and exchange private messages safely.
                  </p>
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/item/${item._id}` } }}
                    style={{
                      padding: '10px 20px', borderRadius: 10, background: 'var(--accent)',
                      color: 'white', fontWeight: 600, fontSize: 13, textDecoration: 'none'
                    }}
                  >
                    Sign In to Message
                  </Link>
                </div>
              ) : isOwner && conversations.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
                  <Clock size={32} color="var(--text-3)" style={{ marginBottom: 10 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No Inquiries Yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 260, marginTop: 4 }}>
                    When someone spots or asks about your report, their messages will appear here in real-time.
                  </p>
                </div>
              ) : (
                <>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, margin: 'auto' }}>
                      <p>Start the conversation about this item.</p>
                      <p style={{ fontSize: 11, marginTop: 4 }}>Ask for distinguishing marks, proof of ownership, or handover details.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = (m.sender?._id || m.sender) === user?._id
                      return (
                        <div
                          key={m._id || m.createdAt}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isMe ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{
                            maxWidth: '78%',
                            padding: '10px 14px',
                            borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            background: isMe ? 'var(--accent)' : 'var(--bg-surface)',
                            border: isMe ? 'none' : '1px solid var(--border)',
                            color: isMe ? 'white' : 'var(--text)',
                            fontSize: 13,
                            lineHeight: 1.5,
                            wordBreak: 'break-word'
                          }}>
                            {!isMe && (
                              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>
                                {m.sender?.name || 'User'}
                              </p>
                            )}
                            <p>{m.text}</p>
                            <p style={{ fontSize: 10, opacity: 0.65, textAlign: 'right', marginTop: 4 }}>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}

                  {otherTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', fontStyle: 'italic' }}>
                      <span>{otherTyping} is typing…</span>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Chat Input */}
            {isAuthenticated && (isOwner ? conversations.length > 0 : true) && (
              <form
                onSubmit={handleSend}
                style={{
                  padding: '12px 16px', borderTop: '1px solid var(--border)',
                  display: 'flex', gap: 10, background: 'var(--bg-surface)'
                }}
              >
                <input
                  value={msgText}
                  onChange={handleInputChange}
                  placeholder={isResolved ? 'Item is marked resolved, but you can still chat…' : 'Write your message…'}
                  style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', color: 'var(--text)',
                    fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif'
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !msgText.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 10,
                    background: msgText.trim() ? 'var(--accent)' : 'var(--border)',
                    color: msgText.trim() ? 'white' : 'var(--text-3)',
                    border: 'none', fontWeight: 600, fontSize: 13,
                    cursor: msgText.trim() ? 'pointer' : 'default',
                    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
                  }}
                >
                  <Send size={14} /> Send
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .item-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
