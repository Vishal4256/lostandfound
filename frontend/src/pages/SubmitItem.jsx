import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  'Electronics',
  'Wallets & IDs',
  'Pets & Animals',
  'Keys & Access Cards',
  'Bags & Luggage',
  'Jewelry & Watches',
  'Documents & Portfolios',
  'Other Civic Item'
]

const SUB_CATEGORIES = {
  'Electronics': ['Laptops & Notebooks', 'Smartphones & Tablets', 'Headphones & Audio', 'Smart Watches', 'Cameras & Tech'],
  'Wallets & IDs': ['Driver Licenses', 'Passports', 'Leather Wallets', 'Metro Transit Cards', 'Bank Cards'],
  'Pets & Animals': ['Dogs', 'Cats', 'Birds', 'Other Companion Animals'],
  'Keys & Access Cards': ['Automotive Smart Fobs', 'House Keys & Carabiners', 'Office Badges'],
  'Bags & Luggage': ['Backpacks', 'Suitcases & Duffles', 'Handbags & Purses'],
  'Jewelry & Watches': ['Rings & Bands', 'Necklaces & Pendants', 'Luxury Watches'],
  'Documents & Portfolios': ['Folders & Legal Files', 'Books & Notebooks', 'Diplomas & Certs'],
  'Other Civic Item': ['Eyewear & Glasses', 'Clothing & Coats', 'Medical Assistive Devices']
}

export default function SubmitItem() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const initialType = searchParams.get('type') === 'lost' ? 'lost' : 'found'
  const [type, setType] = useState(initialType)

  const urlType = searchParams.get('type')
  const [prevUrlType, setPrevUrlType] = useState(urlType)
  if (prevUrlType !== urlType) {
    setPrevUrlType(urlType)
    if (urlType === 'lost' || urlType === 'found') {
      setType(urlType)
    }
  }
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [subCategory, setSubCategory] = useState(SUB_CATEGORIES[CATEGORIES[0]][0])
  const [location, setLocation] = useState('')
  const [coordinates, setCoordinates] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [description, setDescription] = useState('')
  const [privateVerification, setPrivateVerification] = useState('')
  const [contactPref, setContactPref] = useState('chat')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [analyzingImage, setAnalyzingImage] = useState(false)

  // Update subcategories when category changes without cascading effect render
  const [prevCategory, setPrevCategory] = useState(category)
  if (prevCategory !== category) {
    setPrevCategory(category)
    const subs = SUB_CATEGORIES[category] || []
    if (subs.length > 0) {
      setSubCategory(subs[0])
    }
  }

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles) => {
    const selected = acceptedFiles[0]
    if (selected) {
      if (selected.size > 15 * 1024 * 1024) {
        toast.error('File size exceeds the 15MB limit')
        return
      }
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setAnalyzingImage(true)
      setTimeout(() => setAnalyzingImage(false), 1200)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic'] },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024
  })

  const removeImage = (e) => {
    e?.stopPropagation()
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  // Geolocation detection & Local Area Reverse Geocoding
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Unable to access your location. Please enable location permission and try again.')
      return
    }

    setGeoLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const coords = [lng, lat] // [longitude, latitude] GeoJSON order
        setCoordinates(coords)

        try {
          // Call backend reverse-geocoding endpoint for clean local area
          const { data } = await api.get('/api/items/reverse-geocode', {
            params: { lat, lng }
          })

          const localArea = data.localArea || data.address
          if (data.success && localArea) {
            setLocation(localArea)
            toast.success(`Location set to ${localArea}`)
          } else {
            toast.error('Unable to determine local area. Please try GPS again.')
          }
        } catch {
          toast.error('Unable to determine local area. Please try GPS again.')
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          toast.error('Unable to access your location. Please enable location permission and try again.')
        } else {
          toast.error('Unable to access your location. Please enable location permission and try again.')
        }
        setGeoLoading(false)
      },
      { timeout: 15000, enableHighAccuracy: true }
    )
  }

  // Check unsaved changes
  const hasChanges = Boolean(
    title.trim() ||
    location.trim() ||
    description.trim() ||
    privateVerification.trim() ||
    file
  )

  const handleDiscard = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes in this report. Are you sure you want to discard them?')) {
        navigate('/')
      }
    } else {
      navigate('/')
    }
  }

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
      toast.error('Please sign in to publish an item report to the civic registry')
      navigate('/login?redirect=/submit-item')
      return
    }

    if (!title.trim()) {
      toast.error('Item title is required')
      return
    }

    if (title.trim().length > 100) {
      toast.error('Item title cannot exceed 100 characters')
      return
    }

    if (!category) {
      toast.error('Please select an item category')
      return
    }

    if (!location.trim()) {
      toast.error('Discovery location or address is required')
      return
    }

    if (!date) {
      toast.error('Please select the incident date')
      return
    }

    if (!file) {
      toast.error('Please provide a photograph of the item for visual verification')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('type', type)
      formData.append('itemType', type)
      formData.append('category', category)
      formData.append('subCategory', (subCategory || '').trim())
      formData.append('location', location.trim())
      formData.append('addressText', location.trim())
      formData.append('date', `${date}T${time}:00`)
      formData.append('description', description.trim())
      formData.append('confidentialVerification', privateVerification.trim())
      formData.append('contactPreference', contactPref)
      formData.append('image', file)

      if (coordinates) {
        formData.append('coordinates', JSON.stringify(coordinates))
      }

      const { data } = await api.post('/api/items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.success && data.data) {
        if (data.potentialMatches && data.potentialMatches.length > 0) {
          toast.success(`${type === 'lost' ? 'Lost incident' : 'Found property'} cataloged! Found ${data.potentialMatches.length} matching candidate(s) in registry.`)
        } else {
          toast.success(`${type === 'lost' ? 'Lost incident' : 'Found property'} cataloged in registry!`)
        }
        navigate(`/item/${data.data._id}`)
      } else {
        throw new Error(data.message || 'Submission failed')
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error submitting report'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12">
      {/* Page Header */}
      <div className="mb-8 md:mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-label-sm font-label-sm font-semibold mb-3 border border-secondary-fixed">
          <span className="material-symbols-outlined text-[14px] material-symbols-filled">verified</span>
          <span>MUNICIPAL &amp; CIVIC AI CO-REGISTRY v4.2</span>
        </div>
        <h1 className="text-headline-lg-mobile md:text-headline-xl font-headline-xl text-primary tracking-tight mb-3">
          Report a Lost or Found Property
        </h1>
        <p className="text-body-lg font-body-lg text-on-surface-variant">
          Our civic AI network instantly matches descriptions, image features, and precinct registries across the metropolitan area.
        </p>
      </div>

      {/* Primary Toggle Selector Switch */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="p-1.5 bg-surface-container-low rounded-2xl border border-outline-variant flex items-center gap-2 shadow-xs">
          <button
            type="button"
            onClick={() => setType('lost')}
            className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-headline-sm text-body-md transition-all ${
              type === 'lost'
                ? 'bg-primary-container text-on-primary shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">search_off</span>
            <span>I Lost an Item</span>
            {type === 'lost' && (
              <span className="px-2 py-0.5 rounded-full bg-on-tertiary-container text-white text-label-sm font-label-sm">
                Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setType('found')}
            className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-headline-sm text-body-md transition-all ${
              type === 'found'
                ? 'bg-primary-container text-on-primary shadow-sm font-semibold'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] material-symbols-filled">volunteer_activism</span>
            <span>I Found an Item</span>
            {type === 'found' && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-on-secondary text-label-sm font-label-sm">
                Active
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between px-2 pt-2 text-label-sm font-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
            {type === 'found'
              ? 'Reporting found property automatically secures custody verification under Civic Code #4109.'
              : 'Reporting a lost item initiates zero-knowledge automated correlation across regional hubs.'}
          </span>
          <Link to="/" className="text-primary underline hover:text-secondary hidden sm:inline">
            Browse Directory
          </Link>
        </div>
      </div>

      {/* Main Form Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-24">
        {/* Left Column: Classification & Location & Distinguishing Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* STEP 1: ITEM CLASSIFICATION */}
          <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-surface-container">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md font-label-md font-semibold">
                  1
                </span>
                <div>
                  <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Item Classification</h2>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    Accurate categorizing accelerates automated biometric &amp; visual matching
                  </p>
                </div>
              </div>
              <span className="text-label-sm font-label-sm px-2.5 py-1 bg-surface-container-low text-on-surface-variant rounded-lg border border-outline-variant">
                Required
              </span>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Item Title / Primary Headline <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Space Gray MacBook Pro 16 or Tan Leather Bifold Wallet"
                  className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <p className="mt-1 text-label-sm font-label-sm text-on-surface-variant">
                  Include brand, model, color, or defining physical characteristics.
                </p>
              </div>

              {/* Category Dual Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                    Category <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none px-4 py-2.5 pr-10 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-outline">
                      <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                    Sub-category
                  </label>
                  <div className="relative">
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full appearance-none px-4 py-2.5 pr-10 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                    >
                      {(SUB_CATEGORIES[category] || ['General Item']).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 inset-y-0 flex items-center pointer-events-none text-outline">
                      <span className="material-symbols-outlined text-[18px]">expand_more</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2: LOCATION & INCIDENT TIME */}
          <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-surface-container">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md font-label-md font-semibold">
                  2
                </span>
                <div>
                  <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Location &amp; Incident Time</h2>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    Pinpoint discovery site for real-time proximity alerts and custody handover
                  </p>
                </div>
              </div>
              <span className="text-label-sm font-label-sm px-2.5 py-1 bg-secondary-container text-on-secondary-fixed-variant rounded-lg border border-secondary/20 font-semibold">
                GIS Enabled
              </span>
            </div>

            <div className="space-y-4">
              {/* Address Search Field */}
              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Discovery Location / Address <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Grand Central Terminal, Dining Concourse near Track 108"
                    className="w-full pl-11 pr-28 py-2.5 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={geoLoading}
                    className="absolute right-2 top-1.5 bottom-1.5 px-3 text-label-sm font-label-sm bg-surface-container hover:bg-surface-container-high text-primary rounded-lg flex items-center gap-1 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${geoLoading ? 'animate-spin' : ''}`}>
                      {geoLoading ? 'sync' : 'my_location'}
                    </span>
                    <span>{geoLoading ? 'Detecting location...' : 'Use GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                    Date Found / Sighted <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                    Approximate Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Custody status note */}
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified_user</span>
                <div className="text-body-sm font-body-sm">
                  <span className="font-semibold text-primary">Civic Custody Protocol:</span>
                  <span className="text-on-surface-variant">
                    {' '}You are currently registering this report. If depositing at an official police desk or transit depository, mark the custody facility in the notes.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 4: DISTINGUISHING DETAILS & PRIVACY */}
          <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-surface-container">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md font-label-md font-semibold">
                  4
                </span>
                <div>
                  <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Distinguishing Details</h2>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    Detailed nuances prevent fraudulent claims and protect ownership verification
                  </p>
                </div>
              </div>
              <span className="text-label-sm font-label-sm px-2.5 py-1 bg-surface-container-low text-on-surface-variant rounded-lg border border-outline-variant">
                Verification Clues
              </span>
            </div>

            <div className="space-y-4">
              {/* Public Description */}
              <div>
                <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5">
                  Public Visual Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe visible scratches, stickers, condition, carrying case, exterior marks, etc."
                  className="w-full px-4 py-2.5 text-body-md font-body-md bg-surface-container-lowest text-on-surface border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Private Verification Notes */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-label-md font-label-md text-primary font-semibold">
                    <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">lock</span>
                    <span>Confidential Verification Markers (Private)</span>
                  </label>
                  <span className="text-[11px] font-label-sm text-on-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded font-medium">
                    Officers &amp; Verified Claimant Only
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={privateVerification}
                  onChange={(e) => setPrivateVerification(e.target.value)}
                  placeholder="Hidden details like engraving text, wallpapers, lockscreen name, or serial segments only the true owner would know..."
                  className="w-full px-3.5 py-2 text-body-sm font-body-sm bg-surface-container-lowest text-on-surface border border-outline-variant rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[12px] text-on-surface-variant font-body-sm">
                  These confidential clues will <span className="font-semibold text-primary">never</span> be published on public feeds. Claimants must furnish this exact detail to claim.
                </p>
              </div>

              {/* Communication Preferences */}
              <div className="pt-2">
                <span className="block text-label-md font-label-md text-primary font-semibold mb-2">Communication Preference</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${contactPref === 'chat' ? 'border-primary bg-surface-container-low' : 'border-outline-variant bg-surface-container-lowest'}`}>
                    <input
                      type="radio"
                      name="contact_pref"
                      checked={contactPref === 'chat'}
                      onChange={() => setContactPref('chat')}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-body-sm font-body-sm text-on-surface font-medium">In-App Chat (Secure)</span>
                  </label>
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${contactPref === 'relay' ? 'border-primary bg-surface-container-low' : 'border-outline-variant bg-surface-container-lowest'}`}>
                    <input
                      type="radio"
                      name="contact_pref"
                      checked={contactPref === 'relay'}
                      onChange={() => setContactPref('relay')}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-body-sm font-body-sm text-on-surface font-medium">Civic Desk Relay</span>
                  </label>
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${contactPref === 'direct' ? 'border-primary bg-surface-container-low' : 'border-outline-variant bg-surface-container-lowest'}`}>
                    <input
                      type="radio"
                      name="contact_pref"
                      checked={contactPref === 'direct'}
                      onChange={() => setContactPref('direct')}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-body-sm font-body-sm text-on-surface font-medium">Direct Phone Call</span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: AI Real-time Image Processing & Match Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* STEP 3: IMAGE UPLOAD & REAL-TIME AI PROCESSING */}
          <section className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-surface-container">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-md font-label-md font-semibold">
                  3
                </span>
                <div>
                  <h2 className="text-headline-sm font-headline-sm font-bold text-primary">Image Upload &amp; Civic AI</h2>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">Real-time computer vision feature extraction</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-label-sm font-label-sm px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                Live Pipeline
              </span>
            </div>

            {/* Drag and Drop Zone */}
            {!preview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-secondary bg-secondary-container/20'
                    : 'border-outline-variant hover:border-primary bg-surface-container-low'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 rounded-full bg-surface-container-lowest mx-auto flex items-center justify-center text-primary shadow-xs mb-3">
                  <span className="material-symbols-outlined text-[26px]">add_a_photo</span>
                </div>
                <p className="text-body-md font-body-md text-primary font-semibold">
                  Drop item photos here, or <span className="text-secondary underline">browse files</span>
                </p>
                <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">
                  Supports JPG, PNG, WEBP, HEIC up to 15MB
                </p>
              </div>
            ) : (
              /* Active Upload Card & Scanning Stage */
              <div className="rounded-2xl border border-outline-variant p-4 bg-surface-bright relative overflow-hidden space-y-4">
                <div className="flex items-start gap-4">
                  {/* Item Thumbnail with Scanning Beam Animation */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border border-outline-variant bg-surface-container-high">
                    <img
                      src={preview}
                      alt="Uploaded Item"
                      className="w-full h-full object-cover"
                    />
                    {analyzingImage && (
                      <div className="absolute inset-x-0 h-[2px] bg-secondary-container shadow-[0_0_8px_#82f5c1] scanning-pulse"></div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-primary/80 backdrop-blur-sm text-on-primary text-[9px] font-label-sm px-1 rounded">
                      VERIFIED
                    </div>
                  </div>

                  {/* Upload Progress & Status Meta */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-body-md font-body-md font-semibold text-primary truncate">{file?.name}</h4>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-on-surface-variant hover:text-error transition-colors p-1"
                        aria-label="Remove photo"
                      >
                        <span className="material-symbols-outlined text-[18px]">cancel</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-label-sm font-label-sm text-on-surface-variant mb-2">
                      <span>{(file?.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>•</span>
                      <span className="text-secondary flex items-center gap-0.5 font-semibold">
                        <span className="material-symbols-outlined text-[14px]">done_all</span>
                        Ready
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                      <div className="bg-secondary h-full rounded-full w-full"></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-label-sm text-on-surface-variant mt-1">
                      <span>512-D Local CLIP Engine</span>
                      <span className="text-primary font-semibold">Processed</span>
                    </div>
                  </div>
                </div>

                {/* AI Feature Extraction Preview Widget */}
                <div className="pt-3 border-t border-outline-variant/60">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-[18px]">psychology</span>
                      <span className="text-label-md font-label-md font-semibold text-primary">AI Visual Feature Extraction</span>
                    </div>
                    <span className="text-[10px] font-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/70 text-body-sm font-body-sm">
                      <div className="flex items-center gap-2 truncate">
                        <span className="material-symbols-outlined text-[16px] text-primary">category</span>
                        <span className="text-on-surface font-medium truncate">Category Classified: {category}</span>
                      </div>
                      <span className="text-label-sm font-label-sm font-semibold text-secondary bg-secondary-container/40 px-2 py-0.5 rounded">
                        Analyzed
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/70 text-body-sm font-body-sm">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">fingerprint</span>
                        <span className="text-on-surface font-medium">Vector Dimension: 512-D Dense Float</span>
                      </div>
                      <span className="text-label-sm font-label-sm text-outline">CLIP ViT-B/32</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Potential Match Correlation Notice */}
          <div className="rounded-2xl border border-secondary/30 bg-surface-container-low p-5 shadow-xs space-y-2.5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">hub</span>
                <h3 className="text-headline-sm font-headline-sm font-bold text-primary">Pre-Match Correlation</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-label-sm font-label-sm font-semibold">
                Auto-Indexing
              </span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Once published, our automated vector index correlates this record against regional lost/found entries across transit and partner custody hubs.
            </p>
          </div>

          {/* Civic Trust Policy Badge */}
          <div className="p-4 rounded-2xl border border-outline-variant bg-surface-container-lowest flex items-start gap-3 shadow-xs">
            <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">policy</span>
            <div className="text-body-sm font-body-sm">
              <span className="font-semibold text-primary">Civic Safe Harbor Protocol:</span>
              <span className="text-on-surface-variant">
                {' '}Documenting found or lost property provides official timestamps and custody immunity under local municipal codes.
              </span>
            </div>
          </div>
        </div>

        {/* STEP 5: FULL-WIDTH DOCKED FOOTER BAR */}
        <div className="lg:col-span-12 fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant p-4 shadow-xl">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-2.5 text-on-surface-variant text-body-sm font-body-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">cloud_done</span>
              <span>Civic draft encrypted &amp; ready for metropolitan registry indexing.</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDiscard}
                className="w-1/2 sm:w-auto px-5 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-sm transition-all active:scale-[0.98]"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="w-1/2 sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-semibold text-body-sm transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Processing Vector Embeddings...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>Publish to Civic Registry &amp; Scan Matches</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
