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
      {/* ── SVG defs (noise + graffiti texture filters) ───────────────── */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="noise-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" result="noisy" />
            <feColorMatrix type="saturate" values="0" in="noisy" result="grey" />
            <feBlend in="SourceGraphic" in2="grey" mode="overlay" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="graffiti-filter">
            <feTurbulence type="turbulence" baseFrequency="0.02 0.05" numOctaves="3" seed="5" result="turb" />
            <feDisplacementMap in="SourceGraphic" in2="turb" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* ── Layer 1: Dark concrete wall gradient base ─────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 60% at 50% 100%, rgba(10,14,20,0.95) 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 20% 80%, rgba(0,20,10,0.4) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 80% 70%, rgba(0,40,80,0.18) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Layer 2: Concrete wall texture (grain) ─────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.03,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Layer 3: Horizontal scan-line / wall-block texture ────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              rgba(255,255,255,0.012) 39px,
              rgba(255,255,255,0.012) 40px
            )
          `,
        }}
      />

      {/* ── Layer 4: Neon green ambient glow (top center) ─────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 45% at 50% 20%, rgba(0,255,135,0.06) 0%, transparent 65%)',
      }} />

      {/* ── Layer 5: Brandenburg Gate — large, centered, atmospheric ─── */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '900px',
          opacity: 1,
        }}
      >
        <svg
          viewBox="0 0 900 320"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMax meet"
          style={{ width: '100%', display: 'block' }}
        >
          <defs>
            {/* Gradient: solid at bottom, fades to transparent at top */}
            <linearGradient id="gateGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00FF87" stopOpacity="0.0" />
              <stop offset="45%"  stopColor="#00FF87" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#00FF87" stopOpacity="0.10" />
            </linearGradient>
            <linearGradient id="gateStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00FF87" stopOpacity="0.0" />
              <stop offset="50%"  stopColor="#00FF87" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#00FF87" stopOpacity="0.22" />
            </linearGradient>
          </defs>

          {/* ── Quadriga (chariot on top) ── */}
          {/* Chariot platform */}
          <rect x="390" y="58" width="120" height="14" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          {/* Horses silhouettes */}
          <ellipse cx="405" cy="54" rx="12" ry="8" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          <ellipse cx="425" cy="50" rx="12" ry="9" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          <ellipse cx="450" cy="48" rx="13" ry="9" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          <ellipse cx="475" cy="50" rx="12" ry="9" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          <ellipse cx="495" cy="54" rx="12" ry="8" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          {/* Rider */}
          <ellipse cx="450" cy="44" rx="6" ry="6" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>
          <rect x="447" y="44" width="6" height="12" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5"/>

          {/* ── Attic (top decorative block) ── */}
          <rect x="335" y="72" width="230" height="32" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          {/* Attic decorative reliefs */}
          {[350,375,400,425,450,475,500,525].map((x, i) => (
            <rect key={i} x={x} y="76" width="16" height="24" rx="1"
              fill="none" stroke="url(#gateStroke)" strokeWidth="0.4" opacity="0.6"/>
          ))}

          {/* ── Entablature (main horizontal beam) ── */}
          <rect x="325" y="104" width="250" height="18" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />

          {/* ── 6 Doric columns ── */}
          {[345, 381, 417, 453, 489, 525].map((x, i) => (
            <g key={i}>
              {/* Column shaft */}
              <rect x={x} y="122" width="22" height="150" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
              {/* Capital (top) */}
              <rect x={x - 3} y="119" width="28" height="6" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
              {/* Base */}
              <rect x={x - 3} y="270" width="28" height="6" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
            </g>
          ))}

          {/* ── Stylobate (column base platform) ── */}
          <rect x="320" y="276" width="260" height="8"  fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          <rect x="315" y="284" width="270" height="6"  fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          <rect x="310" y="290" width="280" height="30" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />

          {/* ── Side wings (guardhouses) ── */}
          {/* Left wing */}
          <rect x="220" y="175" width="105" height="145" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          <rect x="215" y="168" width="115" height="10" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          {/* Left wing windows */}
          {[230, 258, 286].map((x, i) => (
            <rect key={i} x={x} y="195" width="16" height="22" rx="1"
              fill="none" stroke="url(#gateStroke)" strokeWidth="0.5" opacity="0.7"/>
          ))}
          {/* Right wing */}
          <rect x="575" y="175" width="105" height="145" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          <rect x="570" y="168" width="115" height="10" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.5" />
          {/* Right wing windows */}
          {[584, 612, 640].map((x, i) => (
            <rect key={i} x={x} y="195" width="16" height="22" rx="1"
              fill="none" stroke="url(#gateStroke)" strokeWidth="0.5" opacity="0.7"/>
          ))}

          {/* ── Ground floor / arch passages (between columns) ── */}
          {/* Main central arch */}
          <path d="M417,122 L417,270 Q450,250 483,270 L483,122" fill="rgba(0,0,0,0.3)" />

          {/* ── Flanking buildings (left) ── */}
          <rect x="60"  y="200" width="80"  height="120" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.5"/>
          <rect x="150" y="220" width="60"  height="100" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.4"/>
          <rect x="0"   y="230" width="55"  height="90"  fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.4"/>

          {/* ── Flanking buildings (right) ── */}
          <rect x="760" y="200" width="80"  height="120" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.5"/>
          <rect x="690" y="220" width="60"  height="100" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.4"/>
          <rect x="845" y="230" width="55"  height="90"  fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.4"/>

          {/* ── TV Tower (far left silhouette) ── */}
          <rect x="32" y="40" width="5" height="180" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.35"/>
          <ellipse cx="34.5" cy="110" rx="14" ry="16" fill="url(#gateGrad)" stroke="url(#gateStroke)" strokeWidth="0.3" opacity="0.35"/>

          {/* ── Ground line ── */}
          <rect x="0" y="318" width="900" height="2" fill="url(#gateGrad)" />
        </svg>
      </div>

      {/* ── Layer 6: Bottom fog / fade to dark ─────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: '200px',
          background: 'linear-gradient(to top, #070B10 0%, rgba(7,11,16,0.85) 40%, transparent 100%)',
        }}
      />

      {/* ── Layer 7: Subtle graffiti spray marks (decorative SVG) ──────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.045 }}
      >
        <svg viewBox="0 0 1440 900" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
          {/* Abstract spray shapes mimicking graffiti highlights */}
          <ellipse cx="120" cy="200" rx="90" ry="30" fill="#00FF87" transform="rotate(-15,120,200)" />
          <ellipse cx="1320" cy="350" rx="70" ry="22" fill="#00FF87" transform="rotate(10,1320,350)" />
          <ellipse cx="200" cy="600" rx="110" ry="18" fill="#00AAFF" transform="rotate(5,200,600)" />
          <ellipse cx="1100" cy="150" rx="80" ry="15" fill="#FF4466" transform="rotate(-8,1100,150)" />
          {/* Drips */}
          <path d="M115,215 Q118,240 116,265" stroke="#00FF87" strokeWidth="3" fill="none" opacity="0.6"/>
          <path d="M1315,365 Q1318,388 1316,410" stroke="#00FF87" strokeWidth="2.5" fill="none" opacity="0.6"/>
          <path d="M198,615 Q201,638 199,660" stroke="#00AAFF" strokeWidth="2.5" fill="none" opacity="0.5"/>
        </svg>
      </div>

      {/* ── Foreground content ────────────────────────────────────────── */}
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
            textShadow: '0 0 80px rgba(0,255,135,0.18), 0 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          Berlin<span style={{ color: '#00FF87', textShadow: '0 0 40px rgba(0,255,135,0.55)' }}>JobHunt</span>
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
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(0,255,135,0.45)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.5), 0 0 0 3px rgba(0,255,135,0.10)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'
              e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.5)'
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
