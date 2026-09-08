import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Mail,
  Activity,
  Tag,
  CheckCircle,
  Clock,
  MessageCircle,
  Package,
  ArrowRight,
  ExternalLink,
  Plus,
  RefreshCw
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('reports') // 'reports' | 'chats'
  const [reports, setReports] = useState([])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [reportsRes, convosRes] = await Promise.allSettled([
        axios.get('/api/items?mine=true'),
        axios.get('/api/chat/conversations')
      ])

      if (reportsRes.status === 'fulfilled' && reportsRes.value.data.success) {
        setReports(reportsRes.value.data.data || [])
      }

      if (convosRes.status === 'fulfilled' && convosRes.value.data.success) {
        setConversations(convosRes.value.data.conversations || [])
      }
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Toggle status of a reported item
  const handleToggleStatus = async (itemId, currentStatus) => {
    const nextStatus = currentStatus === 'Resolved' ? 'Active' : 'Resolved'
    try {
      const { data } = await axios.patch(`/api/items/${itemId}/status`, { status: nextStatus })
      if (data.success) {
        setReports(prev => prev.map(r => r._id === itemId ? { ...r, status: nextStatus } : r))
        toast.success(`Marked as ${nextStatus}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const lostCount = reports.filter(r => r.type === 'lost').length
  const foundCount = reports.filter(r => r.type === 'found').length
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length

  const stats = [
    { icon: Activity, label: 'Reports', value: reports.length, color: 'var(--accent)' },
    { icon: Tag, label: 'Lost', value: lostCount, color: '#EF4444' },
    { icon: CheckCircle, label: 'Found', value: foundCount, color: '#10B981' },
    { icon: Clock, label: 'Resolved', value: resolvedCount, color: '#8B5CF6' },
    { icon: MessageCircle, label: 'Chats', value: conversations.length, color: '#38BDF8' },
  ]

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div style={{ padding: '40px 0 80px', maxWidth: 920, margin: '0 auto' }}>
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 24,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 24, padding: '28px 32px', marginBottom: 28,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F97316, #EF4444, #8B5CF6)' }} />

        <div style={{
          width: 74, height: 74, borderRadius: 20,
          background: 'var(--accent)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 30, fontWeight: 800, color: 'white',
          fontFamily: "'Bricolage Grotesque', sans-serif", flexShrink: 0,
          boxShadow: '0 8px 25px rgba(249,115,22,0.35)'
        }}>
          {userInitial}
        </div>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>
            {user?.name || 'Community Member'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13 }}>
            <Mail size={14} /> <span>{user?.email || 'No email attached'}</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/add-item')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 12,
            background: 'var(--accent)', color: 'white', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 15px rgba(249,115,22,0.3)'
          }}
        >
          <Plus size={16} /> Report Item
        </button>
      </motion.div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }} className="profile-stats-grid">
        {stats.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: activeTab === 'reports' ? 'var(--accent-dim)' : 'transparent',
            color: activeTab === 'reports' ? 'var(--accent)' : 'var(--text-3)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
          }}
        >
          <Package size={16} /> My Reports ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: activeTab === 'chats' ? 'var(--accent-dim)' : 'transparent',
            color: activeTab === 'chats' ? 'var(--accent)' : 'var(--text-3)',
            fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
          }}
        >
          <MessageCircle size={16} /> Active Conversations ({conversations.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : activeTab === 'reports' ? (
        /* Reports Tab */
        reports.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <Package size={40} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No Reports Yet</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 360, margin: '0 auto 20px' }}>
              Have you lost something valuable or found someone else's item? Report it now to connect with your community.
            </p>
            <Link to="/add-item" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: 'var(--accent)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
              <Plus size={15} /> Submit First Report
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((item, i) => {
              const isLost = item.type === 'lost'
              const isResolved = item.status === 'Resolved'
              return (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 16, padding: '14px 18px'
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{ width: 68, height: 68, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        color: isLost ? '#EF4444' : '#10B981', background: isLost ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'
                      }}>
                        {item.type}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        color: isResolved ? '#10B981' : 'var(--accent)', background: isResolved ? 'rgba(16,185,129,0.1)' : 'var(--accent-dim)'
                      }}>
                        {item.status || 'Active'}
                      </span>
                    </div>

                    <Link to={`/item/${item._id}`} style={{ textDecoration: 'none' }}>
                      <h4 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </h4>
                    </Link>
                    <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                      {item.category} • {new Date(item.date || item.createdAt).toLocaleDateString()} • {item.location?.addressText || item.location || 'Unknown'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handleToggleStatus(item._id, item.status)}
                      style={{
                        padding: '7px 12px', borderRadius: 8,
                        background: isResolved ? 'var(--bg-surface)' : 'rgba(16,185,129,0.15)',
                        border: `1px solid ${isResolved ? 'var(--border)' : '#10B981'}`,
                        color: isResolved ? 'var(--text-2)' : '#10B981',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      {isResolved ? 'Re-open' : 'Mark Resolved'}
                    </button>
                    <Link
                      to={`/item/${item._id}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 34, height: 34, borderRadius: 8, background: 'var(--bg-surface)',
                        border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none'
                      }}
                    >
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )
      ) : (
        /* Chats Tab */
        conversations.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 48, textAlign: 'center' }}>
            <MessageCircle size={40} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No Active Chats</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 360, margin: '0 auto 20px' }}>
              When you or someone else sends a message about a lost or found item, the conversation thread will show here.
            </p>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: 'var(--accent)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
              Browse Listings
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conversations.map((c, i) => {
              const other = c.participants?.find(p => p._id !== user?._id)
              const itemInfo = c.item
              return (
                <motion.div
                  key={c._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 16, padding: '16px 20px'
                  }}
                >
                  {itemInfo?.imageUrl ? (
                    <img
                      src={itemInfo.imageUrl}
                      alt={itemInfo.title}
                      style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={22} color="var(--text-3)" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>
                        {other?.name || 'Community Member'}
                      </p>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        regarding <strong style={{ color: 'var(--text-2)' }}>{itemInfo?.title || 'Reported Item'}</strong>
                      </span>
                    </div>

                    <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage || 'Conversation started'}
                    </p>
                    <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 3 }}>
                      {new Date(c.lastMessageAt || c.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <Link
                    to={`/item/${itemInfo?._id || ''}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 10,
                      background: 'var(--accent)', color: 'white',
                      textDecoration: 'none', fontSize: 12, fontWeight: 700
                    }}
                  >
                    Open Chat <ArrowRight size={13} />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )
      )}

      <style>{`
        @media (max-width: 640px) {
          .profile-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
