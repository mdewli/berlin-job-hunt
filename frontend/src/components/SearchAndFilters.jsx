const REMOTE_OPTIONS = ['', 'Full-Remote', 'Hybrid', 'On-site']
const SIZE_OPTIONS   = ['', 'Micro', 'Startup', 'Mid-size', 'Enterprise']

function Toggle({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-sm font-medium border transition-all whitespace-nowrap',
        active
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-sm border border-slate-300 rounded-full px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {options.filter(Boolean).map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

export default function SearchAndFilters({ query, setQuery, filters, setFilters, count, loading }) {
  const toggle = key => setFilters(f => ({ ...f, [key]: !f[key] }))
  const set    = key => val => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">

        {/* Search input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search jobs, companies, or tech stack..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          <Toggle
            label="🏙️ Berlin / Remote DE"
            active={filters.berlin}
            onClick={() => toggle('berlin')}
          />
          <Toggle
            label="🇬🇧 No German required"
            active={filters.english_only}
            onClick={() => toggle('english_only')}
          />
          <Toggle
            label="🌍 Full-Remote only"
            active={filters.remote_type === 'Full-Remote'}
            onClick={() => set('remote_type')(filters.remote_type === 'Full-Remote' ? '' : 'Full-Remote')}
          />

          <div className="h-5 w-px bg-slate-200 mx-1 flex-shrink-0" />

          <Select
            value={filters.company_size}
            onChange={set('company_size')}
            options={SIZE_OPTIONS}
            placeholder="Company size"
          />
          <Select
            value={filters.remote_type}
            onChange={set('remote_type')}
            options={REMOTE_OPTIONS}
            placeholder="Work style"
          />
        </div>

        {/* Result count */}
        <p className="text-xs text-slate-500 pb-0.5">
          {loading
            ? 'Loading...'
            : `${count.toLocaleString()} job${count === 1 ? '' : 's'} found`}
        </p>
      </div>
    </div>
  )
}
