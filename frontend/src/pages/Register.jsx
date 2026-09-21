import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Eye, EyeOff, MapPin, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState('')

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    if (errorBanner) setErrorBanner('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorBanner('')

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setErrorBanner('Please fill in all required fields.')
      return
    }

    if (form.password.length < 6) {
      setErrorBanner('Password must be at least 6 characters long.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setErrorBanner('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(form.name.trim(), form.email.trim(), form.password)
      toast.success('Account created successfully! Welcome to FindIt.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.'
      setErrorBanner(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 20%, #1e1b4b 0%, #09090b 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(17, 17, 19, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 30px 70px -15px rgba(0,0,0,0.8), 0 0 40px rgba(99, 102, 241, 0.12)'
        }}
      >
        {/* Top Gradient Ribbon */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #6366f1, #ec4899, #f97316)' }} />

        <div style={{ padding: '36px 32px' }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 26, justifyContent: 'center' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}>
              <MapPin size={20} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22, color: '#fafafa', letterSpacing: '-0.03em' }}>
              FindIt <span style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: 999 }}>AI</span>
            </span>
          </Link>

          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: '#fafafa', marginBottom: 6, letterSpacing: '-0.02em', textAlign: 'center' }}>
            Create an Account
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Join the community to report items, track claims, and chat directly
          </p>

          {/* Error Banner */}
          {errorBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                marginBottom: 20
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>{errorBanner}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Full Name
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChange('name')}
                  placeholder="Alex Doe"
                  required
                  style={{
                    width: '100%',
                    background: '#141417',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    padding: '12px 14px 12px 42px',
                    color: '#fafafa',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#27272a'}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="alex@example.com"
                  required
                  style={{
                    width: '100%',
                    background: '#141417',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    padding: '12px 14px 12px 42px',
                    color: '#fafafa',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#27272a'}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Password (min. 6 characters)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    background: '#141417',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    padding: '12px 42px 12px 42px',
                    color: '#fafafa',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#27272a'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 14, background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, color: '#71717a', pointerEvents: 'none' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    background: '#141417',
                    border: '1px solid #27272a',
                    borderRadius: 12,
                    padding: '12px 42px 12px 42px',
                    color: '#fafafa',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#6366f1'}
                  onBlur={e => e.target.style.borderColor = '#27272a'}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '13px 0',
                borderRadius: 12,
                background: loading ? '#312e81' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.15s'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#71717a', fontSize: 13, marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
