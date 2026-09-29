import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-6 py-16 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#091426_1px,transparent_1px)] [background-size:16px_16px]"></div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Civic Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim text-label-sm font-label-sm font-semibold">
          <span className="material-symbols-outlined text-[16px]">search_off</span>
          <span>INCIDENT CODE: ERR_NOT_FOUND_404</span>
        </div>

        {/* Big 404 Graphic / Label */}
        <div className="relative">
          <p className="text-[100px] sm:text-[120px] font-bold text-surface-container-high leading-none select-none tracking-tighter">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-md flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[32px] text-secondary">explore_off</span>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
            Lost in Transit
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant mt-2 leading-relaxed">
            The civic dossier, page, or municipal directory record you are searching for does not exist or has been relocated to archives.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-md shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            <span>Return to Directory</span>
          </Link>
          <Link
            to="/submit-item"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant text-primary font-semibold text-body-md shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">add_circle</span>
            <span>Report an Item</span>
          </Link>
        </div>

        <p className="text-label-sm font-label-sm text-outline pt-4">
          HavenFind Metropolitan Property Recovery Network &bull; Secure Routing Active
        </p>
      </div>
    </div>
  )
}
