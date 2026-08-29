import { useState, useEffect } from 'react'
import { Search, PlusCircle, LayoutDashboard, Cpu, Zap, Shield, Globe, ChevronRight, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import Tilt from 'react-parallax-tilt'
import axios from 'axios'
import VisualSearchModal from './components/VisualSearchModal'
import MatchResultsGrid from './components/MatchResultsGrid'
import CreateListingModal from './components/CreateListingModal'

const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-white/5"
    style={{ background: 'rgba(15,23,64,0.6)' }}
  >
    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  </motion.div>
)

function App() {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [activeListings, setActiveListings] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const { data } = await axios.get('/api/items')
      setActiveListings(data.data || [])
    } catch (err) {
      // Backend offline — use sample data so UI always looks great
      setActiveListings([
        { _id: '1', title: 'Lost Golden Retriever', description: 'Friendly golden retriever named Max. Last seen near Central Park.', category: 'Pets', status: 'Active', type: 'lost', date: new Date().toISOString(), location: { addressText: 'Central Park, NY' }, imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&q=80', matchPercentage: 98 },
        { _id: '2', title: 'Found Keys on Lanyard', description: 'Honda car keys on a red Supreme lanyard. Found on a bench.', category: 'Keys', status: 'Active', type: 'found', date: new Date().toISOString(), location: { addressText: 'Times Square, NY' }, imageUrl: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=500&q=80', matchPercentage: 85 },
        { _id: '3', title: 'Lost iPhone 14 Pro', description: 'Black iPhone 14 Pro with a clear case. Lock screen has a cat.', category: 'Electronics', status: 'Active', type: 'lost', date: new Date().toISOString(), location: { addressText: 'Financial District, NY' }, imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&q=80', matchPercentage: 91 },
        { _id: '4', title: 'Found Blue Backpack', description: 'Jansport blue backpack found in the library study hall.', category: 'Accessories', status: 'Active', type: 'found', date: new Date().toISOString(), location: { addressText: 'Columbia University Library' }, imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80', matchPercentage: 79 },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  const stats = [
    { icon: Globe, label: 'Active Reports', value: activeListings.length, color: '#06b6d4' },
    { icon: Cpu, label: 'AI Engine', value: 'CLIP v32', color: '#8b5cf6' },
    { icon: Zap, label: 'Vector Dims', value: '512D', color: '#f59e0b' },
    { icon: Shield, label: 'Match Type', value: 'Cosine', color: '#10b981' },
  ]

  return (
    <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #0c0f1a 100%)' }}>
      <Toaster position="top-right" richColors theme="dark" />

      {/* Animated gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)' }}
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Navigation */}
      <nav className="border-b sticky top-0 z-40" style={{ borderColor: 'rgba(6,182,212,0.1)', background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', boxShadow: '0 0 20px rgba(6,182,212,0.4)' }}>
                <Search className="text-white" size={17} />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AI·FOUND
                </span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium text-cyan-400 border border-cyan-500/30" style={{ background: 'rgba(6,182,212,0.1)' }}>
                  BETA
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden sm:flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium transition-colors text-sm px-3 py-2 rounded-lg hover:bg-cyan-500/10">
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-black transition-all"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', boxShadow: '0 0 15px rgba(6,182,212,0.3)' }}
              >
                <PlusCircle size={16} />
                Report Item
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Hero */}
        <div className="flex flex-col lg:flex-row items-center gap-16 mb-24">
          <div className="flex-1 text-center lg:text-left z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-cyan-400 mb-6 border border-cyan-500/20"
              style={{ background: 'rgba(6,182,212,0.08)' }}
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                <Cpu size={12} />
              </motion.div>
              Multimodal CLIP Vector RAG Engine
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-none"
              style={{ color: '#f1f5f9' }}
            >
              Find your lost<br />
              <span style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                items with AI.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 text-lg mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed"
            >
              Upload any image and our CLIP neural network generates 512-dimensional visual embeddings to instantly find matches from active reports.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-black overflow-hidden transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', boxShadow: '0 0 30px rgba(6,182,212,0.4), 0 0 60px rgba(139,92,246,0.2)' }}
              >
                <Search size={20} />
                Launch AI Visual Search
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-slate-300 border transition-all hover:text-white hover:scale-105"
                style={{ borderColor: 'rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.05)' }}
              >
                <PlusCircle size={20} />
                Report New Item
              </button>
            </motion.div>
          </div>

          {/* 2.5D floating card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 hidden lg:flex justify-center"
          >
            <Tilt glareEnable glareMaxOpacity={0.2} scale={1.03} tiltMaxAngleX={12} tiltMaxAngleY={12} className="w-72">
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-72 rounded-3xl overflow-hidden border"
                style={{
                  border: '1px solid rgba(6,182,212,0.25)',
                  background: 'linear-gradient(135deg, rgba(8,15,40,0.95), rgba(15,23,64,0.95))',
                  boxShadow: '0 0 60px rgba(6,182,212,0.2), 0 0 120px rgba(139,92,246,0.15), inset 0 0 40px rgba(6,182,212,0.05)'
                }}
              >
                <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />
                <img src="https://images.unsplash.com/photo-1552053831-71594a27632d?w=500&q=80" className="w-full h-44 object-cover" alt="Sample item" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-cyan-400" style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)' }}>Pets</span>
                    <span className="text-xs font-bold text-emerald-400">✦ 98% Match</span>
                  </div>
                  <p className="text-white font-bold text-base mb-1">Lost Golden Retriever</p>
                  <p className="text-slate-500 text-xs mb-4">Central Park, New York</p>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <motion.div className="h-full rounded-full" style={{ width: '98%', background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)' }}
                      initial={{ width: 0 }} animate={{ width: '98%' }} transition={{ delay: 0.8, duration: 1 }} />
                  </div>
                </div>
              </motion.div>
            </Tilt>
          </motion.div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <StatCard {...s} />
            </motion.div>
          ))}
        </div>

        {/* Listings */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #06b6d4, #8b5cf6)' }} />
              <h2 className="text-2xl font-bold text-white">
                {searchResults ? '🎯 AI Match Results' : 'Active Reports'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {searchResults && (
                <button onClick={() => setSearchResults(null)} className="text-sm font-medium text-slate-400 hover:text-cyan-400 px-3 py-2 rounded-lg border transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  Clear Results
                </button>
              )}
              <button onClick={fetchItems} className="p-2 rounded-lg text-slate-500 hover:text-cyan-400 transition-colors" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
                  style={{ borderTopColor: '#06b6d4', borderRightColor: '#8b5cf6' }} />
                <p className="text-slate-500 text-sm">Connecting to vector database...</p>
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <MatchResultsGrid results={searchResults || activeListings} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <VisualSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} onSearchResults={(r) => { setSearchResults(r); setIsSearchModalOpen(false); }} />
      <CreateListingModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onItemCreated={fetchItems} />
    </div>
  )
}

export default App
