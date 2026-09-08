import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, User, Menu, X, MapPin, LogOut, LogIn } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const Navbar = () => {
  const [open, setOpen] = useState(false)
  const [profileDropdown, setProfileDropdown] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const active = (p) => pathname === p

  const links = [
    { to: '/', label: 'Browse', icon: LayoutGrid },
    { to: '/profile', label: 'My Reports & Chats', icon: User },
  ]

  const handleLogout = () => {
    logout()
    setProfileDropdown(false)
    navigate('/')
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,11,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 28 }}>
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

          {/* Desktop nav links */}
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

          {/* Right action area */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/add-item')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 10,
                background: 'var(--accent)', color: 'white',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
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

            {/* Auth section */}
            {isAuthenticated ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 20, padding: '4px 10px 4px 5px',
                    cursor: 'pointer', color: 'var(--text)'
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'var(--accent)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 12
                  }}>
                    {userInitial}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || 'Account'}
                  </span>
                </button>

                <AnimatePresence>
                  {profileDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 6 }}
                      style={{
                        position: 'absolute', right: 0, top: '100%', marginTop: 8,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 14, padding: 6, minWidth: 170,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 60
                      }}
                    >
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user?.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdown(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          color: 'var(--text)', textDecoration: 'none', fontWeight: 500
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <User size={14} /> My Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          color: '#EF4444', background: 'none', border: 'none',
                          cursor: 'pointer', textAlign: 'left', fontWeight: 500, fontFamily: 'Inter, sans-serif'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 9,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                  transition: 'border-color 0.15s'
                }}
              >
                <LogIn size={15} /> Sign In
              </Link>
            )}

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
