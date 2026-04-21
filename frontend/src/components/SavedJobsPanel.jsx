import { useEffect } from 'react'
import JobCard from './JobCard.jsx'

/**
 * Slide-in panel (right side) showing the user's saved jobs.
 *
 * @param {{ open, onClose, savedJobs, savedIds, onSaveToggle }} props
 */
export default function SavedJobsPanel({ open, onClose, savedJobs, savedIds, onSaveToggle }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={[
          'fixed top-0 right-0 h-full w-full sm:w-[420px] bg-slate-50 z-50',
          'shadow-2xl flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-label="Saved jobs"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 text-xl">♥</span>
            <h2 className="font-semibold text-slate-900">Saved Jobs</h2>
            {savedJobs.length > 0 && (
              <span className="text-xs bg-rose-100 text-rose-600 font-medium px-2 py-0.5 rounded-full">
                {savedJobs.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none p-1 transition-colors"
            aria-label="Close saved jobs"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {savedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 pb-20">
              <div className="text-5xl mb-4">🤍</div>
              <p className="font-medium text-slate-600">No saved jobs yet</p>
              <p className="text-sm mt-1">
                Click the ♡ on any job card to save it here.
              </p>
            </div>
          ) : (
            savedJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                isSaved={savedIds.has(job.id)}
                onSaveToggle={onSaveToggle}
              />
            ))
          )}
        </div>
      </aside>
    </>
  )
}
