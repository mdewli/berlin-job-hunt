import { useState } from 'react'

// ── Badge helpers ──────────────────────────────────────────────────────────────

const REMOTE_STYLES = {
  'Full-Remote': 'bg-emerald-100 text-emerald-700',
  'Hybrid':      'bg-amber-100 text-amber-700',
  'On-site':     'bg-slate-100 text-slate-600',
}

const SIZE_STYLES = {
  'Enterprise': 'bg-violet-100 text-violet-700',
  'Mid-size':   'bg-blue-100 text-blue-700',
  'Startup':    'bg-cyan-100 text-cyan-700',
  'Micro':      'bg-teal-100 text-teal-700',
}

const CEFR_STYLES = {
  C2: 'bg-rose-100 text-rose-700',
  C1: 'bg-orange-100 text-orange-700',
  B2: 'bg-yellow-100 text-yellow-700',
  B1: 'bg-lime-100 text-lime-700',
  A2: 'bg-green-100 text-green-700',
  A1: 'bg-emerald-100 text-emerald-700',
}

const LANG_NAMES = { german: 'DE', english: 'EN', french: 'FR', spanish: 'ES' }

function Badge({ children, className }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

/**
 * @param {{ job, isSaved, onSaveToggle }} props
 *
 * onSaveToggle(jobId) — async; returns null if unauthenticated (parent opens modal),
 * true/false for new saved state, or throws on API error.
 */
export default function JobCard({ job, isSaved, onSaveToggle }) {
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSaveToggle(job.id)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const company = job.company ?? {}
  const borderColor = job.remote_type === 'Full-Remote'
    ? 'border-l-emerald-400'
    : job.remote_type === 'Hybrid'
    ? 'border-l-amber-400'
    : 'border-l-slate-300'

  return (
    <article
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 border-l-4 ${borderColor} p-5 flex flex-col gap-3`}
    >
      {/* Top row: company size + remote badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {company.company_size && (
          <Badge className={SIZE_STYLES[company.company_size] ?? 'bg-slate-100 text-slate-600'}>
            {company.company_size}
          </Badge>
        )}
        {job.remote_type && (
          <Badge className={REMOTE_STYLES[job.remote_type] ?? 'bg-slate-100 text-slate-600'}>
            {job.remote_type === 'Full-Remote' ? '🌍 ' : job.remote_type === 'Hybrid' ? '🏢 ' : '📍 '}
            {job.remote_type}
          </Badge>
        )}
        {job.is_in_berlin && (
          <Badge className="bg-slate-800 text-white">Berlin</Badge>
        )}
        {company.hq_city && company.hq_city !== 'Berlin' && (
          <Badge className="bg-slate-100 text-slate-500">{company.hq_city}</Badge>
        )}
      </div>

      {/* Company + title */}
      <div>
        <p className="text-sm font-medium text-indigo-600 mb-0.5">
          {company.name ?? 'Unknown company'}
        </p>
        <h2 className="text-base font-semibold text-slate-900 leading-snug">
          {job.title}
        </h2>
        {job.role_category && (
          <p className="text-xs text-slate-500 mt-0.5">{job.role_category}</p>
        )}
      </div>

      {/* Tech stack */}
      {job.tech_stack?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.tech_stack.slice(0, 8).map(tech => (
            <Badge key={tech} className="bg-indigo-50 text-indigo-700">
              {tech}
            </Badge>
          ))}
          {job.tech_stack.length > 8 && (
            <Badge className="bg-slate-100 text-slate-500">
              +{job.tech_stack.length - 8}
            </Badge>
          )}
        </div>
      )}

      {/* Language requirements */}
      {Object.keys(job.languages ?? {}).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 self-center">Languages:</span>
          {Object.entries(job.languages).map(([lang, level]) => (
            <Badge
              key={lang}
              className={CEFR_STYLES[level] ?? 'bg-slate-100 text-slate-600'}
              title={`${lang}: ${level}`}
            >
              {LANG_NAMES[lang] ?? lang.toUpperCase()}: {level}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <span className="text-xs text-slate-400">
          {new Date(job.posted_at).toLocaleDateString('en-DE', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>

        <div className="flex items-center gap-2">
          {/* Save heart */}
          <button
            onClick={handleSave}
            disabled={saving}
            title={isSaved ? 'Unsave job' : 'Save job'}
            className={[
              'p-2 rounded-lg border transition-colors text-lg',
              isSaved
                ? 'border-rose-300 bg-rose-50 text-rose-500'
                : 'border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-400',
            ].join(' ')}
          >
            {saving ? '...' : isSaved ? '♥' : '♡'}
          </button>

          {/* Apply button */}
          <a
            href={job.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Apply →
          </a>
        </div>
      </div>
    </article>
  )
}
