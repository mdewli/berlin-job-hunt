export default function Header({ user, savedCount, onLoginClick, onLogout, onSavedClick }) {
  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐻</span>
          <div>
            <span className="font-bold text-lg tracking-tight">Berlin</span>
            <span className="font-light text-lg text-indigo-400">JobHub</span>
          </div>
        </div>

        {/* Tagline (hidden on mobile) */}
        <p className="hidden md:block text-sm text-slate-400">
          English-friendly tech jobs in Berlin &amp; remote from Germany
        </p>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={onSavedClick}
              className="relative flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-600 hover:border-rose-400 hover:text-rose-400 transition-colors"
              title="View saved jobs"
            >
              <span>{savedCount > 0 ? '♥' : '♡'}</span>
              <span className="hidden sm:inline">Saved</span>
              {savedCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {savedCount > 9 ? '9+' : savedCount}
                </span>
              )}
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300 hidden sm:block truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={onLogout}
                className="text-sm px-3 py-1.5 rounded-md border border-slate-600 hover:border-slate-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="text-sm px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors"
            >
              Sign in
            </button>
          )}
        </div>

      </div>
    </header>
  )
}
