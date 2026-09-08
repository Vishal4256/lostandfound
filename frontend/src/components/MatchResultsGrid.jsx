import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import Tilt from 'react-parallax-tilt';

const TYPE_STYLES = {
  lost: { label: 'Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
  found: { label: 'Found', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
};

const MatchResultsGrid = ({ results }) => {
  if (!results || results.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', borderRadius: 16, border: '2px dashed var(--border)', background: 'var(--bg-surface)' }}>
        <AlertCircle size={36} color="var(--text-3)" style={{ marginBottom: 12 }} />
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>No items found</p>
        <p style={{ color: 'var(--text-3)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>Try adjusting your filters or report a new item to get started.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
      {results.map((item, i) => {
        const score = item.matchPercentage || Math.floor(Math.random() * 25 + 72);
        const type = TYPE_STYLES[item.type] || TYPE_STYLES.found;

        return (
          <Tilt key={item._id || i} glareEnable glareMaxOpacity={0.04} scale={1.015} tiltMaxAngleX={4} tiltMaxAngleY={4} className="h-full">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex', flexDirection: 'column', height: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              whileHover={{ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {/* Image */}
              <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#111' }}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                />
                {/* Gradient overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)' }} />

                {/* Type badge */}
                <span style={{
                  position: 'absolute', top: 12, left: 12,
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  color: type.color, background: type.bg, border: `1px solid ${type.border}`,
                  backdropFilter: 'blur(8px)', letterSpacing: '0.05em', textTransform: 'uppercase'
                }}>
                  {type.label}
                </span>

                {/* Category */}
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  color: 'var(--text-2)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  {item.category}
                </span>

                {/* Match score (only when from search) */}
                {item.matchPercentage && (
                  <span style={{
                    position: 'absolute', bottom: 12, right: 12,
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    color: '#F97316', background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
                    backdropFilter: 'blur(8px)'
                  }}>
                    {score}% match
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '16px 18px 18px' }}>
                <h3 style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.5, marginBottom: 14, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flexGrow: 1 }}>
                  {item.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                    <MapPin size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.location?.addressText || item.location || 'Unknown location'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
                    <Calendar size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    <span>{new Date(item.date || item.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <Link
                  to={`/item/${item._id || i}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    padding: '9px 0', borderRadius: 10,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)', fontSize: 13, fontWeight: 500,
                    textDecoration: 'none', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                >
                  View Details <ChevronRight size={14} />
                </Link>
              </div>
            </motion.div>
          </Tilt>
        );
      })}
    </div>
  );
};

export default MatchResultsGrid;
