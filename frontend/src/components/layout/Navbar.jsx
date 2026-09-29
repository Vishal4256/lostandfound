import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const [profileDropdown, setProfileDropdown] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  // Close dropdowns on route change without cascading effect render
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setProfileDropdown(false)
    setMobileMenu(false)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (globalSearch.trim()) {
      navigate(`/?search=${encodeURIComponent(globalSearch.trim())}`)
    }
  }

  const handleLogout = () => {
    logout()
    setProfileDropdown(false)
    navigate('/')
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <>
      {/* Live Civic Broadcast Banner */}
      <aside className="w-full bg-primary text-on-primary py-1.5 px-4 z-50 border-b border-primary-container text-body-sm font-body-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary text-label-sm font-label-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
              CIVIC DISPATCH
            </span>
            <p className="truncate text-surface-container-high text-body-sm font-body-sm">
              <span className="font-semibold text-on-primary">Municipal Registry Active</span>: Report lost belongings &amp; coordinate secure custody verification
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-inverse-primary text-body-sm font-body-sm shrink-0">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-secondary-fixed-dim text-[16px] material-symbols-filled">verified_user</span>
              256-Bit Encrypted Privacy Shield
            </span>
            <span className="text-outline">|</span>
            <span className="flex items-center gap-1 font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[15px]">call</span>
              Civic Dispatch: 1-800-555-0192
            </span>
          </div>
        </div>
      </aside>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant shadow-xs transition-all duration-200">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6 md:gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-secondary-fixed shadow-sm group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-secondary-fixed text-[22px] material-symbols-filled">travel_explore</span>
              </div>
              <div className="flex flex-col">
                <span className="text-headline-sm font-headline-sm font-bold text-primary tracking-tight leading-tight">HavenFind</span>
                <span className="text-label-sm font-label-sm text-outline -mt-0.5 tracking-wider text-[10px]">CIVIC NETWORK</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Global Primary Navigation" className="hidden lg:flex items-center gap-6 ml-2">
              <Link
                to="/"
                className={`flex items-center gap-1.5 transition-colors font-medium text-body-md ${
                  pathname === '/'
                    ? 'border-b-2 border-primary text-primary font-semibold pb-0.5'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-body-md">grid_view</span>
                Directory
              </Link>
              <Link
                to="/dashboard"
                className={`flex items-center gap-1.5 transition-colors font-medium text-body-md ${
                  pathname === '/dashboard' || pathname === '/profile'
                    ? 'border-b-2 border-primary text-primary font-semibold pb-0.5'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-body-md">badge</span>
                {isAuthenticated ? 'My Registry Desk' : 'Verification Desk'}
              </Link>
              <a
                href="/#how-it-works"
                className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 text-body-md"
              >
                <span className="material-symbols-outlined text-outline text-body-md">psychology_alt</span>
                How It Works
              </a>
            </nav>
          </div>

          {/* Search bar in center/left for tablet/desktop */}
          <div className="hidden md:flex items-center flex-1 max-w-xs lg:max-w-sm mx-4">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                <span className="material-symbols-outlined text-[18px]">search</span>
              </span>
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search case #, item, precinct..."
                className="w-full pl-9 pr-12 py-1.5 bg-surface border border-outline-variant rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <kbd className="bg-surface-container border border-outline-variant rounded px-1.5 text-[10px] font-label-sm text-outline">⌘K</kbd>
              </span>
            </form>
          </div>

          {/* Action Clustered Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Primary Action: Report an Item */}
            <Link
              to="/submit-item"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-3.5 sm:px-4 py-2 rounded-xl font-semibold text-body-sm sm:text-body-md shadow-xs active:scale-[0.98] transition-all"
            >
              <span className="material-symbols-outlined text-secondary-fixed text-body-md">add_circle</span>
              <span className="hidden xs:inline">Report Item</span>
              <span className="xs:hidden">Report</span>
            </Link>

            {/* Auth Button or User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setProfileDropdown((v) => !v)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-full border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors"
                  aria-label="User Account Menu"
                >
                  <span className="text-body-sm font-semibold text-primary hidden sm:inline max-w-[100px] truncate">
                    {user?.name || 'Member'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary text-secondary-fixed font-bold text-label-md flex items-center justify-center shadow-xs">
                    {userInitial}
                  </div>
                </button>

                {profileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-outline-variant/60 mb-1">
                      <p className="text-body-sm font-bold text-primary truncate">{user?.name}</p>
                      <p className="text-label-sm font-label-sm text-outline truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed-variant text-[10px] font-label-sm font-bold">
                        {user?.role === 'admin' ? 'CIVIC ADMINISTRATOR' : 'VERIFIED CITIZEN'}
                      </span>
                    </div>

                    <Link
                      to="/dashboard"
                      className="flex items-center gap-2.5 px-3 py-2 text-body-sm font-medium text-primary hover:bg-surface-container rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-body-md">dashboard</span>
                      Registry Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 px-3 py-2 text-body-sm font-medium text-primary hover:bg-surface-container rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-body-md">account_circle</span>
                      Civic Profile &amp; Badges
                    </Link>
                    <Link
                      to="/submit-item"
                      className="flex items-center gap-2.5 px-3 py-2 text-body-sm font-medium text-primary hover:bg-surface-container rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-body-md">add_box</span>
                      File New Case Report
                    </Link>

                    <div className="border-t border-outline-variant/60 my-1"></div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-body-sm font-medium text-error hover:bg-error-container/40 rounded-lg transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-body-md">logout</span>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  to="/login"
                  className="px-3 py-2 text-body-sm font-semibold text-primary hover:bg-surface-container rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="hidden sm:inline-flex px-3.5 py-2 text-body-sm font-semibold bg-surface-container-low hover:bg-surface-container border border-outline-variant text-primary rounded-xl transition-colors"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenu((v) => !v)}
              className="p-2 rounded-lg text-primary hover:bg-surface-container lg:hidden"
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined text-body-lg">
                {mobileMenu ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenu && (
          <div className="lg:hidden border-t border-outline-variant bg-surface-container-lowest p-4 space-y-3 shadow-lg">
            <form onSubmit={handleSearchSubmit} className="relative w-full mb-3">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search case #, item..."
                className="w-full pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface"
              />
              <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-2.5">search</span>
            </form>
            <Link to="/" className="block py-2 text-body-md font-medium text-primary">
              Directory Feed
            </Link>
            <Link to="/dashboard" className="block py-2 text-body-md font-medium text-primary">
              My Registry Desk
            </Link>
            <Link to="/submit-item" className="block py-2 text-body-md font-medium text-secondary font-semibold">
              + Report Lost or Found Item
            </Link>
            {!isAuthenticated ? (
              <div className="pt-3 border-t border-outline-variant flex gap-2">
                <Link to="/login" className="flex-1 text-center py-2 rounded-xl bg-primary text-on-primary font-semibold text-body-sm">
                  Sign In
                </Link>
                <Link to="/register" className="flex-1 text-center py-2 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm">
                  Register
                </Link>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="block w-full text-left py-2 text-body-sm font-medium text-error"
              >
                Sign Out
              </button>
            )}
          </div>
        )}
      </header>
    </>
  )
}
