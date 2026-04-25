const REMOTE_OPTIONS = ['', 'Full-Remote', 'Hybrid', 'On-site']
const SIZE_OPTIONS   = ['', 'Micro', 'Startup', 'Mid-size', 'Enterprise']

/* Matches the FilterChip style from LandingPage — uppercase, tracking-widest, square-ish */
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all"
      style={{
        borderRadius: '4px',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        border: active
          ? '1px solid rgba(0,255,135,0.55)'
          : '1px solid rgba(255,255,255,0.18)',
        color: active ? '#00FF87' : 'rgba(255,255,255,0.65)',
        background: active ? 'rgba(0,255,135,0.10)' : 'rgba(255,255,255,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,255,135,0.65)'
        e.currentTarget.style.color = '#00FF87'
        e.currentTarget.style.background = 'rgba(0,255,135,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = active ? 'rgba(0,255,135,0.55)' : 'rgba(255,255,255,0.18)'
        e.currentTarget.style.color = active ? '#00FF87' : 'rgba(255,255,255,0.65)'
        e.currentTarget.style.background = active ? 'rgba(0,255,135,0.10)' : 'rgba(255,255,255,0.04)'
      }}
    >
      {label}
    </button>
  )
}

function GlassSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="cursor-pointer appearance-none outline-none transition-all font-bold"
      style={{
        borderRadius: '4px',
        padding: '0.375rem 0.75rem',
        fontSize: '0.6875rem',
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        background: value ? 'rgba(0,255,135,0.10)' : 'rgba(255,255,255,0.04)',
        border: value ? '1px solid rgba(0,255,135,0.50)' : '1px solid rgba(255,255,255,0.18)',
        color: value ? '#00FF87' : 'rgba(255,255,255,0.65)',
      }}
    >
      <option value="" style={{ background: '#151921', color: '#fff' }}>{placeholder}</option>
      {options.filter(Boolean).map(o => (
        <option key={o} value={o} style={{ background: '#151921', color: '#fff' }}>{o}</option>
      ))}
    </select>
  )
}

export default function SearchAndFilters({
  query, setQuery,
  filters, setFilters,
  count, loading,
  companyFilterName,
  onClearCompany,
}) {
  const toggle = key => setFilters(f => ({ ...f, [key]: !f[key] }))
  const set    = key => val => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="glass-panel sticky top-16 z-30">
      <div className="py-3 px-4">
        <div className="max-w-2xl mx-auto space-y-2.5">

          {/* Active company filter banner */}
          {companyFilterName && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{
                background: 'rgba(0,255,135,0.10)',
                border: '1px solid rgba(0,255,135,0.28)',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Showing jobs at</span>
              <span style={{ color: '#00FF87' }}>{companyFilterName}</span>
              <button
                onClick={onClearCompany}
                className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 transition-all"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#fb7185'
                  e.currentTarget.style.borderColor = 'rgba(251,113,133,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
                }}
              >
                Clear
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'rgba(255,255,255,0.28)' }}
            >
              🔍
            </span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search jobs, companies, technologies..."
              className="input pl-10"
            />
          </div>

          {/* Filter chips — centered, matching LandingPage FilterChip style */}
          <div className="flex items-center justify-center gap-2 flex-wrap pb-0.5">
            <Chip
              label="🏙 Berlin / Remote DE"
              active={filters.berlin}
              onClick={() => toggle('berlin')}
            />
            <Chip
              label="🇬🇧 No German required"
              active={filters.english_only}
              onClick={() => toggle('english_only')}
            />
            <Chip
              label="🌍 Full-Remote"
              active={filters.remote_type === 'Full-Remote'}
              onClick={() => set('remote_type')(filters.remote_type === 'Full-Remote' ? '' : 'Full-Remote')}
            />

            <div className="h-4 w-px shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

            <GlassSelect
              value={filters.company_size}
              onChange={set('company_size')}
              options={SIZE_OPTIONS}
              placeholder="Company size"
            />
            <GlassSelect
              value={filters.remote_type}
              onChange={set('remote_type')}
              options={REMOTE_OPTIONS}
              placeholder="Work style"
            />
          </div>

          {/* Count */}
          <p className="text-xs pb-0.5 text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {loading
              ? 'Searching...'
              : `${count.toLocaleString()} ${count === 1 ? 'position' : 'positions'} found`}
          </p>
        </div>
      </div>
    </div>
  )
}
