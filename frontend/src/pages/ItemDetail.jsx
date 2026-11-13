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
  const { socket, onlineUsers } = useSocket() || {}

  // Primary Item State
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [inspectModal, setInspectModal] = useState(false)

  // Claims State (For Reporter & Claimant)
  const [claims, setClaims] = useState([])
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [claimModalOpen, setClaimModalOpen] = useState(() => searchParams.get('action') === 'claim')
  const [proofDetails, setProofDetails] = useState('')
  const [serialProof, setSerialProof] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submittingClaim, setSubmittingClaim] = useState(false)

  // Review & Decision Modals (Reporter Actions)
  const [actionClaim, setActionClaim] = useState(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')
  const [infoRequestMessage, setInfoRequestMessage] = useState('')
  const [actioningClaim, setActioningClaim] = useState(false)

  // Claimant Response Modal
  const [respondModalOpen, setRespondModalOpen] = useState(false)
  const [claimantResponseText, setClaimantResponseText] = useState('')
  const [submittingResponse, setSubmittingResponse] = useState(false)

  // Case Lifecycle Modals
  const [handoverModalOpen, setHandoverModalOpen] = useState(false)
  const [handoverNotes, setHandoverNotes] = useState('')
  const [submittingHandover, setSubmittingHandover] = useState(false)

  const [recoveryRecordModalOpen, setRecoveryRecordModalOpen] = useState(false)
  const [closeCaseModalOpen, setCloseCaseModalOpen] = useState(false)
  const [reopenCaseModalOpen, setReopenCaseModalOpen] = useState(false)
  const [submittingStatusChange, setSubmittingStatusChange] = useState(false)

  // Edit Case Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSubCategory, setEditSubCategory] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Chat Messenger State
  const [chatOpen, setChatOpen] = useState(() => ['sighting', 'chat'].includes(searchParams.get('action')))
  const [conversation, setConversation] = useState(null)
  const [conversationsList, setConversationsList] = useState([])
  const [activeChatRecipientId, setActiveChatRecipientId] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUser, setTypingUser] = useState(null)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Technical Details Drawer (Optional Power-user view)
  const [techDetailsOpen, setTechDetailsOpen] = useState(false)

  // Ownership & Permissions Check
  const reporterId = (item?.reportedBy?._id || item?.reportedBy || item?.reporterId?._id || item?.reporterId)?.toString()
  const isOwner = Boolean(user && reporterId && user._id?.toString() === reporterId)
  const isAdmin = Boolean(user && user.role === 'admin')
  const canManage = isOwner || isAdmin

  // Fetch Item Dossier
  const fetchItem = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/items/${id}`)
      if (data.success && data.data) {
        setItem(data.data)
        setEditTitle(data.data.title || '')
        setEditDescription(data.data.description || '')
        setEditCategory(data.data.category || 'Other')
        setEditSubCategory(data.data.subCategory || '')
        setEditLocation(data.data.location?.addressText || '')
      }
    } catch {
      toast.error('Could not find case record in the registry.')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchItem()
  }, [fetchItem])

  // Fetch Submitted Claims for Case Owner / Admin
  const fetchClaims = useCallback(async () => {
    if (!isAuthenticated || !canManage) return
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
  }, [id, isAuthenticated, canManage])

  useEffect(() => {
    if (canManage) {
      // eslint-disable-next-line react/set-state-in-effect
      fetchClaims()
    }
  }, [canManage, fetchClaims])

  // Chat Setup & Initialization
  const initChatForTarget = useCallback(async (targetRecipientId) => {
    if (!isAuthenticated || !item || !targetRecipientId) return null
    try {
      const { data } = await api.post('/api/chat/conversations', {
        itemId: item._id,
        recipientId: targetRecipientId
      })

      if (data.success && data.conversation) {
        setConversation(data.conversation)
        if (socket) {
          const token = localStorage.getItem('findit_token')
          socket.emit('join_conversation', data.conversation._id, token)
        }
        const msgRes = await api.get(`/api/chat/conversations/${data.conversation._id}/messages`)
        if (msgRes.data.success) {
          setMessages(msgRes.data.messages || [])
        }
        return data.conversation
      }
    } catch (err) {
      console.warn('Chat load error:', err.response?.data?.message || err.message)
    }
    return null
  }, [isAuthenticated, item, socket])

  const loadChat = useCallback(async () => {
    if (!isAuthenticated || !item) return
    try {
      if (!canManage) {
        // Normal user / claimant chats with the reporter
        const target = item.reportedBy || item.reporterId
        const repId = (typeof target === 'object' && target?._id)
          ? target._id.toString()
          : target?.toString()
        if (repId && (!user?._id || user._id.toString() !== repId)) {
          await initChatForTarget(repId)
        }
      } else {
        // Reporter sees all threads for this case
        const { data } = await api.get('/api/chat/conversations')
        if (data.success && Array.isArray(data.conversations)) {
          const itemConvos = data.conversations.filter(
            (c) => (c.item?._id || c.item)?.toString() === item._id?.toString()
          )
          setConversationsList(itemConvos)
          if (itemConvos.length > 0) {
            const selectedConvo = activeChatRecipientId
              ? itemConvos.find((c) =>
                  c.participants.some((p) => (p._id || p)?.toString() === activeChatRecipientId?.toString())
                ) || itemConvos[0]
              : itemConvos[0]

            setConversation(selectedConvo)
            if (socket) {
              const token = localStorage.getItem('findit_token')
              socket.emit('join_conversation', selectedConvo._id, token)
            }
            const msgRes = await api.get(`/api/chat/conversations/${selectedConvo._id}/messages`)
            if (msgRes.data.success) {
              setMessages(msgRes.data.messages || [])
            }
          } else if (claims && claims.length > 0) {
            // No message thread yet, but claims exist -> connect with first claimant
            const firstClaimant = claims[0].claimant
            const claimantId = (firstClaimant?._id || firstClaimant)?.toString()
            if (claimantId) {
              await initChatForTarget(claimantId)
            }
          }
        }
      }
    } catch (err) {
      console.error('Initial chat load failed:', err)
    }
  }, [isAuthenticated, item, canManage, user, activeChatRecipientId, claims, initChatForTarget, socket])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    loadChat()
  }, [loadChat, chatOpen])

  // Automatically mark conversation as read when viewing active chat
  useEffect(() => {
    if (chatOpen && conversation?._id && isAuthenticated) {
      api.patch(`/api/chat/conversations/${conversation._id}/read`).catch(() => {})
    }
  }, [chatOpen, conversation?._id, isAuthenticated, messages.length])

  // Real-Time Socket Connection & Event Handling
  useEffect(() => {
    if (!socket) return

    const token = localStorage.getItem('findit_token')
    if (token) {
      socket.emit('authenticate', token)
    }

    if (conversation?._id) {
      socket.emit('join_conversation', conversation._id, token)
    }

    const handleNewMessage = (msg) => {
      const msgConvId = (msg.conversationId || msg.conversation?._id || msg.conversation)?.toString()
      const currentConvId = conversation?._id?.toString()

      if (msgConvId && currentConvId && msgConvId === currentConvId) {
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
      if (conversation?._id) {
        socket.emit('leave_conversation', conversation._id)
      }
    }
  }, [socket, conversation?._id])

  // Real-Time Application Synchronization for Claims & Case Status
  useEffect(() => {
    if (!socket || !item?._id) return

    const itemIdStr = item._id.toString()
    socket.emit('join_case', itemIdStr)

    const handleClaimSubmitted = (data) => {
      if (data?.itemId && data.itemId.toString() === itemIdStr) {
        if (data.claim) {
          setClaims((prev) => {
            if (prev.some((c) => c._id === data.claim._id)) return prev
            return [data.claim, ...prev]
          })
        }
        if (data.itemStatus) {
          setItem((prev) => prev ? { ...prev, status: data.itemStatus } : prev)
        }
        if (canManage) {
          toast.info(`New ownership claim submitted by ${data.claimant?.name || 'citizen'}!`)
        }
      }
    }

    const handleClaimStatusUpdated = (data) => {
      if (data?.itemId && data.itemId.toString() === itemIdStr) {
        setClaims((prev) =>
          prev.map((c) =>
            c._id === data.claimId
              ? { ...c, status: data.status, decisionReason: data.reason, reviewedAt: new Date() }
              : c
          )
        )
        if (data.itemStatus) {
          setItem((prev) => prev ? { ...prev, status: data.itemStatus } : prev)
        }

        const isMyClaim = claims.some(
          (c) => c._id === data.claimId && (c.claimant?._id || c.claimant)?.toString() === user?._id?.toString()
        )
        if (isMyClaim) {
          if (data.status === 'approved') {
            toast.success('Your ownership claim has been approved! You can now coordinate handover.')
          } else if (data.status === 'rejected') {
            toast.error(`Your claim was rejected: ${data.reason || 'Insufficient proof provided.'}`)
          }
        }
      }
    }

    const handleClaimInfoRequested = (data) => {
      if (data?.itemId && data.itemId.toString() === itemIdStr) {
        setClaims((prev) =>
          prev.map((c) =>
            c._id === data.claimId
              ? { ...c, status: 'info_requested', infoRequestedMessage: data.message }
              : c
          )
        )
        const isMyClaim = claims.some(
          (c) => c._id === data.claimId && (c.claimant?._id || c.claimant)?.toString() === user?._id?.toString()
        )
        if (isMyClaim) {
          toast.warning(`The reporter requested more information: "${data.message}"`)
        }
      }
    }

    const handleClaimInfoResponded = (data) => {
      if (data?.itemId && data.itemId.toString() === itemIdStr) {
        setClaims((prev) =>
          prev.map((c) =>
            c._id === data.claimId
              ? { ...c, status: 'pending', claimantResponse: data.claimantResponse }
              : c
          )
        )
        if (canManage) {
          toast.info('Claimant provided additional verification details for review.')
        }
      }
    }

    const handleCaseStatusUpdated = (data) => {
      if (data?.itemId && data.itemId.toString() === itemIdStr) {
        if (data.item) {
          setItem((prev) => (prev ? { ...prev, ...data.item } : prev))
        } else if (data.status) {
          setItem((prev) => (prev ? { ...prev, status: data.status } : prev))
        }

        if (data.status === 'Resolved') {
          toast.success('Case status updated: Successfully Reunited!')
        } else if (data.status === 'Closed') {
          toast.info('This case has been formally closed and archived.')
        } else if (data.status === 'Active') {
          toast.info('Case status updated to Active.')
        }
      }
    }

    const handleItemUpdated = (data) => {
      if (data?.item && data.item._id?.toString() === itemIdStr) {
        setItem((prev) => (prev ? { ...prev, ...data.item } : prev))
        toast.info('Case details updated.')
      }
    }

    socket.on('claim_submitted', handleClaimSubmitted)
    socket.on('claim_status_updated', handleClaimStatusUpdated)
    socket.on('claim_info_requested', handleClaimInfoRequested)
    socket.on('claim_info_responded', handleClaimInfoResponded)
    socket.on('case_status_updated', handleCaseStatusUpdated)
    socket.on('item_status_updated', handleCaseStatusUpdated)
    socket.on('item_updated', handleItemUpdated)

    return () => {
      socket.emit('leave_case', itemIdStr)
      socket.off('claim_submitted', handleClaimSubmitted)
      socket.off('claim_status_updated', handleClaimStatusUpdated)
      socket.off('claim_info_requested', handleClaimInfoRequested)
      socket.off('claim_info_responded', handleClaimInfoResponded)
      socket.off('case_status_updated', handleCaseStatusUpdated)
      socket.off('item_status_updated', handleCaseStatusUpdated)
      socket.off('item_updated', handleItemUpdated)
    }
  }, [socket, item?._id, canManage, user?._id, claims])

  // Scroll to Bottom of Chat
  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatOpen])

  // Copy Case ID to Clipboard
  const handleCopyCaseId = (e) => {
    e.stopPropagation()
    const idToCopy = item?._id || id
    navigator.clipboard.writeText(idToCopy)
    toast.success('Case Reference ID copied to clipboard!')
  }

  // Quick Trigger AI Recovery Assistant with Case Context
  const handleOpenAiAssistant = () => {
    const event = new CustomEvent('open-rag-assistant', {
      detail: {
        caseContext: {
          itemId: item._id,
          title: item.title,
          type: item.type || item.itemType,
          category: item.category,
          status: item.status,
          location: formatLocation(item.location),
          description: item.description
        }
      }
    })
    window.dispatchEvent(event)
  }

  // Submit Ownership Claim (Claimant)
  const handleSubmitClaim = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please sign in to submit an ownership claim.')
      navigate('/login')
      return
    }

    if (!proofDetails.trim()) {
      toast.error('Please describe your proof of ownership in detail.')
      return
    }

    setSubmittingClaim(true)
    try {
      const fd = new FormData()
      let combinedProof = proofDetails.trim()
      if (serialProof.trim()) {
        combinedProof += `\n[Documented Serial / Secret Identification]: ${serialProof.trim()}`
      }
      fd.append('proofDetails', combinedProof)
      if (proofFile) {
        fd.append('proofImage', proofFile)
      }

      const { data } = await api.post(`/api/claims/item/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.success) {
        toast.success('Ownership claim submitted successfully! The reporter will review your proof.')
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

  // Approve Claim (Reporter / Admin)
  const handleApproveClaimConfirm = async () => {
    if (!actionClaim) return
    setActioningClaim(true)
    try {
      const { data } = await api.patch(`/api/claims/${actionClaim._id}/resolve`, {
        status: 'approved',
        reason: decisionReason.trim()
      })
      if (data.success) {
        toast.success('Ownership claim approved! Handover coordination can now begin.')
        setApproveModalOpen(false)
        setActionClaim(null)
        setDecisionReason('')
        fetchClaims()
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve claim')
    } finally {
      setActioningClaim(false)
    }
  }

  // Reject Claim (Reporter / Admin)
  const handleRejectClaimConfirm = async () => {
    if (!actionClaim) return
    setActioningClaim(true)
    try {
      const { data } = await api.patch(`/api/claims/${actionClaim._id}/resolve`, {
        status: 'rejected',
        reason: decisionReason.trim() || 'Ownership verification criteria not satisfied.'
      })
      if (data.success) {
        toast.success('Claim has been rejected.')
        setRejectModalOpen(false)
        setActionClaim(null)
        setDecisionReason('')
        fetchClaims()
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject claim')
    } finally {
      setActioningClaim(false)
    }
  }

  // Request More Information (Reporter / Admin)
  const handleRequestInfoConfirm = async () => {
    if (!actionClaim || !infoRequestMessage.trim()) {
      toast.error('Please specify what additional information is needed.')
      return
    }
    setActioningClaim(true)
    try {
      const { data } = await api.post(`/api/claims/${actionClaim._id}/request-info`, {
        message: infoRequestMessage.trim()
      })
      if (data.success) {
        toast.success('Information request sent to claimant.')
        setRequestInfoModalOpen(false)
        setActionClaim(null)
        setInfoRequestMessage('')
        fetchClaims()
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send information request')
    } finally {
      setActioningClaim(false)
    }
  }

  // Claimant Responds to Info Request
  const handleRespondToInfoSubmit = async (e) => {
    e.preventDefault()
    const targetClaim = item?.userClaim
    if (!targetClaim || !claimantResponseText.trim()) {
      toast.error('Please write your response details.')
      return
    }
    setSubmittingResponse(true)
    try {
      const { data } = await api.post(`/api/claims/${targetClaim._id}/respond`, {
        response: claimantResponseText.trim()
      })
      if (data.success) {
        toast.success('Additional details submitted for review!')
        setRespondModalOpen(false)
        setClaimantResponseText('')
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit response')
    } finally {
      setSubmittingResponse(false)
    }
  }

  // Confirm Handover (Reporter / Admin)
  const handleConfirmHandoverSubmit = async (e) => {
    e.preventDefault()
    setSubmittingHandover(true)
    try {
      const { data } = await api.post(`/api/items/${id}/handover`, {
        notes: handoverNotes.trim()
      })
      if (data.success) {
        toast.success('Item safely returned! Case updated to Successfully Reunited.')
        setHandoverModalOpen(false)
        setHandoverNotes('')
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record handover')
    } finally {
      setSubmittingHandover(false)
    }
  }

  // Close Case (Reporter / Admin)
  const handleCloseCaseSubmit = async () => {
    setSubmittingStatusChange(true)
    try {
      const { data } = await api.post(`/api/items/${id}/close`)
      if (data.success) {
        toast.success('Case closed and archived.')
        setCloseCaseModalOpen(false)
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close case')
    } finally {
      setSubmittingStatusChange(false)
    }
  }

  // Reopen Case (Reporter / Admin)
  const handleReopenCaseSubmit = async () => {
    setSubmittingStatusChange(true)
    try {
      const { data } = await api.post(`/api/items/${id}/reopen`)
      if (data.success) {
        toast.success('Case reopened and returned to active directory.')
        setReopenCaseModalOpen(false)
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen case')
    } finally {
      setSubmittingStatusChange(false)
    }
  }

  // Edit Case Details (Reporter / Admin)
  const handleEditCaseSubmit = async (e) => {
    e.preventDefault()
    if (!editTitle.trim()) {
      toast.error('Item title is required.')
      return
    }
    setSavingEdit(true)
    try {
      const { data } = await api.patch(`/api/items/${id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        subCategory: editSubCategory.trim(),
        location: editLocation.trim()
      })
      if (data.success) {
        toast.success('Case details updated successfully.')
        setEditModalOpen(false)
        fetchItem()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update case details')
    } finally {
      setSavingEdit(false)
    }
  }

  // Send Chat Message with resilient auto-recovery & explicit error handling
  const handleSendMessage = async (e) => {
    e.preventDefault()
    const textToSend = msgText.trim()
    if (!textToSend || sending) return

    if (!isAuthenticated) {
      toast.error('Please sign in to send messages.')
      navigate('/login')
      return
    }

    setSending(true)

    try {
      let activeConvo = conversation

      // If active conversation is not loaded yet, resolve or create it dynamically
      if (!activeConvo?._id) {
        let recipientId = null
        if (!canManage) {
          // Claimant or citizen -> recipient is the reporter
          const repObj = item.reportedBy || item.reporterId
          recipientId = (typeof repObj === 'object' && repObj?._id) ? repObj._id.toString() : repObj?.toString()
        } else {
          // Reporter -> recipient is selected claimant or first claimant from claims
          recipientId = activeChatRecipientId || claims[0]?.claimant?._id || claims[0]?.claimant
        }

        if (!recipientId) {
          toast.info('No recipient available yet. When a citizen submits a claim or sends an inquiry, you can coordinate return here.')
          setSending(false)
          return
        }

        if (user?._id && user._id.toString() === recipientId.toString()) {
          toast.error('Cannot send a message to yourself.')
          setSending(false)
          return
        }

        const { data: convoData } = await api.post('/api/chat/conversations', {
          itemId: item._id,
          recipientId
        })

        if (convoData.success && convoData.conversation) {
          activeConvo = convoData.conversation
          setConversation(convoData.conversation)
          if (socket) {
            const token = localStorage.getItem('findit_token')
            socket.emit('join_conversation', convoData.conversation._id, token)
          }
        } else {
          throw new Error(convoData.message || 'Could not establish conversation channel')
        }
      }

      // Deliver message to MongoDB via authenticated API
      const { data } = await api.post(`/api/chat/conversations/${activeConvo._id}/messages`, {
        text: textToSend
      })

      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.message._id)) return prev
          return [...prev, data.message]
        })
        setMsgText('') // Only clear input on successful save!
      } else {
        throw new Error(data.message || 'Failed to deliver message')
      }
    } catch (err) {
      console.error('Send message error:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Could not send message. Please try again.'
      toast.error(errorMsg)
      // msgText is preserved so the user's typed message is not lost!
    } finally {
      setSending(false)
    }
  }

  // Typing Broadcast Handler
  const handleMsgInputChange = (e) => {
    setMsgText(e.target.value)
    if (!socket || !conversation) return

    socket.emit('typing', {
      conversationId: conversation._id,
      userName: user?.name || 'Someone',
      isTyping: true
    })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        conversationId: conversation._id,
        userName: user?.name,
        isTyping: false
      })
      socket.emit('stop_typing', { conversationId: conversation._id })
    }, 1500)
  }

  // Start chat with a specific claimant (Reporter action)
  const handleChatWithClaimant = (claimantUser) => {
    if (!claimantUser?._id) return
    setActiveChatRecipientId(claimantUser._id)
    setChatOpen(true)
    initChatForTarget(claimantUser._id)
  }

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 rounded-full border-3 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-body-md font-medium text-primary">Loading case file from HavenFind registry...</p>
        <p className="text-body-sm text-on-surface-variant mt-1">Verifying custody status and secure records</p>
      </div>
    )
  }

  if (!item) return null

  const caseId = (item._id || '').slice(-6).toUpperCase()
  const itemType = (item.type || item.itemType || 'found').toLowerCase()
  const isFound = itemType === 'found'

  const DEFAULT_IMAGE_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' fill='none'%3E%3Crect width='800' height='600' fill='%23F1F5F9'/%3E%3Ccircle cx='400' cy='280' r='50' stroke='%2394A3B8' stroke-width='4'/%3E%3Ctext x='400' y='380' font-family='system-ui, sans-serif' font-size='18' font-weight='500' fill='%2364748B' text-anchor='middle'%3ENo Item Photo Provided%3C/text%3E%3C/svg%3E"
  const allImages = item.images && item.images.length > 0 ? item.images : item.imageUrl ? [item.imageUrl] : [DEFAULT_IMAGE_PLACEHOLDER]
  const activeImage = allImages[activeImageIndex] || allImages[0]
  const reporterData = item.reportedBy || item.reporterId || {}
  const reporterName = reporterData.name || 'Verified Citizen'
  const userClaim = item.userClaim

  // Recovery Progress Milestone calculation
  const isClaimSubmitted = ['Pending Claim', 'Handover Pending', 'Resolved', 'Closed'].includes(item.status) || claims.length > 0 || Boolean(userClaim)
  const isClaimApproved = ['Handover Pending', 'Resolved', 'Closed'].includes(item.status) || claims.some((c) => c.status === 'approved')
  const isHandoverDone = ['Resolved', 'Closed'].includes(item.status)
  const isCaseClosed = item.status === 'Closed'

  const milestones = [
    {
      id: 'reported',
      label: 'Item Reported',
      sublabel: `Logged by ${reporterName}`,
      date: item.createdAt || item.date,
      completed: true,
      current: item.status === 'Active'
    },
    {
      id: 'claim_submitted',
      label: 'Claim Submitted',
      sublabel: claims.length > 0 ? `${claims.length} claim(s) on record` : (userClaim ? 'Your claim logged' : 'Waiting for owner proof'),
      date: item.statusHistory?.find((h) => h.status === 'Pending Claim')?.changedAt || (claims[0]?.createdAt),
      completed: isClaimSubmitted,
      current: item.status === 'Pending Claim'
    },
    {
      id: 'claim_verified',
      label: 'Claim Verified & Approved',
      sublabel: isClaimApproved ? 'Proof verified by reporter' : 'Awaiting reviewer check',
      date: item.statusHistory?.find((h) => h.status === 'Handover Pending')?.changedAt,
      completed: isClaimApproved,
      current: item.status === 'Handover Pending'
    },
    {
      id: 'handover',
      label: 'Item Reunited',
      sublabel: isHandoverDone ? (item.handover?.notes || 'Returned to rightful owner') : 'Handover coordination',
      date: item.handover?.completedAt || item.statusHistory?.find((h) => h.status === 'Resolved')?.changedAt,
      completed: isHandoverDone,
      current: item.status === 'Resolved' && !isCaseClosed
    },
    {
      id: 'closed',
      label: 'Case Concluded',
      sublabel: isCaseClosed ? 'Archived in municipal ledger' : 'Final registry closure',
      date: item.statusHistory?.find((h) => h.status === 'Closed')?.changedAt,
      completed: isCaseClosed,
      current: isCaseClosed
    }
  ]

  // Plain English Recovery Summary derivation
  const getPlainEnglishSummary = () => {
    if (isCaseClosed) {
      return {
        headline: 'Case Successfully Concluded',
        body: `This ${item.title} was recovered, verified, and safely returned to its owner. The case is now closed.`,
        actionNeeded: 'No further action required.',
        actionBy: 'Registry Completed'
      }
    }
    if (isHandoverDone) {
      return {
        headline: 'Item Successfully Reunited!',
        body: `The item has been returned to its verified owner. ${item.handover?.notes ? `Note: "${item.handover.notes}"` : ''}`,
        actionNeeded: canManage ? 'Case can now be officially closed and archived.' : 'No further action needed.',
        actionBy: canManage ? 'Reporter' : 'Complete'
      }
    }
    if (item.status === 'Handover Pending') {
      return {
        headline: 'Ownership Verified – Ready for Handover',
        body: 'The ownership claim was approved. The reporter and owner need to coordinate safe in-person collection.',
        actionNeeded: 'Use the Secure Messenger below to arrange handover at a safe public location.',
        actionBy: isOwner ? 'Both Reporter & Claimant' : 'Both Parties'
      }
    }
    if (item.status === 'Pending Claim') {
      return {
        headline: 'Claim Submitted – Verification Underway',
        body: canManage
          ? `You have ${claims.length || 1} claim(s) awaiting your review. Check the evidence and approve or request more details.`
          : 'Your claim has been submitted. The reporter is reviewing your submitted evidence.',
        actionNeeded: canManage ? 'Review the submitted claim evidence below.' : 'Wait for reporter response.',
        actionBy: canManage ? 'Reporter' : 'Claimant'
      }
    }
    return {
      headline: isFound ? 'Found Property Awaiting Owner' : 'Lost Item Looking for Match',
      body: isFound
        ? 'This item was safely turned in and recorded. If you are the owner, submit a verification claim with proof.'
        : 'This item was reported lost. If you have seen or recovered it, contact the owner or report it found.',
      actionNeeded: isFound ? 'Submit an ownership claim with identifying details.' : 'Report a sighting or match.',
      actionBy: 'Community / Rightful Owner'
    }
  }

  const recoverySummary = getPlainEnglishSummary()

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-6 space-y-8">
      {/* ── TOP BREADCRUMB & CASE REFERENCE BAR ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-body-sm text-on-surface-variant flex-wrap">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to Directory</span>
          </Link>
          <span className="text-outline">/</span>
          <span className="capitalize">{item.category || 'General'}</span>
          <span className="text-outline">/</span>
          <span className="font-semibold text-primary truncate max-w-[220px] sm:max-w-md">{item.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCaseId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant hover:border-primary text-primary text-body-sm font-semibold transition-all shadow-2xs"
            title="Click to copy full Case ID"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">fingerprint</span>
            <span>Case #{caseId}</span>
            <span className="material-symbols-outlined text-[14px] text-outline">content_copy</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAiAssistant}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary text-on-secondary text-body-sm font-semibold hover:bg-on-secondary-container transition-all shadow-2xs"
            title="Ask the AI Assistant about this recovery case"
          >
            <span className="material-symbols-outlined text-[16px]">psychology</span>
            <span>Ask AI</span>
          </button>
        </div>
      </div>

      {/* ── SECTION A: CASE OVERVIEW HERO ─────────────────────────────────── */}
      <section className="bg-surface-container-lowest rounded-3xl border border-outline-variant p-6 sm:p-8 shadow-xs overflow-hidden relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Item Image Gallery (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div
              onClick={() => setInspectModal(true)}
              className="relative aspect-4/3 w-full bg-surface-container rounded-2xl overflow-hidden border border-outline-variant cursor-zoom-in group shadow-xs"
            >
              <img
                src={activeImage}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-label-sm font-bold uppercase shadow-xs ${
                  isFound
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-primary text-on-primary'
                }`}>
                  {isFound ? 'Found Property' : 'Lost Item Report'}
                </span>
              </div>
              <div className="absolute bottom-3 right-3 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-primary text-label-sm font-semibold flex items-center gap-1 border border-outline-variant">
                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                <span>Enlarge</span>
              </div>
            </div>

            {/* Thumbnail angles (if multiple) */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      activeImageIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item Meta & Descriptions (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-6">
            <div>
              {/* Status Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <StatusBadge status={item.status} type={itemType} />
                <span className="text-body-sm text-outline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  <span>Reported {new Date(item.createdAt || item.date).toLocaleDateString()}</span>
                </span>
              </div>

              <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
                {item.title}
              </h1>

              <p className="text-body-md font-body-md text-on-surface-variant mt-3 leading-relaxed whitespace-pre-line">
                {item.description || 'No detailed public notes provided for this property.'}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/60">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary border border-outline-variant/60 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
                <div>
                  <span className="text-label-sm font-semibold text-outline uppercase block">Discovery / Loss Area</span>
                  <p className="text-body-md font-bold text-primary mt-0.5">
                    {formatLocation(item.location, 'Metropolitan Area')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary border border-outline-variant/60 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">category</span>
                </div>
                <div>
                  <span className="text-label-sm font-semibold text-outline uppercase block">Category</span>
                  <p className="text-body-md font-bold text-primary mt-0.5">
                    {item.category || 'General Item'} {item.subCategory ? `• ${item.subCategory}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary border border-outline-variant/60 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </div>
                <div>
                  <span className="text-label-sm font-semibold text-outline uppercase block">Case Coordinator</span>
                  <p className="text-body-md font-bold text-primary mt-0.5 flex items-center gap-1.5">
                    <span>{reporterName}</span>
                    {isOwner && (
                      <span className="px-1.5 py-0.2 bg-secondary/10 text-secondary text-[11px] font-bold rounded">YOU</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary border border-outline-variant/60 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                </div>
                <div>
                  <span className="text-label-sm font-semibold text-outline uppercase block">Custody Protocol</span>
                  <p className="text-body-md font-bold text-primary mt-0.5">
                    In-App Secure Handover
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary border border-outline-variant/60 shrink-0">
                  <span className="material-symbols-outlined text-[20px]">support_agent</span>
                </div>
                <div>
                  <span className="text-label-sm font-semibold text-outline uppercase block">Support &amp; Care</span>
                  <a href="tel:+918092982304" className="text-body-md font-bold text-secondary hover:underline mt-0.5 block">
                    +91 8092982304
                  </a>
                </div>
              </div>
            </div>

            {/* Action Bar (Role & Status Sensitive) */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Claimant: Submit Claim if active & not reporter */}
              {!canManage && !userClaim && item.status !== 'Resolved' && item.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      toast.info('Please sign in to submit your ownership claim.')
                      navigate('/login')
                      return
                    }
                    setClaimModalOpen(true)
                  }}
                  className="px-5 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-body-md transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>This is My Item – Submit Claim</span>
                </button>
              )}

              {/* Chat with Reporter / Claimant */}
              <button
                type="button"
                onClick={() => {
                  setChatOpen((v) => {
                    const next = !v
                    if (next) {
                      setTimeout(() => {
                        document.getElementById('case-messenger')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }
                    return next
                  })
                }}
                className={`px-5 py-3 rounded-xl font-bold text-body-md transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                  chatOpen
                    ? 'bg-surface-container border border-outline-variant text-primary'
                    : canManage
                    ? 'bg-primary hover:bg-primary-container text-on-primary'
                    : 'bg-secondary hover:bg-on-secondary-container text-on-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                <span>{chatOpen ? 'Hide Case Messenger' : (canManage ? 'Open Case Messenger' : 'Contact Reporter')}</span>
              </button>

              {/* Reporter Action: Edit Case Details */}
              {canManage && item.status !== 'Resolved' && item.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="px-4 py-3 rounded-xl border border-outline-variant hover:border-primary text-primary font-semibold text-body-md transition-all bg-surface-container-lowest flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  <span>Edit Case</span>
                </button>
              )}

              {/* Reporter Action: Record Handover & Mark Reunited */}
              {canManage && (item.status === 'Handover Pending' || item.status === 'Active' || item.status === 'Pending Claim') && (
                <button
                  type="button"
                  onClick={() => setHandoverModalOpen(true)}
                  className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-body-md transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[20px]">handshake</span>
                  <span>Confirm Handover / Mark Reunited</span>
                </button>
              )}

              {/* View Recovery Record if Reunited / Closed */}
              {(item.status === 'Resolved' || item.status === 'Closed') && (
                <button
                  type="button"
                  onClick={() => setRecoveryRecordModalOpen(true)}
                  className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-body-md hover:bg-emerald-100 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>View Recovery Record</span>
                </button>
              )}

              {/* Reporter Action: Close Case */}
              {canManage && item.status === 'Resolved' && (
                <button
                  type="button"
                  onClick={() => setCloseCaseModalOpen(true)}
                  className="px-4 py-3 rounded-xl border border-outline-variant hover:border-primary text-primary font-semibold text-body-md transition-all bg-surface-container-lowest flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">archive</span>
                  <span>Close Case</span>
                </button>
              )}

              {/* Reporter Action: Reopen Case */}
              {canManage && (item.status === 'Resolved' || item.status === 'Closed') && (
                <button
                  type="button"
                  onClick={() => setReopenCaseModalOpen(true)}
                  className="px-4 py-3 rounded-xl border border-outline-variant hover:bg-surface-container text-on-surface-variant font-medium text-body-md transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                  <span>Reopen Case</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION D: PLAIN-ENGLISH RECOVERY SUMMARY ─────────────────────── */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-2 bg-secondary" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-label-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>Case Status Summary</span>
            </span>
            <h3 className="text-headline-sm font-bold text-primary">{recoverySummary.headline}</h3>
            <p className="text-body-md text-on-surface-variant leading-relaxed max-w-3xl">
              {recoverySummary.body}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 shrink-0 space-y-1">
            <span className="text-label-sm font-semibold text-outline uppercase block">Next Step</span>
            <p className="text-body-sm font-bold text-primary">{recoverySummary.actionNeeded}</p>
            <p className="text-[12px] text-on-surface-variant">Action required by: <strong className="text-primary">{recoverySummary.actionBy}</strong></p>
          </div>
        </div>
      </section>

      {/* ── SECTION B: RECOVERY PROGRESS TRACKER ──────────────────────────── */}
      <section className="bg-surface-container-lowest rounded-3xl border border-outline-variant p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-headline-md font-headline-md font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[26px]">timeline</span>
              <span>Recovery Progress Tracker</span>
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Real-time milestone progression logged by verified timestamps in the municipal database.
            </p>
          </div>
        </div>

        {/* Timeline Steps Display */}
        <div className="relative pt-4 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            {milestones.map((m, idx) => {
              const isLast = idx === milestones.length - 1
              return (
                <div key={m.id} className="relative flex md:flex-col items-start gap-3 md:gap-2">
                  {/* Step Connector Line (Desktop) */}
                  {!isLast && (
                    <div
                      className={`hidden md:block absolute top-4 left-8 right-0 h-1 z-0 ${
                        m.completed ? 'bg-secondary' : 'bg-outline-variant'
                      }`}
                    />
                  )}

                  {/* Node Circle */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-body-sm shrink-0 transition-all ${
                      m.completed
                        ? 'bg-secondary text-on-secondary shadow-sm'
                        : m.current
                        ? 'bg-primary text-on-primary ring-4 ring-primary/20 animate-pulse'
                        : 'bg-surface-container border border-outline-variant text-outline'
                    }`}
                  >
                    {m.completed ? (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Labels */}
                  <div className="flex-1">
                    <h4 className={`text-body-md font-bold ${m.completed || m.current ? 'text-primary' : 'text-outline'}`}>
                      {m.label}
                    </h4>
                    <p className="text-label-sm text-on-surface-variant mt-0.5">{m.sublabel}</p>
                    {m.date && m.completed && (
                      <p className="text-[11px] font-medium text-secondary mt-1">
                        {new Date(m.date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION C: OWNERSHIP VERIFICATION & CLAIMS ────────────────────── */}
      <section className="bg-surface-container-lowest rounded-3xl border border-outline-variant p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant">
          <div>
            <h2 className="text-headline-md font-headline-md font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[26px]">fact_check</span>
              <span>Ownership Verification &amp; Evidence</span>
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {canManage
                ? 'Review proof submitted by community members claiming this property.'
                : 'Ownership claims are verified against unique identifying marks before return.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-surface-container text-primary font-bold text-label-sm border border-outline-variant">
              {canManage ? `${claims.length} Claim(s) Submitted` : (userClaim ? '1 Active Claim Filed by You' : 'No Claims Filed by You')}
            </span>
          </div>
        </div>

        {/* 1. Claimant View: Own claim status card */}
        {!canManage && userClaim && (
          <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-label-sm font-bold text-outline uppercase block">YOUR SUBMITTED CLAIM</span>
                <h3 className="text-headline-sm font-bold text-primary mt-0.5">
                  Verification Status: <span className="capitalize">{userClaim.status.replace(/_/g, ' ')}</span>
                </h3>
                <p className="text-body-sm text-outline">
                  Submitted on {new Date(userClaim.createdAt).toLocaleString()}
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-label-sm font-bold uppercase ${
                userClaim.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : userClaim.status === 'rejected'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : userClaim.status === 'info_requested'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-sky-100 text-sky-800 border border-sky-300'
              }`}>
                {userClaim.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-body-md text-primary">
              <p className="text-label-sm font-semibold text-outline uppercase mb-1">Your Proof of Ownership:</p>
              <p className="whitespace-pre-line">{userClaim.proofDetails}</p>
            </div>

            {userClaim.proofImage && (
              <div>
                <span className="text-label-sm font-semibold text-outline uppercase block mb-1.5">Submitted Evidence Document:</span>
                <div
                  onClick={() => {
                    setActiveImageIndex(0)
                    setInspectModal(true)
                  }}
                  className="w-32 h-32 rounded-xl overflow-hidden border border-outline-variant cursor-pointer"
                >
                  <img src={userClaim.proofImage} alt="Submitted Proof" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Information Requested Alert & Action */}
            {userClaim.status === 'info_requested' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <span className="material-symbols-outlined text-[20px]">help</span>
                  <span>The Reporter has Requested Additional Information</span>
                </div>
                <p className="text-body-sm">{userClaim.infoRequestedMessage}</p>
                <button
                  type="button"
                  onClick={() => setRespondModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-body-sm transition-all"
                >
                  Provide Requested Details
                </button>
              </div>
            )}

            {/* Rejection notice */}
            {userClaim.status === 'rejected' && userClaim.decisionReason && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                <p className="font-semibold text-body-sm">Reviewer Note: {userClaim.decisionReason}</p>
              </div>
            )}
          </div>
        )}

        {/* 2. Reporter / Admin View: Review all claims */}
        {canManage && (
          <div className="space-y-4">
            {claimsLoading ? (
              <div className="py-8 text-center text-on-surface-variant">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-body-sm">Fetching submitted claim dossiers...</p>
              </div>
            ) : claims.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface-container-low border border-dashed border-outline-variant text-center space-y-2">
                <span className="material-symbols-outlined text-[36px] text-outline block">inventory_2</span>
                <h4 className="text-headline-sm font-bold text-primary">No Ownership Claims Filed Yet</h4>
                <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
                  When a community member identifies this property and submits proof of ownership, their verification claim will appear here for your review.
                </p>
              </div>
            ) : (
              claims.map((cl) => {
                const claimant = cl.claimant || {}
                const isPending = cl.status === 'pending'
                const isApproved = cl.status === 'approved'

                return (
                  <div
                    key={cl._id}
                    className="p-5 sm:p-6 rounded-2xl bg-surface-container-low border border-outline-variant space-y-4 hover:border-primary/50 transition-all shadow-2xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center font-bold text-headline-sm shrink-0">
                          {claimant.name ? claimant.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <h4 className="text-body-md font-bold text-primary">{claimant.name || 'Verified Citizen'}</h4>
                          <p className="text-label-sm text-on-surface-variant">{claimant.email || 'Email Protected'}</p>
                          <p className="text-[11px] text-outline mt-0.5">Submitted {new Date(cl.createdAt).toLocaleString()}</p>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-label-sm font-bold uppercase ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : cl.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : cl.status === 'info_requested'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-sky-100 text-sky-800 border border-sky-300'
                      }`}>
                        {cl.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Proof Statement */}
                    <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-body-md text-primary">
                      <span className="text-label-sm font-semibold text-outline uppercase block mb-1">Claimant Statement &amp; Proof:</span>
                      <p className="whitespace-pre-line">{cl.proofDetails}</p>
                    </div>

                    {/* Proof Document Thumbnail */}
                    {cl.proofImage && (
                      <div>
                        <span className="text-label-sm font-semibold text-outline uppercase block mb-1.5">Attached Document Proof:</span>
                        <a
                          href={cl.proofImage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-24 h-24 rounded-xl overflow-hidden border border-outline-variant hover:ring-2 hover:ring-primary transition-all"
                        >
                          <img src={cl.proofImage} alt="Claimant Proof" className="w-full h-full object-cover" />
                        </a>
                      </div>
                    )}

                    {/* Claimant Response if provided */}
                    {cl.claimantResponse && (
                      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant text-body-sm">
                        <span className="text-label-sm font-semibold text-secondary uppercase block mb-0.5">Claimant Follow-Up Response:</span>
                        <p>{cl.claimantResponse}</p>
                      </div>
                    )}

                    {/* Reviewer Action Buttons */}
                    <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-outline-variant/60">
                      <button
                        type="button"
                        onClick={() => handleChatWithClaimant(claimant)}
                        className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-body-sm flex items-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                        <span>Message Claimant</span>
                      </button>

                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActionClaim(cl)
                              setRequestInfoModalOpen(true)
                            }}
                            className="px-3.5 py-2 rounded-xl border border-outline-variant hover:border-amber-500 text-amber-800 font-semibold text-body-sm flex items-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">help</span>
                            <span>Request Info</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionClaim(cl)
                              setRejectModalOpen(true)
                            }}
                            className="px-3.5 py-2 rounded-xl border border-outline-variant hover:border-rose-500 text-rose-700 font-semibold text-body-sm flex items-center gap-1.5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                            <span>Reject Claim</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionClaim(cl)
                              setApproveModalOpen(true)
                            }}
                            className="px-4 py-2 rounded-xl bg-secondary hover:bg-on-secondary-container text-on-secondary font-bold text-body-sm flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">check</span>
                            <span>Approve Claim</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 3. Confidential Verification Marker (Reporter / Admin Only) */}
        {canManage && item.confidentialVerification && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
            <span className="text-label-sm font-bold text-amber-800 uppercase flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span>Your Confidential Verification Markers (Private to You)</span>
            </span>
            <p className="text-body-sm font-mono bg-white/80 p-2.5 rounded-lg border border-amber-200/60 select-all">
              {item.confidentialVerification}
            </p>
            <p className="text-[11px] text-amber-700">
              Citizens cannot see this. Compare claimants&apos; submitted proof against these secret details.
            </p>
          </div>
        )}
      </section>

      {/* ── SECTION E: REAL-TIME MESSENGER ─────────────────────────────────── */}
      {chatOpen && (() => {
        const counterpart = (() => {
          if (conversation?.participants) {
            const found = conversation.participants.find((p) => (p._id || p)?.toString() !== user?._id?.toString())
            if (found) return found
          }
          if (!canManage) {
            return item?.reportedBy || item?.reporterId || { name: 'Item Reporter' }
          }
          return claims[0]?.claimant || { name: 'Claimant' }
        })()
        const counterpartId = (counterpart?._id || counterpart)?.toString()
        const isCounterpartOnline = Boolean(counterpartId && onlineUsers?.has(counterpartId))
        const counterpartInitial = counterpart.name ? counterpart.name.charAt(0).toUpperCase() : 'C'

        const quickPrompts = canManage
          ? [
              'Hello, thanks for reaching out. What details can you share about the item?',
              'Can you describe any unique markings or serial numbers?',
              'Where would you like to arrange safe public handover?'
            ]
          : [
              'Hello, is this item still available?',
              'Where specifically was this item discovered?',
              'I have proof of purchase and serial numbers for this item.',
              'When would be a good time to meet for safe handover?'
            ]

        const formatMessageDateHeader = (dateStr) => {
          if (!dateStr) return 'Today'
          const d = new Date(dateStr)
          const today = new Date()
          if (d.toDateString() === today.toDateString()) return 'Today'
          const y = new Date()
          y.setDate(y.getDate() - 1)
          if (d.toDateString() === y.toDateString()) return 'Yesterday'
          return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        }

        return (
          <section id="case-messenger" className="bg-surface-container-lowest rounded-3xl border border-outline-variant shadow-lg overflow-hidden animate-in fade-in duration-200">
            {/* Chat Header */}
            <div className="px-6 py-4 bg-primary text-on-primary flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Item thumbnail */}
                <div className="w-12 h-12 rounded-xl bg-surface-container overflow-hidden border border-white/20 shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary bg-surface">
                      <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-body-md font-bold leading-tight truncate max-w-xs sm:max-w-md">
                      {item.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-mono">
                      #{caseId}
                    </span>
                  </div>

                  {/* Counterpart info & online presence */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-label-sm text-surface-container-high">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className={`w-2 h-2 rounded-full ${isCounterpartOnline ? 'bg-secondary animate-pulse' : 'bg-outline-variant'}`} />
                      <span>{counterpart.name || 'Participant'}</span>
                      <span className="text-[11px] opacity-80">({isCounterpartOnline ? 'Active Now' : 'Offline'})</span>
                    </span>
                    {conversation?.claim && (
                      <>
                        <span>&bull;</span>
                        <span className="px-2 py-0.5 rounded-md bg-secondary text-on-secondary text-[10px] font-bold uppercase">
                          Claim: {conversation.claim.status || 'Active'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-xl hover:bg-primary-container text-surface-container-high hover:text-white transition-colors"
                aria-label="Close case messenger"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* If reporter has multiple claimants, allow switching tabs */}
            {canManage && conversationsList.length > 1 && (
              <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant flex gap-2 overflow-x-auto">
                <span className="text-label-sm font-semibold text-outline self-center shrink-0">Claimants:</span>
                {conversationsList.map((convo) => {
                  const other = convo.participants.find((p) => (p._id || p)?.toString() !== user?._id?.toString())
                  const isSelected = conversation?._id === convo._id
                  const hasUnread = (convo.computedUnreadCount || 0) > 0

                  return (
                    <button
                      key={convo._id}
                      type="button"
                      onClick={() => {
                        setConversation(convo)
                        api.get(`/api/chat/conversations/${convo._id}/messages`).then(({ data }) => {
                          if (data.success) setMessages(data.messages || [])
                        })
                      }}
                      className={`px-3 py-1 rounded-lg text-label-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container hover:bg-surface-container-high text-primary'
                      }`}
                    >
                      <span>{other?.name || 'Claimant Thread'}</span>
                      {hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-error" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Messages Feed */}
            <div className="p-6 h-96 overflow-y-auto space-y-3 bg-surface-container-low custom-scrollbar">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-primary mx-auto">
                    <span className="material-symbols-outlined text-[28px] text-outline">chat_bubble_outline</span>
                  </div>
                  <p className="text-body-md font-bold text-primary">No messages in this case channel yet.</p>
                  <p className="text-body-sm text-outline max-w-sm mx-auto">
                    Ask questions, verify lost details, or arrange safe public handover in a verified civic precinct.
                  </p>

                  {/* Quick Prompt Chips */}
                  <div className="flex flex-wrap gap-2 justify-center pt-2 max-w-md mx-auto">
                    {quickPrompts.map((promptText, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setMsgText(promptText)
                          document.getElementById('case-msg-input')?.focus()
                        }}
                        className="px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant hover:border-primary text-primary text-[12px] font-medium transition-all"
                      >
                        &ldquo;{promptText}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMe = (m.sender?._id || m.sender)?.toString() === user?._id?.toString()
                  const currentDateLabel = formatMessageDateHeader(m.createdAt)
                  const prevDateLabel = idx > 0 ? formatMessageDateHeader(messages[idx - 1].createdAt) : null
                  const showDateSeparator = currentDateLabel !== prevDateLabel

                  return (
                    <div key={m._id || idx} className="space-y-2">
                      {showDateSeparator && (
                        <div className="flex items-center my-3">
                          <div className="flex-1 border-t border-outline-variant/60" />
                          <span className="px-3 text-[10px] font-bold text-outline uppercase tracking-wider bg-surface-container-low">
                            {currentDateLabel}
                          </span>
                          <div className="flex-1 border-t border-outline-variant/60" />
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]">
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-primary text-secondary-fixed flex items-center justify-center text-label-sm font-bold shrink-0 mb-1">
                              {m.sender?.name ? m.sender.name.charAt(0).toUpperCase() : counterpartInitial}
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2.5 text-body-sm leading-relaxed ${
                              isMe
                                ? 'bg-primary text-on-primary rounded-br-none shadow-xs'
                                : 'bg-surface-container-lowest text-primary border border-outline-variant rounded-bl-none shadow-xs'
                            }`}
                          >
                            <p className="whitespace-pre-line">{m.text}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-outline mt-1 px-1">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}

              {typingUser && (
                <p className="text-label-sm font-semibold text-secondary animate-pulse">
                  {typingUser} is typing...
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-surface-container-lowest border-t border-outline-variant flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  id="case-msg-input"
                  rows={2}
                  value={msgText}
                  onChange={handleMsgInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                  placeholder="Write a message to coordinate safe return... (Enter to send, Shift+Enter for new line)"
                  className="w-full px-4 py-2.5 text-body-sm bg-surface rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-outline"
                  maxLength={2000}
                />
                {msgText.length > 500 && (
                  <span className="absolute bottom-2 right-2 text-[10px] text-outline font-mono">
                    {msgText.length}/2000
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={sending || !msgText.trim()}
                className="px-5 py-3 bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary rounded-xl font-bold text-body-md flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <span>{sending ? 'Sending...' : 'Send'}</span>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </section>
        )
      })()}

      {/* ── SECTION G: TECHNICAL VERIFICATION DISCLOSURE (COLLAPSIBLE) ────── */}
      <section className="bg-surface-container-low rounded-2xl border border-outline-variant/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setTechDetailsOpen((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-container transition-colors"
        >
          <div className="flex items-center gap-2 text-body-sm font-semibold text-primary">
            <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
            <span>Technical Registry Record Details (Optional)</span>
          </div>
          <span className="material-symbols-outlined text-[20px] text-outline">
            {techDetailsOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {techDetailsOpen && (
          <div className="p-6 border-t border-outline-variant bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-body-sm font-mono">
            <div className="p-3 rounded-lg bg-surface-container-low">
              <span className="text-[11px] text-outline uppercase block">MongoDB ObjectId</span>
              <span className="text-primary font-bold text-xs select-all">{item._id}</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <span className="text-[11px] text-outline uppercase block">CLIP Vector Dimension</span>
              <span className="text-secondary font-bold text-xs">512-D Local Float Embedding</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <span className="text-[11px] text-outline uppercase block">Coordinates Stored</span>
              <span className="text-primary font-bold text-xs">
                {item.location?.coordinates ? `${item.location.coordinates[1]}, ${item.location.coordinates[0]}` : 'General Locality Only'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ── MODALS & CONFIRMATION DIALOGS ──────────────────────────────────── */}

      {/* 1. SUBMIT CLAIM MODAL */}
      {claimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setClaimModalOpen(false)}
          />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-2xl w-full border border-outline-variant shadow-2xl overflow-hidden z-10 max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
                <div>
                  <h3 className="text-headline-sm font-bold text-primary">Submit Ownership Claim</h3>
                  <p className="text-body-sm text-on-surface-variant">Case #{caseId} &bull; {item.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="p-6 space-y-4">
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1.5">
                  Proof of Ownership Statement <span className="text-error">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={proofDetails}
                  onChange={(e) => setProofDetails(e.target.value)}
                  placeholder="Describe unique hidden markings, scratches, contents, purchase receipt info, phone wallpaper, engravings, or any distinctive features..."
                  className="w-full px-4 py-3 text-body-md bg-surface rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1.5">
                  Serial Number or Unique ID (Optional)
                </label>
                <input
                  type="text"
                  value={serialProof}
                  onChange={(e) => setSerialProof(e.target.value)}
                  placeholder="e.g. Serial prefix, IMEI, registration code, engraved name..."
                  className="w-full px-4 py-2.5 text-body-md bg-surface rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1.5">
                  Supporting Photo or Document (Receipt, Box, Photo with Item)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setProofFile(f)
                      setProofPreview(URL.createObjectURL(f))
                    }
                  }}
                  className="w-full text-body-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-body-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-container cursor-pointer"
                />
                {proofPreview && (
                  <div className="mt-3 w-24 h-24 rounded-xl overflow-hidden border border-outline-variant">
                    <img src={proofPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">lock</span>
                <span>
                  Your claim details will be sent privately to the item coordinator. Secret verification markers are strictly protected.
                </span>
              </div>

              <div className="pt-4 border-t border-outline-variant flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClaimModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-bold text-body-sm flex items-center gap-2"
                >
                  {submittingClaim ? 'Submitting Claim...' : 'Submit Verification Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CONFIRM HANDOVER MODAL */}
      {handoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setHandoverModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">handshake</span>
              </div>
              <div>
                <h3 className="text-headline-sm font-bold text-primary">Confirm Item Handover</h3>
                <p className="text-body-sm text-on-surface-variant">Mark case as Successfully Reunited</p>
              </div>
            </div>

            <p className="text-body-md text-on-surface-variant leading-relaxed">
              Are you sure you have completed the safe handover of <strong>{item.title}</strong> to the verified owner?
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1.5">
                Handover Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="e.g. Returned in person to Alice at Main Library lobby on Friday..."
                className="w-full px-4 py-2.5 text-body-md bg-surface rounded-xl border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setHandoverModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingHandover}
                onClick={handleConfirmHandoverSubmit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-body-sm"
              >
                {submittingHandover ? 'Recording...' : 'Confirm Handover & Reunite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIEW RECOVERY RECORD MODAL */}
      {recoveryRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setRecoveryRecordModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
              <div className="flex items-center gap-2.5 text-emerald-800">
                <span className="material-symbols-outlined text-[24px]">verified</span>
                <h3 className="text-headline-sm font-bold">Official Recovery Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecoveryRecordModalOpen(false)}
                className="p-1 text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-emerald-950">
              <p className="font-bold text-body-md">Successfully Reunited &amp; Returned</p>
              <p className="text-body-sm">
                This item was confirmed as successfully returned to its rightful owner.
              </p>
            </div>

            <div className="space-y-2.5 text-body-sm text-primary">
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-outline">Item Case:</span>
                <span className="font-semibold">{item.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-outline">Date Reunited:</span>
                <span className="font-semibold">
                  {new Date(item.handover?.completedAt || item.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-outline-variant/40">
                <span className="text-outline">Recorded Handover Notes:</span>
                <span className="font-semibold">{item.handover?.notes || 'Returned directly to owner'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setRecoveryRecordModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-body-sm"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. APPROVE CLAIM CONFIRMATION MODAL */}
      {approveModalOpen && actionClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setApproveModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[24px]">verified</span>
              <span>Approve Ownership Claim?</span>
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Confirming this will mark the claim by <strong>{actionClaim.claimant?.name}</strong> as verified, and advance the case to <strong>Ready for Handover</strong>.
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Approval Note for Claimant (Optional)
              </label>
              <textarea
                rows={2}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g. Serial number and markings match our records. Let's arrange handover."
                className="w-full px-4 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
              />
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actioningClaim}
                onClick={handleApproveClaimConfirm}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-on-secondary-container text-on-secondary font-bold text-body-sm"
              >
                {actioningClaim ? 'Approving...' : 'Yes, Approve Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. REJECT CLAIM CONFIRMATION MODAL */}
      {rejectModalOpen && actionClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setRejectModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px]">block</span>
              <span>Reject Ownership Claim</span>
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Provide a reason why the claim by <strong>{actionClaim.claimant?.name}</strong> is being rejected.
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="e.g. The provided photo/serial markings do not correspond to this item."
                className="w-full px-4 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
              />
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actioningClaim}
                onClick={handleRejectClaimConfirm}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-body-sm"
              >
                {actioningClaim ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. REQUEST MORE INFO MODAL */}
      {requestInfoModalOpen && actionClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setRequestInfoModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[24px]">help</span>
              <span>Request More Information</span>
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              Ask <strong>{actionClaim.claimant?.name}</strong> to supply specific additional verification details.
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Required Proof Description <span className="text-error">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={infoRequestMessage}
                onChange={(e) => setInfoRequestMessage(e.target.value)}
                placeholder="e.g. Please provide a photo of the original packaging or specify what brand of charm is on the keychain."
                className="w-full px-4 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
              />
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRequestInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actioningClaim || !infoRequestMessage.trim()}
                onClick={handleRequestInfoConfirm}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-body-sm"
              >
                {actioningClaim ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CLAIMANT RESPOND TO INFO MODAL */}
      {respondModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setRespondModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary">Provide Additional Proof</h3>
            <p className="text-body-sm text-on-surface-variant">
              The reporter requested: <em>&quot;{item?.userClaim?.infoRequestedMessage}&quot;</em>
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Your Response <span className="text-error">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={claimantResponseText}
                onChange={(e) => setClaimantResponseText(e.target.value)}
                placeholder="Provide the requested details to verify ownership..."
                className="w-full px-4 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
              />
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRespondModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingResponse || !claimantResponseText.trim()}
                onClick={handleRespondToInfoSubmit}
                className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-body-sm"
              >
                {submittingResponse ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. EDIT CASE MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setEditModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-lg w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary">Edit Case Information</h3>

            <form onSubmit={handleEditCaseSubmit} className="space-y-3">
              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">Subcategory</label>
                <input
                  type="text"
                  value={editSubCategory}
                  onChange={(e) => setEditSubCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">General Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3.5 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
                />
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-body-sm bg-surface rounded-xl border border-outline-variant"
                />
              </div>

              <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-body-sm"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. CLOSE CASE CONFIRMATION MODAL */}
      {closeCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setCloseCaseModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-md w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary">Close Recovery Case?</h3>
            <p className="text-body-md text-on-surface-variant">
              Closing this case archives it in the registry ledger. You can reopen it at any time if needed.
            </p>
            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCloseCaseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingStatusChange}
                onClick={handleCloseCaseSubmit}
                className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-body-sm"
              >
                {submittingStatusChange ? 'Closing...' : 'Confirm Close Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. REOPEN CASE CONFIRMATION MODAL */}
      {reopenCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setReopenCaseModalOpen(false)} />
          <div className="relative bg-surface-container-lowest rounded-3xl max-w-md w-full border border-outline-variant shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-headline-sm font-bold text-primary">Reopen Case?</h3>
            <p className="text-body-md text-on-surface-variant">
              Reopening will restore this item to <strong>Active</strong> in the public lost &amp; found directory.
            </p>
            <div className="pt-3 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReopenCaseModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingStatusChange}
                onClick={handleReopenCaseSubmit}
                className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-body-sm"
              >
                {submittingStatusChange ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. INSPECT IMAGE MODAL */}
      {inspectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setInspectModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant p-2">
            <img src={activeImage} alt={item.title} className="w-full h-full max-h-[85vh] object-contain rounded-xl" />
            <button
              type="button"
              onClick={() => setInspectModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-primary/80 text-white hover:bg-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
