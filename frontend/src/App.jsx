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
import LandingPage      from './pages/LandingPage.jsx'
import { useAuth }      from './hooks/useAuth.js'
import { useJobs }      from './hooks/useJobs.js'
import { useStats }     from './hooks/useStats.js'

const INITIAL_FILTERS = {
  berlin:       false,
  english_only: false,
  remote_type:  '',
  company_size: '',
  company_id:   '',
}

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    user, savedIds, savedJobs,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, toggleSaved,
  } = useAuth()

  const [showAuth,  setShowAuth]  = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // ── View ──────────────────────────────────────────────────────────────────
  const [view,         setView]         = useState('home')
  const [previousView, setPreviousView] = useState(null)

  // ── Search & filters ──────────────────────────────────────────────────────
  const [query,   setQuery]   = useState('')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page,    setPage]    = useState(1)

  // ── Filter context: tracks how we arrived at the jobs view ────────────────
  // When set, the SearchAndFilters bar is hidden and a back button is shown
  const [filterContext, setFilterContext] = useState(null)
  // { label: string, backView: 'home'|'companies'|'insights' }

  // ── Quick view ────────────────────────────────────────────────────────────
  const [quickViewJob, setQuickViewJob] = useState(null)

  // ── Stats (for landing page numbers) ─────────────────────────────────────
  const { totalJobs, totalCompanies } = useStats()

  const handleSetQuery   = v => { setQuery(v);   setPage(1) }
  const handleSetFilters = v => { setFilters(v); setPage(1) }

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goToView = (newView, opts = {}) => {
    const { clearSearch = false } = opts
    setPreviousView(view)
    setView(newView)
    if (clearSearch) {
      setQuery('')
      setFilters(INITIAL_FILTERS)
      setFilterContext(null)
      setPage(1)
    }
  }

  // Header view change — logo click always goes home and clears everything
  const handleViewChange = newView => {
    if (newView === 'home') {
      setQuery('')
      setFilters(INITIAL_FILTERS)
      setFilterContext(null)
      setPage(1)
      setPreviousView(view)
      setView('home')
    } else {
      goToView(newView)
    }
  }

  // Back button — return to where we came from
  const handleBack = () => {
    const dest = filterContext?.backView ?? previousView ?? 'home'
    setFilterContext(null)
    setQuery('')
    setFilters(INITIAL_FILTERS)
    setPage(1)
    setView(dest)
  }

  // ── Landing page actions ──────────────────────────────────────────────────
  const handleLandingSearch = q => {
    setQuery(q)
    setFilters(INITIAL_FILTERS)
    setFilterContext(null)
    setPage(1)
    setPreviousView('home')
    setView('jobs')
  }

  const handleLandingFilter = ({ query: q, filters: f }) => {
    if (q !== undefined) setQuery(q)
    setFilters({ ...INITIAL_FILTERS, ...f })
    setFilterContext(null)
    setPage(1)
    setPreviousView('home')
    setView('jobs')
  }

  const handleBrowseAll = () => {
    setQuery('')
    setFilters(INITIAL_FILTERS)
    setFilterContext(null)
    setPage(1)
    setPreviousView('home')
    setView('jobs')
  }

  // ── Company drill-through ─────────────────────────────────────────────────
  const handleCompanyJobsClick = company => {
    setFilters({ ...INITIAL_FILTERS, company_id: company.id })
    setQuery('')
    setPage(1)
    setFilterContext({ label: `Jobs at ${company.name}`, backView: 'companies' })
    setPreviousView('companies')
    setView('jobs')
  }

  // ── Insights drill-through ────────────────────────────────────────────────
  const handleInsightsFilter = ({ query: q, remote_type, berlin, label } = {}) => {
    if (q           !== undefined) setQuery(q)
    if (remote_type !== undefined) setFilters({ ...INITIAL_FILTERS, remote_type })
    else if (berlin !== undefined) setFilters({ ...INITIAL_FILTERS, berlin })
    else                           setFilters(INITIAL_FILTERS)
    setPage(1)
    setFilterContext({ label: label ?? q ?? remote_type ?? 'Filtered jobs', backView: 'insights' })
    setPreviousView('insights')
    setView('jobs')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Jobs data ─────────────────────────────────────────────────────────────
  const { jobs, count, totalPages, loading, error } = useJobs({ query, filters, page })

  const handleSaveToggle = async jobId => {
    const result = await toggleSaved(jobId)
    if (result === null) setShowAuth(true)
  }

  // ── Context-aware job view header ─────────────────────────────────────────
  const JobsContextHeader = () => {
    if (!filterContext) return null
    const icons = { companies: '🏢', insights: '📊', home: '🏠' }
    const backLabels = { companies: 'Companies', insights: 'Insights', home: 'Home' }
    const back = filterContext.backView ?? 'home'
    return (
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-2">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-xs px-3.5 py-2 rounded-full mb-5 transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.5)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(0,255,135,0.35)'
            e.currentTarget.style.color = '#00FF87'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
          }}
        >
          <span>{icons[back] ?? '←'}</span>
          <span>← Back to {backLabels[back] ?? back}</span>
        </button>
        <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: '#00CC6A', letterSpacing: '0.1em' }}>
          {filterContext.backView === 'companies'
            ? 'Company'
            : filterContext.label.startsWith('Jobs in ')
              ? 'Berlin District'
              : filterContext.label.endsWith('Roles')
                ? 'Role Filter'
                : filterContext.label.endsWith('Jobs')
                  ? 'Job Filter'
                  : 'Filtered Results'}
        </p>
        <h1
          className="font-bold mb-6"
          style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}
        >
          {filterContext.label.startsWith('Jobs at ') ? (
            <>
              Open roles at{' '}
              <span style={{ color: '#00FF87' }}>{filterContext.label.replace('Jobs at ', '')}</span>
            </>
          ) : filterContext.label.startsWith('Jobs in ') ? (
            <>
              {'Jobs in '}
              <span style={{ color: '#00FF87' }}>{filterContext.label.replace('Jobs in ', '')}</span>
            </>
          ) : filterContext.label.endsWith(' Roles') ? (
            <>
              <span style={{ color: '#00FF87' }}>{filterContext.label.replace(' Roles', '')}</span>
              {' Roles'}
            </>
          ) : filterContext.label.endsWith(' Jobs') ? (
            <>
              <span style={{ color: '#00FF87' }}>{filterContext.label.replace(' Jobs', '')}</span>
              {' Jobs'}
            </>
          ) : (
            <span style={{ color: '#00FF87' }}>{filterContext.label}</span>
          )}
        </h1>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans relative">

      {/* ── Global background: photo + dark overlay, fixed so it never scrolls ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage: "url('/berlin-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          background: 'rgba(7,11,16,0.72)',
        }}
      />

      {/* ── All page content sits above the background ── */}
      <div className="relative" style={{ zIndex: 2 }}>

      <Header
        user={user}
        savedCount={savedIds.size}
        view={view}
        onViewChange={handleViewChange}
        onLoginClick={() => setShowAuth(true)}
        onLogout={signOut}
        onSavedClick={() => setShowSaved(true)}
      />

      <AnimatePresence mode="wait">

        {/* ── Home / Landing ─────────────────────────────────────────── */}
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LandingPage
              totalJobs={totalJobs}
              totalCompanies={totalCompanies}
              onSearch={handleLandingSearch}
              onFilterClick={handleLandingFilter}
              onBrowseAll={handleBrowseAll}
              onNavigateCompanies={() => goToView('companies')}
            />
          </motion.div>
        )}

        {/* ── Companies ──────────────────────────────────────────────── */}
        {view === 'companies' && (
          <motion.div key="companies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <CompaniesPage
              onLoginClick={() => setShowAuth(true)}
              onCompanyJobsClick={handleCompanyJobsClick}
            />
          </motion.div>
        )}

        {/* ── Insights ───────────────────────────────────────────────── */}
        {view === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <InsightsPage
              onNavigateJobs={handleInsightsFilter}
              onNavigateCompanies={() => goToView('companies')}
            />
          </motion.div>
        )}

        {/* ── Jobs ───────────────────────────────────────────────────── */}
        {view === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>

            {/* Show filters bar OR context header — never both */}
            {filterContext ? (
              <JobsContextHeader />
            ) : (
              <>
                <SearchAndFilters
                  query={query}
                  setQuery={handleSetQuery}
                  filters={filters}
                  setFilters={handleSetFilters}
                  count={count}
                  loading={loading}
                  companyFilterName={null}
                  onClearCompany={null}
                />
                {/* Normal jobs hero */}
                <div className="max-w-6xl mx-auto px-4 pt-8 pb-2">
                  <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: '#00CC6A', letterSpacing: '0.1em' }}>
                    Job Feed
                  </p>
                  <h1
                    className="font-bold mb-1"
                    style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', color: 'var(--text-1)', letterSpacing: '-0.02em' }}
                  >
                    Tech careers <span style={{ color: '#00FF87' }}>in Berlin</span>
                  </h1>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>
                    English-friendly roles — updated daily from 1 000+ companies
                  </p>
                </div>
              </>
            )}

            <main className="max-w-6xl mx-auto px-4 pb-16">
              {/* Count line when in context mode */}
              {filterContext && (
                <p className="text-xs mb-5 pb-1" style={{ color: 'var(--text-3)' }}>
                  {loading ? 'Loading…' : `${count.toLocaleString()} ${count === 1 ? 'position' : 'positions'} found`}
                </p>
              )}

              {error && (
                <div className="text-center py-16">
                  <p className="text-sm" style={{ color: '#fb7185' }}>
                    Could not load jobs: {error}
                  </p>
                </div>
              )}

              {!error && !loading && jobs.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-4xl mb-4">🔍</p>
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>No jobs found. Try adjusting your filters.</p>
                </div>
              )}

              <motion.div
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
                variants={gridVariants}
                initial="hidden"
                animate="show"
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
                    disabled={page <= 1}
                    className="btn-dim px-4 py-2 text-xs disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-dim px-4 py-2 text-xs disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </main>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Overlays ─────────────────────────────────────────────────── */}
      {quickViewJob && (
        <JobQuickView
          job={quickViewJob}
          isSaved={savedIds.has(quickViewJob.id)}
          onSaveToggle={handleSaveToggle}
          onClose={() => setQuickViewJob(null)}
          onLoginClick={() => setShowAuth(true)}
        />
      )}

      {showSaved && (
        <SavedJobsPanel
          savedJobs={savedJobs}
          onClose={() => setShowSaved(false)}
          onQuickView={job => { setShowSaved(false); setQuickViewJob(job) }}
        />
      )}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          signIn={signInWithEmail}
          signUp={signUpWithEmail}
          signInWithGoogle={signInWithGoogle}
        />
      )}
      </div>{/* end z-2 content wrapper */}
    </div>
  )
}
