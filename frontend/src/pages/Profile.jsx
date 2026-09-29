import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user } = useAuth()
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-label-sm font-label-sm text-outline uppercase tracking-wider mb-1">
          <span>CIVIC CREDENTIALS &amp; PROFILE</span>
        </div>
        <h1 className="text-headline-xl-mobile md:text-headline-lg font-headline-lg font-bold text-primary">
          Citizen Registry Account
        </h1>
        <p className="text-body-md font-body-md text-on-surface-variant">
          Your municipal verification identity and secure property recovery profile.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary text-secondary-fixed flex items-center justify-center font-bold text-headline-lg shadow-sm">
            {userInitial}
          </div>
          <div className="space-y-1 text-center sm:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-headline-sm font-headline-sm font-bold text-primary">{user?.name}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-label-sm font-label-sm font-bold border border-secondary-fixed">
                {user?.role === 'admin' ? 'MUNICIPAL ADMINISTRATOR' : 'VERIFIED CITIZEN'}
              </span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">{user?.email}</p>
            <p className="text-label-sm font-label-sm text-outline pt-1">
              Public Safety ID: #{user?._id || 'REGISTRATION-PENDING'}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-body-sm hover:bg-primary-container transition-colors shrink-0"
          >
            Go to Registry Desk
          </Link>
        </div>

        <div className="border-t border-outline-variant/60 pt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm font-body-sm">
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-1">
            <span className="text-label-sm font-label-sm text-outline uppercase block">IDENTITY VERIFICATION</span>
            <p className="text-primary font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
              <span>Level 2 Certified Resident</span>
            </p>
            <p className="text-on-surface-variant text-[12px]">Eligible for direct in-person transit custody handovers.</p>
          </div>

          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/50 space-y-1">
            <span className="text-label-sm font-label-sm text-outline uppercase block">DATA PRIVACY SHIELD</span>
            <p className="text-primary font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
              <span>Zero-Knowledge Verification</span>
            </p>
            <p className="text-on-surface-variant text-[12px]">Phone numbers and residential addresses are never stored publicly.</p>
          </div>
        </div>
      </div>

      {/* Statutory Guidelines Box */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant p-6 space-y-3">
        <h3 className="font-headline-sm text-headline-sm font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">gavel</span>
          <span>Statutory Property Return Regulations</span>
        </h3>
        <p className="text-body-sm font-body-sm text-on-surface-variant leading-relaxed">
          Under Metropolitan Administrative Code Section 48-B, surrendered property held in municipal depositories must be claimed with valid photo identification. Falsified ownership claims are subject to municipal fines.
        </p>
      </div>
    </div>
  )
}
