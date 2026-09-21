import { useState, useEffect, useRef, useCallback } from 'react'
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
  ShieldCheck,
  FileCheck,
  Check,
  X,
  Loader2
} from 'lucide-react'
import api from '../services/api'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const socket = useSocket()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  // Claims state
  const [claims, setClaims] = useState([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const [proofDetails, setProofDetails] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [actioningClaimId, setActioningClaimId] = useState(null)

  // Chat state
  const [conversation, setConversation] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const isOwner = Boolean(
    user && item && (
      (item.reportedBy?._id || item.reportedBy) === user._id ||
      (item.reporterId?._id || item.reporterId) === user._id
    )
  )

  const fetchItem = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/items/${id}`)
      if (data.success && data.data) {
        setItem(data.data)
      }
    } catch {
      toast.error('Listing not found')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    fetchItem()
  }, [fetchItem])

  // Fetch Claims for Reporter
  const fetchClaims = useCallback(async () => {
    if (!isAuthenticated || !isOwner) return
    setClaimsLoading(true)
    try {
      const { data } = await api.get(`/api/claims/item/${id}`)
      if (data.success) {
        setClaims(data.claims || [])
      }
    } catch (err) {
      console.warn('Could not load claims:', err.message)
    } finally {
      setClaimsLoading(false)
    }
  }, [id, isAuthenticated, isOwner])

  useEffect(() => {
    if (isOwner) {
      fetchClaims()
    }
  }, [isOwner, fetchClaims])

  // Chat initialization
  useEffect(() => {
    if (!isAuthenticated || !item) return

    const initChat = async () => {
      try {
        const reporter = item.reportedBy || item.reporterId
        const recipientId = typeof reporter === 'object' ? reporter?._id : reporter

        if (!isOwner) {
          if (!recipientId) return
          const { data } = await api.post('/api/chat/conversations', {
            itemId: item._id,
            recipientId
          })

          if (data.success && data.conversation) {
            setConversation(data.conversation)
            const msgRes = await api.get(`/api/chat/conversations/${data.conversation._id}/messages`)
            if (msgRes.data.success) {
              setMessages(msgRes.data.messages || [])
            }
          }
        } else {
          const { data } = await api.get('/api/chat/conversations')
          if (data.success) {
            const itemConvos = (data.conversations || []).filter(
              c => (c.item?._id || c.item) === item._id
            )
            setConversations(itemConvos)
            if (itemConvos.length > 0) {
              setConversation(itemConvos[0])
              const msgRes = await api.get(`/api/chat/conversations/${itemConvos[0]._id}/messages`)
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
  }, [item, isAuthenticated, isOwner])

  // Socket room join
  useEffect(() => {
    if (!socket || !conversation) return
    socket.emit('join_conversation', conversation._id)

    const handleNewMessage = (msg) => {
      if (msg.conversationId === conversation._id) {
        setMessages((prev) => {
          if (prev.some(m => m._id === msg._id)) return prev
          return [...prev, msg]
        })
      }
    }

    const handleTyping = ({ userName, isTyping }) => {
      if (isTyping) {
        setTypingUser(userName)
      } else {
        setTypingUser(null)
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('user_typing', handleTyping)

    return () => {
      socket.emit('leave_conversation', conversation._id)
      socket.off('new_message', handleNewMessage)
      socket.off('user_typing', handleTyping)
    }
  }, [socket, conversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send Chat Message
  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!msgText.trim() || !conversation || sending) return

    const text = msgText.trim()
    setMsgText('')
    setSending(true)

    if (socket) {
      socket.emit('typing', { conversationId: conversation._id, userName: user?.name, isTyping: false })
    }

    try {
      const { data } = await api.post(`/api/chat/conversations/${conversation._id}/messages`, { text })
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some(m => m._id === data.message._id)) return prev
          return [...prev, data.message]
        })
      }
    } catch {
      toast.error('Could not deliver message')
      setMsgText(text)
    } finally {
      setSending(false)
    }
  }

  // Submit Ownership Claim
  const handleSubmitClaim = async (e) => {
    e.preventDefault()
    if (!proofDetails.trim()) {
      toast.error('Please describe your proof of ownership')
      return
    }

    setSubmittingClaim(true)
    try {
      const formData = new FormData()
      formData.append('proofDetails', proofDetails.trim())
      if (proofFile) {
        formData.append('proofImage', proofFile)
      }

      const { data } = await api.post(`/api/claims/${item._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.success) {
        toast.success(data.message || 'Ownership claim submitted!')
        setClaimModalOpen(false)
        setProofDetails('')
        setProofFile(null)
        setProofPreview(null)
        setItem(prev => ({ ...prev, status: 'Pending Claim' }))
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error submitting claim')
    } finally {
      setSubmittingClaim(false)
    }
  }

  // Resolve Claim (Approve / Reject)
  const handleResolveClaim = async (claimId, status) => {
    setActioningClaimId(claimId)
    try {
      const { data } = await api.patch(`/api/claims/${claimId}/resolve`, { status })
      if (data.success) {
        toast.success(data.message || `Claim ${status}`)
        setClaims(prev => prev.map(c => c._id === claimId ? { ...c, status } : c))
        if (data.itemStatus) {
          setItem(prev => ({ ...prev, status: data.itemStatus }))
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve claim')
    } finally {
      setActioningClaimId(null)
    }
  }

  // Toggle item status directly
  const handleToggleStatus = async () => {
    if (!item) return
    const nextStatus = item.status === 'Resolved' ? 'Active' : 'Resolved'
    try {
      const { data } = await api.patch(`/api/items/${item._id}/status`, { status: nextStatus })
      if (data.success) {
        setItem(prev => ({ ...prev, status: nextStatus }))
        toast.success(`Item status updated to ${nextStatus}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  if (loading || !item) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const isLost = (item.type || item.itemType || 'lost').toLowerCase() === 'lost'
  const isResolved = item.status === 'Resolved'
  const isPending = item.status === 'Pending Claim'
  const reporter = item.reportedBy || item.reporterId
  const reporterName = reporter?.name || 'Community Member'
  const reporterInitial = reporterName.charAt(0).toUpperCase()

  return (
    <div style={{ padding: '36px 0 80px' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          color: '#a1a1aa',
          cursor: 'pointer',
          fontSize: 14,
          marginBottom: 24,
          padding: 0
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
      >
        <ChevronLeft size={18} /> Back to listings
      </button>

      {/* Main Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 32 }} className="item-detail-grid">
        {/* Left Column: Image & Details */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Main Item Image */}
          <div style={{
            position: 'relative',
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#09090b',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <img
              src={item.imageUrl}
              alt={item.title}
              style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block' }}
            />
            {/* Type Overlay */}
            <div style={{
              position: 'absolute',
              top: 16,
              left: 16,
              background: isLost ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              padding: '6px 14px',
              borderRadius: 999,
              letterSpacing: '0.04em'
            }}>
              {isLost ? 'Lost Item' : 'Found Item'}
            </div>

            {/* Status Overlay */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: isResolved ? 'rgba(100, 116, 139, 0.9)' : isPending ? 'rgba(245, 158, 11, 0.9)' : 'rgba(16, 185, 129, 0.9)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: 999
            }}>
              {item.status}
            </div>
          </div>

          {/* Item Meta Box */}
          <div style={{
            background: 'rgba(18, 18, 22, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 24
          }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fafafa', marginBottom: 12, lineHeight: 1.3 }}>
              {item.title}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#818cf8', fontSize: 13, fontWeight: 600, background: 'rgba(99, 102, 241, 0.12)', padding: '4px 10px', borderRadius: 8 }}>
                <Tag size={14} />
                <span>{item.category}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#a1a1aa', fontSize: 13 }}>
                <Calendar size={14} />
                <span>{new Date(item.date || item.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#a1a1aa', fontSize: 13 }}>
                <MapPin size={14} />
                <span>{item.location?.addressText || 'Location recorded'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Description & Circumstances
              </h3>
              <p style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {item.description || 'No additional description provided by the reporter.'}
              </p>
            </div>
          </div>

          {/* Reporter Profile Card */}
          <div style={{
            background: 'rgba(18, 18, 22, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                fontWeight: 800,
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {reporterInitial}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: '#fafafa', margin: '0 0 2px' }}>
                  {reporterName}
                </p>
                <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
                  Item Reporter {isOwner && '(You)'}
                </p>
              </div>
            </div>

            {/* Reporter Quick Actions */}
            {isOwner && (
              <button
                onClick={handleToggleStatus}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                  color: isResolved ? '#34d399' : '#cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <CheckCircle2 size={15} />
                <span>{isResolved ? 'Re-open Listing' : 'Mark as Resolved'}</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Right Column: Claims & Real-Time Chat */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Claim Action / Incoming Claims Section */}
          <div style={{
            background: 'rgba(18, 18, 22, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 24
          }}>
            {/* Visitor View: Claim Button */}
            {!isOwner && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <ShieldCheck size={20} color="#818cf8" />
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fafafa', margin: 0 }}>
                    Ownership Verification
                  </h2>
                </div>
                <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, marginBottom: 16 }}>
                  {isResolved
                    ? 'This item has already been reunited or marked as resolved.'
                    : 'Think this is your item or have conclusive proof? Submit an ownership claim with secret identifiers.'}
                </p>

                {!isResolved && (
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast.info('Please sign in to submit an ownership claim')
                        navigate('/login', { state: { from: { pathname: `/item/${id}` } } })
                        return
                      }
                      setClaimModalOpen(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 4px 18px rgba(99, 102, 241, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <FileCheck size={17} />
                    <span>Claim This Item</span>
                  </button>
                )}
              </div>
            )}

            {/* Reporter View: Incoming Claims List */}
            {isOwner && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={20} color="#818cf8" />
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#fafafa', margin: 0 }}>
                      Incoming Ownership Claims ({claims.length})
                    </h2>
                  </div>
                </div>

                {claimsLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#71717a' }}>
                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13 }}>Loading claims...</p>
                  </div>
                ) : claims.length === 0 ? (
                  <div style={{
                    background: '#0e0e11',
                    borderRadius: 14,
                    padding: '20px',
                    textAlign: 'center',
                    border: '1px dashed #27272a'
                  }}>
                    <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>
                      No ownership claims submitted yet for this item.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {claims.map((claim) => {
                      const isPendingClaim = claim.status === 'pending'
                      return (
                        <div
                          key={claim._id}
                          style={{
                            background: '#0e0e11',
                            border: '1px solid #27272a',
                            borderRadius: 14,
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                background: '#27272a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fafafa',
                                fontSize: 13,
                                fontWeight: 700
                              }}>
                                {claim.claimant?.name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, fontSize: 14, color: '#fafafa', margin: 0 }}>
                                  {claim.claimant?.name || 'Claimant'}
                                </p>
                                <p style={{ fontSize: 11, color: '#71717a', margin: 0 }}>
                                  {new Date(claim.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: claim.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : claim.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: claim.status === 'approved' ? '#34d399' : claim.status === 'rejected' ? '#f87171' : '#fbbf24'
                            }}>
                              {claim.status}
                            </span>
                          </div>

                          <div style={{ background: '#141418', padding: '10px 12px', borderRadius: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: 4 }}>
                              Submitted Proof:
                            </p>
                            <p style={{ fontSize: 13, color: '#e4e4e7', margin: 0, lineHeight: 1.5 }}>
                              {claim.proofDetails}
                            </p>
                          </div>

                          {claim.proofImage && (
                            <div style={{ marginTop: 4 }}>
                              <a href={claim.proofImage} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={claim.proofImage}
                                  alt="Proof Attachment"
                                  style={{ maxHeight: 90, borderRadius: 8, border: '1px solid #3f3f46', objectFit: 'cover' }}
                                />
                              </a>
                            </div>
                          )}

                          {isPendingClaim && (
                            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                              <button
                                onClick={() => handleResolveClaim(claim._id, 'approved')}
                                disabled={actioningClaimId === claim._id}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  padding: '8px 0',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: '#10b981',
                                  color: 'white',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={15} /> Approve Ownership
                              </button>
                              <button
                                onClick={() => handleResolveClaim(claim._id, 'rejected')}
                                disabled={actioningClaimId === claim._id}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  padding: '8px 0',
                                  borderRadius: 8,
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#f87171',
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={15} /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Real-time Messenger Card */}
          <div style={{
            background: 'rgba(18, 18, 22, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            height: 440
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={18} color="#818cf8" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: 0 }}>
                  Direct Messages
                </h3>
              </div>
              <span style={{ fontSize: 12, color: '#71717a' }}>
                {socket?.connected ? '⚡ Live Connected' : 'Connecting...'}
              </span>
            </div>

            {/* Conversation Switcher for Owner */}
            {isOwner && conversations.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
                {conversations.map((c) => {
                  const otherUser = c.participants?.find(p => p._id !== user?._id)
                  const isActive = conversation?._id === c._id
                  return (
                    <button
                      key={c._id}
                      onClick={() => setConversation(c)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: `1px solid ${isActive ? '#6366f1' : '#27272a'}`,
                        background: isActive ? 'rgba(99, 102, 241, 0.2)' : '#09090b',
                        color: isActive ? '#c7d2fe' : '#a1a1aa',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      {otherUser?.name || 'Chat'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Message Feed */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingRight: 6
            }}>
              {!isAuthenticated ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: '#71717a' }}>
                  <p style={{ fontSize: 13, marginBottom: 10 }}>Sign in to start messaging with the reporter.</p>
                  <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                    Sign in here
                  </Link>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: '#71717a', fontSize: 13 }}>
                  No messages exchanged yet. Send a greeting to start coordinating!
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender?._id === user?._id || m.sender === user?._id
                  return (
                    <div
                      key={m._id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: isMe ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#27272a',
                        color: '#fafafa',
                        padding: '9px 14px',
                        borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        fontSize: 13,
                        lineHeight: 1.45
                      }}
                    >
                      {!isMe && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc', marginBottom: 2 }}>
                          {m.sender?.name || 'User'}
                        </div>
                      )}
                      <div>{m.text}</div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {typingUser && (
              <p style={{ fontSize: 11, color: '#818cf8', margin: '4px 0 0', fontStyle: 'italic' }}>
                {typingUser} is typing...
              </p>
            )}

            {/* Message Input Form */}
            {isAuthenticated && (
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => {
                    setMsgText(e.target.value)
                    if (socket && conversation) {
                      socket.emit('typing', { conversationId: conversation._id, userName: user?.name, isTyping: true })
                      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                      typingTimeoutRef.current = setTimeout(() => {
                        socket.emit('typing', { conversationId: conversation._id, userName: user?.name, isTyping: false })
                      }, 2000)
                    }
                  }}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    background: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: 10,
                    padding: '9px 12px',
                    color: '#fafafa',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !msgText.trim()}
                  style={{
                    padding: '0 16px',
                    borderRadius: 10,
                    background: '#6366f1',
                    border: 'none',
                    color: 'white',
                    cursor: sending || !msgText.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Send size={15} />
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>

      {/* Ownership Claim Modal */}
      <AnimatePresence>
        {claimModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 100
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: 480,
                background: '#121216',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 20,
                padding: 28,
                boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0 }}>
                  Claim Ownership
                </h3>
                <button
                  onClick={() => setClaimModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitClaim} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                    Proof of Ownership *
                  </label>
                  <textarea
                    rows={4}
                    value={proofDetails}
                    onChange={e => setProofDetails(e.target.value)}
                    placeholder="Provide serial numbers, private marks, wallpaper descriptions, passwords, or invoice details that only the true owner would know."
                    required
                    style={{
                      width: '100%',
                      background: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: 10,
                      padding: '10px 12px',
                      color: '#fafafa',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
                    Supporting Document / Photo (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setProofFile(file)
                        setProofPreview(URL.createObjectURL(file))
                      }
                    }}
                    style={{ color: '#a1a1aa', fontSize: 13 }}
                  />
                  {proofPreview && (
                    <img
                      src={proofPreview}
                      alt="Proof Preview"
                      style={{ height: 60, borderRadius: 8, marginTop: 8, objectFit: 'cover' }}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setClaimModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: '11px 0',
                      borderRadius: 10,
                      background: '#27272a',
                      border: 'none',
                      color: '#fafafa',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClaim}
                    style={{
                      flex: 1,
                      padding: '11px 0',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: submittingClaim ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submittingClaim ? 'Submitting Claim...' : 'Submit Claim'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 840px) {
          .item-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
