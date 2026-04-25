import { useState } from 'react'
import { useAuth }          from '../hooks/useAuth.js'
import { useCompanies }     from '../hooks/useCompanies.js'
import SuggestCompanyModal  from '../components/SuggestCompanyModal.jsx'

const SIZE_OPTIONS = [
  { value: '',           label: 'All sizes' },
  { value: 'Micro',      label: 'Micro' },
  { value: 'Startup',    label: 'Startup' },
  { value: 'Mid-size',   label: 'Mid-size' },
  { value: 'Enterprise', label: 'Enterprise' },
]

// Glass chip style per company size
const SIZE_CHIP = {
  Micro:      { bg: 'rgba(20,184,166,0.12)',   text: '#2dd4bf', border: 'rgba(45,212,191,0.25)' },
  Startup:    { bg: 'rgba(6,182,212,0.12)',     text: '#22d3ee', border: 'rgba(34,211,238,0.25)' },
  'Mid-size': { bg: 'rgba(59,130,246,0.12)',    text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  Enterprise: { bg: 'rgba(139,92,246,0.12)',    text: '#a78bfa', border: 'rgba(167,139,250,0.25)' },
}

function GlassSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-xs rounded-full px-3.5 py-2 cursor-pointer appearance-none outline-none transition-all"
      style={{
        background: value ? 'rgba(0,255,135,0.15)' : 'rgba(255,255,255,0.06)',
        border: value ? '1px solid rgba(0,255,135,0.35)' : '1px solid rgba(255,255,255,0.10)',
        color: value ? '#00FF87' : 'rgba(255,255,255,0.6)',
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: '#111827', color: '#fff' }}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

export default function CompaniesPage({ onLoginClick, onCompanyJobsClick }) {
  const { user } = useAuth()

  const [query,   setQuery]   = useState('')
  const [size,    setSize]    = useState('')
  const [hasJobs, setHasJobs] = useState(false)
  const [page,    setPage]    = useState(1)

  const [showSuggest, setShowSuggest] = useState(false)
  const [justAdded,   setJustAdded]   = useState(null)

  const { companies, count, totalPages, loading, error } = useCompanies({
    query, size, hasJobs, page,
  })

  const handleQuery  = v => { setQuery(v); setPage(1) }
  const handleSize   = v => { setSize(v);  setPage(1) }
  const handleJobs   = v => { setHasJobs(v); setPage(1) }

  function handleSuggestClick() {
    if (!user) { onLoginClick?.(); return }
    setShowSuggest(true)
  }

  function handleSuggestSuccess(company) {
    setJustAdded(company.name)
    setShowSuggest(false)
    setTimeout(() => setJustAdded(null), 7000)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase mb-2" style={{ color: '#00FF87' }}>
            Company Directory
          </p>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl" style={{ color: 'rgba(255,255,255,0.95)' }}>
            Who's hiring
            <span className="italic font-normal" style={{ color: '#00FF87' }}> in Berlin</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {count > 0
              ? `${count.toLocaleString()} companies tracked — updated daily`
              : 'Browse all companies hiring in Berlin & remote from Germany'}
          </p>
        </div>

        <button
          onClick={handleSuggestClick}
          className="btn-gold shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
        >
          <span>＋</span>
          <span>Suggest a company</span>
        </button>
      </div>

      {/* ── Success toast ────────────────────────────────────────────────── */}
      {justAdded && (
        <div
          className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}
        >
          <span>🎉</span>
          <span><strong>{justAdded}</strong> added! Jobs will appear after the next crawler run.</span>
          <button onClick={() => setJustAdded(null)} className="ml-auto opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2.5 mb-6 p-3 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={e => handleQuery(e.target.value)}
            placeholder="Search companies…"
            className="glass-input w-full pl-8 pr-3 py-2 rounded-xl text-xs"
          />
        </div>

        <GlassSelect value={size} onChange={handleSize} options={SIZE_OPTIONS} />

        <button
          onClick={() => handleJobs(!hasJobs)}
          className="px-3.5 py-2 rounded-full text-xs font-medium transition-all"
          style={hasJobs ? {
            background: 'rgba(0,255,135,0.18)',
            border: '1px solid rgba(0,255,135,0.4)',
            color: '#00FF87',
          } : {
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          ✦ Hiring now
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185' }}
        >
          <strong>Could not load companies:</strong> {error}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl p-5 space-y-3 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="h-4 rounded-lg w-2/3" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="h-3 rounded-lg w-1/3" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <div className="flex gap-2 mt-3">
                <div className="h-5 rounded-full w-16" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-5 rounded-full w-20" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && !error && companies.length === 0 && (
        <div className="text-center py-24">
          <div className="text-5xl mb-5">🏢</div>
          <h3 className="font-display font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
            No companies found
          </h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Try a different search, or add the company yourself.
          </p>
          <button onClick={handleSuggestClick} className="btn-gold px-6 py-2.5 rounded-xl text-sm">
            Suggest a company
          </button>
        </div>
      )}

      {/* ── Company grid ─────────────────────────────────────────────────── */}
      {!loading && companies.length > 0 && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(company => (
              <CompanyCard
                key={company.id}
                company={company}
                onJobsClick={onCompanyJobsClick ? () => onCompanyJobsClick(company) : null}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost px-4 py-2 rounded-xl text-sm disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost px-4 py-2 rounded-xl text-sm disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Suggest modal ────────────────────────────────────────────────── */}
      {showSuggest && (
        <SuggestCompanyModal
          onClose={() => setShowSuggest(false)}
          onSuccess={handleSuggestSuccess}
        />
      )}
    </div>
  )
}


// ── Company card ─────────────────────────────────────────────────────────────

function CompanyCard({ company, onJobsClick }) {
  const { name, homepage_url, company_size, hq_city, job_count } = company

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')

  const sizeStyle = SIZE_CHIP[company_size] ?? { bg: 'rgba(255,255,255,0.07)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.12)' }
  const hiringStyle = job_count > 0
    ? { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.25)' }
    : { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.08)' }

  return (
    <article className="card p-5 flex flex-col gap-3.5 group">

      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0
            font-display font-semibold text-sm select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(0,255,135,0.2), rgba(109,40,160,0.15))',
            border: '1px solid rgba(0,255,135,0.2)',
            color: '#00FF87',
          }}
        >
          {initials || '?'}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="font-display font-semibold text-sm leading-snug truncate"
            style={{ color: 'rgba(255,255,255,0.92)' }}
            title={name}
          >
            {name}
          </h3>
          {hq_city && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>
              📍 {hq_city}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {company_size && (
          <span
            className="chip"
            style={{ backgroundColor: sizeStyle.bg, color: sizeStyle.text, borderColor: sizeStyle.border }}
          >
            {company_size}
          </span>
        )}
        {job_count > 0 && onJobsClick ? (
          <button
            onClick={onJobsClick}
            className="chip transition-all"
            style={{ backgroundColor: hiringStyle.bg, color: hiringStyle.text, borderColor: hiringStyle.border, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(52,211,153,0.22)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = hiringStyle.bg; e.currentTarget.style.borderColor = hiringStyle.border }}
            title={`View all ${job_count} jobs at ${name}`}
          >
            {job_count} open {job_count === 1 ? 'job' : 'jobs'} →
          </button>
        ) : (
          <span
            className="chip"
            style={{ backgroundColor: hiringStyle.bg, color: hiringStyle.text, borderColor: hiringStyle.border }}
          >
            {job_count > 0 ? `${job_count} open ${job_count === 1 ? 'job' : 'jobs'}` : 'No open jobs'}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Website link */}
      <a
        href={homepage_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs transition-colors truncate block hover:underline overflow-hidden"
        style={{ color: 'rgba(255,255,255,0.3)', maxWidth: '100%', wordBreak: 'break-all' }}
        onMouseEnter={e => e.currentTarget.style.color = '#00FF87'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
      >
        {homepage_url.replace(/^https?:\/\//, '')} ↗
      </a>
    </article>
  )
}
