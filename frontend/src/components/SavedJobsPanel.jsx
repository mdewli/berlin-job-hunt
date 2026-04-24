import { useEffect } from 'react'
import JobCard from './JobCard.jsx'

export default function SavedJobsPanel({ open, onClose, savedJobs, savedIds, onSaveToggle }) {
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(6,13,26,0.7)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <aside
        aria-label="Saved jobs"
        className="fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col"
        style={{
          background: 'rgba(8, 16, 32, 0.92)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-rose-400 text-xl">♥</span>
            <h2 className="font-display font-semibold text-lg" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Saved Jobs
            </h2>
            {savedJobs.length > 0 && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}
              >
                {savedJobs.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none transition-colors p-1 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-gold">
          {savedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-20">
              <div className="text-5xl mb-4">🤍</div>
              <p className="font-display font-medium text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
                No saved jobs yet
              </p>
              <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Click ♡ on any job card to save it here.
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
