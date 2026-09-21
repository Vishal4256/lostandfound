import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search,
  Plus,
  Package,
  MapPin,
  Calendar,
  Sparkles,
  Camera,
  X,
  ChevronRight
} from 'lucide-react'
import api from '../services/api'
import MatchResultsGrid from '../components/MatchResultsGrid'
import VisualSearchModal from '../components/VisualSearchModal'

const CATEGORIES = [
  'All',
  'Electronics',
  'Wallets',
  'IDs',
  'Keys',
  'Books',
  'Clothing',
  'Documents',
  'Pets',
  'Jewellery',
  'Accessories',
  'Other'
]

export default function Home() {
  const [searchModal, setSearchModal] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [type, setType] = useState('all') // 'all' | 'lost' | 'found'
  const [status, setStatus] = useState('all') // 'all' | 'Active' | 'Resolved'
  const [searchQuery, setSearchQuery] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (type !== 'all') params.type = type
      if (category !== 'All') params.category = category
      if (status !== 'all') params.status = status
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const { data } = await api.get('/api/items', { params })
      if (data.success && Array.isArray(data.data)) {
        setListings(data.data)
      }
    } catch (err) {
      console.error('Error loading items:', err)
    } finally {
      setLoading(false)
    }
  }, [type, category, status, searchQuery])

  useEffect(() => {
    // Debounce search query slightly
    const timer = setTimeout(() => {
      fetchItems()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchItems])

  const clearVisualSearch = () => {
    setSearchResults(null)
  }

  const lostCount = listings.filter(i => (i.type || i.itemType) === 'lost').length
  const foundCount = listings.filter(i => (i.type || i.itemType) === 'found').length

  const getStatusBadge = (itemStatus) => {
    const s = (itemStatus || 'Active').toLowerCase()
    if (s === 'resolved') {
      return { label: 'Resolved', bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' }
    }
    if (s.includes('pending')) {
      return { label: 'Pending Claim', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' }
    }
    return { label: 'Active', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' }
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Visual Search Modal */}
      <VisualSearchModal
        isOpen={searchModal}
        onClose={() => setSearchModal(false)}
        onSearchResults={(results) => {
          setSearchResults(results)
          setSearchModal(false)
        }}
        onResults={(results) => {
          setSearchResults(results)
          setSearchModal(false)
        }}
      />

      {/* Hero Section */}
      <div style={{ padding: '56px 0 44px', maxWidth: 760 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: 20
          }}
        >
          <Sparkles size={14} color="#818cf8" />
          <span style={{ color: '#818cf8', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
            AI-POWERED LOCAL CLIP SEARCH
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          style={{
            fontSize: 'clamp(36px, 5.5vw, 64px)',
            fontWeight: 800,
            lineHeight: 1.08,
            marginBottom: 18,
            color: '#fafafa',
            letterSpacing: '-0.04em'
          }}
        >
          Reuniting people<br />
          with their <span style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>belongings.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ color: '#a1a1aa', fontSize: 17, lineHeight: 1.6, marginBottom: 30, maxWidth: 540 }}
        >
          Browse real-time lost and found listings in your community. Take or upload a photo to instantly find visual vector matches.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
        >
          <button
            onClick={() => setSearchModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              border: 'none',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Camera size={18} />
            <span>Search by Photo</span>
          </button>

          <Link
            to="/submit-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#fafafa',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: 'none',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'
            }}
          >
            <Plus size={18} />
            <span>Report an Item</span>
          </Link>
        </motion.div>
      </div>

      {/* Visual Search Results Banner */}
      {searchResults && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={18} color="#818cf8" />
            <span style={{ color: '#fafafa', fontWeight: 600, fontSize: 14 }}>
              Showing {searchResults.length} AI Visual Vector Matches
            </span>
          </div>
          <button
            onClick={clearVisualSearch}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#fafafa',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <X size={14} /> Clear Photo Search
          </button>
        </motion.div>
      )}

      {/* Search & Filter Controls */}
      <div style={{
        background: 'rgba(18, 18, 22, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        padding: '20px 24px',
        marginBottom: 32
      }}>
        {/* Top Row: Keyword Search, Type Tabs, Status Filter */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
          {/* Keyword Input */}
          <div style={{ flex: '1 1 280px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={17} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by keywords, markings, location..."
              style={{
                width: '100%',
                background: '#0e0e11',
                border: '1px solid #27272a',
                borderRadius: 12,
                padding: '10px 14px 10px 42px',
                color: '#fafafa',
                fontSize: 14,
                outline: 'none'
              }}
            />
          </div>

          {/* Type Selector (All, Lost, Found) */}
          <div style={{ display: 'flex', background: '#0e0e11', padding: 4, borderRadius: 12, border: '1px solid #27272a' }}>
            {[
              { id: 'all', label: 'All Reports' },
              { id: 'lost', label: `Lost (${lostCount})` },
              { id: 'found', label: `Found (${foundCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setType(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: type === tab.id ? '#27272a' : 'transparent',
                  color: type === tab.id ? '#fafafa' : '#71717a',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                background: '#0e0e11',
                border: '1px solid #27272a',
                borderRadius: 12,
                color: '#fafafa',
                fontSize: 13,
                fontWeight: 600,
                padding: '9px 14px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Category Pill Buttons */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => {
            const isActive = category === cat
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${isActive ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                  background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#a5b4fc' : '#a1a1aa',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid of Results */}
      {searchResults ? (
        <MatchResultsGrid results={searchResults} />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 16
          }} />
          <p style={{ color: '#71717a', fontSize: 14 }}>Loading listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div style={{
          background: 'rgba(18, 18, 22, 0.6)',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          borderRadius: 20,
          padding: '48px 24px',
          textAlign: 'center'
        }}>
          <Package size={36} color="#71717a" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 6 }}>No Listings Found</h3>
          <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>
            No items matched your current filter criteria.
          </p>
          <button
            onClick={() => { setCategory('All'); setType('all'); setStatus('all'); setSearchQuery('') }}
            style={{
              padding: '8px 18px',
              borderRadius: 10,
              background: '#27272a',
              border: 'none',
              color: '#fafafa',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24
        }}>
          {listings.map(item => {
            const itemType = (item.type || item.itemType || 'lost').toLowerCase()
            const badge = getStatusBadge(item.status)
            const isLost = itemType === 'lost'

            return (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(18, 18, 22, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {/* Image Container */}
                <div style={{ position: 'relative', width: '100%', height: 190, background: '#09090b', overflow: 'hidden' }}>
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  {/* Type Tag */}
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    background: isLost ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                    backdropFilter: 'blur(8px)',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: 999,
                    letterSpacing: '0.04em'
                  }}>
                    {isLost ? 'Lost' : 'Found'}
                  </div>

                  {/* Status Badge */}
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: badge.bg,
                    backdropFilter: 'blur(8px)',
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999
                  }}>
                    {badge.label}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Category */}
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {item.category}
                  </span>

                  {/* Title */}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', marginBottom: 8, lineHeight: 1.3 }}>
                    {item.title}
                  </h3>

                  {/* Description snippet */}
                  <p style={{
                    fontSize: 13,
                    color: '#a1a1aa',
                    lineHeight: 1.5,
                    marginBottom: 14,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {item.description || 'No additional description provided.'}
                  </p>

                  {/* Location & Date */}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 12 }}>
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.location?.addressText || 'Location recorded'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 12 }}>
                        <Calendar size={13} />
                        <span>{new Date(item.date || item.createdAt).toLocaleDateString()}</span>
                      </div>

                      <Link
                        to={`/item/${item._id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: '#818cf8',
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <span>Details</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
