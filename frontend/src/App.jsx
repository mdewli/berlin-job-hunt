import { useState } from 'react'
import AuthModal        from './components/AuthModal.jsx'
import Header           from './components/Header.jsx'
import JobCard          from './components/JobCard.jsx'
import SavedJobsPanel   from './components/SavedJobsPanel.jsx'
import SearchAndFilters from './components/SearchAndFilters.jsx'
import { useAuth }      from './hooks/useAuth.js'
import { useJobs }      from './hooks/useJobs.js'

const INITIAL_FILTERS = {
  berlin:       false,
  english_only: false,
  remote_type:  '',
  company_size: '',
}

export default function App() {
  // ── Auth + saved-jobs (all managed inside useAuth) ──────────────────────
  const {
    user,
    loading: authLoading,
    savedIds,
    savedJobs,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    toggleSaved,
  } = useAuth()

  const [showAuth,  setShowAuth]  = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // ── Search & filter state ───────────────────────────────────────────────
  const [query,   setQuery]   = useState('')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page,    setPage]    = useState(1)

  const handleSetQuery   = v => { setQuery(v);   setPage(1) }
  const handleSetFilters = v => { setFilters(v); setPage(1) }

  // ── Jobs data ───────────────────────────────────────────────────────────
  const { jobs, count, totalPages, loading, error } = useJobs({ query, filters, page })

  // ── Save toggle — open auth modal if not logged in ──────────────────────
  const handleSaveToggle = async (jobId) => {
    const result = await toggleSaved(jobId)
    if (result === null) setShowAuth(true)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header
        user={user}
        savedCount={savedIds.size}
        onLoginClick={() => setShowAuth(true)}
        onLogout={signOut}
        onSavedClick={() => setShowSaved(true)}
      />

      <SearchAndFilters
        query={query}
        setQuery={handleSetQuery}
        filters={filters}
        setFilters={handleSetFilters}
        count={count}
        loading={loading}
      />

      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Error state */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-5 py-4 mb-6 text-sm">
            <strong>Could not load jobs:</strong> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="flex gap-2">
                  {[1,2,3].map(j => <div key={j} className="h-5 bg-slate-100 rounded-full w-16" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && jobs.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4">🔭</div>
            <h3 className="text-lg font-medium text-slate-700">No jobs found</h3>
            <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
          </div>
        )}

        {/* Job grid */}
        {!loading && jobs.length > 0 && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedIds.has(job.id)}
                  onSaveToggle={handleSaveToggle}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-40 hover:border-indigo-400 transition-colors"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm disabled:opacity-40 hover:border-indigo-400 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Saved jobs panel */}
      <SavedJobsPanel
        open={showSaved}
        onClose={() => setShowSaved(false)}
        savedJobs={savedJobs}
        savedIds={savedIds}
        onSaveToggle={handleSaveToggle}
      />

      {/* Auth modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          signIn={signInWithEmail}
          signUp={signUpWithEmail}
        />
      )}
    </div>
  )
}
