import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlusCircle, MapPin, Tag, AlignLeft, Loader2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const CATEGORIES = ['Electronics', 'Accessories', 'Keys', 'Pets', 'Clothing', 'Documents', 'Jewellery', 'Other'];

const CreateListingModal = ({ isOpen, onClose, onItemCreated }) => {
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Other', type: 'found', addressText: '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, multiple: false });

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please upload an image.'); return; }
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('image', file);
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('category', formData.category);
      data.append('type', formData.type);
      data.append('addressText', formData.addressText);
      data.append('coordinates', JSON.stringify([0, 0]));
      await axios.post('/api/items', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Item reported successfully!');
      onItemCreated?.();
      handleClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to create listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({ title: '', description: '', category: 'Other', type: 'found', addressText: '' });
    setFile(null);
    setPreview(null);
    onClose();
  };

  const inputClass = "w-full bg-slate-800/60 border border-slate-700 focus:border-cyan-500/70 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors";
  const labelClass = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

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
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-violet-500/20"
            style={{
              background: 'linear-gradient(135deg, rgba(8,15,40,0.98) 0%, rgba(15,23,64,0.98) 100%)',
              boxShadow: '0 0 60px rgba(139,92,246,0.15), 0 0 120px rgba(6,182,212,0.1)'
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' }}>
                  <PlusCircle size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Report an Item</h2>
                  <p className="text-xs text-violet-400/70">AI will generate visual embeddings</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              {/* Lost / Found toggle */}
              <div className="flex gap-2 p-1 bg-slate-800/60 rounded-xl">
                {['found', 'lost'].map(t => (
                  <button key={t} type="button" onClick={() => setFormData(p => ({ ...p, type: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${formData.type === t ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                    {t === 'found' ? '✅ I Found an Item' : '🔍 I Lost an Item'}
                  </button>
                ))}
              </div>

              {/* Image Drop */}
              <div>
                <label className={labelClass}>Item Photo *</label>
                <div {...getRootProps()} className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${isDragActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-600 hover:border-violet-500/50 hover:bg-violet-500/5'}`}>
                  <input {...getInputProps()} />
                  {preview
                    ? <img src={preview} alt="Preview" className="max-h-36 rounded-lg object-contain" />
                    : <div className="flex flex-col items-center gap-2 text-center">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-600 bg-slate-800">
                          <Tag size={20} className="text-slate-400" />
                        </div>
                        <p className="text-white text-sm font-medium">Drop image here</p>
                        <p className="text-slate-500 text-xs">PNG, JPG, WEBP up to 10MB</p>
                      </div>
                  }
                </div>
              </div>

              <div>
                <label className={labelClass}>Title *</label>
                <input name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Black iPhone 14 Pro" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}><AlignLeft size={10} className="inline mr-1" />Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} placeholder="Distinctive markings, colors, or anything helpful..." className={inputClass + ' resize-none'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className={inputClass + ' cursor-pointer'}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}><MapPin size={10} className="inline mr-1" />Location</label>
                  <input name="addressText" value={formData.addressText} onChange={handleChange} placeholder="e.g. Central Park, NY" className={inputClass} />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', boxShadow: '0 0 20px rgba(139,92,246,0.3)' }}
              >
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" /> Generating AI Embeddings...</>
                  : <><CheckCircle size={16} /> Submit Report</>
                }
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateListingModal;
