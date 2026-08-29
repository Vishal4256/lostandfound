import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, ImageIcon, Loader2, Cpu } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const VisualSearchModal = ({ isOpen, onClose, onSearchResults }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleSearch = async () => {
    if (!file) return;
    setIsSearching(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await axios.post('/api/items/search', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onSearchResults(data.data || []);
      toast.success(`Found ${data.count || 0} AI matches!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Vector search failed. Is the backend running?');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', background: 'rgba(2,6,23,0.85)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-cyan-500/20 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(8,15,40,0.95) 0%, rgba(15,23,64,0.95) 100%)',
              boxShadow: '0 0 60px rgba(6,182,212,0.15), 0 0 120px rgba(139,92,246,0.1)'
            }}
          >
            {/* Neon top border */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}>
                  <Cpu size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">AI Visual Search</h2>
                  <p className="text-xs text-cyan-400/70">CLIP Vector Similarity Engine</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* Drop Zone */}
              <div
                {...getRootProps()}
                className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : preview
                    ? 'border-violet-500/40 bg-violet-500/5'
                    : 'border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5'
                }`}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <img src={preview} alt="Preview" className="max-h-52 rounded-lg object-contain shadow-lg shadow-black/50" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-600 bg-slate-800/50">
                      <ImageIcon size={24} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Drop image here</p>
                      <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scanning animation */}
              {isSearching && (
                <div className="relative h-1 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 w-1/3 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)' }}
                    animate={{ x: ['−100%', '400%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {preview && (
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all font-medium text-sm"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={handleSearch}
                  disabled={!file || isSearching}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: file && !isSearching ? 'linear-gradient(135deg, #06b6d4, #8b5cf6)' : undefined,
                    backgroundColor: !file || isSearching ? '#1e293b' : undefined,
                    color: 'white',
                    boxShadow: file && !isSearching ? '0 0 20px rgba(6,182,212,0.3)' : undefined
                  }}
                >
                  {isSearching ? (
                    <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                  ) : (
                    <><Upload size={16} /> Run AI Search</>
                  )}
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
