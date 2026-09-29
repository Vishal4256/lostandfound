import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-surface-container-low border-t border-outline-variant mt-auto">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Brand & Civic Copyright */}
        <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-secondary-fixed shadow-xs">
              <span className="material-symbols-outlined text-[20px] material-symbols-filled">travel_explore</span>
            </div>
            <span className="text-headline-sm font-headline-sm font-bold text-primary">HavenFind</span>
          </div>
          <p className="text-body-sm font-body-sm text-on-surface-variant max-w-md">
            &copy; 2024 HavenFind Civic Lost &amp; Found Network. Dedicated to community relief and municipal property recovery.
          </p>
          <div className="flex items-center gap-3 text-label-sm font-label-sm text-outline pt-1">
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">accessibility_new</span> Section 508 &amp; WCAG 2.1 AA Compliant
            </span>
            <span>&bull;</span>
            <span>Open Records Act Certified</span>
          </div>
        </div>

        {/* Footer Navigation Links */}
        <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 text-label-sm font-label-sm">
          <Link to="/#activity" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            Browse Directory
          </Link>
          <Link to="/submit-item?type=lost" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            Report Lost Item
          </Link>
          <Link to="/submit-item?type=found" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            Report Found Item
          </Link>
          <a href="/#how-it-works" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            Safety &amp; Verification
          </a>
          <Link to="/dashboard" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            Official Registry Desk
          </Link>
          <a href="/#dispatch" className="text-on-surface-variant hover:text-primary underline transition-colors duration-150">
            24/7 Civic Dispatch
          </a>
        </div>
      </div>
    </footer>
  )
}
