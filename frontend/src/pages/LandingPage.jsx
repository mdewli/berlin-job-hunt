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
        border: `1px solid ${accent ? 'rgba(0,255,135,0.65)' : 'rgba(255,255,255,0.30)'}`,
        color: accent ? '#00FF87' : 'rgba(255,255,255,0.85)',
        background: accent ? 'rgba(0,255,135,0.12)' : 'rgba(255,255,255,0.08)',
        letterSpacing: '0.1em',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(0,255,135,0.75)'
        e.currentTarget.style.color = '#00FF87'
        e.currentTarget.style.background = 'rgba(0,255,135,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accent ? 'rgba(0,255,135,0.65)' : 'rgba(255,255,255,0.30)'
        e.currentTarget.style.color = accent ? '#00FF87' : 'rgba(255,255,255,0.85)'
        e.currentTarget.style.background = accent ? 'rgba(0,255,135,0.12)' : 'rgba(255,255,255,0.08)'
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
    <div className="min-h-screen flex flex-col items-center justify-start relative overflow-hidden"
      style={{ background: '#070B10' }}
    >
      {/* ── Background photo ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('/berlin-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* ── Dark overlay: top heavy (keeps content readable) ─────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to bottom,
              rgba(7,11,16,0.72) 0%,
              rgba(7,11,16,0.55) 35%,
              rgba(7,11,16,0.65) 65%,
              rgba(7,11,16,0.92) 100%
            )
          `,
        }}
      />

      {/* ── Neon green ambient glow (top center) ─────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 40% at 50% 15%, rgba(0,255,135,0.07) 0%, transparent 70%)',
        }}
      />

      {/* ── Foreground content — glass card ──────────────────────────────── */}
      <div className="relative z-10 w-full flex flex-col items-center justify-start pt-12 sm:pt-16 pb-24 px-4">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* ── Glass card wrapping all interactive content ─────────────── */}
          <div
            className="rounded-2xl px-6 sm:px-10 py-8 sm:py-10 text-center"
            style={{
              background: 'rgba(7,11,16,0.58)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Eyebrow */}
            <p className="text-xs font-bold tracking-[0.28em] uppercase mb-4"
              style={{ color: 'rgba(0,255,135,0.75)' }}>
              ✦ Berlin Tech Jobs ✦
            </p>

            {/* Main title */}
            <h1
              className="font-bold leading-none mb-3 select-none"
              style={{
                fontSize: 'clamp(2.6rem, 8vw, 5rem)',
                letterSpacing: '-0.03em',
                color: '#fff',
                textShadow: '0 2px 24px rgba(0,0,0,0.7), 0 0 60px rgba(0,255,135,0.12)',
              }}
            >
              Berlin<span style={{ color: '#00FF87', textShadow: '0 0 40px rgba(0,255,135,0.6)' }}>JobHunt</span>
            </h1>

            {/* Tagline */}
            <p
              className="font-medium mb-7"
              style={{
                fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                color: 'rgba(255,255,255,0.60)',
                letterSpacing: '0.02em',
              }}
            >
              English-Friendly Tech Careers.{' '}
              <span style={{ color: 'rgba(0,255,135,0.85)' }}>Berliner Edge.</span>
            </p>

            {/* ── Search bar ───────────────────────────────────────────── */}
            <form onSubmit={handleSearch} className="relative mb-5 mx-auto">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search roles, companies, tech stack..."
                className="w-full py-3.5 pl-5 pr-14 rounded-xl outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: '0.9375rem',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(0,255,135,0.50)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35), 0 0 0 3px rgba(0,255,135,0.12)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'
                }}
              />
              <button
                type="submit"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                style={{ background: 'rgba(0,255,135,0.18)', border: '1px solid rgba(0,255,135,0.35)', color: '#00FF87' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,255,135,0.30)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,255,135,0.18)' }}
              >
                🔍
              </button>
            </form>

            {/* ── Vibe chips ───────────────────────────────────────────── */}
            <div className="space-y-2.5 mb-7">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.30)', minWidth: '40px' }}>
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
                <span className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.30)', minWidth: '40px' }}>
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

            {/* Divider */}
            <div className="mb-6" style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />

            {/* ── Stats row ────────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-6 flex-wrap mb-6">
              <button
                onClick={onBrowseAll}
                className="flex flex-col items-center transition-opacity hover:opacity-75"
              >
                <span className="text-2xl font-bold" style={{ color: '#00FF87', fontVariantNumeric: 'tabular-nums' }}>
                  {totalJobs > 0 ? totalJobs.toLocaleString() : '—'}
                </span>
                <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  live positions
                </span>
              </button>

              <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.12)' }} />

              <button
                onClick={onNavigateCompanies}
                className="flex flex-col items-center transition-opacity hover:opacity-75"
              >
                <span className="text-2xl font-bold" style={{ color: '#00FF87', fontVariantNumeric: 'tabular-nums' }}>
                  {totalCompanies > 0 ? totalCompanies.toLocaleString() : '—'}
                </span>
                <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  companies tracked
                </span>
              </button>

              <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.12)' }} />

              <button
                onClick={() => onFilterClick({ filters: { berlin: true } })}
                className="flex flex-col items-center transition-opacity hover:opacity-75"
              >
                <span className="text-2xl font-bold" style={{ color: '#00FF87' }}>DE</span>
                <span className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Berlin &amp; Germany
                </span>
              </button>
            </div>

            {/* Browse all CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <button
                onClick={onBrowseAll}
                className="btn-gold px-8 py-3"
                style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
              >
                BROWSE ALL JOBS →
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
