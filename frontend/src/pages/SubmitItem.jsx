import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import {
  Upload,
  MapPin,
  Loader2,
  X,
  Navigation,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import api from '../services/api'
import { toast } from 'sonner'

const CATEGORIES = [
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

export default function SubmitItem() {
  const navigate = useNavigate()

  const [type, setType] = useState('lost') // 'lost' | 'found'
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [location, setLocation] = useState('')
  const [coordinates, setCoordinates] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState('')

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles) => {
    const selected = acceptedFiles[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  const removeImage = (e) => {
    e.stopPropagation()
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  // Geolocation detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude]
        setCoordinates(coords)
        if (!location) {
          setLocation(`Near Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`)
        }
        toast.success('Coordinates captured from your device')
        setGeoLoading(false)
      },
      (err) => {
        console.warn('Geolocation error:', err.message)
        toast.error('Could not detect location. Please type the address manually.')
        setGeoLoading(false)
      },
      { timeout: 10000 }
    )
  }

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error('Please enter an item title')
      return
    }

    if (!file) {
      toast.error('Please upload a clear photo of the item')
      return
    }

    setSubmitting(true)
    setSubmitStep('Uploading photo to secure cloud storage...')

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('type', type)
      formData.append('itemType', type)
      formData.append('category', category)
      formData.append('location', location.trim() || 'Unknown Location')
      formData.append('date', date)
      formData.append('description', description.trim())
      formData.append('image', file)

      if (coordinates) {
        formData.append('coordinates', JSON.stringify(coordinates))
      }

      setSubmitStep('Generating 512-D local CLIP vector embedding...')

      const { data } = await api.post('/api/items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.success && data.data) {
        toast.success(`${type === 'lost' ? 'Lost' : 'Found'} item reported successfully!`)
        navigate(`/item/${data.data._id}`)
      } else {
        throw new Error(data.message || 'Submission failed')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error submitting report'
      toast.error(msg)
    } finally {
      setSubmitting(false)
      setSubmitStep('')
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#131316',
    border: '1px solid #27272a',
    borderRadius: 12,
    padding: '12px 14px',
    color: '#fafafa',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s'
  }

  return (
    <div style={{ padding: '36px 0 80px', maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', marginBottom: 14 }}>
          <Sparkles size={14} color="#818cf8" />
          <span style={{ color: '#818cf8', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>AI EMBEDDED LISTING</span>
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: '#fafafa', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Report an Item
        </h1>
        <p style={{ color: '#a1a1aa', fontSize: 15 }}>
          Fill in the details below. Our local CLIP vision model will instantly analyze the photo for visual matching.
        </p>
      </motion.div>

      {/* Main Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: 'rgba(18, 18, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Lost vs Found Segmented Toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Report Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#09090b', padding: 6, borderRadius: 14, border: '1px solid #27272a' }}>
              <button
                type="button"
                onClick={() => setType('lost')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: type === 'lost' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'transparent',
                  color: type === 'lost' ? 'white' : '#a1a1aa',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: type === 'lost' ? '0 4px 15px rgba(239, 68, 68, 0.35)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                <span>🔍 I Lost Something</span>
              </button>
              <button
                type="button"
                onClick={() => setType('found')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: type === 'found' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                  color: type === 'found' ? 'white' : '#a1a1aa',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: type === 'found' ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                <span>🙌 I Found Something</span>
              </button>
            </div>
          </div>

          {/* Photo Upload Dropzone */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Item Photo (Required for AI visual matching)
            </label>
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? '#6366f1' : preview ? '#3f3f46' : '#27272a'}`,
                borderRadius: 16,
                background: isDragActive ? 'rgba(99, 102, 241, 0.08)' : '#0d0d10',
                padding: preview ? 16 : 36,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative'
              }}
            >
              <input {...getInputProps()} />

              {preview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, textAlign: 'left' }}>
                  <img
                    src={preview}
                    alt="Preview"
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 12, border: '1px solid #3f3f46' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#fafafa', margin: '0 0 4px' }}>{file?.name}</p>
                    <p style={{ fontSize: 12, color: '#a1a1aa', margin: '0 0 8px' }}>
                      {(file?.size / (1024 * 1024)).toFixed(2)} MB • Ready for CLIP embedding
                    </p>
                    <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>Click or drop to replace image</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px'
                  }}>
                    <Upload size={24} color="#818cf8" />
                  </div>
                  <p style={{ fontWeight: 600, fontSize: 15, color: '#fafafa', marginBottom: 4 }}>
                    Drag & drop your item photo here, or <span style={{ color: '#818cf8' }}>browse</span>
                  </p>
                  <p style={{ fontSize: 12, color: '#71717a' }}>
                    JPEG, PNG, or WebP up to 10MB. Clear images yield highest matching accuracy.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Item Title */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Item Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Midnight Black AirPods Pro in MagSafe Case"
              required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#27272a'}
            />
          </div>

          {/* Grid: Category & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-grid-2">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} style={{ background: '#18181b', color: '#fafafa' }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Date & Time {type === 'lost' ? 'Lost' : 'Found'}
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
            </div>
          </div>

          {/* Location with Geolocation button */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Location / Place Description
              </label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={geoLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'none',
                  border: 'none',
                  color: '#818cf8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: geoLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {geoLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Navigation size={13} />}
                <span>Detect My Location</span>
              </button>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <MapPin size={16} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g., Campus Student Library, 2nd Floor Study Table"
                style={{ ...inputStyle, paddingLeft: 40 }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Detailed Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide identifiable markings, brand names, color shades, contents, or circumstances..."
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#27272a'}
            />
          </div>

          {/* Submit Progress / Action Button */}
          <div>
            {submitting && submitStep && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#c7d2fe',
                padding: '12px 16px',
                borderRadius: 12,
                fontSize: 13,
                marginBottom: 12
              }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#818cf8', flexShrink: 0 }} />
                <span>{submitStep}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 0',
                borderRadius: 12,
                background: submitting ? '#312e81' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.15s'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Processing AI Embeddings...</span>
                </>
              ) : (
                <>
                  <span>Publish {type === 'lost' ? 'Lost' : 'Found'} Item Report</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .form-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
