import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, MapPin, Tag, AlignLeft, Loader2, CheckCircle, Image, X } from 'lucide-react'
import axios from 'axios'
import { toast } from 'sonner'

const CATEGORIES = ['Electronics', 'Accessories', 'Clothing', 'Documents', 'Keys', 'Pets', 'Jewellery', 'Other']

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
    {children}
  </label>
)

const inputStyle = {
  width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 10, padding: '11px 14px', color: 'var(--text)', fontSize: 14,
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s'
}

export default function AddItem() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', category: 'Other', type: 'found', location: '' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback(files => {
    const f = files[0]; if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false })
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Please add an image.'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      await axios.post('/api/items', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Item reported successfully!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit. Is the backend running?')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 0' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.03em' }}>Report an Item</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 15, marginBottom: 36 }}>Help someone recover what they lost — or let people know you found something.</p>
      </motion.div>

      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        onSubmit={handleSubmit}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Type toggle */}
        <div>
          <Label>I am reporting a…</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['found', '✓ Found Item', '#10B981', 'rgba(16,185,129,0.1)'], ['lost', '⚠ Lost Item', '#EF4444', 'rgba(239,68,68,0.1)']].map(([val, label, color, bg]) => (
              <button key={val} type="button" onClick={() => setForm(p => ({ ...p, type: val }))}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', border: `1px solid ${form.type === val ? color + '50' : 'var(--border)'}`,
                  background: form.type === val ? bg : 'var(--bg-surface)',
                  color: form.type === val ? color : 'var(--text-3)',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Image upload */}
        <div>
          <Label>Photo *</Label>
          <div {...getRootProps()} style={{
            position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 28, borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s', minHeight: 180,
            border: `2px dashed ${isDragActive ? 'var(--accent)' : preview ? 'var(--border-light)' : 'var(--border)'}`,
            background: isDragActive ? 'var(--accent-dim)' : 'var(--bg-surface)'
          }}>
            <input {...getInputProps()} />
            {preview ? (
              <>
                <img src={preview} alt="preview" style={{ maxHeight: 150, borderRadius: 10, objectFit: 'contain' }} />
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', color: 'white' }}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={20} color="var(--text-3)" />
                </div>
                <div>
                  <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Drop image here</p>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>PNG, JPG, WEBP — max 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <Label>Title *</Label>
          <input value={form.title} onChange={set('title')} required placeholder="e.g. Black iPhone 14 Pro, Lost Golden Retriever…" style={inputStyle} />
        </div>

        {/* Description */}
        <div>
          <Label>Description</Label>
          <textarea value={form.description} onChange={set('description')} rows={3}
            placeholder="Distinctive features, markings, or anything helpful…"
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
        </div>

        {/* Category + Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label>Category</Label>
            <select value={form.category} onChange={set('category')} style={{ ...inputStyle, cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#18181B' }}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Location</Label>
            <input value={form.location} onChange={set('location')} placeholder="e.g. Central Park, NY" style={inputStyle} />
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 0', borderRadius: 12, background: loading ? 'var(--bg-surface)' : 'var(--accent)',
            color: loading ? 'var(--text-3)' : 'white', border: 'none', fontWeight: 700, fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(249,115,22,0.3)', transition: 'all 0.15s'
          }}>
          {loading ? <><Loader2 size={16} className="animate-spin" />Uploading & processing…</> : <><CheckCircle size={17} />Submit Report</>}
        </button>
      </motion.form>
    </div>
  )
}
