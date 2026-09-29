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
