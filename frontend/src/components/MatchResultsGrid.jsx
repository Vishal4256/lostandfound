import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'
import { formatLocation } from '../utils/formatters'

export default function MatchResultsGrid({ results, onClear }) {
  if (!results || results.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-10 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-outline mx-auto mb-3">
          <span className="material-symbols-outlined text-[28px]">search_off</span>
        </div>
        <h3 className="text-headline-sm font-headline-sm font-bold text-primary mb-1">
          No Vector Matches Detected
        </h3>
        <p className="text-body-sm font-body-sm text-on-surface-variant max-w-sm mx-auto mb-5">
          The image vectors did not correlate with any currently open lost or found incidents with sufficient confidence threshold.
        </p>
        {onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-body-sm transition-colors"
          >
            Clear Search &amp; View All Records
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-low rounded-2xl border border-secondary/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-fixed-variant flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-headline-sm font-bold text-primary">
                AI Vector Match Telemetry
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-label-sm font-label-sm font-semibold">
                {results.length} Candidates Found
              </span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              Results ranked by cosine similarity against local 512-dimensional CLIP embeddings.
            </p>
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-sm transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            <span>Reset Vector Filter</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((item, i) => {
          const itemType = (item.type || item.itemType || 'found').toLowerCase()
          const caseId = (item._id || '').slice(-4).toUpperCase()
          const DEFAULT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='none'%3E%3Crect width='400' height='300' fill='%23F1F5F9'/%3E%3Ccircle cx='200' cy='150' r='30' stroke='%2394A3B8' stroke-width='3'/%3E%3Ctext x='200' y='210' font-family='system-ui, sans-serif' font-size='12' font-weight='500' fill='%2364748B' text-anchor='middle'%3ENo Incident Photo Filed%3C/text%3E%3C/svg%3E"
          const imageUrl = item.imageUrl || (item.images && item.images[0]) || DEFAULT_PLACEHOLDER

          return (
            <article
              key={item._id || i}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group h-full ring-1 ring-secondary/20"
            >
              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[4/3] bg-surface-container-high overflow-hidden">
                <img
                  src={imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                <div className="absolute top-3 left-3">
                  <StatusBadge status={item.status} type={itemType} />
                </div>

                {/* Real Similarity Score Pill */}
                {score !== null && (
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-primary/90 text-secondary-fixed backdrop-blur-md text-label-sm font-label-sm font-bold flex items-center gap-1 shadow-md border border-secondary/30">
                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                    <span>{score}% Affinity Match</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-body-sm font-body-sm text-outline mb-1">
                    <span className="text-label-sm font-label-sm uppercase">{item.category || 'Item'} • CASE #{caseId}</span>
                    <span className="text-label-sm font-label-sm text-secondary font-semibold">Rank #{i + 1}</span>
                  </div>
                  <h3 className="text-headline-sm font-headline-sm text-primary group-hover:text-secondary transition-colors line-clamp-1 font-bold">
                    <Link to={`/item/${item._id}`}>{item.title}</Link>
                  </h3>
                  <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 line-clamp-2">
                    {item.description || 'Matched against municipal visual index.'}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-body-sm font-body-sm text-on-surface-variant truncate">
                    <span className="material-symbols-outlined text-secondary text-body-md shrink-0">location_on</span>
                    <span className="truncate">{formatLocation(item.location, 'Metropolitan Area')}</span>
                  </div>
                  <Link
                    to={`/item/${item._id}`}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-body-sm font-semibold active:scale-[0.98] transition-colors"
                  >
                    View Match Case
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
