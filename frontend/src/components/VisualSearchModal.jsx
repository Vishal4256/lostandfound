import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'
import { toast } from 'sonner'

export default function VisualSearchModal({ isOpen, onClose, onSearchResults, onResults }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback((files) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024
  })

  const handleClose = () => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    onClose()
  }

  const handleSearch = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const { data } = await api.post('/api/items/search', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const callback = onSearchResults || onResults
      if (callback) {
        callback(data.data || [])
      }
      toast.success(`Found ${data.count || 0} visual vector matches`)
      handleClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Visual search failed. Please try another angle.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-primary/45 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative bg-surface-container-lowest rounded-2xl max-w-lg w-full border border-outline-variant shadow-2xl overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-outline-variant/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px] text-secondary">psychology</span>
            </div>
            <div>
              <h2 className="text-headline-sm font-headline-sm font-bold text-primary">
                AI Visual Vector Search
              </h2>
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                512-Dimensional CLIP semantic image matcher
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!preview ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-secondary bg-secondary-container/20'
                  : 'border-outline-variant hover:border-primary bg-surface-container-low'
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-14 h-14 rounded-full bg-surface-container-lowest mx-auto flex items-center justify-center text-primary shadow-xs mb-3">
                <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
              </div>
              <p className="text-body-md font-body-md font-semibold text-primary">
                {isDragActive ? 'Drop image here...' : 'Upload or drop a reference photo'}
              </p>
              <p className="text-label-sm font-label-sm text-on-surface-variant mt-1.5">
                Matches texture, color, silhouette, and branding marks across active precinct records
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-outline-variant p-4 bg-surface-container-low space-y-4">
              <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-surface-container-high border border-outline-variant">
                <img
                  src={preview}
                  alt="Search Reference"
                  className="w-full h-full object-contain"
                />
                {loading && (
                  <div className="absolute inset-x-0 h-[2px] bg-secondary-container shadow-[0_0_8px_#82f5c1] scanning-pulse"></div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    if (preview) URL.revokeObjectURL(preview)
                    setPreview(null)
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-primary/80 text-white hover:bg-primary transition-colors"
                  aria-label="Remove image"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant">
                <span className="font-label-sm truncate max-w-[200px]">{file?.name}</span>
                <span className="font-label-sm text-label-sm">{(file?.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
          )}

          {/* AI Info Notice */}
          <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/60 flex items-start gap-2.5 text-body-sm font-body-sm">
            <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">verified_user</span>
            <p className="text-on-surface-variant text-body-sm">
              <strong className="text-primary font-semibold">Privacy Shielded:</strong> Your uploaded photo is processed ephemerally in memory to compute embedding vectors and is never published without your explicit authorization.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/60 bg-surface-container-low flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container text-primary text-body-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!file || loading}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary text-body-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all shadow-xs"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                <span>Calculating Vectors...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                <span>Search Registry Matches</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
