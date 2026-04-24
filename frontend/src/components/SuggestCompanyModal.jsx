import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api/v1'

/**
 * Modal for suggesting a new company to the directory.
 * Requires the user to be signed in (enforced by the parent).
 */
export default function SuggestCompanyModal({ onClose, onSuccess }) {
  const { getAccessToken } = useAuth()

  const [name,        setName]        = useState('')
  const [homepageUrl, setHomepageUrl] = useState('')
  const [jobBoardUrl, setJobBoardUrl] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [errors,      setErrors]      = useState({})
  const [serverError, setServerError] = useState('')
  const [done,        setDone]        = useState(false)
  const [result,      setResult]      = useState(null)

  function validate() {
    const errs = {}
    if (!name.trim())        errs.name = 'Company name is required.'
    if (!homepageUrl.trim()) errs.homepageUrl = 'Homepage URL is required.'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    setServerError('')
    setErrors({})

    try {
      const token = await getAccessToken()
      const res   = await fetch(`${API_BASE}/companies/suggest/`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name:          name.trim(),
          homepage_url:  homepageUrl.trim(),
          job_board_url: jobBoardUrl.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (typeof data === 'object' && !data.detail) setErrors(data)
        else setServerError(data.detail ?? 'Something went wrong. Please try again.')
        return
      }

      setResult(data)
      setDone(true)
      onSuccess?.(data)
    } catch {
      setServerError('Network error — please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: 'rgba(6,13,26,0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10, 20, 40, 0.96)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: '#d4a853' }}>
              Directory
            </p>
            <h2 className="font-display font-semibold text-xl" style={{ color: 'rgba(255,255,255,0.95)' }}>
              Suggest a company
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              We'll crawl for jobs on the next daily run.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none ml-4 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            ×
          </button>
        </div>

        {/* Success */}
        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="text-5xl mb-5">🎉</div>
            <h3 className="font-display font-semibold text-xl mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {result?.name ?? name} added!
            </h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              The crawler will pick up jobs from this company on the next daily run.
            </p>
            <button onClick={onClose} className="btn-gold px-8 py-2.5 rounded-xl text-sm">
              Done
            </button>
          </div>
        ) : (

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {serverError && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fb7185' }}
              >
                {serverError}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Company name <span style={{ color: '#fb7185' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Zalando"
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm"
                style={errors.name ? { borderColor: 'rgba(244,63,94,0.5)' } : {}}
              />
              {errors.name && (
                <p className="mt-1 text-xs" style={{ color: '#fb7185' }}>{errors.name}</p>
              )}
            </div>

            {/* Homepage */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Homepage URL <span style={{ color: '#fb7185' }}>*</span>
              </label>
              <input
                type="url"
                value={homepageUrl}
                onChange={e => setHomepageUrl(e.target.value)}
                placeholder="https://zalando.com"
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm"
                style={errors.homepageUrl || errors.homepage_url ? { borderColor: 'rgba(244,63,94,0.5)' } : {}}
              />
              {(errors.homepageUrl || errors.homepage_url) && (
                <p className="mt-1 text-xs" style={{ color: '#fb7185' }}>
                  {errors.homepageUrl || errors.homepage_url}
                </p>
              )}
            </div>

            {/* Careers page */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Careers page URL
                <span className="ml-1.5 font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
              </label>
              <input
                type="url"
                value={jobBoardUrl}
                onChange={e => setJobBoardUrl(e.target.value)}
                placeholder="https://zalando.com/jobs  or  boards.greenhouse.io/zalando"
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm"
              />
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Linking directly to the jobs page speeds up discovery.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost flex-1 py-2.5 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-gold flex-1 py-2.5 rounded-xl text-sm disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Suggest company'}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}
