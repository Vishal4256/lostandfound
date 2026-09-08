import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, SlidersHorizontal, RefreshCw, ArrowRight, Package, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import MatchResultsGrid from '../components/MatchResultsGrid'
import VisualSearchModal from '../components/VisualSearchModal'

const CATEGORIES = ['All', 'Electronics', 'Accessories', 'Clothing', 'Documents', 'Keys', 'Pets', 'Jewellery', 'Other']

const SAMPLE = [
  { _id: '1', title: 'Lost Golden Retriever', description: 'Friendly golden retriever named Max. Has a red collar with name tag. Very approachable.', category: 'Pets', type: 'lost', date: new Date().toISOString(), location: { addressText: 'Central Park, New York' }, imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&q=85' },
  { _id: '2', title: 'Found Car Keys on Red Lanyard', description: 'Honda car keys on a red lanyard. Found on a bench near the fountain.', category: 'Keys', type: 'found', date: new Date(Date.now() - 86400000).toISOString(), location: { addressText: 'Times Square, New York' }, imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&q=85' },
  { _id: '3', title: 'Lost iPhone 14 Pro — Black', description: 'Black iPhone 14 Pro in a clear case. Lock screen has a photo of a cat.', category: 'Electronics', type: 'lost', date: new Date(Date.now() - 172800000).toISOString(), location: { addressText: 'Financial District, New York' }, imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&q=85' },
  { _id: '4', title: 'Found Blue Jansport Backpack', description: 'Blue Jansport backpack left in the study hall. Contains some notebooks.', category: 'Accessories', type: 'found', date: new Date(Date.now() - 259200000).toISOString(), location: { addressText: 'Columbia University, New York' }, imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=85' },
  { _id: '5', title: 'Lost Ray-Ban Wayfarer Sunglasses', description: 'Classic black wayfarer Ray-Bans. Left at a café table.', category: 'Accessories', type: 'lost', date: new Date(Date.now() - 345600000).toISOString(), location: { addressText: 'Brooklyn, New York' }, imageUrl: 'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600&q=85' },
  { _id: '6', title: 'Found Brown Leather Wallet', description: 'Brown leather bifold. Cards still inside. Found near the subway entrance.', category: 'Accessories', type: 'found', date: new Date(Date.now() - 432000000).toISOString(), location: { addressText: 'Grand Central, New York' }, imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=85' },
]

export default function Home() {
  const [searchModal, setSearchModal] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [type, setType] = useState('all')
  const [text, setText] = useState('')

  const fetchItems = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get('/api/items')
      setListings(data.data?.length ? data.data : SAMPLE)
    } catch { setListings(SAMPLE) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [])

  const filtered = searchResults || listings.filter(item => {
    if (category !== 'All' && item.category !== category) return false
    if (type !== 'all' && item.type !== type) return false
    if (text && !item.title.toLowerCase().includes(text.toLowerCase()) && !item.description?.toLowerCase().includes(text.toLowerCase())) return false
    return true
  })

  const lostCount = listings.filter(i => i.type === 'lost').length
  const foundCount = listings.filter(i => i.type === 'found').length

  const selectStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
    color: 'var(--text-2)', fontSize: 13, fontWeight: 500, padding: '9px 14px',
    cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif'
  }

  return (
    <div>
      {/* Hero */}
      <div style={{ padding: '64px 0 56px', maxWidth: 700 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', marginBottom: 22 }}>
          <Package size={13} color="var(--accent)" />
          <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>{listings.length} ACTIVE REPORTS</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
          style={{ fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 18, color: 'var(--text)', letterSpacing: '-0.04em' }}>
          Reuniting people<br />
          with their<span style={{ color: 'var(--accent)' }}> belongings.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          style={{ color: 'var(--text-2)', fontSize: 17, lineHeight: 1.65, marginBottom: 32, maxWidth: 520 }}>
          Browse lost and found items from your community. Upload a photo to instantly find visual matches.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setSearchModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px',
            background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 12,
            fontWeight: 600, fontSize: 15, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 4px 20px rgba(249,115,22,0.35)', transition: 'transform 0.15s, box-shadow 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(249,115,22,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(249,115,22,0.35)'; }}>
            <Search size={18} strokeWidth={2.5} /> Search by Photo
          </button>
          <Link to="/add-item" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px',
            background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer', textDecoration: 'none',
            transition: 'border-color 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <Plus size={18} /> Report an Item
          </Link>
        </motion.div>
      </div>

      {/* Stats row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
        {[
          { label: 'Active Lost', value: lostCount, accent: '#EF4444' },
          { label: 'Active Found', value: foundCount, accent: '#10B981' },
          { label: 'Total Reports', value: listings.length, accent: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', flex: '1 1 140px' }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.accent, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{s.value}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Search items…"
            style={{ ...selectStyle, paddingLeft: 38, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SlidersHorizontal size={15} color="var(--text-3)" />
          <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
            <option value="all">All Types</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
            {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#18181B' }}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
        </div>
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {searchResults ? 'Visual Match Results' : 'Recent Reports'}
          </h2>
          <span style={{ padding: '2px 9px', borderRadius: 999, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 12, fontWeight: 500 }}>
            {filtered.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {searchResults && (
            <button onClick={() => setSearchResults(null)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-3)', fontSize: 13, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Clear results
            </button>
          )}
          <button onClick={fetchItems} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-3)', padding: '7px', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <MatchResultsGrid results={filtered} />
      )}

      <VisualSearchModal isOpen={searchModal} onClose={() => setSearchModal(false)}
        onSearchResults={r => { setSearchResults(r); setSearchModal(false); }} />
    </div>
  )
}
