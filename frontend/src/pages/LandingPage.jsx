import { useState } from 'react'
import { motion } from 'framer-motion'

const VIBE_CHIPS = [
  { label: 'FULL-REMOTE', filter: { remote_type: 'Full-Remote' } },
  { label: 'HYBRID',      filter: { remote_type: 'Hybrid' } },
  { label: 'ON-SITE',     filter: { remote_type: 'On-site' } },
  { label: 'ENGLISH ONLY', filter: { english_only: true } },
]

const DISTRICT_CHIPS = [
  { label: 'KREUZBERG',       q: 'Kreuzberg' },
  { label: 'MITTE',           q: 'Mitte' },
  { label: 'FRIEDRICHSHAIN',  q: 'Friedrichshain' },
  { label: 'PRENZLAUER BERG', q: 'Prenzlauer Berg' },
  { label: 'CHARLOTTENBURG',  q: 'Charlottenburg' },
]

function FilterChip({ label, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-bold tracking-widest rounded-sm transition-all"
      style={{
        border: `1px solid ${accent ? 'rgba(0,255,135,0.55)' : 'rgba(255,255,255,0.22)'}`,
        color: accent ? '#00FF87' : 'rgba(255,255,255,0.75)',
        background: accent ? 'rgba(0,255,135,0.08)' : 'rgba(255,255,255,0.04)',
        letterSpacing: '0.1em',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,255,135,0.7)'
        e.currentTarget.style.color = '#00FF87'
        e.currentTarget.style.background = 'rgba(0,255,135,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accent ? 'rgba(0,255,135,0.55)' : 'rgba(255,255,255,0.22)'
        e.currentTarget.style.color = accent ? '#00FF87' : 'rgba(255,255,255,0.75)'
        e.currentTarget.style.background = accent ? 'rgba(0,255,135,0.08)' : 'rgba(255,255,255,0.04)'
      }}
    >
      {label}
    </button>
  )
}

export default function LandingPage({ onSearch, onFilterClick, onBrowseAll, totalJobs, totalCompanies, onNavigateCompanies }) {
  const [query, setQuery] = useState('')

  const handleSearch = e => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
    else onBrowseAll()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-12 sm:pt-16 pb-24 px-4 relative overflow-hidden"
      style={{ background: '#070B10' }}
    >
      {/* ── Gritty background layers ──────────────────────────────────── */}
      {/* Grainy overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.5,
      }} />

      {/* Radial glows */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(0,255,135,0.05) 0%, transparent 70%)',
      }} />

      {/* Berlin skyline silhouette — SVG */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ opacity: 0.06 }}>
        <svg viewBox="0 0 1440 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: '100%', height: '200px' }}>
          {/* Brandenburg Gate */}
          <rect x="620" y="80" width="200" height="120" fill="white"/>
          <rect x="620" y="60" width="20" height="40" fill="white"/>
          <rect x="800" y="60" width="20" height="40" fill="white"/>
          <rect x="650" y="60" width="140" height="20" fill="white"/>
          <rect x="670" y="40" width="100" height="20" fill="white"/>
          <rect x="700" y="20" width="40" height="20" fill="white"/>
          {/* TV Tower */}
          <rect x="200" y="10" width="6" height="180" fill="white"/>
          <ellipse cx="203" cy="70" rx="20" ry="22" fill="white"/>
          {/* Buildings left */}
          <rect x="0"   y="120" width="80"  height="80" fill="white"/>
          <rect x="85"  y="100" width="60"  height="100" fill="white"/>
          <rect x="150" y="130" width="45"  height="70" fill="white"/>
          <rect x="300" y="110" width="70"  height="90" fill="white"/>
          <rect x="380" y="90"  width="50"  height="110" fill="white"/>
          <rect x="440" y="120" width="55"  height="80" fill="white"/>
          <rect x="500" y="105" width="40"  height="95" fill="white"/>
          {/* Buildings right */}
          <rect x="850"  y="115" width="55"  height="85" fill="white"/>
          <rect x="910"  y="95"  width="65"  height="105" fill="white"/>
          <rect x="980"  y="125" width="50"  height="75" fill="white"/>
          <rect x="1040" y="100" width="70"  height="100" fill="white"/>
          <rect x="1120" y="120" width="55"  height="80" fill="white"/>
          <rect x="1180" y="90"  width="80"  height="110" fill="white"/>
          <rect x="1270" y="110" width="60"  height="90" fill="white"/>
          <rect x="1340" y="130" width="100" height="70" fill="white"/>
        </svg>
      </div>

      {/* ── Logo / Hero text ─────────────────────────────────────────── */}
      <motion.div
        className="text-center z-10 w-full max-w-3xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Eyebrow */}
        <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: 'rgba(0,255,135,0.7)' }}>
          ✦ Berlin Tech Jobs ✦
        </p>

        {/* Main title */}
        <h1
          className="font-bold leading-none mb-3 select-none"
          style={{
            fontSize: 'clamp(2.8rem, 8vw, 5.5rem)',
            letterSpacing: '-0.03em',
            color: '#fff',
            textShadow: '0 0 60px rgba(0,255,135,0.15)',
          }}
        >
          Berlin<span style={{ color: '#00FF87', textShadow: '0 0 40px rgba(0,255,135,0.5)' }}>JobHunt</span>
        </h1>

        {/* Tagline */}
        <p
          className="font-medium mb-8 sm:mb-10"
          style={{
            fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.02em',
          }}
        >
          English-Friendly Tech Careers.{' '}
          <span style={{ color: 'rgba(0,255,135,0.8)' }}>Berliner Edge.</span>
        </p>

        {/* ── Search bar ─────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="relative mb-6 mx-auto max-w-xl">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search roles, companies, tech stack..."
            className="w-full py-4 pl-5 pr-14 text-sm rounded-xl outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.92)',
              fontSize: '0.9375rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(0,255,135,0.45)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4), 0 0 0 3px rgba(0,255,135,0.10)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'
            }}
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg transition-all"
            style={{ background: 'rgba(0,255,135,0.15)', border: '1px solid rgba(0,255,135,0.3)', color: '#00FF87' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,135,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,135,0.15)' }}
          >
            🔍
          </button>
        </form>

        {/* ── Vibe chips ─────────────────────────────────────────────── */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)', minWidth: '40px' }}>
              vibe
            </span>
            {VIBE_CHIPS.map(c => (
              <FilterChip
                key={c.label}
                label={c.label}
                accent={c.label === 'FULL-REMOTE'}
                onClick={() => onFilterClick({ filters: c.filter })}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.28)', minWidth: '40px' }}>
              district
            </span>
            {DISTRICT_CHIPS.map(c => (
              <FilterChip
                key={c.label}
                label={c.label}
                onClick={() => onFilterClick({ query: c.q, filters: { berlin: true } })}
              />
            ))}
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <button
            onClick={onBrowseAll}
            className="flex flex-col items-center transition-opacity hover:opacity-80"
          >
            <span className="text-2xl font-bold" style={{ color: '#00FF87', fontVariantNumeric: 'tabular-nums' }}>
              {totalJobs > 0 ? totalJobs.toLocaleString() : '—'}
            </span>
            <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              live positions
            </span>
          </button>

          <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.10)' }} />

          <button
            onClick={onNavigateCompanies}
            className="flex flex-col items-center transition-opacity hover:opacity-80"
          >
            <span className="text-2xl font-bold" style={{ color: '#00FF87', fontVariantNumeric: 'tabular-nums' }}>
              {totalCompanies > 0 ? totalCompanies.toLocaleString() : '—'}
            </span>
            <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              companies tracked
            </span>
          </button>

          <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.10)' }} />

          <button
            onClick={() => onFilterClick({ filters: { berlin: true } })}
            className="flex flex-col items-center transition-opacity hover:opacity-80"
          >
            <span className="text-2xl font-bold" style={{ color: '#00FF87' }}>DE</span>
            <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Berlin &amp; Germany
            </span>
          </button>
        </div>

        {/* Browse all CTA */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={onBrowseAll}
            className="btn-gold px-8 py-3 text-sm font-semibold"
            style={{ fontSize: '0.875rem', letterSpacing: '0.04em' }}
          >
            BROWSE ALL JOBS →
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
