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
  const isHome      = view === 'home'

  return (
    <header className="glass-panel sticky top-0 z-40">

      {/* ── Row 1: Logo + Auth ─────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 h-12 sm:h-14 grid grid-cols-3 items-center">

        {/* Left — logo */}
        <button
          onClick={() => onViewChange?.('home')}
          className="flex items-center gap-2 justify-self-start"
          aria-label="Home"
        >
          <LogoLotus size={20} />
          <span
            className="font-bold text-sm sm:text-lg tracking-tight"
            style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}
          >
            Berlin<span style={{ color: '#00FF87' }}>JobHunt</span>
          </span>
        </button>

        {/* Center — desktop nav (hidden on mobile) */}
        <nav className="hidden sm:flex items-center justify-center gap-1">
          <button className={`nav-tab ${isHome ? 'active' : ''}`}      onClick={() => onViewChange?.('home')}>Home</button>
          <button className={`nav-tab ${isJobs ? 'active' : ''}`}      onClick={() => onViewChange?.('jobs')}>Jobs</button>
          <button className={`nav-tab ${isCompanies ? 'active' : ''}`} onClick={() => onViewChange?.('companies')}>Companies</button>
          <button className={`nav-tab ${isInsights ? 'active' : ''}`}  onClick={() => onViewChange?.('insights')}>Insights</button>
        </nav>

        {/* Right — auth */}
        <div className="flex items-center gap-2 justify-self-end">
          {user && (
            <button
              onClick={onSavedClick}
              title="Saved jobs"
              className="btn-dim relative px-2.5 py-1.5"
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
              className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all"
              style={{
                border: '1px solid rgba(0,255,135,0.50)',
                color: '#00FF87',
                background: 'transparent',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
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
              Sign in
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Mobile nav tabs (hidden on sm+) ──────────────────── */}
      <nav
        className="sm:hidden flex border-t"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        aria-label="Mobile navigation"
      >
        {[
          { id: 'home',      icon: '🏠', label: 'Home'      },
          { id: 'jobs',      icon: '💼', label: 'Jobs'      },
          { id: 'companies', icon: '🏢', label: 'Companies' },
          { id: 'insights',  icon: '📊', label: 'Insights'  },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => onViewChange?.(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
            style={{
              background: view === tab.id ? 'rgba(0,255,135,0.07)' : 'transparent',
              borderBottom: view === tab.id ? '2px solid #00FF87' : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{tab.icon}</span>
            <span
              className="font-medium"
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.04em',
                color: view === tab.id ? '#00FF87' : 'rgba(255,255,255,0.4)',
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}

        {/* Saved / Sign-in slot */}
        {user ? (
          <button
            onClick={onSavedClick}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all relative"
            style={{ background: 'transparent', borderBottom: '2px solid transparent' }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1, color: savedCount > 0 ? '#fb7185' : 'rgba(255,255,255,0.4)' }}>
              {savedCount > 0 ? '♥' : '♡'}
            </span>
            <span
              className="font-medium"
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.04em',
                color: savedCount > 0 ? '#fb7185' : 'rgba(255,255,255,0.4)',
              }}
            >
              {savedCount > 0 ? savedCount : 'Saved'}
            </span>
            {savedCount > 0 && (
              <span
                className="absolute top-1 right-3 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"
                style={{ background: '#ef4444' }}
              >
                {savedCount > 9 ? '9+' : savedCount}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all"
            style={{ background: 'transparent', borderBottom: '2px solid transparent' }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>👤</span>
            <span
              className="font-medium"
              style={{ fontSize: '0.6rem', letterSpacing: '0.04em', color: '#00FF87' }}
            >
              Sign in
            </span>
          </button>
        )}
      </nav>

    </header>
  )
}
