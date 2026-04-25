import { useState } from 'react'

export default function AuthModal({ onClose, signIn, signUp, signInWithGoogle }) {
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

  const handleGoogle = async () => {
    setError(null)
    try {
      await signInWithGoogle?.()
      // Google OAuth redirects — modal will close after redirect back
    } catch (err) {
      setError(err.message ?? 'Google sign-in failed.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(4,8,14,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 relative"
        style={{
          background: 'linear-gradient(145deg, rgba(13,20,32,0.98) 0%, rgba(8,12,20,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,255,135,0.04)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-xl transition-colors"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
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
              We sent a confirmation link to{' '}
              <span style={{ color: '#00FF87' }}>{email}</span>.
              Click it to activate your account.
            </p>
            <button onClick={onClose} className="btn-gold w-full py-2.5 rounded-2xl text-sm mt-2">
              Got it
            </button>
          </div>
        ) : (
          <>
            {/* Accent line */}
            <div className="h-px w-12 mb-6" style={{ background: 'linear-gradient(90deg, #00FF87, transparent)' }} />

            <h2 className="font-display font-semibold text-2xl mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.42)' }}>
              {mode === 'signin' ? 'Sign in to save jobs across sessions.' : 'Save jobs and track your applications.'}
            </p>

            {/* Google sign-in */}
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-xl py-2.5 mb-4 text-sm font-medium transition-all"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.85)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.10)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              }}
            >
              {/* Google icon */}
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1L37.4 9.6C34.1 6.6 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.6-.2-3.2-.9-4.9z"/>
                <path fill="#FF3D00" d="M6.3 15.4l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.2 7.9 3.1L37.4 9.6C34.1 6.6 29.3 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.9z"/>
                <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-2 13.3-5.3l-6.2-5.2C29.1 36.7 26.7 37.5 24 37.5c-5.3 0-9.8-3.6-11.3-8.5l-6.6 5.1C9.4 41 16.2 45.5 24 45.5z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.2 5.2C37 38.3 44.5 32.5 44.5 25c0-1.6-.2-3.2-.9-4.9z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

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
                  className="glass-input"
                  autoComplete="email"
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
                  className="glass-input"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
                className="btn-gold w-full py-2.5 rounded-2xl text-sm mt-1 disabled:opacity-50 justify-center"
              >
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs mt-5" style={{ color: 'rgba(255,255,255,0.32)' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                className="font-medium hover:underline"
                style={{ color: '#00FF87' }}
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
