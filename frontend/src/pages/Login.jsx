import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, resetPassword } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState('')

  // Password reset modal states
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showResetPass, setShowResetPass] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errorBanner) setErrorBanner('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorBanner('')

    if (!form.email.trim() || !form.password) {
      setErrorBanner('Please provide both email and password.')
      return
    }

    setLoading(true)
    try {
      await login(form.email.trim(), form.password)
      toast.success('Authenticated to civic network')
      const fromObj = location.state?.from
      const destination = fromObj
        ? (typeof fromObj === 'string' ? fromObj : `${fromObj.pathname || '/dashboard'}${fromObj.search || ''}`)
        : '/dashboard'
      navigate(destination, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password'
      setErrorBanner(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReset = () => {
    setResetEmail(form.email.trim())
    setNewPassword('')
    setConfirmPassword('')
    setResetError('')
    setShowResetModal(true)
  }

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    setResetError('')

    if (!resetEmail.trim()) {
      setResetError('Please enter your registered email address.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setResetError('New password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    setResetLoading(true)
    try {
      await resetPassword(resetEmail.trim(), newPassword)
      toast.success('Password updated successfully! You can now sign in.')
      setForm((prev) => ({ ...prev, email: resetEmail.trim(), password: newPassword }))
      setShowResetModal(false)
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password.'
      setResetError(msg)
    } finally {
      setResetLoading(false)
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
            Citizen Registry Sign In
          </h2>
          <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
            Access case dossiers, file claims, and coordinate property returns.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-surface-container-lowest py-8 px-6 sm:px-10 shadow-lg rounded-2xl border border-outline-variant space-y-6">
          {errorBanner && (
            <div className="p-3.5 rounded-xl bg-error-container text-on-error-container text-body-sm font-body-sm flex items-start gap-2.5 border border-error/20">
              <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">error</span>
              <span>{errorBanner}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-md font-label-md text-primary font-semibold mb-1.5" htmlFor="email">
                Registered Email Address
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
                  placeholder="resident@city.gov or citizen@email.com"
                  className="w-full pl-10 pr-4 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-label-md font-label-md text-primary font-semibold" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                  lock
                </span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 text-body-md font-body-md bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Password Reset action placed directly below password */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenReset}
                  className="text-label-sm font-medium text-primary hover:text-primary/80 hover:underline flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">lock_reset</span>
                  <span>Forgot or Reset Password?</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-semibold text-body-md transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Registry</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-outline-variant text-center space-y-3">
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Don't have a civic account?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline">
                Register Citizen Profile
              </Link>
            </p>

            <div className="flex items-center justify-center gap-2 text-label-sm font-label-sm text-outline">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span>256-Bit Encrypted Municipal Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">lock_reset</span>
                </div>
                <div>
                  <h3 className="text-title-md font-bold text-primary">Reset Password</h3>
                  <p className="text-body-xs text-on-surface-variant">Choose a new password for your account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                aria-label="Close reset modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm flex items-start gap-2 border border-error/20">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">error</span>
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="resident@city.gov or citizen@email.com"
                    className="w-full pl-10 pr-4 py-2.5 text-body-sm bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                    key
                  </span>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-10 py-2.5 text-body-sm bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary p-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showResetPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-semibold text-primary mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-outline absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]">
                    check_circle
                  </span>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-4 py-2.5 text-body-sm bg-surface text-on-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container font-medium text-body-sm cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary font-semibold text-body-sm transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {resetLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
