import LogoLotus from './LogoLotus.jsx'

export default function Header({
  user,
  savedCount,
  view = 'home',
  onViewChange,
  onLoginClick,
  onLogout,
  onSavedClick,
}) {
  const isJobs      = view === 'jobs'
  const isCompanies = view === 'companies'
  const isInsights  = view === 'insights'

  return (
    <>
      <header className="glass-panel sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 grid grid-cols-3 items-center">

          {/* Left — logo */}
          <button
            onClick={() => onViewChange?.('home')}
            className="flex items-center gap-2 justify-self-start"
            aria-label="Home"
          >
            <LogoLotus size={22} />
            <span className="font-bold text-base sm:text-lg tracking-tight hidden sm:inline" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Berlin<span style={{ color: '#00FF87' }}>JobHunt</span>
            </span>
          </button>

          {/* Center — desktop nav */}
          <nav className="hidden sm:flex items-center justify-center gap-1">
            <button className={`nav-tab ${isJobs ? 'active' : ''}`}      onClick={() => onViewChange?.('jobs')}>Jobs</button>
            <button className={`nav-tab ${isCompanies ? 'active' : ''}`} onClick={() => onViewChange?.('companies')}>Companies</button>
            <button className={`nav-tab ${isInsights ? 'active' : ''}`}  onClick={() => onViewChange?.('insights')}>Insights</button>
          </nav>

          {/* Right — auth + saved */}
          <div className="flex items-center gap-2 justify-self-end">
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
                    className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    style={{ background: '#ef4444' }}
                  >
                    {savedCount > 9 ? '9+' : savedCount}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs hidden md:block truncate max-w-[110px]" style={{ color: 'var(--text-3)' }}>
                  {user.email}
                </span>
                <button onClick={onLogout} className="btn-dim text-xs">Sign out</button>
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full transition-all"
                style={{
                  border: '1px solid rgba(0,255,135,0.50)',
                  color: '#00FF87',
                  background: 'transparent',
                  letterSpacing: '0.04em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,255,135,0.10)'
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(0,255,135,0.18)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                SIGN IN
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navigation bar ────────────────────────────── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button className={`mobile-nav-btn ${view === 'home' ? 'active' : ''}`}      onClick={() => onViewChange?.('home')}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button className={`mobile-nav-btn ${isJobs ? 'active' : ''}`}               onClick={() => onViewChange?.('jobs')}>
          <span className="nav-icon">💼</span>
          <span className="nav-label">Jobs</span>
        </button>
        <button className={`mobile-nav-btn ${isCompanies ? 'active' : ''}`}          onClick={() => onViewChange?.('companies')}>
          <span className="nav-icon">🏢</span>
          <span className="nav-label">Companies</span>
        </button>
        <button className={`mobile-nav-btn ${isInsights ? 'active' : ''}`}           onClick={() => onViewChange?.('insights')}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
        {user ? (
          <button className="mobile-nav-btn" onClick={onSavedClick}>
            <span className="nav-icon" style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
              {savedCount > 0 ? '♥' : '♡'}
            </span>
            <span className="nav-label" style={{ color: savedCount > 0 ? '#fb7185' : undefined }}>
              {savedCount > 9 ? '9+' : savedCount > 0 ? savedCount : 'Saved'}
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
