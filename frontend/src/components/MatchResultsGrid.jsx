import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import Tilt from 'react-parallax-tilt';

const TYPE_STYLES = {
  lost: { label: 'Lost', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
  found: { label: 'Found', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' },
};

const MatchResultsGrid = ({ results }) => {
  if (!results || results.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', borderRadius: 20, border: '2px dashed rgba(255, 255, 255, 0.1)',
        background: 'rgba(18, 18, 22, 0.6)', textAlign: 'center'
      }}>
        <AlertCircle size={36} color="#71717a" style={{ marginBottom: 12 }} />
        <p style={{ color: '#fafafa', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No Visual Matches Found</p>
        <p style={{ color: '#a1a1aa', fontSize: 13, maxWidth: 320 }}>
          Try uploading a clearer image or search with different lighting or angle.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
      {results.map((item, i) => {
        const itemType = (item.type || item.itemType || 'found').toLowerCase();
        const type = TYPE_STYLES[itemType] || TYPE_STYLES.found;
        const matchScore = typeof item.matchPercentage === 'number' ? item.matchPercentage : null;

        return (
          <Tilt key={item._id || i} glareEnable glareMaxOpacity={0.05} scale={1.015} tiltMaxAngleX={4} tiltMaxAngleY={4} className="h-full">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: 'flex', flexDirection: 'column', height: '100%',
                background: 'rgba(18, 18, 22, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {/* Thumbnail Container */}
              <div style={{ position: 'relative', height: 190, overflow: 'hidden', background: '#09090b' }}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />

                {/* Type badge */}
                <span style={{
                  position: 'absolute', top: 12, left: 12,
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  color: type.color, background: type.bg, border: `1px solid ${type.border}`,
                  backdropFilter: 'blur(8px)', letterSpacing: '0.04em', textTransform: 'uppercase'
                }}>
                  {type.label}
                </span>

                {/* Category */}
                <span style={{
                  position: 'absolute', top: 12, right: 12,
                  padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  color: '#e4e4e7', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {item.category}
                </span>

                {/* Real AI vector similarity match score */}
                {matchScore !== null && (
                  <span style={{
                    position: 'absolute', bottom: 12, right: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                    color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.4)', border: '1px solid rgba(99, 102, 241, 0.5)',
                    backdropFilter: 'blur(8px)'
                  }}>
                    <Sparkles size={12} color="#818cf8" />
                    {matchScore}% match
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '18px 20px' }}>
                <h3 style={{ color: '#fafafa', fontWeight: 700, fontSize: 16, marginBottom: 6, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#a1a1aa', fontSize: 13, lineHeight: 1.5, marginBottom: 14, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', flexGrow: 1 }}>
                  {item.description || 'No additional details provided.'}
                </p>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 12 }}>
                    <MapPin size={13} style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.location?.addressText || 'Location recorded'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#71717a', fontSize: 12 }}>
                      <Calendar size={13} />
                      <span>{new Date(item.date || item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Link
                      to={`/item/${item._id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: '#818cf8',
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      <span>View Details</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </Tilt>
        );
      })}
    </div>
  );
};

export default MatchResultsGrid;
