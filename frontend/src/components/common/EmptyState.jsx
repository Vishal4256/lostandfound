import { Link } from 'react-router-dom'

export default function EmptyState({
  icon = 'inventory_2',
  title = 'No Records Found',
  description = 'No active entries match the requested search parameters or category filters.',
  actionText = 'Report an Item',
  actionLink = '/submit-item',
  onAction = null
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-8 md:p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-xs">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-primary mb-4 shadow-inner">
        <span className="material-symbols-outlined text-[32px] text-primary">{icon}</span>
      </div>
      <h3 className="text-headline-sm font-headline-sm font-bold text-primary mb-2">
        {title}
      </h3>
      <p className="text-body-md font-body-md text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLink ? (
        <Link
          to={actionLink}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-md shadow-sm active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>{actionText}</span>
        </Link>
      ) : onAction ? (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-md shadow-sm active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          <span>{actionText}</span>
        </button>
      ) : null}
    </div>
  )
}
