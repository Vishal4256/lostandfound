import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

/**
 * Formats basic Markdown styling (bold, bullets, code) safely
 */
function FormattedMessage({ content }) {
  if (!content) return null

  const lines = content.split('\n')
  return (
    <div className="space-y-1.5 text-body-sm leading-relaxed text-on-surface">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.substring(2)
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-secondary text-[12px] mt-1">•</span>
              <span>{renderInlineFormatting(bulletText)}</span>
            </div>
          )
        }

        // Standard paragraph
        return <p key={idx}>{renderInlineFormatting(trimmed)}</p>
      })}
    </div>
  )
}

function renderInlineFormatting(text) {
  // Simple regex parser for **bold** and `code`
  const parts = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/)
    const codeMatch = remaining.match(/`(.*?)`/)

    if (!boldMatch && !codeMatch) {
      parts.push(<span key={keyIdx++}>{remaining}</span>)
      break
    }

    const firstIndex = Math.min(
      boldMatch ? boldMatch.index : Infinity,
      codeMatch ? codeMatch.index : Infinity
    )

    if (firstIndex > 0) {
      parts.push(<span key={keyIdx++}>{remaining.substring(0, firstIndex)}</span>)
      remaining = remaining.substring(firstIndex)
      continue
    }

    if (boldMatch && boldMatch.index === 0) {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-primary">
          {boldMatch[1]}
        </strong>
      )
      remaining = remaining.substring(boldMatch[0].length)
    } else if (codeMatch && codeMatch.index === 0) {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[11px] text-secondary">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.substring(codeMatch[0].length)
    }
  }

  return parts
}

export default function AiRecoveryAssistant({ isOpen: controlledIsOpen, onToggle: controlledOnToggle }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = typeof controlledIsOpen === 'boolean'
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  const setIsOpen = useCallback((nextState) => {
    if (isControlled && controlledOnToggle) {
      controlledOnToggle(nextState)
    } else {
      setInternalIsOpen(nextState)
    }
  }, [isControlled, controlledOnToggle])

  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const idCounterRef = useRef(1)

  const [inputQuery, setInputQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I am your **HavenFind AI Recovery Assistant**.\n\nDescribe any lost or found property (color, model, unique features, or location) and I will retrieve matching reports from our verified civic database using **Multimodal Vector RAG**.',
      matches: [],
      timestamp: 'Just now'
    }
  ])

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, isOpen])

  // Support global custom event to open assistant from any page/button
  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    window.addEventListener('open-rag-assistant', handleOpen)
    return () => window.removeEventListener('open-rag-assistant', handleOpen)
  }, [setIsOpen])

  const quickPrompts = [
    'I lost my black leather wallet in Phagwara',
    'Has anyone found car keys on a lanyard?',
    'Lost black iPhone with clear case',
    'Found a blue backpack in the library'
  ]

  const handleSend = async (queryToSend) => {
    const query = (queryToSend || inputQuery).trim()
    if (!query || loading) return

    if (!isAuthenticated) {
      toast.info('Authentication Required', {
        description: 'Please sign in to your HavenFind account to use the AI Recovery Assistant.'
      })
      navigate('/login')
      return
    }

    const userMessage = {
      id: `usr-${idCounterRef.current++}`,
      role: 'user',
      text: query,
      matches: [],
      timestamp: 'Sent'
    }

    setMessages((prev) => [...prev, userMessage])
    setInputQuery('')
    setLoading(true)

    try {
      // Build lightweight conversation history for follow-ups
      const conversationHistory = messages.slice(-4).map((m) => ({
        role: m.role,
        text: m.text
      }))

      const response = await api.post('/api/ai/recovery', {
        query,
        conversationHistory
      })

      if (response.data?.success) {
        const assistantMessage = {
          id: `ast-${idCounterRef.current++}`,
          role: 'assistant',
          text: response.data.answer,
          matches: response.data.matches || [],
          timestamp: 'Just now'
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error(response.data?.message || 'Failed to process inquiry')
      }
    } catch (err) {
      console.error('RAG Query Error:', err)
      const errorMsg = err.response?.data?.message || err.message || 'AI Recovery Assistant is currently unreachable.'
      toast.error('Recovery Query Failed', { description: errorMsg })

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${idCounterRef.current++}`,
          role: 'assistant',
          text: `⚠️ **Notice:** ${errorMsg}\n\nYou can also browse the civic directory directly using the Search bar.`,
          matches: [],
          timestamp: 'Just now'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${idCounterRef.current++}`,
        role: 'assistant',
        text: 'Conversation reset. Describe any lost or found property to search the verified HavenFind civic registry.',
        matches: [],
        timestamp: 'Just now'
      }
    ])
  }

  return (
    <>
      {/* Floating Action Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center">
        <motion.button
          id="rag-assistant-launcher-btn"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative group flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-2xl hover:border-secondary hover:shadow-secondary/20 transition-all cursor-pointer backdrop-blur-xl"
          aria-label="Open HavenFind AI Recovery Assistant"
        >
          {/* Subtle pulsating glow indicator */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary" />
          </span>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">psychology</span>
            <div className="text-left hidden sm:block">
              <p className="text-label-md font-bold text-on-surface leading-tight">AI Recovery</p>
              <p className="text-[10px] font-mono text-outline uppercase tracking-wider">Grounded RAG</p>
            </div>
          </div>

          <span className="px-1.5 py-0.5 rounded-md bg-secondary/10 text-secondary text-[11px] font-semibold">
            Ask AI
          </span>
        </motion.button>
      </div>

      {/* Slide-over / Modal Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[94vw] sm:w-[460px] h-[640px] max-h-[82vh] bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-fixed-variant">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                </div>
                <div>
                  <h3 className="text-title-sm font-bold text-on-surface flex items-center gap-1.5">
                    HavenFind Recovery AI
                    <span className="px-1.5 py-0.2 rounded bg-secondary/15 text-secondary text-[10px] font-mono uppercase tracking-wide">
                      RAG Active
                    </span>
                  </h3>
                  <p className="text-[11px] text-on-surface-variant font-mono">
                    Grounded with MongoDB Atlas Vector Registry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  title="Clear conversation"
                  aria-label="Clear conversation"
                >
                  <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                  title="Close Assistant"
                  aria-label="Close Assistant"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-primary text-on-primary rounded-tr-xs max-w-[85%] shadow-sm'
                        : 'bg-surface-container-low border border-outline-variant/80 rounded-tl-xs max-w-[96%] shadow-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-body-sm leading-relaxed">{msg.text}</p>
                    ) : (
                      <FormattedMessage content={msg.text} />
                    )}
                  </div>

                  {/* Retrieved Real Item Cards */}
                  {msg.matches && msg.matches.length > 0 && (
                    <div className="w-full mt-3 space-y-2 pl-1 pr-1">
                      <p className="text-[11px] font-mono text-outline uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-secondary">verified</span>
                        Grounded Registry Matches ({msg.matches.length}):
                      </p>

                      <div className="grid grid-cols-1 gap-2">
                        {msg.matches.map((item) => (
                          <div
                            key={item.itemId}
                            className="p-2.5 rounded-xl bg-surface-container border border-outline-variant/60 hover:border-secondary/40 transition-all flex items-start gap-3 group"
                          >
                            {/* Thumbnail */}
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-14 h-14 rounded-lg object-cover bg-surface-container-high shrink-0 border border-outline-variant/50"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center text-outline shrink-0">
                                <span className="material-symbols-outlined text-[20px]">image</span>
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <h4 className="text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                                  {item.title}
                                </h4>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                                    (item.type || '').toLowerCase() === 'found'
                                      ? 'bg-secondary/15 text-secondary'
                                      : 'bg-amber-500/15 text-amber-600'
                                  }`}
                                >
                                  {item.type}
                                </span>
                              </div>

                              <p className="text-[12px] text-on-surface-variant flex items-center gap-1 truncate mb-1">
                                <span className="material-symbols-outlined text-[13px] text-outline">place</span>
                                {item.location}
                              </p>

                              <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-outline-variant/30">
                                <span className="text-[11px] font-mono text-secondary font-semibold">
                                  {Math.round((item.score || 0.8) * 100)}% Match
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsOpen(false)
                                    navigate(`/item/${item.itemId}`)
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <span>View Report</span>
                                  <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-outline mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-start gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/80 rounded-tl-xs flex items-center gap-2.5 text-body-sm text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-secondary text-[18px]">
                      progress_activity
                    </span>
                    <span className="text-[12px]">Scanning registry vectors & grounding response...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips (when user is at prompt) */}
            {messages.length <= 3 && !loading && (
              <div className="px-4 py-2 border-t border-outline-variant/40 bg-surface-container-lowest flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant text-[11px] border border-outline-variant/60 transition-colors cursor-pointer shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Footer / Input Bar */}
            <div className="p-3 bg-surface-container-low border-t border-outline-variant">
              {!isAuthenticated ? (
                <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-surface-container border border-outline-variant/60">
                  <p className="text-[12px] text-on-surface-variant pl-1">
                    Sign in to consult the AI Recovery Assistant.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      navigate('/login')
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold shrink-0 cursor-pointer hover:bg-primary-container transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    id="rag-query-input"
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Describe lost or found item..."
                    disabled={loading}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface placeholder:text-outline text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary/30 transition-all outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputQuery.trim()}
                    className="p-2.5 rounded-xl bg-secondary text-on-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary-fixed transition-all cursor-pointer shrink-0 flex items-center justify-center"
                    aria-label="Send inquiry"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
