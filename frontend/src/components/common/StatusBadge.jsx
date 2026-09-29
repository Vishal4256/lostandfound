export default function StatusBadge({ status, type, className = '' }) {
  const normStatus = (status || '').toLowerCase()
  const normType = (type || '').toLowerCase()

  if (normStatus === 'resolved') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm border border-outline-variant font-semibold ${className}`}>
        <span className="material-symbols-outlined text-[13px] material-symbols-filled">check_circle</span>
        RESOLVED / REUNITED
      </span>
    )
  }

  if (normStatus.includes('pending') || normStatus === 'under_review') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-sm text-label-sm border border-tertiary-fixed-dim font-semibold ${className}`}>
        <span className="material-symbols-outlined text-[13px]">pending</span>
        CLAIM PENDING
      </span>
    )
  }

  if (normType === 'found') {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant font-label-sm text-label-sm border border-secondary-fixed font-semibold ${className}`}>
        <span className="material-symbols-outlined text-[13px] material-symbols-filled">verified</span>
        FOUND / IN CUSTODY
      </span>
    )
  }

  // Default: Lost
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant font-label-sm text-label-sm border border-tertiary-fixed-dim font-semibold ${className}`}>
      <span className="material-symbols-outlined text-[13px]">fmd_bad</span>
      LOST REPORT
    </span>
  )
}
