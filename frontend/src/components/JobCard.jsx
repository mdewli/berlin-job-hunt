import { useState } from 'react'
import { motion } from 'framer-motion'

// ── Badge colour maps ─────────────────────────────────────────────────────────
const REMOTE_BADGE = {
  'Full-Remote': { bg: 'rgba(16,185,129,0.10)', text: '#34d399', border: 'rgba(52,211,153,0.22)' },
  'Hybrid':      { bg: 'rgba(245,158,11,0.10)', text: '#fbbf24', border: 'rgba(251,191,36,0.22)' },
  'On-site':     { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.10)' },
}
const SIZE_BADGE = {
  'Enterprise': { bg: 'rgba(139,92,246,0.10)', text: '#a78bfa', border: 'rgba(167,139,250,0.22)' },
  'Mid-size':   { bg: 'rgba(59,130,246,0.10)', text: '#60a5fa', border: 'rgba(96,165,250,0.22)' },
  'Startup':    { bg: 'rgba(6,182,212,0.10)',  text: '#22d3ee', border: 'rgba(34,211,238,0.22)' },
  'Micro':      { bg: 'rgba(20,184,166,0.10)', text: '#2dd4bf', border: 'rgba(45,212,191,0.22)' },
}
const CEFR_BADGE = {
  C2: { bg: 'rgba(244,63,94,0.10)',  text: '#fb7185', border: 'rgba(251,113,133,0.22)' },
  C1: { bg: 'rgba(249,115,22,0.10)', text: '#fb923c', border: 'rgba(251,146,60,0.22)' },
  B2: { bg: 'rgba(234,179,8,0.10)',  text: '#facc15', border: 'rgba(250,204,21,0.22)' },
  B1: { bg: 'rgba(132,204,22,0.10)', text: '#a3e635', border: 'rgba(163,230,53,0.22)' },
  A2: { bg: 'rgba(34,197,94,0.10)',  text: '#4ade80', border: 'rgba(74,222,128,0.22)' },
  A1: { bg: 'rgba(16,185,129,0.10)', text: '#34d399', border: 'rgba(52,211,153,0.22)' },
}
const FALLBACK_BADGE = { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.10)' }
const LANG_NAMES = { german: 'DE', english: 'EN', french: 'FR', spanish: 'ES' }

const ACCENT_BORDER = {
  'Full-Remote': '#34d399',
  'Hybrid':      '#fbbf24',
  'On-site':     'rgba(255,255,255,0.08)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ style = FALLBACK_BADGE, icon, children, title }) {
  return (
    <span
      title={title}
      className="badge"
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {children}
    </span>
  )
}

function CompanyLogo({ name, homepageUrl }) {
  const [failed, setFailed] = useState(false)
  const domain = homepageUrl?.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
  const initials = name?.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') ?? '?'

  if (failed || !domain) {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold font-display shrink-0 select-none"
        style={{ background: 'rgba(0,255,135,0.10)', border: '1px solid rgba(0,255,135,0.18)', color: '#00FF87' }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={() => setFailed(true)}
        className="w-7 h-7 object-contain"
      />
    </div>
  )
}

// ── Card animation variant (used by parent grid for stagger) ──────────────────
export const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function JobCard({ job, isSaved, onSaveToggle, onQuickView }) {
  const [saving, setSaving] = useState(false)

  const handleSave = async e => {
    e.stopPropagation()
    setSaving(true)
    try { await onSaveToggle(job.id) }
    catch (err) { console.error('Save failed:', err) }
    finally { setSaving(false) }
  }

  const company      = job.company ?? {}
  const accentColor  = ACCENT_BORDER[job.remote_type] ?? 'rgba(255,255,255,0.06)'
  const postedDate   = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString('en-DE', { day: 'numeric', month: 'short' })
    : ''

  return (
    <motion.article
      className="card p-5 flex flex-col gap-3 relative overflow-hidden cursor-default"
      variants={cardVariant}
      whileHover={{ y: -5, boxShadow: '0px 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,255,135,0.15)' }}
      transition={{ duration: 0.2 }}
      layout
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-5 bottom-5 w-[3px] rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Top row: logo + company + badges */}
      <div className="flex items-start gap-2.5 pl-4">
        <CompanyLogo name={company.name} homepageUrl={company.homepage_url} />

        <div className="flex-1 min-w-0">
          {/* Company name */}
          <p
            className="text-xs font-medium truncate"
            style={{ color: '#00FF87' }}
            title={company.name}
          >
            {company.name ?? 'Unknown company'}
            {company.hq_city && (
              <span style={{ color: 'var(--text-3)' }}> · {company.hq_city}</span>
            )}
          </p>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {company.company_size && (
              <Badge style={SIZE_BADGE[company.company_size]}>{company.company_size}</Badge>
            )}
            {job.remote_type && (
              <Badge style={REMOTE_BADGE[job.remote_type]}>
                {job.remote_type === 'Full-Remote' ? '🌍' : job.remote_type === 'Hybrid' ? '🏢' : '📍'}
                {' '}{job.remote_type}
              </Badge>
            )}
            {job.is_in_berlin && (
              <Badge style={{ bg: 'rgba(0,255,135,0.10)', text: '#00FF87', border: 'rgba(0,255,135,0.22)' }}>
                Berlin
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Job title — clicking opens Quick View */}
      <div className="pl-4">
        <h2
          className="font-display font-semibold text-[0.9375rem] leading-snug cursor-pointer group"
          style={{ color: 'var(--text-1)' }}
          onClick={() => onQuickView?.(job)}
          title="Quick view"
        >
          <span className="hover:text-[#00FF87] transition-colors duration-150">{job.title}</span>
        </h2>
        {job.role_category && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {job.role_category}
          </p>
        )}
      </div>

      {/* Tech stack */}
      {job.tech_stack?.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-4">
          {job.tech_stack.slice(0, 6).map(tech => (
            <Badge key={tech}>{tech}</Badge>
          ))}
          {job.tech_stack.length > 6 && (
            <Badge>+{job.tech_stack.length - 6}</Badge>
          )}
        </div>
      )}

      {/* Language + date meta — icons instead of labels */}
      <div className="flex items-center gap-3 pl-4 flex-wrap">
        {Object.entries(job.languages ?? {}).map(([lang, level]) => (
          <span
            key={lang}
            className="badge"
            title={`${lang}: ${level}`}
            style={{
              ...(CEFR_BADGE[level] ?? FALLBACK_BADGE),
              backgroundColor: (CEFR_BADGE[level] ?? FALLBACK_BADGE).bg,
              borderColor:     (CEFR_BADGE[level] ?? FALLBACK_BADGE).border,
              color:           (CEFR_BADGE[level] ?? FALLBACK_BADGE).text,
            }}
          >
            {/* Globe for any language */}
            <span aria-hidden>🌐</span>
            {LANG_NAMES[lang] ?? lang.toUpperCase()} {level}
          </span>
        ))}

        {postedDate && (
          <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
            <span aria-hidden>🕐</span> {postedDate}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="divider mx-0" />

      {/* Footer actions */}
      <div className="flex items-center justify-between pl-4">
        {/* Quick-view button — clearly visible pill */}
        <button
          onClick={() => onQuickView?.(job)}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all"
          style={{
            color: 'rgba(255,255,255,0.70)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#00FF87'
            e.currentTarget.style.borderColor = 'rgba(0,255,135,0.35)'
            e.currentTarget.style.background = 'rgba(0,255,135,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.70)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          }}
        >
          <span>Quick view</span>
          <span style={{ opacity: 0.7 }}>↗</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Save button with label */}
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background:  isSaved ? 'rgba(251,113,133,0.12)' : 'rgba(0,255,135,0.07)',
              border:      isSaved ? '1px solid rgba(251,113,133,0.30)' : '1px solid rgba(0,255,135,0.28)',
              color:       isSaved ? '#fb7185' : '#00FF87',
              letterSpacing: '0.02em',
            }}
          >
            <span aria-hidden>{saving ? '…' : isSaved ? '♥' : '♡'}</span>
            {!saving && <span>{isSaved ? 'Saved' : 'Save'}</span>}
          </motion.button>

          {/* Ghost Apply button — fills on hover */}
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            onClick={e => e.stopPropagation()}
          >
            Apply →
          </a>
        </div>
      </div>
    </motion.article>
  )
}
