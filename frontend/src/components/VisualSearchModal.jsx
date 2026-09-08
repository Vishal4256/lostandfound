import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Image, Loader2, Upload } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const VisualSearchModal = ({ isOpen, onClose, onSearchResults }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((files) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });

  const handleSearch = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await axios.post('/api/items/search', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSearchResults(data.data || []);
      toast.success(`Found ${data.count || 0} visual matches`);
      handleClose();
    } catch {
      toast.error('Search failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setFile(null); setPreview(null); onClose(); };

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '11px 0', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
    border: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
          onClick={handleClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
              <div>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Visual Search</h2>
                <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>Upload a photo to find similar items</p>
              </div>
              <button onClick={handleClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-2)', cursor: 'pointer', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Drop zone */}
              <div {...getRootProps()} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 32, borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                border: `2px dashed ${isDragActive ? 'var(--accent)' : preview ? 'var(--border-light)' : 'var(--border)'}`,
                background: isDragActive ? 'var(--accent-dim)' : preview ? 'var(--bg-surface)' : 'var(--bg-surface)',
                minHeight: 200
              }}>
                <input {...getInputProps()} />
                {preview ? (
                  <img src={preview} alt="Preview" style={{ maxHeight: 160, borderRadius: 10, objectFit: 'contain' }} />
                ) : (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Image size={22} color="var(--text-3)" />
                    </div>
                    <div>
                      <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Drop an image here</p>
                      <p style={{ color: 'var(--text-3)', fontSize: 12 }}>or click to browse files</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                {preview && (
                  <button onClick={() => { setFile(null); setPreview(null); }}
                    style={{ ...btnBase, flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    Clear
                  </button>
                )}
                <button onClick={handleSearch} disabled={!file || loading}
                  style={{ ...btnBase, flex: 1, background: file && !loading ? 'var(--accent)' : 'var(--bg-surface)', color: file && !loading ? 'white' : 'var(--text-3)', border: '1px solid transparent', opacity: !file ? 0.5 : 1, cursor: !file ? 'not-allowed' : 'pointer' }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Searching…</> : <><Search size={16} /> Find Matches</>}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VisualSearchModal;
