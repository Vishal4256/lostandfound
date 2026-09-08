import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, LayoutGrid, User, Menu, X, MapPin } from 'lucide-react'

const Navbar = () => {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = (p) => pathname === p

  const links = [
    { to: '/', label: 'Browse', icon: LayoutGrid },
    { to: '/profile', label: 'My Reports', icon: User },
  ]

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 32 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <MapPin size={17} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, color: 'var(--text)', letterSpacing: '-0.03em' }}>
              FindIt
            </span>
          </Link>

          {/* Desktop nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} className="hidden-mobile">
            {links.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                color: active(to) ? 'var(--text)' : 'var(--text-2)',
                background: active(to) ? 'var(--bg-card)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s'
              }}>
                {label}
              </Link>
            ))}
          </nav>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/add-item')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 10,
                background: 'var(--accent)', color: 'white',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                transition: 'opacity 0.15s, transform 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Report Item
            </button>
            <button onClick={() => setOpen(v => !v)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 6 }} className="show-mobile">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <style>{`
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 49, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 24px 16px' }}>
            {links.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
                color: active(to) ? 'var(--accent)' : 'var(--text-2)',
                background: active(to) ? 'var(--accent-dim)' : 'transparent',
                textDecoration: 'none', fontWeight: 500, fontSize: 15, marginBottom: 4
              }}>
                <Icon size={18} /> {label}
              </Link>
            ))}
            <Link to="/add-item" onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 10, background: 'var(--accent)', color: 'white',
              textDecoration: 'none', fontWeight: 600, fontSize: 15, marginTop: 8
            }}>
              <Plus size={18} /> Report Item
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Navbar
