import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import AuthModal        from './components/AuthModal.jsx'
import Header           from './components/Header.jsx'
import JobCard, { cardVariant } from './components/JobCard.jsx'
import JobQuickView     from './components/JobQuickView.jsx'
import SavedJobsPanel   from './components/SavedJobsPanel.jsx'
import SearchAndFilters from './components/SearchAndFilters.jsx'
import CompaniesPage    from './pages/CompaniesPage.jsx'
import InsightsPage     from './pages/InsightsPage.jsx'
import { useAuth }      from './hooks/useAuth.js'
import { useJobs }      from './hooks/useJobs.js'

const INITIAL_FILTERS = {
  berlin:       false,
  english_only: false,
  remote_type:  '',
  company_size: '',
  company_id:   '',   // set when drilling from Companies → Jobs
}

// Staggered grid container
const gridVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

export default function App() {
  // ── Auth + saved-jobs ───────────────────────────────────────────────────
  const {
    user,
    savedIds,
    savedJobs,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    toggleSaved,
  } = useAuth()

  const [showAuth,  setShowAuth]  = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // ── View state ───────────────────────────────────────────────────────────
  const [view, setView] = useState('jobs')

  // ── Quick View ───────────────────────────────────────────────────────────
  const [quickViewJob, setQuickViewJob] = useState(null)

  // ── Search & filter state ────────────────────────────────────────────────
  const [query,             setQuery]             = useState('')
  const [filters,           setFilters]           = useState(INITIAL_FILTERS)
  const [page,              setPage]              = useState(1)
  const [companyFilterName, setCompanyFilterName] = useState('')

  const handleSetQuery   = v => { setQuery(v);   setPage(1) }
  const handleSetFilters = v => { setFilters(v); setPage(1) }

  // ── "View jobs at [Company]" — called from CompaniesPage ─────────────────
  const handleCompanyJobsClick = company => {
    setFilters(f => ({ ...f, company_id: company.id }))
    setCompanyFilterName(company.name)
    setQuery('')
    setPage(1)
    setView('jobs')
  }

  // ── Clear company filter ──────────────────────────────────────────────────
  const handleClearCompany = () => {
    setFilters(f => ({ ...f, company_id: '' }))
    setCompanyFilterName('')
    setPage(1)
  }

  // ── Jobs data ─────────────────────────────────────────────────────────────
  const { jobs, count, totalPages, loading, error } = useJobs({ query, filters, page })

  // ── Save toggle ──────────────────────────────────────────────────────────
  const handleSaveToggle = async jobId => {
    const result = await toggleSaved(jobId)
    if (result === null) setShowAuth(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans">

      <Header
        user={user}
        savedCount={savedIds.size}
        view={view}
        onViewChange={setView}
        onLoginClick={() => setShowAuth(true)}
        onLogout={signOut}
        onSavedClick={() => setShowSaved(true)}
      />

      {/* ── Companies view ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === 'companies' && (
          <motion.div
            key="companies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <CompaniesPage
              onLoginClick={() => setShowAuth(true)}
              onCompanyJobsClick={handleCompanyJobsClick}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Insights view ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <InsightsPage />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Jobs view ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === 'jobs' && (
          <motion.div
            key="jobs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <SearchAndFilters
              query={query}
              setQuery={handleSetQuery}
              filters={filters}
              setFilters={handleSetFilters}
              count={count}
              loading={loading}
              companyFilterName={companyFilterName}
              onClearCompany={handleClearCompany}
            />

            <main className="max-w-6xl mx-auto px-4 py-8">

              {/* Page hero caption */}
              <div className="mb-8">
                {companyFilterName ? (
                  <>
                    <p className="text-xs font-medium tracking-widest uppercase mb-2 text-gold">
                      Company jobs
                    </p>
                    <h1 className="font-display font-semibold text-3xl sm:text-4xl" style={{ color: 'var(--text-1)' }}>
                      Open roles at
                      <em className="not-italic" style={{ color: '#D4AF37' }}> {companyFilterName}</em>
                    </h1>
                    <button
                      onClick={handleClearCompany}
                      className="text-xs mt-2 inline-flex items-center gap-1 transition-opacity opacity-50 hover:opacity-100"
                      style={{ color: 'var(--text-3)' }}
                    >
                      ← Back to all jobs
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium tracking-widest uppercase mb-2 text-gold">
                      Job Feed
                    </p>
                    <h1 className="font-display font-semibold text-3xl sm:text-4xl" style={{ color: 'var(--text-1)' }}>
                      Tech careers
                      <em className="not-italic" style={{ color: '#D4AF37' }}> in Berlin</em>
                    </h1>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
                      English-friendly roles — updated daily from 1 000+ companies
                    </p>
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-xl px-5 py-4 mb-6 text-sm"
                  style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.22)', color: '#fb7185' }}
                >
                  <strong>Could not load jobs:</strong> {error}
                </div>
              )}

              {/* Loading skeleton */}
              {loading && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-5 space-y-3.5 animate-pulse"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)' }} />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-2.5 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.07)' }} />
                          <div className="flex gap-1.5">
                            {[1,2].map(j => <div key={j} className="h-4 rounded-full w-14" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
                          </div>
                        </div>
                      </div>
                      <div className="h-4 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      <div className="flex gap-1.5">
                        {[1,2,3].map(j => <div key={j} className="h-4 rounded-full w-12" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!loading && !error && jobs.length === 0 && (
                <div className="text-center py-24">
                  <div className="text-5xl mb-5">🔭</div>
                  <h3 className="font-display font-semibold text-xl mb-2" style={{ color: 'var(--text-2)' }}>
                    No jobs found
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                    {companyFilterName
                      ? `No active listings at ${companyFilterName} right now.`
                      : 'Try adjusting your filters or search query.'}
                  </p>
                  {companyFilterName && (
                    <button onClick={handleClearCompany} className="btn-dim mt-5 px-4 py-2">
                      ← Back to all jobs
                    </button>
                  )}
                </div>
              )}

              {/* Staggered job grid */}
              {!loading && jobs.length > 0 && (
                <>
                  <motion.div
                    className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                    variants={gridVariants}
                    initial="hidden"
                    animate="show"
                    key={`${query}-${JSON.stringify(filters)}-${page}`}
                  >
                    {jobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isSaved={savedIds.has(job.id)}
                        onSaveToggle={handleSaveToggle}
                        onQuickView={setQuickViewJob}
                      />
                    ))}
                  </motion.div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-10">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn-dim px-4 py-2 disabled:opacity-30"
                      >
                        ← Prev
                      </button>
                      <span className="text-sm" style={{ color: 'var(--text-3)' }}>
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="btn-dim px-4 py-2 disabled:opacity-30"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick View drawer ────────────────────────────────────────── */}
      <JobQuickView
        job={quickViewJob}
        onClose={() => setQuickViewJob(null)}
        isSaved={quickViewJob ? savedIds.has(quickViewJob.id) : false}
        onSaveToggle={handleSaveToggle}
      />

      {/* ── Saved jobs drawer ────────────────────────────────────────── */}
      <SavedJobsPanel
        open={showSaved}
        onClose={() => setShowSaved(false)}
        savedJobs={savedJobs}
        savedIds={savedIds}
        onSaveToggle={handleSaveToggle}
      />

      {/* ── Auth modal ───────────────────────────────────────────────── */}
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
