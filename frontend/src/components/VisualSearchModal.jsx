import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

const VisualSearchModal = ({ isOpen, onClose, onSearchResults, onResults }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((files) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024
  });

  const handleClose = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onClose();
  };

  const handleSearch = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/api/items/search', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const callback = onSearchResults || onResults;
      if (callback) {
        callback(data.data || []);
      }
      toast.success(`Found ${data.count || 0} visual vector matches`);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Visual search failed. Please try a different image.');
    } finally {
      setLoading(false);
    }
  };

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 0', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
    border: 'none', transition: 'all 0.15s'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)'
          }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 460, background: '#121216',
              border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 24,
              overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.8)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 0' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
                  AI Visual Vector Search
                </h2>
                <p style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>
                  Upload a photo to find matching items using local CLIP embeddings
                </p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close modal"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 10, padding: 8, color: '#a1a1aa', cursor: 'pointer', display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                {...getRootProps()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 28, borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px dashed ${isDragActive ? '#6366f1' : preview ? '#3f3f46' : '#27272a'}`,
                  background: isDragActive ? 'rgba(99, 102, 241, 0.08)' : '#0d0d10',
                  minHeight: 190
                }}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <img
                    src={preview}
                    alt="Search Query Preview"
                    style={{ maxHeight: 150, borderRadius: 12, objectFit: 'contain', border: '1px solid #3f3f46' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: 'rgba(99, 102, 241, 0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <ImageIcon size={24} color="#818cf8" />
                    </div>
                    <div>
                      <p style={{ color: '#fafafa', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                        Drop an image here or click to browse
                      </p>
                      <p style={{ color: '#71717a', fontSize: 12 }}>
                        JPEG, PNG, WebP up to 10MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                {preview && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    style={{ ...btnBase, flex: 1, background: '#27272a', color: '#e4e4e7' }}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!file || loading}
                  style={{
                    ...btnBase,
                    flex: 1,
                    background: file && !loading ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#1f1f23',
                    color: file && !loading ? 'white' : '#71717a',
                    cursor: !file || loading ? 'not-allowed' : 'pointer',
                    boxShadow: file && !loading ? '0 4px 18px rgba(99, 102, 241, 0.4)' : 'none'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Matching Vectors…</span>
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Find Visual Matches</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default VisualSearchModal;
