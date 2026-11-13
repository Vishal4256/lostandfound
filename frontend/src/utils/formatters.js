/**
 * Formats item location safely whether it's a string, an object { addressText, coordinates }, or undefined.
 */
export function formatLocation(loc, fallback = 'Civic Center') {
  if (!loc) return fallback
  if (typeof loc === 'string') return loc.trim() || fallback
  if (typeof loc === 'object') {
    return loc.addressText || loc.name || loc.city || loc.district || fallback
  }
  return String(loc)
}

/**
 * Safely extracts a searchable location string for filtering
 */
export function getLocationSearchText(loc) {
  if (!loc) return ''
  if (typeof loc === 'string') return loc.toLowerCase()
  if (typeof loc === 'object') {
    return (loc.addressText || loc.name || loc.city || loc.district || '').toLowerCase()
  }
  return String(loc).toLowerCase()
}

/**
 * Format relative date or fall back to standard date string
 */
export function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Recently'
  try {
    const d = new Date(dateStr)
    const diffMin = Math.floor((Date.now() - d.getTime()) / (1000 * 60))
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin} mins ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
    return d.toLocaleDateString()
  } catch {
    return 'Recently'
  }
}

/**
 * Human-readable status definitions and theme metadata
 */
export function getStatusMeta(status, type) {
  const normStatus = (status || '').toLowerCase().replace(/_/g, ' ')
  const normType = (type || '').toLowerCase()

  if (normStatus === 'closed') {
    return {
      label: 'Case Closed',
      description: 'This case has been completed and archived.',
      badgeClass: 'bg-surface-container text-on-surface-variant border-outline-variant',
      icon: 'archive'
    }
  }

  if (normStatus === 'resolved' || normStatus === 'reunited') {
    return {
      label: 'Successfully Reunited',
      description: 'This item has been returned to its rightful owner.',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: 'check_circle'
    }
  }

  if (normStatus === 'handover pending' || normStatus === 'ready for handover') {
    return {
      label: 'Ready for Handover',
      description: 'Ownership verified. Coordinator and owner are arranging return.',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      icon: 'handshake'
    }
  }

  if (normStatus.includes('pending') || normStatus === 'under review') {
    return {
      label: 'Claim Under Review',
      description: 'An ownership claim has been submitted and is awaiting verification.',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: 'hourglass_top'
    }
  }

  if (normType === 'found') {
    return {
      label: 'Found – Waiting for Owner',
      description: 'Turned in by a finder. Waiting for the owner to claim.',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: 'verified'
    }
  }

  return {
    label: 'Lost – Waiting for a Match',
    description: 'Reported lost. Scanning directory for matching found reports.',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    icon: 'search'
  }
}
