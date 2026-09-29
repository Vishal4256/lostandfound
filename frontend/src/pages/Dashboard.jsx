import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/common/StatCard'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import { formatLocation } from '../utils/formatters'

export default function Dashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('reports')
  const [reports, setReports] = useState([])
  const [claims, setClaims] = useState([])
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, claimsRes, convosRes] = await Promise.allSettled([
        api.get('/api/items/my-items'),
        api.get('/api/claims/my-claims'),
        api.get('/api/chat/conversations')
      ])

      if (reportsRes.status === 'fulfilled' && reportsRes.value.data.success) {
        setReports(reportsRes.value.data.data || [])
      }

      if (claimsRes.status === 'fulfilled' && claimsRes.value.data.success) {
        setClaims(claimsRes.value.data.claims || [])
      }

      if (convosRes.status === 'fulfilled' && convosRes.value.data.success) {
        setConversations(convosRes.value.data.conversations || [])
      }
    } catch {
      toast.error('Failed to sync registry dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    fetchData()
  }, [fetchData])

  const handleToggleStatus = async (itemId, currentStatus) => {
    const nextStatus = currentStatus === 'Resolved' ? 'Active' : 'Resolved'
    try {
      const { data } = await api.patch(`/api/items/${itemId}/status`, { status: nextStatus })
      if (data.success) {
        setReports((prev) =>
          prev.map((r) => (r._id === itemId ? { ...r, status: nextStatus } : r))
        )
        toast.success(`Case status updated to ${nextStatus}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const lostCount = reports.filter((r) => (r.type || r.itemType) === 'lost').length
  const foundCount = reports.filter((r) => (r.type || r.itemType) === 'found').length
  const resolvedCount = reports.filter((r) => r.status === 'Resolved').length
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12 space-y-8">
      {/* Profile Overview Card */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
        
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary text-secondary-fixed flex items-center justify-center font-bold text-headline-md shadow-xs shrink-0">
            {userInitial}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-headline-md font-headline-md font-bold text-primary">
                {user?.name || 'Civic Member'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-label-sm font-label-sm font-bold border border-secondary-fixed">
                {user?.role === 'admin' ? 'ADMINISTRATOR' : 'VERIFIED CITIZEN'}
              </span>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-[16px] text-outline">mail</span>
              <span>{user?.email}</span>
            </p>
            <p className="text-label-sm font-label-sm text-outline mt-1">
              Account Status: Active &bull; Citizen Ledger ID: #{user?._id?.slice(-6).toUpperCase() || 'REG-981'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={fetchData}
            className="px-4 py-2.5 rounded-xl border border-outline-variant hover:bg-surface-container text-primary font-semibold text-body-sm flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Refresh Feeds</span>
          </button>
          <Link
            to="/submit-item"
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-sm flex items-center gap-2 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Report Item</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Case Reports"
          value={reports.length}
          subtext={`${lostCount} Lost, ${foundCount} Found`}
          icon="inventory_2"
        />
        <StatCard
          label="Reunited & Resolved"
          value={resolvedCount}
          subtext="Closed municipal files"
          icon="check_circle"
          color="secondary"
        />
        <StatCard
          label="Ownership Claims Filed"
          value={claims.length}
          subtext="Under statutory review"
          icon="assignment_turned_in"
        />
        <StatCard
          label="Active Secure Channels"
          value={conversations.length}
          subtext="Coordination chats"
          icon="chat"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-outline-variant flex items-center gap-6">
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 font-semibold text-body-md flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">folder_open</span>
          <span>My Case Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 font-semibold text-body-md flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'claims'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">verified</span>
          <span>My Filed Claims ({claims.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('chats')}
          className={`pb-3 font-semibold text-body-md flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'chats'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">chat</span>
          <span>Secure Messages ({conversations.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
          <p className="text-body-sm font-body-sm text-on-surface-variant">Syncing with municipal database...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: REPORTS */}
          {activeTab === 'reports' && (
            <div>
              {reports.length === 0 ? (
                <EmptyState
                  icon="post_add"
                  title="No Incident Reports Logged"
                  description="You haven't reported any lost or found items yet. File your first report to activate community matching."
                  actionText="Report an Item"
                  actionLink="/submit-item"
                />
              ) : (
                <div className="space-y-4">
                  {reports.map((r)=>{
                    const itemType=(r.type || r.itemType || 'found').toLowerCase()
                    const caseId=(r._id || '').slice(-4).toUpperCase()
                    const isResolved=r.status==='Resolved'

                    return(
                      <div
                        key={r._id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-primary transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-20 h-20 rounded-xl bg-surface-container overflow-hidden border border-outline-variant shrink-0">
                            <img
                              src={r.imageUrl || (r.images && r.images[0]) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200' fill='none'%3E%3Crect width='200' height='200' fill='%23F1F5F9'/%3E%3Ccircle cx='100' cy='100' r='20' stroke='%2394A3B8' stroke-width='2'/%3E%3C/svg%3E"}
                              alt={r.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-label-sm text-label-sm font-bold text-primary">
                                CASE #LF-{caseId}
                              </span>
                              <StatusBadge status={r.status} type={itemType} />
                              <span className="text-outline text-label-sm font-label-sm">&bull;</span>
                              <span className="text-on-surface-variant text-label-sm font-label-sm uppercase">{r.category}</span>
                            </div>

                            <h3 className="text-headline-sm font-headline-sm font-bold text-primary">
                              <Link to={`/item/${r._id}`} className="hover:text-secondary transition-colors">
                                {r.title}
                              </Link>
                            </h3>

                            <p className="text-body-sm font-body-sm text-on-surface-variant line-clamp-1 max-w-lg">
                              {r.description || 'No additional notes provided.'}
                            </p>

                            <div className="flex items-center gap-4 text-label-sm font-label-sm text-outline pt-1">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                <span>{formatLocation(r.location, 'Civic Center')}</span>
                              </span>
                              <span>Date: {new Date(r.createdAt || r.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-outline-variant/60">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(r._id, r.status)}
                            className={`px-3.5 py-1.5 rounded-xl text-body-sm font-semibold transition-colors flex items-center gap-1.5 ${
                              isResolved
                                ? 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'
                                : 'bg-secondary hover:bg-on-secondary-container text-on-secondary shadow-xs'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isResolved ? 'history' : 'check'}
                            </span>
                            <span>{isResolved ? 'Re-open Case' : 'Mark Reunited'}</span>
                          </button>

                          <Link
                            to={`/item/${r._id}`}
                            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-semibold text-body-sm flex items-center gap-1 transition-colors"
                          >
                            <span>Dossier</span>
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLAIMS */}
          {activeTab === 'claims' && (
            <div>
              {claims.length === 0 ? (
                <EmptyState
                  icon="assignment_late"
                  title="No Claims on Record"
                  description="You have not filed any ownership verification claims yet. If you locate your lost property in the directory, you can submit an official retrieval claim."
                  actionText="Search Directory"
                  actionLink="/"
                />
              ) : (
                <div className="space-y-4">
                  {claims.map((cl) => {
                    const itemTarget = cl.item || {}
                    return (
                      <div
                        key={cl._id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-5 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-label-sm font-label-sm text-outline uppercase block">CLAIM REGISTRATION #{cl._id?.slice(-4).toUpperCase()}</span>
                            <h3 className="text-headline-sm font-headline-sm font-bold text-primary mt-0.5">
                              {itemTarget.title ? (
                                <Link to={`/item/${itemTarget._id || itemTarget}`} className="hover:text-secondary">
                                  {itemTarget.title}
                                </Link>
                              ) : (
                                'Claimed Property Case'
                              )}
                            </h3>
                            <p className="text-label-sm font-label-sm text-outline">
                              Submitted: {new Date(cl.createdAt).toLocaleString()}
                            </p>
                          </div>

                          <span className={`px-3 py-1 rounded-full text-label-sm font-label-sm font-bold uppercase ${
                            cl.status === 'approved'
                              ? 'bg-secondary-container text-on-secondary-fixed-variant'
                              : cl.status === 'rejected'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          }`}>
                            {cl.status}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-surface-container text-body-sm font-body-sm text-on-surface">
                          <p className="text-outline text-label-sm font-label-sm mb-1">YOUR PROOF OF OWNERSHIP STATEMENT:</p>
                          <p>{cl.proofDetails}</p>
                        </div>

                        {cl.proofImage && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden border border-outline-variant">
                            <img src={cl.proofImage} alt="Submitted Proof" className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="pt-2 flex justify-end">
                          <Link
                            to={`/item/${itemTarget._id || itemTarget}`}
                            className="text-body-sm font-semibold text-primary hover:text-secondary flex items-center gap-1"
                          >
                            <span>Open Related Case File</span>
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHATS */}
          {activeTab === 'chats' && (
            <div>
              {conversations.length === 0 ? (
                <EmptyState
                  icon="chat_bubble_outline"
                  title="No Coordination Messages"
                  description="You don't have any active communication threads. When you claim an item or coordinate with a finder, direct channels will appear here."
                  actionText="Browse Items"
                  actionLink="/"
                />
              ) : (
                <div className="space-y-3">
                  {conversations.map((convo) => {
                    const itemData = convo.item || {}
                    return (
                      <div
                        key={convo._id}
                        className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-4 shadow-xs flex items-center justify-between gap-4 hover:border-primary transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[24px]">chat</span>
                          </div>
                          <div>
                            <h4 className="text-body-md font-bold text-primary">
                              Case: {itemData.title || 'Property Coordination'}
                            </h4>
                            <p className="text-label-sm font-label-sm text-outline">
                              Channel ID: #{convo._id?.slice(-6).toUpperCase()} &bull; Last updated {new Date(convo.updatedAt || convo.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/item/${itemData._id || itemData}`}
                          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-body-sm font-semibold flex items-center gap-1 shadow-xs hover:bg-primary-container transition-colors"
                        >
                          <span>Open Channel</span>
                          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
