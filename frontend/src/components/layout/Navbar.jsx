import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, User, Menu, X, MapPin, LogOut, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const Navbar = () => {
  const [open, setOpen] = useState(false)
  const [profileDropdown, setProfileDropdown] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const active = (p) => pathname === p

  const links = [
    { to: '/', label: 'Browse Feed', icon: LayoutGrid },
    { to: '/dashboard', label: 'Dashboard', icon: User, protected: true }
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
        background: 'rgba(9, 9, 11, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 64, gap: 28 }}>
          {/* Brand Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
            }}>
              <MapPin size={18} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 18, color: '#fafafa', letterSpacing: '-0.03em' }}>
              FindIt <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: 6 }}>AI</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }} className="hidden-mobile">
            {links.map(({ to, label, protected: isProt }) => {
              if (isProt && !isAuthenticated) return null
              return (
                <Link key={to} to={to} style={{
                  padding: '7px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  color: active(to) ? '#fafafa' : '#a1a1aa',
                  background: active(to) ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.15s'
                }}>
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Action Area */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/submit-item')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
                border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Plus size={16} strokeWidth={2.5} />
              Report Item
            </button>

            {/* Auth Section */}
            {isAuthenticated ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileDropdown(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    background: '#18181b', border: '1px solid #27272a',
                    borderRadius: 999, padding: '4px 12px 4px 5px',
                    cursor: 'pointer', color: '#fafafa'
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
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
                        background: '#121216', border: '1px solid #27272a',
                        borderRadius: 16, padding: 6, minWidth: 190,
                        boxShadow: '0 15px 40px rgba(0,0,0,0.6)', zIndex: 60
                      }}
                    >
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid #27272a', marginBottom: 4 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', margin: 0 }}>{user?.name}</p>
                        <p style={{ fontSize: 11, color: '#71717a', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                      </div>
                      <Link
                        to="/dashboard"
                        onClick={() => setProfileDropdown(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          color: '#fafafa', textDecoration: 'none', fontWeight: 500
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1e1e24'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <User size={14} /> My Dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 8, fontSize: 13,
                          color: '#ef4444', background: 'none', border: 'none',
                          cursor: 'pointer', textAlign: 'left', fontWeight: 500
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link
                  to="/login"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fafafa', textDecoration: 'none', fontSize: 13, fontWeight: 600
                  }}
                >
                  <LogIn size={15} /> Sign In
                </Link>
                <Link
                  to="/register"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10,
                    background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#818cf8', textDecoration: 'none', fontSize: 13, fontWeight: 600
                  }}
                >
                  <UserPlus size={15} /> Register
                </Link>
              </div>
            )}

            <button onClick={() => setOpen(v => !v)} style={{ display: 'none', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 6 }} className="show-mobile">
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

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 49, background: '#121216', borderBottom: '1px solid #27272a', padding: '16px 24px' }}>
            <Link to="/" onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
              color: '#fafafa', textDecoration: 'none', fontWeight: 600, fontSize: 15, marginBottom: 6
            }}>
              <LayoutGrid size={18} /> Browse Feed
            </Link>
            {isAuthenticated && (
              <Link to="/dashboard" onClick={() => setOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
                color: '#fafafa', textDecoration: 'none', fontWeight: 600, fontSize: 15, marginBottom: 6
              }}>
                <User size={18} /> My Dashboard
              </Link>
            )}
            <Link to="/submit-item" onClick={() => setOpen(false)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
              textDecoration: 'none', fontWeight: 700, fontSize: 15, marginTop: 10
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
