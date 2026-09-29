import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import ItemCard from '../components/common/ItemCard'
import EmptyState from '../components/common/EmptyState'
import VisualSearchModal from '../components/VisualSearchModal'
import MatchResultsGrid from '../components/MatchResultsGrid'
import { getLocationSearchText } from '../utils/formatters'

const CATEGORIES = [
  { id: 'All', label: 'All', icon: 'dashboard' },
  { id: 'Electronics', label: 'Electronics', icon: 'devices' },
  { id: 'Pets', label: 'Pets & Animals', icon: 'pets' },
  { id: 'Wallets', label: 'Keys & Wallets', icon: 'key' },
  { id: 'Bags', label: 'Bags & Luggage', icon: 'backpack' },
  { id: 'Jewellery', label: 'Jewelry', icon: 'diamond' },
  { id: 'Documents', label: 'Documents & IDs', icon: 'badge' },
  { id: 'Other', label: 'Other Items', icon: 'category' }
]

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchModal, setSearchModal] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ total: 0, active: 0, inCustody: 0, resolved: 0 })

  // Fetch real database statistics
  useEffect(() => {
    api.get('/api/items/stats')
      .then(({ data }) => {
        if (data.success && data.stats) {
          setStats(data.stats)
        }
      })
      .catch((err) => console.warn('Could not load registry stats:', err.message))
  }, [listings])

  // Filters initialized from URL parameters
  const [category, setCategory] = useState(() => searchParams.get('category') || 'All')
  const [type, setType] = useState(() => searchParams.get('type') || 'all') // 'all' | 'lost' | 'found'
  const [locationQuery, setLocationQuery] = useState(() => searchParams.get('location') || '')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [verifiedOnly, setVerifiedOnly] = useState(() => searchParams.get('custody') === 'true')
  const [sortBy, setSortBy] = useState(() => searchParams.get('sort') || 'newest')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  // Pagination
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, parseInt(searchParams.get('page') || '1', 10)))
  const itemsPerPage = 9

  // Synchronize state back into URL query parameters
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (category !== 'All') params.set('category', category)
    if (type !== 'all') params.set('type', type)
    if (locationQuery) params.set('location', locationQuery)
    if (verifiedOnly) params.set('custody', 'true')
    if (sortBy !== 'newest') params.set('sort', sortBy)
    if (currentPage > 1) params.set('page', String(currentPage))

    setSearchParams(params, { replace: true })
  }, [searchQuery, category, type, locationQuery, verifiedOnly, sortBy, currentPage, setSearchParams])

  // Sync when navbar triggers external search parameter changes
  const externalSearch = searchParams.get('search')
  const [prevExternalSearch, setPrevExternalSearch] = useState(externalSearch)
  if (prevExternalSearch !== externalSearch) {
    setPrevExternalSearch(externalSearch)
    if (externalSearch !== null && externalSearch !== searchQuery) {
      setSearchQuery(externalSearch)
      setCurrentPage(1)
    }
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 100 }
      if (type !== 'all') params.type = type
      if (category !== 'All') params.category = category
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (locationQuery) params.location = locationQuery
      if (verifiedOnly) params.custody = 'true'
      if (sortBy) params.sort = sortBy

      const { data } = await api.get('/api/items', { params })
      if (data.success && Array.isArray(data.data)) {
        setListings(data.data)
      } else {
        setListings([])
      }
    } catch (err) {
      console.error('Error loading civic items:', err)
      setError('Unable to load civic feed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [type, category, searchQuery, locationQuery, verifiedOnly, sortBy])

  // Debounced fetch for user typing
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchItems])

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const input = document.getElementById('civic-search-input')
        if (input) {
          input.focus()
          input.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Client-side safety filter & sort guarantee
  const filteredListings = listings.filter((item) => {
    if (verifiedOnly) {
      const isFound = (item.type || item.itemType || '').toLowerCase() === 'found'
      if (!isFound) return false
    }
    if (locationQuery) {
      const loc = getLocationSearchText(item.location)
      if (!loc.includes(locationQuery.toLowerCase())) return false
    }
    return true
  }).sort((a, b) => {
    if (sortBy === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    }
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  })

  // Pagination slice
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage) || 1
  const paginatedListings = filteredListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const clearVisualSearch = () => {
    setSearchResults(null)
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setCategory('All')
    setType('all')
    setLocationQuery('')
    setVerifiedOnly(false)
    setSortBy('newest')
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Visual AI Search Modal */}
      <VisualSearchModal
        isOpen={searchModal}
        onClose={() => setSearchModal(false)}
        onSearchResults={(results) => {
          setSearchResults(results)
          setSearchModal(false)
          // Scroll to results
          setTimeout(() => {
            document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }}
        onResults={(results) => {
          setSearchResults(results)
          setSearchModal(false)
        }}
      />

      {/* Hero Section with Relief Trust Tone & Live Proof Metrics */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden bg-gradient-to-b from-surface-container-low via-surface to-background border-b border-outline-variant/40">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#091426_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="w-full max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Relief Trust Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant shadow-xs">
              <span className="material-symbols-outlined text-secondary text-[20px] material-symbols-filled">shield_with_heart</span>
              <span className="text-body-sm font-body-sm font-semibold text-primary">Civic Recovery &amp; Safe Verification Protocol</span>
            </div>

            <h1 className="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-primary tracking-tight">
              Lost something precious? <br className="hidden sm:block" />
              <span className="text-secondary">Let your community help bring it home.</span>
            </h1>

            <p className="text-body-lg font-body-lg text-on-surface-variant max-w-2xl mx-auto">
              HavenFind is a municipal-grade lost &amp; found registry. We replace distress with immediate coordination, privacy-shielded verification, and real-time precinct recovery.
            </p>

            {/* CTAs & Action Toggles */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/submit-item?type=lost"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-tertiary-fixed text-[20px]">search</span>
                <span>Report Lost Item</span>
              </Link>
              <Link
                to="/submit-item?type=found"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant text-primary font-semibold flex items-center justify-center gap-2.5 shadow-xs active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-secondary text-[20px]">inventory_2</span>
                <span>I Found Something</span>
              </Link>
              <button
                onClick={() => setSearchModal(true)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed-variant font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">psychology</span>
                <span>AI Photo Search</span>
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-rag-assistant'))}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-secondary/40 text-secondary font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                <span>Ask AI Assistant</span>
              </button>
            </div>

            {/* Real Database Registry Metrics Bar */}
            <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto border-t border-outline-variant/60">
              <div className="p-3 text-center">
                <p className="text-headline-md font-headline-md text-primary font-bold">{stats.total}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Total Registry Items</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-headline-md font-headline-md text-secondary font-bold">{stats.active}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Active Incidents</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-headline-md font-headline-md text-primary font-bold">{stats.inCustody}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Secured in Custody</p>
              </div>
              <div className="p-3 text-center">
                <p className="text-headline-md font-headline-md text-secondary font-bold">{stats.resolved}</p>
                <p className="text-body-sm font-body-sm text-on-surface-variant">Reunited Cases</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Search Experience & Category Filter Bar */}
      <section className="relative -mt-8 z-30 w-full max-w-7xl mx-auto px-6 md:px-12">
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant p-4 md:p-6 backdrop-blur-md">
          {/* Search Input Bar Cluster */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setCurrentPage(1)
              fetchItems()
              document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="flex flex-col md:flex-row items-center gap-3"
          >
            {/* Primary Query Input */}
            <div className="relative w-full md:flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
              <input
                id="civic-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by keywords: 'iPhone 15', 'Labrador', 'Leather wallet', case number..."
                className="w-full pl-12 pr-16 py-3.5 rounded-xl border border-outline-variant bg-surface text-on-surface placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10 text-body-md transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                    className="p-1 rounded-md text-outline hover:text-primary transition-colors cursor-pointer"
                    aria-label="Clear search query"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-label-sm font-label-sm text-outline">
                  ⌘K
                </span>
              </div>
            </div>

            {/* Proximity / Location Dropdown */}
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">location_on</span>
              <select
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-outline-variant bg-surface text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/10 text-body-md appearance-none font-medium cursor-pointer"
              >
                <option value="">All Metro Civic Zones</option>
                <option value="Central">Central Metro &amp; Downtown</option>
                <option value="Transit">Transit Terminals &amp; Rail</option>
                <option value="Park">Civic Parks &amp; Recreation</option>
                <option value="Library">Public Library &amp; Education</option>
                <option value="Hospital">Medical &amp; University</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[20px]">expand_more</span>
            </div>

            {/* Filter Submit Button */}
            <button
              type="submit"
              className="w-full md:w-auto px-7 py-3.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-md flex items-center justify-center gap-2 active:scale-[0.98] transition-colors shadow-xs cursor-pointer"
            >
              <span>Filter Feed</span>
            </button>
          </form>

          {/* Category Horizontal Pills & Toggle Filter State */}
          <div className="mt-5 pt-4 border-t border-outline-variant/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 md:pb-0 custom-scrollbar">
              <span className="text-label-sm font-label-sm text-outline shrink-0 mr-1">CATEGORIES:</span>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id)
                      setCurrentPage(1)
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-body-sm font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary border border-outline-variant/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Quick Sort, Type & Verification Filters */}
            <div className="flex flex-wrap items-center gap-4 shrink-0 text-body-sm font-body-sm text-on-surface-variant">
              {/* Type Switch */}
              <div className="inline-flex rounded-lg border border-outline-variant p-0.5 bg-surface-container text-label-sm font-label-sm">
                <button
                  type="button"
                  onClick={() => { setType('all'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${type === 'all' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setType('lost'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${type === 'lost' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant'}`}
                >
                  Lost
                </button>
                <button
                  type="button"
                  onClick={() => { setType('found'); setCurrentPage(1); }}
                  className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${type === 'found' ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant'}`}
                >
                  Found
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-body-sm">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => {
                    setVerifiedOnly(e.target.checked)
                    setCurrentPage(1)
                  }}
                  className="w-4 h-4 rounded border-outline text-primary focus:ring-primary/20 cursor-pointer"
                />
                <span>In Custody Only</span>
              </label>

              <span className="text-outline hidden sm:inline">|</span>

              <div className="flex items-center gap-1.5 text-primary font-medium">
                <span className="text-outline text-body-sm">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="bg-transparent border-none text-body-sm font-semibold text-primary focus:ring-0 cursor-pointer p-0 pr-4"
                >
                  <option value="newest">Most Recent</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Feed: Active Items Section */}
      <section className="w-full max-w-7xl mx-auto px-6 md:px-12 py-12" id="activity">
        {/* If Visual Vector Search is active */}
        {searchResults && (
          <div className="mb-10">
            <MatchResultsGrid results={searchResults} onClear={clearVisualSearch} />
          </div>
        )}

        {/* Section Header with Real-Time Counter */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-label-sm font-label-sm text-outline tracking-wider">
              <span>REAL-TIME CIVIC FEED</span>
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
            </div>
            <h2 className="text-headline-lg-mobile md:text-headline-lg font-headline-lg text-primary tracking-tight mt-1">
              Recent Incidents &amp; Secured Items
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchModal(true)}
              className="px-3 py-1.5 rounded-lg border border-outline-variant text-body-sm font-medium text-primary hover:bg-surface-container transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">psychology</span>
              <span>AI Search</span>
            </button>
            <div className="bg-surface-container rounded-lg p-0.5 flex items-center border border-outline-variant/60">
              <button
                aria-label="Grid View"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-outline hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-body-md">grid_view</span>
              </button>
              <button
                aria-label="List View"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-outline hover:text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-body-md">view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Listings Feed: Loading / Error / Empty / Data */}
        {error ? (
          <div className="py-12 text-center max-w-md mx-auto p-6 rounded-2xl bg-surface-container-lowest border border-error/20 space-y-3">
            <span className="material-symbols-outlined text-[36px] text-error">cloud_off</span>
            <h3 className="font-bold text-headline-sm text-primary">Unable to Load Civic Feed</h3>
            <p className="text-body-sm text-on-surface-variant">{error}</p>
            <button
              onClick={fetchItems}
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-body-sm hover:bg-primary-container transition-all cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : loading ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-container border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
            <p className="text-body-sm font-body-sm text-on-surface-variant">Accessing municipal property records...</p>
          </div>
        ) : filteredListings.length === 0 ? (
          listings.length === 0 ? (
            <EmptyState
              title="No Incidents Reported Yet"
              description="There are currently no lost or found items in the community registry. Be the first to report an item."
              actionText="Report an Item"
              actionLink="/submit-item"
            />
          ) : (
            <div className="space-y-4">
              <EmptyState
                title="No Matching Municipal Records"
                description="No active reports match the selected filters. You can clear your search or file a new missing item case."
                actionText="Report an Item"
                actionLink="/submit-item"
              />
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-label-sm font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>Clear All Active Filters</span>
                </button>
              </div>
            </div>
          )
        ) : (
          <>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {paginatedListings.map((item) => (
                <ItemCard key={item._id} item={item} viewMode={viewMode} />
              ))}

              {/* Real Reunion Highlight Bento Card (only shown if a real resolved case exists in DB) */}
              {currentPage === 1 && viewMode === 'grid' && (() => {
                const realReunion = listings.find((i) => i.status === 'Resolved')
                if (!realReunion) return null
                const caseId = (realReunion._id || '').slice(-4).toUpperCase()
                const reporterName = realReunion.reportedBy?.name || 'Registered Citizen'
                return (
                  <article className="bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-secondary-container/30 rounded-2xl border border-secondary-fixed p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-on-secondary text-label-sm font-label-sm font-semibold">
                          <span className="material-symbols-outlined text-sm material-symbols-filled">volunteer_activism</span>
                          VERIFIED REUNION
                        </span>
                        <span className="text-label-sm font-label-sm text-secondary font-bold">CASE #LF-{caseId}</span>
                      </div>
                      <h3 className="text-headline-sm font-headline-sm text-primary font-bold line-clamp-2">
                        {realReunion.title}
                      </h3>
                      <p className="text-body-sm font-body-sm text-on-surface-variant mt-3 line-clamp-3">
                        {realReunion.description || 'Turned in and verified under municipal custody.'}
                      </p>
                      <div className="mt-4 p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/50 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold text-headline-sm shrink-0">
                          {reporterName.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-body-sm font-body-sm truncate">
                          <p className="font-semibold text-primary truncate">{reporterName}</p>
                          <p className="text-outline text-label-sm font-label-sm">{formatLocation(realReunion.location)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6 mt-6 border-t border-outline-variant/60 flex items-center justify-between">
                      <span className="text-body-sm font-body-sm text-on-surface-variant font-medium">Have an item registered?</span>
                      <Link
                        to={`/item/${realReunion._id}`}
                        className="text-secondary hover:text-on-secondary-container font-semibold text-body-sm flex items-center gap-1"
                      >
                        <span>View Dossier</span>
                        <span className="material-symbols-outlined text-body-sm">arrow_forward</span>
                      </Link>
                    </div>
                  </article>
                )
              })()}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-outline-variant">
                <p className="text-body-sm font-body-sm text-outline">
                  Showing <span className="font-semibold text-primary">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredListings.length)}</span> of <span className="font-semibold text-primary">{filteredListings.length}</span> active municipal records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg border border-outline-variant text-body-sm font-semibold disabled:opacity-40 hover:bg-surface-container transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 5).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg text-body-sm font-semibold transition-colors ${
                        currentPage === page
                          ? 'bg-primary text-on-primary'
                          : 'hover:bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg border border-outline-variant text-primary hover:bg-surface-container text-body-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* How Verification Protocol Works (High-Clarity Utility Section) */}
      <section className="bg-surface-container-low py-16 md:py-24 border-y border-outline-variant" id="how-it-works">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-12">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-label-sm font-label-sm text-secondary font-semibold uppercase tracking-wider">
              CIVIC INTEGRITY PIPELINE
            </span>
            <h2 className="text-headline-xl-mobile md:text-headline-lg font-headline-lg text-primary tracking-tight mt-1">
              How HavenFind protects your property &amp; privacy
            </h2>
            <p className="text-body-md font-body-md text-on-surface-variant mt-3">
              Our multi-tier verification ensures items return only to their rightful owners without disclosing personal data to strangers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant shadow-xs relative">
              <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center font-bold text-headline-sm mb-6">
                01
              </div>
              <h3 className="text-headline-sm font-headline-sm text-primary font-bold">Blind Registration</h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                When reporting an item, unique identifying details (serial numbers, engravings, passcode locks) remain encrypted and hidden from public feed scanning.
              </p>
              <div className="mt-6 flex items-center gap-2 text-label-sm font-label-sm text-outline">
                <span className="material-symbols-outlined text-secondary text-headline-sm">lock_clock</span>
                Zero-Knowledge Verification
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant shadow-xs relative">
              <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center font-bold text-headline-sm mb-6">
                02
              </div>
              <h3 className="text-headline-sm font-headline-sm text-primary font-bold">Safe Custody Hand-off</h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Finders can deposit objects directly into official municipal partner lockers, public transit desks, or verified precinct dropboxes for secure inventorying.
              </p>
              <div className="mt-6 flex items-center gap-2 text-label-sm font-label-sm text-outline">
                <span className="material-symbols-outlined text-secondary text-headline-sm">local_police</span>
                Chain of Custody Logged
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant shadow-xs relative">
              <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center font-bold text-headline-sm mb-6">
                03
              </div>
              <h3 className="text-headline-sm font-headline-sm text-primary font-bold">Encrypted Reunion</h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-2 leading-relaxed">
                Upon successful cryptographic or serial match, claimants receive an authentic retrieval token to collect property in person at verified desks.
              </p>
              <div className="mt-6 flex items-center gap-2 text-label-sm font-label-sm text-outline">
                <span className="material-symbols-outlined text-secondary text-headline-sm">task_alt</span>
                Authorized Safe Release
              </div>
            </div>
          </div>

          {/* Safe Dispatch Banner */}
          <div className="mt-12 bg-primary rounded-2xl p-6 md:p-8 text-on-primary flex flex-col md:flex-row items-center justify-between gap-6" id="dispatch">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center text-secondary-fixed shrink-0">
                <span className="material-symbols-outlined text-headline-md">support_agent</span>
              </div>
              <div>
                <h4 className="text-headline-sm font-headline-sm font-bold">Need emergency incident dispatch?</h4>
                <p className="text-body-sm font-body-sm text-inverse-primary">
                  For missing high-value medical items, passports, or critical assistive devices, contact our 24/7 civic hotline.
                </p>
              </div>
            </div>
            <a
              href="tel:18005550192"
              className="shrink-0 px-6 py-3 rounded-xl bg-secondary hover:bg-on-secondary-container text-on-secondary font-semibold text-body-md transition-all active:scale-[0.98] shadow-xs"
            >
              Call Civic Dispatch (24/7)
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
