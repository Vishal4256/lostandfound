import { Link, useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { formatLocation, formatTimeAgo } from '../../utils/formatters'
import { useAuth } from '../../context/AuthContext'

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='none'%3E%3Crect width='400' height='300' fill='%23F1F5F9'/%3E%3Cpath d='M180 130C180 124.477 184.477 120 190 120H210C215.523 120 220 124.477 220 130V135H235C240.523 135 245 139.477 245 145V185C245 190.523 240.523 195 235 195H165C159.477 195 155 190.523 155 185V145C155 139.477 159.477 135 165 135H180V130Z' stroke='%2394A3B8' stroke-width='3' stroke-linejoin='round'/%3E%3Ccircle cx='200' cy='165' r='16' stroke='%2394A3B8' stroke-width='3'/%3E%3Ctext x='200' y='225' font-family='system-ui, sans-serif' font-size='12' font-weight='500' fill='%2364748B' text-anchor='middle'%3ENo Incident Photo Filed%3C/text%3E%3C/svg%3E"

export default function ItemCard({ item, viewMode = 'grid' }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  if (!item) return null

  const itemType = (item.type || item.itemType || 'found').toLowerCase()
  const caseId = (item._id || '').slice(-4).toUpperCase()
  const timeDisplay = formatTimeAgo(item.createdAt || item.date)
  const locationText = formatLocation(item.location, 'Metropolitan Area')
  const imageUrl = item.imageUrl || (item.images && item.images[0]) || DEFAULT_IMAGE

  const handleActionClick = (e) => {
    e.stopPropagation()
    const action = itemType === 'found' ? 'claim' : 'sighting'
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: { pathname: `/item/${item._id}`, search: `?action=${action}` } }
      })
    } else {
      navigate(`/item/${item._id}?action=${action}`)
    }
  }

  const handleImageError = (e) => {
    e.currentTarget.onerror = null
    e.currentTarget.src = DEFAULT_IMAGE
  }

  if (viewMode === 'list') {
    return (
      <article className="bevel-box rounded-xl border border-outline-variant overflow-hidden hover:border-primary transition-all duration-200">
        <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex flex-wrap items-center justify-between gap-2 text-label-sm font-label-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-label-md">CASE #LF-{caseId}</span>
            <StatusBadge status={item.status} type={itemType} />
            <span className="text-outline hidden sm:inline">|</span>
            <span className="text-on-surface-variant hidden sm:inline uppercase">{item.category || 'General'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-[15px]">schedule</span>
            <span>{timeDisplay}</span>
          </div>
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-4 items-start">
          <div className="w-full md:w-44 h-32 flex-shrink-0 bg-surface-container rounded-lg border border-outline-variant overflow-hidden relative">
            <img
              src={imageUrl}
              alt={item.title}
              onError={handleImageError}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute bottom-1 right-1 bg-primary text-white text-[10px] font-label-sm px-1.5 py-0.5 rounded opacity-90">
              ID: #{caseId}
            </span>
          </div>
          <div className="flex-1 space-y-2 w-full">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-headline-sm text-headline-sm font-bold text-primary hover:text-secondary transition-colors">
                  <Link to={`/item/${item._id}`}>{item.title}</Link>
                </h3>
                <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 line-clamp-2">
                  {item.description || 'No additional municipal remarks filed.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-label-sm font-label-sm border-t border-outline-variant bg-surface-container-lowest">
              <div>
                <span className="text-outline block text-[10px]">RECOVERY PREMISES</span>
                <span className="text-on-surface truncate block">{locationText}</span>
              </div>
              <div>
                <span className="text-outline block text-[10px]">CATEGORY</span>
                <span className="text-primary font-semibold block">{item.category || 'General'}</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-outline block text-[10px]">STATUS</span>
                <span className="text-secondary font-bold block">{item.status || 'Active'}</span>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-surface-variant truncate">
                <span className="material-symbols-outlined text-secondary text-body-md shrink-0">location_on</span>
                <span className="truncate">{locationText}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-body-sm font-semibold active:scale-[0.98] transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{itemType === 'found' ? 'Verify & Claim' : 'I Saw This'}</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    )
  }

  // Grid / Bento view (Default matching HTML reference)
  return (
    <article className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group h-full">
      {/* Thumbnail Aspect Container (4:3) */}
      <Link to={`/item/${item._id}`} className="relative w-full aspect-[4/3] bg-surface-container-high overflow-hidden block">
        <img
          src={imageUrl}
          alt={item.title}
          onError={handleImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={item.status} type={itemType} />
        </div>
        {/* Case ID Overlay */}
        <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md bg-primary/80 backdrop-blur-md text-on-primary text-label-sm font-label-sm">
          Case #{caseId}
        </div>
      </Link>

      {/* Item Details */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-body-sm font-body-sm text-outline mb-1">
            <span className="text-label-sm font-label-sm uppercase">{item.category || 'Item'} • #{caseId}</span>
            <span className="text-label-sm font-label-sm">{timeDisplay}</span>
          </div>
          <h3 className="text-headline-sm font-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-1 font-bold">
            <Link to={`/item/${item._id}`}>{item.title}</Link>
          </h3>
          <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 line-clamp-2">
            {item.description || 'Turned into municipal custody. File includes physical verification markers.'}
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-outline-variant/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-surface-variant truncate">
            <span className="material-symbols-outlined text-secondary text-body-md shrink-0">location_on</span>
            <span className="truncate">{locationText}</span>
          </div>
          <button
            type="button"
            onClick={handleActionClick}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-body-sm font-semibold active:scale-[0.98] transition-colors cursor-pointer"
          >
            {itemType === 'found' ? 'Verify & Claim' : 'I Saw This'}
          </button>
        </div>
      </div>
    </article>
  )
}
