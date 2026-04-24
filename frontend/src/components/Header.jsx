import LogoLotus from './LogoLotus.jsx'

export default function Header({
  user,
  savedCount,
  view = 'jobs',
  onViewChange,
  onLoginClick,
  onLogout,
  onSavedClick,
}) {
  return (
    <header className="glass-panel sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Wordmark */}
        <button
          onClick={() => onViewChange?.('jobs')}
          className="flex items-center gap-2.5 shrink-0"
        >
          <LogoLotus size={26} />
          <span className="font-display font-semibold text-xl tracking-tight" style={{ color: 'var(--text-1)' }}>
            Berlin<span style={{ color: '#D4AF37' }}>JobHunt</span>
          </span>
        </button>

        {/* Nav tabs — desktop */}
        <nav className="hidden sm:flex items-center gap-1">
          <button
            className={`nav-tab ${view === 'jobs' ? 'active' : ''}`}
            onClick={() => onViewChange?.('jobs')}
          >
            Jobs
          </button>
          <button
            className={`nav-tab ${view === 'companies' ? 'active' : ''}`}
            onClick={() => onViewChange?.('companies')}
          >
            Companies
          </button>
          <button
            className={`nav-tab ${view === 'insights' ? 'active' : ''}`}
            onClick={() => onViewChange?.('insights')}
          >
            Insights
          </button>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">

          {/* Mobile nav */}
          <div className="flex sm:hidden items-center gap-1">
            <button
              className={`nav-tab text-xs px-2.5 py-1 ${view === 'jobs' ? 'active' : ''}`}
              onClick={() => onViewChange?.('jobs')}
            >
              Jobs
            </button>
            <button
              className={`nav-tab text-xs px-2.5 py-1 ${view === 'companies' ? 'active' : ''}`}
              onClick={() => onViewChange?.('companies')}
            >
              Cos.
            </button>
            <button
              className={`nav-tab text-xs px-2.5 py-1 ${view === 'insights' ? 'active' : ''}`}
              onClick={() => onViewChange?.('insights')}
            >
              ✦
            </button>
          </div>

          {user && (
            <button
              onClick={onSavedClick}
              title="View saved jobs"
              className="btn-dim relative px-3 py-1.5"
              style={{ borderRadius: '9999px' }}
            >
              <span style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
                {savedCount > 0 ? '♥' : '♡'}
              </span>
              <span className="hidden sm:inline ml-1">Saved</span>
              {savedCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none"
                  style={{ background: '#ef4444' }}
                >
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              )}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs hidden sm:block truncate max-w-[130px]" style={{ color: 'var(--text-3)' }}>
                {user.email}
              </span>
              <button
                onClick={onLogout}
                className="btn-dim"
                style={{ borderRadius: '9999px', padding: '0.35rem 0.875rem' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={onLoginClick} className="btn-gold" style={{ borderRadius: '9999px' }}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
