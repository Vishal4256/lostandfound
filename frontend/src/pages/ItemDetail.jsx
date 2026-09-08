import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Calendar, Tag, ChevronLeft, Send, MessageCircle } from 'lucide-react'
import Tilt from 'react-parallax-tilt'
import axios from 'axios'
import { toast } from 'sonner'

const SAMPLE = {
  _id: '1', title: 'Lost Golden Retriever', description: 'Friendly golden retriever named Max. Has a red collar with a name tag. Very approachable — if you see him, crouch down and he will come to you. Last seen near the Central Park fountain on a Tuesday afternoon.',
  category: 'Pets', type: 'lost', date: new Date().toISOString(),
  location: { addressText: 'Central Park, New York' },
  imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=900&q=90',
}

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgs, setMsgs] = useState([
    { id: 1, text: 'Hi, I think I spotted this near Union Square yesterday evening!', sender: 'other', time: '2:34 PM' },
    { id: 2, text: "That's great news! Can you describe what you saw?", sender: 'me', time: '2:36 PM' },
    { id: 3, text: 'Yes — it was near the dog park at the south end.', sender: 'other', time: '2:38 PM' },
  ])

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get(`/api/items/${id}`)
        setItem(data.data || SAMPLE)
      } catch { setItem(SAMPLE) }
      finally { setLoading(false) }
    }
    fetch()
  }, [id])

  const sendMsg = () => {
    if (!msg.trim()) return
    setMsgs(p => [...p, { id: Date.now(), text: msg, sender: 'me', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    setMsg('')
    toast.success('Message sent')
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
      <div style={{ width: 36, height: 36, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const type = item?.type === 'lost'
    ? { label: 'Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' }
    : { label: 'Found', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' }

  const inputStyle = { flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }

  return (
    <div style={{ padding: '36px 0' }}>
      <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, marginBottom: 28, padding: 0, fontFamily: 'Inter, sans-serif', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
        <ChevronLeft size={18} /> Back to listings
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Image */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
          <Tilt glareEnable glareMaxOpacity={0.04} scale={1.01} tiltMaxAngleX={4} tiltMaxAngleY={4}>
            <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ position: 'relative' }}>
                <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: 380, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)' }} />
                <span style={{ position: 'absolute', top: 14, left: 14, padding: '5px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: type.color, background: type.bg, border: `1px solid ${type.border}`, backdropFilter: 'blur(8px)' }}>
                  {type.label}
                </span>
              </div>
            </div>
          </Tilt>
        </motion.div>

        {/* Detail + Chat */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Info card */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.03em', lineHeight: 1.2 }}>{item.title}</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 22 }}>{item.description}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: MapPin, text: item.location?.addressText || item.location || 'Unknown', color: 'var(--accent)' },
                { icon: Calendar, text: new Date(item.date || item.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), color: 'var(--text-3)' },
                { icon: Tag, text: item.category, color: 'var(--text-3)' },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
                  <Icon size={15} style={{ color, flexShrink: 0, marginTop: 1 }} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageCircle size={18} color="var(--accent)" />
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>Contact Reporter</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
              {msgs.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.sender === 'me' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '9px 13px', borderRadius: m.sender === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.sender === 'me' ? 'var(--accent)' : 'var(--bg-surface)',
                    border: m.sender === 'me' ? 'none' : '1px solid var(--border)',
                    color: m.sender === 'me' ? 'white' : 'var(--text-2)', fontSize: 13, lineHeight: 1.5
                  }}>
                    <p>{m.text}</p>
                    <p style={{ fontSize: 10, opacity: 0.6, textAlign: 'right', marginTop: 4 }}>{m.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder="Write a message…" style={inputStyle} />
              <button onClick={sendMsg} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          [data-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
