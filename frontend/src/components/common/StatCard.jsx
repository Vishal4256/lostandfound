export default function StatCard({ label, value, subtext, icon, trend, color = 'primary' }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-label-sm font-label-sm text-outline uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        )}
      </div>
      <div className="my-1">
        <p className={`text-headline-md font-headline-md font-bold ${color === 'secondary' ? 'text-secondary' : 'text-primary'}`}>
          {value}
        </p>
      </div>
      {subtext && (
        <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1 mt-1">
          {trend && <span className="text-secondary font-bold font-label-sm">{trend}</span>}
          <span>{subtext}</span>
        </p>
      )}
    </div>
  )
}
