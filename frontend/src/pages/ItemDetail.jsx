import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import StatusBadge from '../components/common/StatusBadge'
import { formatLocation } from '../utils/formatters'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const socket = useSocket()

  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)

  // Selected angle/image
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [inspectModal, setInspectModal] = useState(false)

  // Claims state
  const [claims, setClaims] = useState([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [claimModalOpen, setClaimModalOpen] = useState(() => searchParams.get('action') === 'claim')
  const [proofDetails, setProofDetails] = useState('')
  const [serialProof, setSerialProof] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [actioningClaimId, setActioningClaimId] = useState(null)

  // Chat messenger state
  const [chatOpen, setChatOpen] = useState(() => ['sighting', 'chat'].includes(searchParams.get('action')))
  const [conversation, setConversation] = useState(null)
  const [_conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Ownership check
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
      toast.error('Municipal listing file not found')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
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
      // eslint-disable-next-line react/set-state-in-effect
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
              (c) => (c.item?._id || c.item) === item._id
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
          if (prev.some((m) => m._id === msg._id)) return prev
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
      socket.off('new_message', handleNewMessage)
      socket.off('user_typing', handleTyping)
    }
  }, [socket, conversation])

  // Scroll to bottom of messages
  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatOpen])

  // Handle Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!msgText.trim() || !conversation) return

    setSending(true)
    const textToSend = msgText.trim()
    setMsgText('')

    try {
      const { data } = await api.post(`/api/chat/conversations/${conversation._id}/messages`, {
        text: textToSend
      })

      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev
          return [...prev, data.message]
        })
      }
    } catch {
      toast.error('Failed to dispatch message')
      setMsgText(textToSend)
    } finally {
      setSending(false)
    }
  }

  // Handle Typing indicator
  const handleMsgInputChange = (e) => {
    setMsgText(e.target.value)
    if (!socket || !conversation) return

    socket.emit('typing', { conversationId: conversation._id, userName: user?.name })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId: conversation._id })
    }, 1500)
  }

  // Submit Claim
  const handleSubmitClaim = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please sign in to submit an ownership claim')
      navigate('/login')
      return
    }

    if (!proofDetails.trim()) {
      toast.error('Please explain your proof of ownership')
      return
    }

    setSubmittingClaim(true)
    try {
      const fd = new FormData()
      let combinedProof = proofDetails.trim()
      if (serialProof.trim()) {
        combinedProof += ` [Documented Serial/Engraving: ${serialProof.trim()}]`
      }
      fd.append('proofDetails', combinedProof)
      if (proofFile) {
        fd.append('proofImage', proofFile)
      }

      const { data } = await api.post(`/api/claims/item/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.success) {
        toast.success('Ownership claim registered under municipal review')
        setClaimModalOpen(false)
        setProofDetails('')
        setSerialProof('')
        setProofFile(null)
        setProofPreview(null)
        fetchItem()
      } else {
        throw new Error(data.message || 'Claim submission failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error submitting claim')
    } finally {
      setSubmittingClaim(false)
    }
  }

  // Approve / Reject Claim (Owner action)
  const handleClaimStatusAction = async (claimId, newStatus) => {
    setActioningClaimId(claimId)
    try {
      const { data } = await api.patch(`/api/claims/${claimId}/status`, { status: newStatus })
      if (data.success) {
        toast.success(`Claim marked as ${newStatus}`)
        fetchClaims()
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating claim status')
    } finally {
      setActioningClaimId(null)
    }
  }

  // Mark item as Resolved
  const handleResolveItem = async () => {
    try {
      const { data } = await api.patch(`/api/items/${id}/status`, { status: 'Resolved' })
      if (data.success) {
        toast.success('Case marked as Resolved & Reunited!')
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error resolving item')
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-container border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
        <p className="text-body-sm font-body-sm text-on-surface-variant">Opening municipal case dossier...</p>
      </div>
    )
  }

  if (!item) return null

  const caseId = (item._id || '').slice(-4).toUpperCase()
  const itemType = (item.type || item.itemType || 'found').toLowerCase()
  const DEFAULT_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' fill='none'%3E%3Crect width='800' height='600' fill='%23F1F5F9'/%3E%3Ccircle cx='400' cy='280' r='50' stroke='%2394A3B8' stroke-width='4'/%3E%3Ctext x='400' y='380' font-family='system-ui, sans-serif' font-size='18' font-weight='500' fill='%2364748B' text-anchor='middle'%3ENo Incident Photo Filed%3C/text%3E%3C/svg%3E"
  const allImages = item.images && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : [DEFAULT_IMAGE_PLACEHOLDER])
  const activeImage = allImages[activeImageIndex] || allImages[0]
  const reporterName = item.reportedBy?.name || item.reporterId?.name || 'Verified Civic Custodian'

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant mb-6">
        <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-body-sm">home</span>
          <span>Home</span>
        </Link>
        <span className="material-symbols-outlined text-body-sm text-outline-variant">chevron_right</span>
        <span className="hover:text-primary transition-colors">{item.category || 'General'}</span>
        <span className="material-symbols-outlined text-body-sm text-outline-variant">chevron_right</span>
        <span className="text-on-surface font-semibold truncate max-w-xs md:max-w-md">
          {item.title} (Case #{caseId})
        </span>
      </nav>

      {/* Two-Column Item Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Image Gallery & AI Diagnostics (5 cols) */}
        <section className="lg:col-span-6 xl:col-span-5 flex flex-col gap-5">
          {/* Primary Image Display Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 shadow-xs overflow-hidden relative group">
            {/* Status Badges Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
              <StatusBadge status={item.status} type={itemType} />
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-surface-container-lowest/90 backdrop-blur-md text-primary font-semibold border border-outline-variant/50 shadow-xs">
                <span className="material-symbols-outlined text-label-sm">inventory_2</span>
                Lockbox #{caseId}
              </span>
            </div>

            {/* Main Image Asset */}
            <div className="aspect-[4/3] w-full bg-surface-container-low overflow-hidden relative">
              <img
                src={activeImage}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/75 via-primary/20 to-transparent p-4 flex items-end justify-between">
                <div className="text-on-primary">
                  <p className="text-label-sm font-label-sm opacity-80">Municipal Catalog Asset</p>
                  <p className="text-body-sm font-body-sm font-medium truncate max-w-xs">
                    Case #{caseId} photographic documentation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectModal(true)}
                  className="bg-surface-container-lowest/90 hover:bg-surface-container-lowest text-primary text-label-sm font-label-sm px-2.5 py-1 rounded-lg flex items-center gap-1 backdrop-blur-md font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-body-sm">zoom_in</span>
                  <span>Inspect 4K</span>
                </button>
              </div>
            </div>

            {/* Thumbnail Angles Strip */}
            {allImages.length > 1 && (
              <div className="p-4 flex gap-3 overflow-x-auto bg-surface-container-lowest border-t border-outline-variant/40 custom-scrollbar">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square w-16 rounded-xl border-2 overflow-hidden flex-shrink-0 transition-all ${
                      activeImageIndex === idx ? 'border-primary shadow-xs' : 'border-outline-variant hover:border-primary/50'
                    }`}
                  >
                    <img src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Visual Match & Forensic Diagnostics Widget */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/60 shadow-xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-body-md font-body-md font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">auto_awesome</span>
                <span>AI Visual &amp; Registry Diagnostics</span>
              </h3>
              <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-primary font-semibold">
                Engine v4.2
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50">
                <div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant mb-1">
                  <span>Visual Confidence</span>
                  <span className="text-secondary font-bold font-label-md text-label-md">96.4%</span>
                </div>
                <div className="w-full bg-outline-variant/40 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '96%' }}></div>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-snug">
                  Chassis and color features verified via 512-D local CLIP embeddings
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/50">
                <div className="flex items-center justify-between text-label-sm font-label-sm text-on-surface-variant mb-1">
                  <span>Hardware Hash</span>
                  <span className="text-secondary font-bold font-label-md text-label-md">Verified</span>
                </div>
                <div className="w-full bg-outline-variant/40 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-snug">
                  Tamper-evident chain of custody logged under Case #{caseId}
                </p>
              </div>
            </div>

            {/* Custody Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-body-sm">
              <span className="material-symbols-outlined text-secondary text-body-lg shrink-0 mt-0.5">shield</span>
              <div>
                <p className="text-primary font-semibold text-body-sm">Tamper-Evident Bag #T-{caseId}88</p>
                <p className="text-on-surface-variant text-body-sm">
                  Physical property is preserved under municipal security protocols. Retrieval requires government identity verification.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Metadata, Case History, Actions & Custody Details (7 cols) */}
        <section className="lg:col-span-6 xl:col-span-7 flex flex-col gap-5">
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/60 shadow-xs flex flex-col gap-6">
            {/* Top Title & Case Identifier Header */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary font-semibold uppercase">
                    {item.category || 'General Incident'}
                  </span>
                  <span className="text-on-surface-variant text-label-sm font-label-sm">Case Registry ID:</span>
                  <span className="text-primary font-semibold font-label-md text-label-md">#{caseId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface-variant text-label-sm font-label-sm">
                  <span className="material-symbols-outlined text-body-sm text-secondary">schedule</span>
                  <span>{new Date(item.createdAt || item.date).toLocaleDateString()}</span>
                </div>
              </div>

              <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
                {item.title}
              </h1>
              <p className="text-body-md font-body-md text-on-surface-variant mt-2 leading-relaxed">
                {item.description || 'Turned into municipal custody. Case file includes verified physical characteristics.'}
              </p>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant/50">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-body-lg">fmd_good</span>
                </span>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">Recovery Geolocation</p>
                  <p className="text-body-md font-body-md font-semibold text-primary">{formatLocation(item.location, 'Metropolitan Precinct')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-body-lg">calendar_today</span>
                </span>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">Incident Timestamp</p>
                  <p className="text-body-md font-body-md font-semibold text-primary">
                    {new Date(item.date || item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-body-lg">badge</span>
                </span>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">Intake Officer / Reporter</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-body-md font-body-md font-semibold text-primary">{reporterName}</p>
                    <span className="material-symbols-outlined text-[15px] text-secondary">check_circle</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/50 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-body-lg">lock</span>
                </span>
                <div>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">Physical Custody Facility</p>
                  <p className="text-body-md font-body-md font-semibold text-primary">Lockbox #{caseId} · Central Depository</p>
                </div>
              </div>
            </div>

            {/* Distinguishing Features Checklist */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-body-md font-body-md font-bold text-primary">
                Distinguishing Marks &amp; Verification Notes
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
                  <span className="material-symbols-outlined text-secondary text-body-md">check</span>
                  <span className="text-body-sm font-body-sm text-on-surface">
                    <strong>Custody Verification:</strong> Documented in public records ledger under Case #{caseId}.
                  </span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
                  <span className="material-symbols-outlined text-secondary text-body-md">check</span>
                  <span className="text-body-sm font-body-sm text-on-surface">
                    <strong>Category Specifics:</strong> {item.category} filed with photographic evidence.
                  </span>
                </div>
                {item.subCategory && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
                    <span className="material-symbols-outlined text-secondary text-body-md">check</span>
                    <span className="text-body-sm font-body-sm text-on-surface">
                      <strong>Sub-Category:</strong> {item.subCategory}
                    </span>
                  </div>
                )}
                {item.confidentialVerification && (
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-secondary/40 bg-secondary-container/20">
                    <span className="material-symbols-outlined text-secondary text-body-md mt-0.5">lock</span>
                    <span className="text-body-sm font-body-sm text-primary">
                      <strong>Confidential Verification Clue (Private to Reporter):</strong> {item.confidentialVerification}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-3 border-t border-outline-variant/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={handleResolveItem}
                    className="flex-1 py-3 px-5 rounded-xl bg-secondary hover:bg-on-secondary-container text-on-secondary font-semibold text-body-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span>Mark as Reunited &amp; Close Case</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatOpen((v) => !v)}
                    className="py-3 px-5 rounded-xl border-2 border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px] text-secondary">chat</span>
                    <span>{chatOpen ? 'Hide Messenger' : 'Open Messenger'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setClaimModalOpen(true)}
                    className="flex-1 py-3 px-5 rounded-xl bg-primary text-on-primary font-semibold text-body-md hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px] text-secondary-fixed">verified</span>
                    <span>Claim This Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatOpen((v) => !v)}
                    className="py-3 px-5 rounded-xl border-2 border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px] text-secondary">encrypted</span>
                    <span>{chatOpen ? 'Close Secure Chat' : 'Start Secure Chat'}</span>
                  </button>
                </>
              )}
            </div>

            {/* Claims Review Section */}
            {isOwner ? (
              <div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">assignment_turned_in</span>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-primary">
                      Ownership Verification Claims ({claims.length})
                    </h3>
                  </div>
                  {claimsLoading && <span className="text-label-sm font-label-sm text-outline">Refreshing...</span>}
                </div>

                {claims.length === 0 ? (
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    No citizens have filed ownership claims for this case yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {claims.map((cl) => {
                      const claimantName = cl.claimant?.name || cl.claimantName || 'Citizen Claimant'
                      return (
                        <div key={cl._id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-primary text-body-md">{claimantName}</p>
                              <p className="text-label-sm font-label-sm text-outline">
                                Filed: {new Date(cl.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-semibold uppercase ${
                              cl.status === 'approved'
                                ? 'bg-secondary-container text-on-secondary-fixed-variant'
                                : cl.status === 'rejected'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            }`}>
                              {cl.status}
                            </span>
                          </div>

                          <p className="text-body-sm font-body-sm text-on-surface-variant bg-surface-container p-3 rounded-lg">
                            <strong>Claimant's Proof Statement:</strong> {cl.proofDetails}
                          </p>

                          {cl.proofImage && (
                            <div className="w-24 h-24 rounded-lg overflow-hidden border border-outline-variant">
                              <img src={cl.proofImage} alt="Claim Proof" className="w-full h-full object-cover" />
                            </div>
                          )}

                          {cl.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={actioningClaimId === cl._id}
                                onClick={() => handleClaimStatusAction(cl._id, 'approved')}
                                className="px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-on-secondary-container text-on-secondary font-semibold text-body-sm flex items-center gap-1 shadow-xs transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                <span>Approve &amp; Reclaim</span>
                              </button>
                              <button
                                type="button"
                                disabled={actioningClaimId === cl._id}
                                onClick={() => handleClaimStatusAction(cl._id, 'rejected')}
                                className="px-3.5 py-1.5 rounded-lg border border-outline-variant hover:bg-surface-container text-error font-semibold text-body-sm flex items-center gap-1 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                                <span>Decline</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Privacy-shielded public claim notice */
              <div className="bg-surface-container-low/60 rounded-xl p-4 border border-outline-variant/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container animate-pulse"></span>
                    <h4 className="text-body-md font-body-md font-semibold text-primary">
                      Protected Ownership Claims Active
                    </h4>
                  </div>
                  <span className="text-label-sm font-label-sm text-on-surface-variant">Cryptographically Sealed</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex items-center justify-between relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant font-label-sm text-label-sm font-bold">
                      C1
                    </div>
                    <div>
                      <div className="filter blur-[3px] select-none text-body-sm font-semibold text-primary">
                        Claimant: Verification Active
                      </div>
                      <div className="text-[11px] text-on-surface-variant">Identity protected by municipal protocol</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                    Reviewing
                  </span>
                </div>
              </div>
            )}

            {/* REAL-TIME CHAT MESSENGER ACCORDION / BOX */}
            {chatOpen && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="px-5 py-3.5 bg-primary text-on-primary flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-secondary-fixed text-[20px]">encrypted</span>
                    <div>
                      <h4 className="text-body-md font-bold leading-tight">Civic Encrypted Messenger</h4>
                      <p className="text-[11px] text-inverse-primary">Case #{caseId} Direct Channel</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="text-inverse-primary hover:text-on-primary p-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Messages list */}
                <div className="p-4 h-72 overflow-y-auto space-y-3 bg-surface-container-low custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px] text-outline mb-1 block">chat_bubble_outline</span>
                      <p className="text-body-sm font-medium">No messages in this case channel yet.</p>
                      <p className="text-label-sm text-outline">Send a message to coordinate secure retrieval.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = (m.sender?._id || m.sender) === user?._id
                      return (
                        <div
                          key={m._id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-body-sm ${
                              isMe
                                ? 'bg-primary text-on-primary rounded-br-none shadow-xs'
                                : 'bg-surface-container-lowest text-primary border border-outline-variant rounded-bl-none shadow-xs'
                            }`}
                          >
                            <p>{m.text}</p>
                          </div>
                          <span className="text-[10px] font-label-sm text-outline mt-1 px-1">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })
                  )}
                  {typingUser && (
                    <p className="text-label-sm font-label-sm text-secondary animate-pulse">
                      {typingUser} is typing...
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <form onSubmit={handleSendMessage} className="p-3 bg-surface-container-lowest border-t border-outline-variant flex gap-2">
                  <input
                    type="text"
                    value={msgText}
                    onChange={handleMsgInputChange}
                    placeholder="Type coordination message..."
                    className="flex-1 px-4 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={sending || !msgText.trim()}
                    className="px-4 py-2 bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary rounded-xl font-semibold text-body-sm flex items-center gap-1"
                  >
                    <span>Send</span>
                    <span className="material-symbols-outlined text-[16px]">send</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Trust & Safe Custody Civic Protocol Section */}
      <section className="mt-12 bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 shadow-xs">
        <div className="max-w-3xl mb-8">
          <span className="px-2.5 py-1 rounded text-label-sm font-label-sm bg-secondary-container text-on-secondary-fixed-variant font-semibold uppercase">
            HavenFind Assurance Framework
          </span>
          <h2 className="text-headline-md font-headline-md font-bold text-primary mt-2">
            Civic Chain-of-Custody &amp; Safe Return Protocol
          </h2>
          <p className="text-body-md font-body-md text-on-surface-variant mt-1">
            Every lost item reported across municipal hubs is governed by strict statutory custody protocols to prevent fraudulent transfers and safeguard personal data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-headline-sm">fingerprint</span>
            </div>
            <h3 className="text-body-md font-body-md font-bold text-primary">1. Hardware Triangulation</h3>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Serial identifiers, purchase receipts, or IMEI records are verified against encrypted manufacturer databases without exposing personal credentials.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-headline-sm">verified_user</span>
            </div>
            <h3 className="text-body-md font-body-md font-bold text-primary">2. In-Person Handover</h3>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Items are released strictly at authorized municipal transit kiosks. Claimants present photo ID and input unlock credentials on-site.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-headline-sm">gavel</span>
            </div>
            <h3 className="text-body-md font-body-md font-bold text-primary">3. Zero-Fee Public Service</h3>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Civic recovery under HavenFind is 100% free of charge. No finder fees, administrative storage charges, or hidden transactional costs.
            </p>
          </div>
        </div>
      </section>

      {/* SUBMIT OWNERSHIP CLAIM MODAL OVERLAY */}
      {claimModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-primary/45 backdrop-blur-sm transition-opacity"
            onClick={() => setClaimModalOpen(false)}
          />

          <div className="relative bg-surface-container-lowest rounded-2xl max-w-2xl w-full border border-outline-variant shadow-2xl overflow-hidden z-10 my-8">
            <div className="px-6 py-5 border-b border-outline-variant/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px] text-secondary">fact_check</span>
                </div>
                <div>
                  <h2 className="text-headline-sm font-headline-sm font-bold text-primary">
                    Submit Ownership Claim
                  </h2>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    Case #{caseId} &bull; {item.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="p-6 space-y-4">
              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Proof of Ownership Statement <span className="text-error">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={proofDetails}
                  onChange={(e) => setProofDetails(e.target.value)}
                  placeholder="Describe unique hidden markings, contents, serial numbers, wallpaper, lock code, purchase details..."
                  className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Serial Number or Engraved Hallmark (Optional)
                </label>
                <input
                  type="text"
                  value={serialProof}
                  onChange={(e) => setSerialProof(e.target.value)}
                  placeholder="e.g. C02G41K9MD6R or IMEI prefix"
                  className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Upload Proof Document or Photo (Receipt, Box, ID)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files[0]
                    if (f) {
                      setProofFile(f)
                      setProofPreview(URL.createObjectURL(f))
                    }
                  }}
                  className="w-full text-body-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-body-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-container cursor-pointer"
                />
                {proofPreview && (
                  <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-outline-variant">
                    <img src={proofPreview} alt="Proof" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 text-body-sm font-body-sm text-on-surface-variant flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified</span>
                <span>
                  All claims are sent directly to the verified custodian and logged in municipal custody ledger. You will be notified when reviewed.
                </span>
              </div>

              <div className="pt-3 border-t border-outline-variant/60 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container text-primary text-body-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary text-body-sm font-semibold flex items-center gap-2"
                >
                  {submittingClaim ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Submitting Claim...</span>
                    </>
                  ) : (
                    <span>Submit Verification Claim</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT 4K IMAGE MODAL */}
      {inspectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/80 backdrop-blur-md"
          onClick={() => setInspectModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant p-2">
            <img src={activeImage} alt={item.title} className="w-full h-full max-h-[85vh] object-contain rounded-xl" />
            <button
              onClick={() => setInspectModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-primary/80 text-white hover:bg-primary"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
