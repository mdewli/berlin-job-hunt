import { useState } from 'react'

export default function AuthModal({ onClose, signIn, signUp }) {
  const [mode,     setMode]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') { await signIn(email, password); onClose() }
      else { await signUp(email, password); setDone(true) }
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
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
        className="w-full max-w-sm rounded-2xl p-8 relative"
        style={{
          background: 'rgba(12, 22, 42, 0.95)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,168,83,0.08)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-xl transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          ×
        </button>

        {done ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">📬</div>
            <h2 className="font-display font-semibold text-xl" style={{ color: 'rgba(255,255,255,0.95)' }}>
              Check your inbox
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              We sent a confirmation link to <span style={{ color: '#d4a853' }}>{email}</span>.
              Click it to activate your account and start saving jobs.
            </p>
            <button onClick={onClose} className="btn-gold mt-2 w-full py-2.5 rounded-xl text-sm">
              Got it
            </button>
          </div>
        ) : (
          <>
            {/* Decorative accent line */}
            <div className="h-px w-12 mb-6" style={{ background: 'linear-gradient(90deg, #d4a853, transparent)' }} />

            <h2 className="font-display font-semibold text-2xl mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {mode === 'signin'
                ? 'Sign in to save jobs across sessions.'
                : 'Save jobs and track your applications.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="min. 6 characters"
                  className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm"
                />
              </div>

              {error && (
                <p
                  className="text-xs px-3.5 py-2.5 rounded-xl"
                  style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', border: '1px solid rgba(244,63,94,0.25)' }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-gold w-full py-2.5 rounded-xl text-sm mt-2 disabled:opacity-50"
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                className="font-medium hover:underline"
                style={{ color: '#d4a853' }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
