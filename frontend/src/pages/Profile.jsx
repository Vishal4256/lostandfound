import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, MapPin, Activity, Tag, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const SAMPLE = [
  { _id: '1', title: 'Lost Golden Retriever', category: 'Pets', type: 'lost', status: 'Active', date: new Date().toISOString(), imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=300&q=80' },
  { _id: '3', title: 'Lost iPhone 14 Pro', category: 'Electronics', type: 'lost', status: 'Active', date: new Date(Date.now() - 172800000).toISOString(), imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300&q=80' },
  { _id: '2', title: 'Found Car Keys', category: 'Keys', type: 'found', status: 'Active', date: new Date(Date.now() - 86400000).toISOString(), imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=300&q=80' },
]

export default function Profile() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get('/api/items')
        setReports(data.data?.slice(0, 6) || SAMPLE)
      } catch { setReports(SAMPLE) }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const lost = reports.filter(r => r.type === 'lost').length
  const found = reports.filter(r => r.type === 'found').length

  const stats = [
    { icon: Activity, label: 'Total', value: reports.length, color: 'var(--accent)' },
    { icon: Tag, label: 'Lost', value: lost, color: '#EF4444' },
    { icon: CheckCircle, label: 'Found', value: found, color: '#10B981' },
    { icon: Clock, label: 'Resolved', value: 0, color: 'var(--text-3)' },
  ]

  return (
    <div style={{ padding: '48px 0', maxWidth: 860, margin: '0 auto' }}>
      {/* Profile card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white', fontFamily: "'Bricolage Grotesque', sans-serif", flexShrink: 0 }}>
          V
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 4 }}>Vishal</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13 }}>
            <Mail size={13} /> <span>vishal@example.com</span>
          </div>
        </div>
        <button style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          Edit Profile
        </button>
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 36 }}>
        {stats.map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Bricolage Grotesque', sans-serif", lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Reports list */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16, letterSpacing: '-0.02em' }}>My Reports</h2>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map((item, i) => {
              const t = item.type === 'lost' ? { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' } : { color: '#10B981', bg: 'rgba(16,185,129,0.1)' }
              return (
                <motion.div key={item._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/item/${item._id}`} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, textDecoration: 'none', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <img src={item.imageUrl} alt={item.title} style={{ width: 58, height: 58, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{item.category} · {new Date(item.date).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.color, background: t.bg }}>
                        {item.type}
                      </span>
                      <ExternalLink size={15} color="var(--text-3)" />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
