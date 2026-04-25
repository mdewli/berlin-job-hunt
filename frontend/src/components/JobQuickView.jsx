import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LANG_NAMES  = { german: 'German', english: 'English', french: 'French', spanish: 'Spanish' }
const CEFR_LABELS = { C2: 'Native', C1: 'Advanced', B2: 'Upper-intermediate', B1: 'Intermediate', A2: 'Elementary', A1: 'Beginner' }

const CEFR_STYLE = {
  C2: { bg: 'rgba(244,63,94,0.10)',  text: '#fb7185', border: 'rgba(251,113,133,0.22)' },
  C1: { bg: 'rgba(249,115,22,0.10)', text: '#fb923c', border: 'rgba(251,146,60,0.22)' },
  B2: { bg: 'rgba(234,179,8,0.10)',  text: '#facc15', border: 'rgba(250,204,21,0.22)' },
  B1: { bg: 'rgba(132,204,22,0.10)', text: '#a3e635', border: 'rgba(163,230,53,0.22)' },
  A2: { bg: 'rgba(34,197,94,0.10)',  text: '#4ade80', border: 'rgba(74,222,128,0.22)' },
  A1: { bg: 'rgba(16,185,129,0.10)', text: '#34d399', border: 'rgba(52,211,153,0.22)' },
}

function CompanyLogo({ name, homepageUrl, size = 12 }) {
  const [failed, setFailed] = useState(false)
  const domain   = homepageUrl?.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
  const initials = name?.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') ?? '?'

  if (failed || !domain) {
    return (
      <div
        className={`w-${size} h-${size} rounded-xl flex items-center justify-center font-display font-semibold shrink-0`}
        style={{ background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.18)', color: '#00FF87', fontSize: size * 1.4 + 'px' }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className={`w-${size} h-${size} rounded-xl overflow-hidden shrink-0 flex items-center justify-center`}
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={() => setFailed(true)}
        className="object-contain"
        style={{ width: size * 3 + 'px', height: size * 3 + 'px' }}
      />
    </div>
  )
}

/**
 * Slide-in Quick View drawer for a single job.
 *
 * Props:
 *   job     — job object (or null to close)
 *   onClose — () => void
 *   isSaved — boolean
 *   onSaveToggle — async (jobId) => void
 */
export default function JobQuickView({ job, onClose, isSaved, onSaveToggle }) {
  const [saving, setSaving] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!job) return
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [job, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = job ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [job])

  const handleSave = async () => {
    if (!job) return
    setSaving(true)
    try { await onSaveToggle(job.id) }
    catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const company = job?.company ?? {}

  return (
    <AnimatePresence>
      {job && (
        <>
          {/* Backdrop */}
          <motion.div
            key="qv-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(11,14,20,0.72)', backdropFilter: 'blur(4px)' }}
          />

          {/* Drawer */}
          <motion.aside
            key="qv-drawer"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col w-full sm:w-[480px]"
            style={{
              background: 'rgba(10,14,20,0.55)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              borderLeft: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#00FF87' }}>
                Quick View
              </span>
              <button
                onClick={onClose}
                className="text-xl leading-none transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* ── Scrollable body ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-gold px-6 py-6 space-y-6">

              {/* Company + title */}
              <div className="flex items-start gap-4">
                <CompanyLogo name={company.name} homepageUrl={company.homepage_url} size={12} />
                <div>
                  <p className="text-xs font-medium" style={{ color: '#00FF87' }}>
                    {company.name}
                    {company.hq_city && <span style={{ color: 'var(--text-3)' }}> · {company.hq_city}</span>}
                  </p>
                  <h2
                    className="font-display font-semibold text-xl leading-snug mt-1"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {job.title}
                  </h2>
                  {job.role_category && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                      {job.role_category}
                    </p>
                  )}
                </div>
              </div>

              {/* Key facts */}
              <div
                className="grid grid-cols-2 gap-3 rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {[
                  ['Work style', job.remote_type ?? '—'],
                  ['Company size', company.company_size ?? '—'],
                  ['Location', job.is_in_berlin ? 'Berlin / Remote DE' : company.hq_city ?? '—'],
                  ['Posted', job.posted_at ? new Date(job.posted_at).toLocaleDateString('en-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-1)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Languages */}
              {Object.keys(job.languages ?? {}).length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--text-3)' }}>
                    🌐 Language requirements
                  </p>
                  <div className="space-y-2">
                    {Object.entries(job.languages).map(([lang, level]) => {
                      const s = CEFR_STYLE[level] ?? { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.10)' }
                      return (
                        <div
                          key={lang}
                          className="flex items-center justify-between rounded-lg px-3 py-2"
                          style={{ background: s.bg, border: `1px solid ${s.border}` }}
                        >
                          <span className="text-sm" style={{ color: 'var(--text-1)' }}>
                            {LANG_NAMES[lang] ?? lang}
                          </span>
                          <span className="badge" style={{ backgroundColor: 'transparent', color: s.text, borderColor: 'transparent' }}>
                            {level} · {CEFR_LABELS[level] ?? level}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tech stack */}
              {job.tech_stack?.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--text-3)' }}>
                    ⚙ Tech stack
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tech_stack.map(tech => (
                      <span
                        key={tech}
                        className="badge"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.10)' }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* ── Sticky footer ────────────────────────────────────────── */}
            <div
              className="shrink-0 px-6 py-4 flex items-center gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,14,20,0.40)' }}
            >
              {/* Save */}
              <motion.button
                onClick={handleSave}
                disabled={saving}
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isSaved ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.05)',
                  border:     isSaved ? '1px solid rgba(244,63,94,0.28)' : '1px solid rgba(255,255,255,0.10)',
                  color:      isSaved ? '#fb7185' : 'rgba(255,255,255,0.5)',
                }}
              >
                {saving ? '…' : isSaved ? '♥' : '♡'}
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </motion.button>

              {/* Apply */}
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold flex-1 justify-center py-2.5"
                style={{ borderRadius: '0.75rem' }}
              >
                Apply for this role →
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
