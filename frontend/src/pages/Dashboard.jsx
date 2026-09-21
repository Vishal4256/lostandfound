import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Mail,
  Tag,
  CheckCircle,
  Clock,
  MessageCircle,
  Package,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('reports') // 'reports' | 'claims' | 'chats'
  const [reports, setReports] = useState([])
  const [claims, setClaims] = useState([])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, claimsRes, convosRes] = await Promise.allSettled([
        api.get('/api/items/my-items'),
        api.get('/api/claims/my-claims'),
        api.get('/api/chat/conversations')
      ])

      if (reportsRes.status === 'fulfilled' && reportsRes.value.data.success) {
        setReports(reportsRes.value.data.data || [])
      }

      if (claimsRes.status === 'fulfilled' && claimsRes.value.data.success) {
        setClaims(claimsRes.value.data.claims || [])
      }

      if (convosRes.status === 'fulfilled' && convosRes.value.data.success) {
        setConversations(convosRes.value.data.conversations || [])
      }
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Toggle status of a reported item
  const handleToggleStatus = async (itemId, currentStatus) => {
    const nextStatus = currentStatus === 'Resolved' ? 'Active' : 'Resolved'
    try {
      const { data } = await api.patch(`/api/items/${itemId}/status`, { status: nextStatus })
      if (data.success) {
        setReports(prev => prev.map(r => r._id === itemId ? { ...r, status: nextStatus } : r))
        toast.success(`Marked as ${nextStatus}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const lostCount = reports.filter(r => (r.type || r.itemType) === 'lost').length
  const foundCount = reports.filter(r => (r.type || r.itemType) === 'found').length
  const resolvedCount = reports.filter(r => r.status === 'Resolved').length

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div style={{ padding: '36px 0 80px', maxWidth: 960, margin: '0 auto' }}>
      {/* User Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          background: 'rgba(18, 18, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          padding: '28px 32px',
          marginBottom: 28,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #6366f1, #ec4899, #f97316)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: 24,
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)'
          }}>
            {userInitial}
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {user?.name || 'Community Member'}
            </h1>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> {user?.email}
            </p>
            <span style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#818cf8',
              background: 'rgba(99, 102, 241, 0.15)',
              padding: '2px 8px',
              borderRadius: 6
            }}>
              {user?.role === 'admin' ? 'Administrator' : 'Verified Member'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fafafa',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <Link
            to="/submit-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              border: 'none',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)'
            }}
          >
            <Plus size={16} /> Report Item
          </Link>
        </div>
      </motion.div>

      {/* Stats Counter Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 14,
        marginBottom: 28
      }}>
        {[
          { label: 'My Reports', value: reports.length, color: '#818cf8', icon: Package },
          { label: 'Lost Items', value: lostCount, color: '#f87171', icon: Tag },
          { label: 'Found Items', value: foundCount, color: '#34d399', icon: CheckCircle },
          { label: 'My Claims', value: claims.length, color: '#fbbf24', icon: ShieldCheck },
          { label: 'Resolved', value: resolvedCount, color: '#c084fc', icon: Clock }
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(18, 18, 22, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 16,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `${s.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: s.color
            }}>
              <s.icon size={20} />
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fafafa', margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 6,
        background: '#0e0e11',
        padding: 5,
        borderRadius: 14,
        border: '1px solid #27272a',
        marginBottom: 24
      }}>
        {[
          { id: 'reports', label: `My Reported Items (${reports.length})`, icon: Package },
          { id: 'claims', label: `My Submitted Claims (${claims.length})`, icon: ShieldCheck },
          { id: 'chats', label: `Direct Chats (${conversations.length})`, icon: MessageCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 0',
              borderRadius: 10,
              border: 'none',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#a1a1aa',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#71717a' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', color: '#818cf8' }} />
          <p style={{ fontSize: 14 }}>Loading your dashboard activity...</p>
        </div>
      ) : activeTab === 'reports' ? (
        /* TAB 1: MY REPORTED ITEMS */
        reports.length === 0 ? (
          <div style={{
            background: 'rgba(18, 18, 22, 0.6)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: 48,
            textAlign: 'center'
          }}>
            <Package size={40} color="#71717a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 6 }}>No Reported Items Yet</h3>
            <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>
              You haven't submitted any lost or found item reports.
            </p>
            <Link
              to="/submit-item"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 12,
                background: '#6366f1',
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none'
              }}
            >
              <Plus size={16} /> Report an Item Now
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reports.map((item) => {
              const isLost = (item.type || item.itemType) === 'lost'
              const isResolved = item.status === 'Resolved'

              return (
                <div
                  key={item._id}
                  style={{
                    background: 'rgba(18, 18, 22, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      style={{ width: 68, height: 68, borderRadius: 12, objectFit: 'cover', border: '1px solid #27272a' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isLost ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: isLost ? '#f87171' : '#34d399'
                        }}>
                          {isLost ? 'Lost' : 'Found'}
                        </span>
                        <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>
                          {item.category}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: '0 0 4px' }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
                        Reported on {new Date(item.date || item.createdAt).toLocaleDateString()} • {item.location?.addressText || 'Location recorded'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handleToggleStatus(item._id, item.status)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: isResolved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: isResolved ? '#34d399' : '#e4e4e7',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isResolved ? 'Status: Resolved' : 'Mark Resolved'}
                    </button>
                    <Link
                      to={`/item/${item._id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      <span>Manage Claims</span>
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : activeTab === 'claims' ? (
        /* TAB 2: MY SUBMITTED CLAIMS */
        claims.length === 0 ? (
          <div style={{
            background: 'rgba(18, 18, 22, 0.6)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: 48,
            textAlign: 'center'
          }}>
            <ShieldCheck size={40} color="#71717a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 6 }}>No Submitted Claims</h3>
            <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>
              You haven't submitted any ownership claims for community listings.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 12,
                background: '#6366f1',
                color: 'white',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none'
              }}
            >
              Browse Public Feed
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {claims.map((claim) => {
              const statusTag = claim.status === 'approved'
                ? { label: 'Approved', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' }
                : claim.status === 'rejected'
                ? { label: 'Rejected', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' }
                : { label: 'Pending Review', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' }

              return (
                <div
                  key={claim._id}
                  style={{
                    background: 'rgba(18, 18, 22, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {claim.item?.imageUrl && (
                        <img
                          src={claim.item.imageUrl}
                          alt={claim.item?.title || 'Item'}
                          style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }}
                        />
                      )}
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', margin: '0 0 2px' }}>
                          {claim.item?.title || 'Claimed Listing'}
                        </h4>
                        <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
                          Submitted on {new Date(claim.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 999,
                        background: statusTag.bg,
                        color: statusTag.text,
                        border: `1px solid ${statusTag.border}`
                      }}>
                        {statusTag.label}
                      </span>

                      {claim.item?._id && (
                        <Link
                          to={`/item/${claim.item._id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: '#818cf8',
                            fontSize: 13,
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <span>View Item</span>
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div style={{ background: '#0e0e11', padding: '12px 14px', borderRadius: 12, border: '1px solid #27272a' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', marginBottom: 4 }}>
                      Your Submitted Proof:
                    </p>
                    <p style={{ fontSize: 13, color: '#e4e4e7', margin: 0, lineHeight: 1.5 }}>
                      {claim.proofDetails}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* TAB 3: DIRECT CHATS */
        conversations.length === 0 ? (
          <div style={{
            background: 'rgba(18, 18, 22, 0.6)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: 48,
            textAlign: 'center'
          }}>
            <MessageCircle size={40} color="#71717a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 6 }}>No Active Conversations</h3>
            <p style={{ color: '#71717a', fontSize: 14 }}>
              Initiate a chat directly from any item detail page.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conversations.map((c) => {
              const other = c.participants?.find(p => p._id !== user?._id)
              return (
                <Link
                  key={c._id}
                  to={`/item/${c.item?._id || c.item}`}
                  style={{
                    background: 'rgba(18, 18, 22, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: '#27272a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#fafafa'
                    }}>
                      {other?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', margin: '0 0 2px' }}>
                        {other?.name || 'Community Member'}
                      </h4>
                      <p style={{ fontSize: 12, color: '#818cf8', margin: 0 }}>
                        Regarding: {c.item?.title || 'Reported Item'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 13 }}>
                    <span>Open Chat</span>
                    <ChevronRight size={16} />
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
