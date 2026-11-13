import { getStatusMeta } from '../../utils/formatters'

export default function StatusBadge({ status, type, className = '', showExplanation = false }) {
  const meta = getStatusMeta(status, type)

  return (
    <div className="inline-flex flex-col">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold border shadow-2xs ${meta.badgeClass} ${className}`}
      >
        <span className="material-symbols-outlined text-[15px] material-symbols-filled">
          {meta.icon}
        </span>
        <span>{meta.label}</span>
      </span>
      {showExplanation && (
        <span className="text-[12px] text-on-surface-variant mt-1 pl-1">
          {meta.description}
        </span>
      )}
    </div>
  )
}
