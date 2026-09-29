import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState('')

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errorBanner) setErrorBanner('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorBanner('')

    if (!form.name.trim()) {
      setErrorBanner('Please provide your legal or preferred citizen name.')
      return
    }

    if (!form.email.trim()) {
      setErrorBanner('Please provide a valid email address.')
      return
    }

    if (form.password.length < 6) {
      setErrorBanner('Password must be at least 6 characters in length.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setErrorBanner('Passwords do not match. Please verify.')
      return
    }

    setLoading(true)
    try {
      await register(form.name.trim(), form.email.trim(), form.password)
      toast.success('Citizen registration complete! Welcome to HavenFind.')
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed'
      setErrorBanner(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#091426_1px,transparent_1px)] [background-size:16px_16px]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Brand Logo */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-secondary-fixed shadow-sm">
              <span className="material-symbols-outlined text-[26px] material-symbols-filled">travel_explore</span>
            </div>
            <div className="text-left">
              <span className="text-headline-md font-headline-md font-bold text-primary block leading-tight">HavenFind</span>
              <span className="text-label-sm font-label-sm text-outline tracking-wider text-[11px]">CIVIC PORTAL</span>
            </div>
          </Link>
          <h2 className="mt-4 text-headline-sm font-headline-sm font-bold text-primary">
            Create Citizen Registry Account
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
            Join the municipal property recovery and safe custody verification network.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface-container-lowest py-8 px-6 sm:px-10 shadow-lg rounded-2xl border border-outline-variant space-y-5">
          {errorBanner && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-body-sm font-body-sm flex items-start gap-2.5 border border-error/20">
              <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">error</span>
              <span>{errorBanner}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5" htmlFor="name">
                Full Legal Name
              </label>
              <div className="relative">
                <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                  badge
                </span>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange('name')}
                  placeholder="Jane Citizen"
                  className="w-full pl-10 pr-4 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5" htmlFor="email">
                Contact Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="resident@city.gov or user@email.com"
                  className="w-full pl-10 pr-4 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                  lock
                </span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-11 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary p-1"
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                  lock_reset
                </span>
                <input
                  id="confirmPassword"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-4 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-semibold text-body-md transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Registering Citizen Record...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Civic Enrollment</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-outline-variant text-center space-y-3">
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Already have an official account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign In Instead
              </Link>
            </p>

            <div className="flex items-center justify-center gap-2 text-label-sm font-label-sm text-outline">
              <span className="material-symbols-outlined text-[14px]">gavel</span>
              <span>Governed by Metropolitan Safety Code Sec. 48-B</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
