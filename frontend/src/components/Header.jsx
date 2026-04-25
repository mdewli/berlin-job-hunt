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
    <>
      {/* ── Top header bar ──────────────────────────────────────────────────── */}
      <header className="glass-panel sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">

          {/* Logo — clicking clears everything and goes home */}
          <button
            onClick={() => onViewChange?.('home')}
            className="flex items-center gap-2 shrink-0"
            aria-label="Home"
          >
            <LogoLotus size={24} />
            <span className="font-display font-semibold text-lg sm:text-xl tracking-tight" style={{ color: 'var(--text-1)' }}>
              Berlin<span style={{ color: '#00FF87' }}>JobHunt</span>
            </span>
          </button>

          {/* Desktop nav tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            <button className={`nav-tab ${view === 'jobs' ? 'active' : ''}`} onClick={() => onViewChange?.('jobs')}>
              Jobs
            </button>
            <button className={`nav-tab ${view === 'companies' ? 'active' : ''}`} onClick={() => onViewChange?.('companies')}>
              Companies
            </button>
            <button className={`nav-tab ${view === 'insights' ? 'active' : ''}`} onClick={() => onViewChange?.('insights')}>
              Insights
            </button>
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={onSavedClick}
                title="Saved jobs"
                className="btn-dim relative px-3 py-1.5"
              >
                <span style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
                  {savedCount > 0 ? '♥' : '♡'}
                </span>
                <span className="hidden sm:inline ml-1 text-xs">Saved</span>
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
                <span className="text-xs hidden md:block truncate max-w-[130px]" style={{ color: 'var(--text-3)' }}>
                  {user.email}
                </span>
                <button onClick={onLogout} className="btn-dim text-xs">Sign out</button>
              </div>
            ) : (
              <button onClick={onLoginClick} className="btn-gold text-xs sm:text-sm">
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navigation bar ────────────────────────────────────── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button className={`mobile-nav-btn ${view === 'jobs' ? 'active' : ''}`} onClick={() => onViewChange?.('jobs')}>
          <span className="nav-icon">💼</span>
          <span className="nav-label">Jobs</span>
        </button>
        <button className={`mobile-nav-btn ${view === 'companies' ? 'active' : ''}`} onClick={() => onViewChange?.('companies')}>
          <span className="nav-icon">🏢</span>
          <span className="nav-label">Companies</span>
        </button>
        <button className={`mobile-nav-btn ${view === 'insights' ? 'active' : ''}`} onClick={() => onViewChange?.('insights')}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
        {user ? (
          <button className="mobile-nav-btn" onClick={onSavedClick}>
            <span className="nav-icon" style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
              {savedCount > 0 ? '♥' : '♡'}
            </span>
            <span className="nav-label" style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
              {savedCount > 0 ? (savedCount > 9 ? '9+' : savedCount) : 'Saved'}
            </span>
          </button>
        ) : (
          <button className="mobile-nav-btn" onClick={onLoginClick}>
            <span className="nav-icon">👤</span>
            <span className="nav-label" style={{ color: '#00FF87' }}>Sign in</span>
          </button>
        )}
      </nav>
    </>
  )
}
