import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()

  const [mode, setMode] = useState('login')
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(form.email, form.password)
        toast.success('Welcome back!')
      } else {
        await register(form.name, form.email, form.password)
        toast.success('Account created! Welcome to FindIt.')
      }
      const destination = location.state?.from?.pathname || '/'
      navigate(destination, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const inputWrap = { position: 'relative', display: 'flex', alignItems: 'center' }
  const inputSt = {
    width: '100%', background: '#111113', border: '1px solid #27272A',
    borderRadius: 10, padding: '12px 14px', color: '#FAFAFA', fontSize: 14,
    outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 400, background: '#111113', border: '1px solid #27272A', borderRadius: 22, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>

        {/* Top accent */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #F97316, #EF4444, #8B5CF6)' }} />

        <div style={{ padding: 36 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32, justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={18} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 20, color: '#FAFAFA', letterSpacing: '-0.03em' }}>FindIt</span>
          </Link>

          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: '#FAFAFA', marginBottom: 4, letterSpacing: '-0.03em', textAlign: 'center' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color: '#71717A', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
            {mode === 'login' ? 'Sign in to manage your reports & chats' : 'Join to connect with your community'}
          </p>

          {/* Toggle */}
          <div style={{ display: 'flex', gap: 4, background: '#09090B', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {[['login', 'Sign In'], ['signup', 'Sign Up']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setMode(val)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                background: mode === val ? '#18181B' : 'transparent',
                color: mode === val ? '#FAFAFA' : '#71717A',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                boxShadow: mode === val ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
                transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Full Name</label>
                <input value={form.name} onChange={set('name')} placeholder="Your full name" required={mode === 'signup'} style={inputSt} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Email</label>
              <div style={inputWrap}>
                <Mail size={15} style={{ position: 'absolute', left: 13, color: '#52525B', pointerEvents: 'none' }} />
                <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required style={{ ...inputSt, paddingLeft: 38 }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Password</label>
              <div style={inputWrap}>
                <Lock size={15} style={{ position: 'absolute', left: 13, color: '#52525B', pointerEvents: 'none', zIndex: 1 }} />
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••" required style={{ ...inputSt, paddingLeft: 38, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: '#52525B', cursor: 'pointer', display: 'flex', padding: 0 }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              padding: '13px 0', borderRadius: 11, background: loading ? '#27272A' : '#F97316',
              color: loading ? '#52525B' : 'white', border: 'none', fontWeight: 700, fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              marginTop: 6, boxShadow: loading ? 'none' : '0 4px 20px rgba(249,115,22,0.3)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              {loading ? <><div style={{ width: 16, height: 16, border: '2px solid #52525B', borderTopColor: '#A1A1AA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Processing…</> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#52525B', fontSize: 12, marginTop: 22 }}>
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 'none', color: '#F97316', cursor: 'pointer', fontWeight: 600, fontSize: 12, padding: 0, fontFamily: 'Inter, sans-serif' }}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </motion.div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
