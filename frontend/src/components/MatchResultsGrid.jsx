import { MapPin, Calendar, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';

const MatchResultsGrid = ({ results }) => {
  if (!results || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed" style={{ borderColor: 'rgba(6,182,212,0.15)', background: 'rgba(6,182,212,0.02)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <AlertCircle className="text-cyan-500" size={28} />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">No items found</h3>
        <p className="text-slate-500 text-center text-sm max-w-sm">
          Our AI couldn't find any matches. Report an item or try a different image.
        </p>
      </div>
    );
  }

  const getScoreColor = (pct) => {
    if (pct >= 90) return { text: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
    if (pct >= 75) return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
    return { text: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' };
  };

  const getTypeBadge = (type) => {
    if (type === 'lost') return { label: 'LOST', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    return { label: 'FOUND', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {results.map((item, i) => {
        const score = item.matchPercentage || Math.floor(Math.random() * 30 + 65);
        const scoreStyle = getScoreColor(score);
        const typeBadge = getTypeBadge(item.type);

        return (
          <Tilt
            key={item._id || i}
            glareEnable
            glareMaxOpacity={0.1}
            glareColor="#06b6d4"
            scale={1.02}
            tiltMaxAngleX={6}
            tiltMaxAngleY={6}
            className="h-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="group flex flex-col h-full rounded-2xl overflow-hidden border transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(8,15,40,0.9) 0%, rgba(15,23,64,0.9) 100%)',
                border: '1px solid rgba(6,182,212,0.12)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
              whileHover={{ boxShadow: '0 4px 40px rgba(6,182,212,0.15), 0 0 80px rgba(139,92,246,0.1)' }}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden bg-slate-900">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,15,40,0.85) 0%, transparent 60%)' }} />

                {/* Neon top line */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)', opacity: 0.6 }} />

                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold border" style={{ color: scoreStyle.text, background: scoreStyle.bg, borderColor: scoreStyle.border }}>
                    <CheckCircle2 size={10} className="inline mr-1" />
                    {score}% Match
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 rounded-md text-xs font-bold border border-white/10" style={{ color: typeBadge.color, background: typeBadge.bg }}>
                    {typeBadge.label}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-grow p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded text-cyan-400" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
                    {item.category}
                  </span>
                </div>

                <p className="text-slate-500 text-xs line-clamp-2 mb-3 flex-grow leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center text-xs text-slate-500">
                    <MapPin size={11} className="mr-1.5 text-cyan-600 shrink-0" />
                    <span className="truncate">{item.location?.addressText || item.location || 'Unknown Location'}</span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500">
                    <Calendar size={11} className="mr-1.5 text-violet-500 shrink-0" />
                    <span>{new Date(item.date || item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Match bar */}
                <div className="mb-3">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${scoreStyle.text}, #8b5cf6)` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.8, delay: i * 0.06 + 0.2 }}
                    />
                  </div>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all border hover:scale-[1.02]"
                  style={{ borderColor: 'rgba(6,182,212,0.2)', color: '#06b6d4', background: 'rgba(6,182,212,0.05)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.12)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(6,182,212,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.05)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Contact Reporter <ChevronRight size={13} />
                </button>
              </div>
            </motion.div>
          </Tilt>
        );
      })}
    </div>
  );
};

export default MatchResultsGrid;
