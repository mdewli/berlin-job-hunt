import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { useStats } from '../hooks/useStats'

// ── Design tokens ─────────────────────────────────────────────────────────────
const CYAN     = '#00FF87'
const CYAN_DIM = '#00CC6A'
const PINK     = '#E91E63'
const MAGENTA  = '#AD1457'

// Colour ramp for the top-skills bars: cyan → violet
function barColor(index, total) {
  const t = index / Math.max(total - 1, 1)
  // green (#00FF87) → teal-blue (#00B4D8)
  const r = Math.round(0   + (0   - 0)   * t)
  const g = Math.round(255 + (180 - 255) * t)
  const b = Math.round(135 + (216 - 135) * t)
  return `rgb(${r},${g},${b})`
}

// Role category palette — multi-hue for donut
const ROLE_COLORS = [
  '#00FF87', '#3B82F6', '#7C3AED', '#10B981', '#F59E0B',
  '#00B4D8', '#EF4444', '#EC4899', '#14B8A6', '#F97316',
]

// ── Berlin district map data ──────────────────────────────────────────────────
const DISTRICTS = [
  { name: 'Mitte',           x: 168, y: 138, weight: 10 },
  { name: 'Charlottenburg',  x:  78, y: 134, weight: 7  },
  { name: 'Kreuzberg',       x: 178, y: 175, weight: 9  },
  { name: 'Friedrichshain',  x: 210, y: 155, weight: 8  },
  { name: 'Prenzlauer Berg', x: 195, y: 112, weight: 7  },
  { name: 'Schöneberg',      x: 140, y: 185, weight: 5  },
  { name: 'Neukölln',        x: 185, y: 212, weight: 4  },
  { name: 'Wedding',         x: 158, y:  88, weight: 3  },
  { name: 'Lichtenberg',     x: 248, y: 140, weight: 3  },
  { name: 'Spandau',         x:  42, y: 108, weight: 2  },
]

const BERLIN_OUTLINE =
  'M 68,48 L 100,34 L 140,28 L 180,30 L 222,42 L 268,58 L 295,82 ' +
  'L 308,118 L 316,152 L 310,190 L 295,220 L 270,248 L 238,265 ' +
  'L 200,272 L 162,268 L 124,258 L 90,238 L 62,210 L 44,178 ' +
  'L 32,142 L 34,106 L 48,72 Z'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, delay = 0, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <motion.div
      className="glass-panel rounded-2xl p-5 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02, borderColor: 'rgba(0,255,135,0.25)' } : {}}
    >
      <p className="text-3xl font-bold font-display" style={{ color: CYAN }}>{value}</p>
      <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-2)' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-4)' }}>{sub}</p>}
      {onClick && <p className="text-[10px] mt-1.5" style={{ color: CYAN_DIM, opacity: 0.7 }}>click to browse →</p>}
    </motion.div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: CYAN_DIM, letterSpacing: '0.08em' }}>
      {children}
    </p>
  )
}

function Panel({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={`glass-panel rounded-2xl p-5 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
    >
      {children}
    </motion.div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs font-medium shadow-lg"
      style={{
        background: 'rgba(21,25,33,0.97)',
        border: '1px solid rgba(0,255,135,0.25)',
        color: 'var(--text-1)',
      }}
    >
      <span style={{ color: CYAN }}>{label ?? payload[0].name}</span>
      {' — '}
      <span>{payload[0].value} jobs</span>
    </div>
  )
}

function PieLabel({ cx, cy, midAngle, outerRadius, name, percent }) {
  if (percent < 0.04) return null
  const RAD = Math.PI / 180
  const r   = outerRadius + 18
  const x   = cx + r * Math.cos(-midAngle * RAD)
  const y   = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={9} fill="rgba(255,255,255,0.55)">
      {name} {(percent * 100).toFixed(0)}%
    </text>
  )
}

// ── Pulsing district dot ──────────────────────────────────────────────────────
function DistrictDot({ x, y, weight, name, selected, onClick }) {
  const r     = 4 + weight * 1.2
  const isHot = weight >= 8

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onClick(name)}>
      {isHot && (
        <circle cx={x} cy={y} r={r + 6} fill="none" stroke={CYAN} strokeOpacity="0.25" strokeWidth="1">
          <animate attributeName="r"              values={`${r+4};${r+10};${r+4}`} dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.3;0;0.3"              dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r={r} fill={selected ? CYAN : PINK} fillOpacity={selected ? 1 : 0.75} stroke={selected ? '#fff' : MAGENTA} strokeWidth={selected ? 1.5 : 1} />
      <text x={x} y={y - r - 3} textAnchor="middle" fontSize={7} fill={selected ? CYAN : 'rgba(255,255,255,0.6)'} fontWeight={selected ? '600' : '400'}>
        {name}
      </text>
    </g>
  )
}

// ── Berlin Map ────────────────────────────────────────────────────────────────
function BerlinMap({ onNavigateJobs }) {
  const [selected, setSelected] = useState(null)

  const handleClick = name => {
    setSelected(s => s === name ? null : name)
    onNavigateJobs?.({ berlin: true })
  }

  const sel = DISTRICTS.find(d => d.name === selected)

  return (
    <div>
      <SectionLabel>Tech Hub Map — Berlin Districts</SectionLabel>
      <h2 className="font-display font-semibold text-xl mb-1" style={{ color: 'var(--text-1)' }}>
        Where Berlin's tech scene clusters
      </h2>
      <p className="text-xs mb-3" style={{ color: 'var(--text-4)' }}>Click any district to browse Berlin jobs</p>

      <div className="relative">
        <svg
          viewBox="0 0 348 300"
          className="w-full rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
        >
          {[60,120,180,240].map(x => <line key={`vg${x}`} x1={x} y1="0" x2={x} y2="300" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>)}
          {[60,120,180,240].map(y => <line key={`hg${y}`} x1="0" y1={y} x2="348" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>)}

          <path d={BERLIN_OUTLINE} fill="rgba(0,255,135,0.04)" stroke="rgba(0,255,135,0.2)" strokeWidth="1.5" strokeLinejoin="round" />

          <path d="M 58,158 Q 100,148 140,152 Q 168,155 188,148 Q 220,138 260,142 Q 290,145 316,152"
            fill="none" stroke="rgba(0,188,212,0.35)" strokeWidth="2.5" strokeLinecap="round" />
          <text x="100" y="144" fontSize="6.5" fill="rgba(0,188,212,0.45)" fontStyle="italic">Spree</text>

          {DISTRICTS.map(d => (
            <DistrictDot key={d.name} {...d} selected={selected === d.name} onClick={handleClick} />
          ))}

          <g transform="translate(320,28)">
            <text x="0" y="0" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.3)">N</text>
            <line x1="0" y1="2" x2="0" y2="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          </g>
        </svg>

        {sel && (
          <div className="absolute bottom-3 left-3 rounded-xl px-3 py-2 text-xs"
            style={{ background: 'rgba(21,25,33,0.95)', border: `1px solid ${CYAN}44`, color: 'var(--text-2)', maxWidth: '200px' }}>
            <p className="font-semibold" style={{ color: CYAN }}>{sel.name}</p>
            <p style={{ color: 'var(--text-3)' }}>Activity: <strong style={{ color: 'var(--text-1)' }}>{sel.weight}/10</strong></p>
            <p className="mt-1" style={{ color: CYAN_DIM }}>→ Showing all Berlin jobs</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {DISTRICTS.slice(0, 6).map(d => (
          <button key={d.name} onClick={() => handleClick(d.name)}
            className="flex items-center gap-1.5 text-xs transition-opacity"
            style={{ color: selected === d.name ? CYAN : 'var(--text-4)' }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: selected === d.name ? CYAN : PINK }} />
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Remote type pill — clickable ──────────────────────────────────────────────
const REMOTE_COLORS = {
  'Full-Remote': { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10B981' },
  Hybrid:        { bg: 'rgba(0,255,135,0.10)',  border: 'rgba(0,255,135,0.30)',  text: '#00FF87' },
  'On-site':     { bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.25)',  text: '#fb7185' },
}

function RemotePill({ type, count, total, onClick }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  const c   = REMOTE_COLORS[type] ?? REMOTE_COLORS['On-site']
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl px-4 py-3 text-center transition-all"
      style={{ background: c.bg, border: `1px solid ${c.border}`, cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
    >
      <p className="text-2xl font-bold font-display" style={{ color: c.text }}>{pct}%</p>
      <p className="text-xs mt-0.5 font-medium" style={{ color: c.text }}>{type}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-4)' }}>{count.toLocaleString()} roles</p>
      <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-4)', opacity: 0.7 }}>click to browse →</p>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="rounded-2xl h-24" style={{ background: 'var(--card)' }} />)}
      </div>
      <div className="rounded-2xl h-64" style={{ background: 'var(--card)' }} />
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl h-48" style={{ background: 'var(--card)' }} />
        <div className="rounded-2xl h-48" style={{ background: 'var(--card)' }} />
      </div>
    </div>
  )
}

// ── Main InsightsPage ─────────────────────────────────────────────────────────
export default function InsightsPage({ onNavigateJobs, onNavigateCompanies }) {
  const { topSkills, roleCategories, remoteBreakdown, totalJobs, totalCompanies, loading, error } = useStats()
  const totalRemote = remoteBreakdown.reduce((s, r) => s + r.count, 0)

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: CYAN_DIM, letterSpacing: '0.08em' }}>Insights</p>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl" style={{ color: 'var(--text-1)' }}>
            Berlin <em className="not-italic" style={{ color: CYAN }}>Tech Pulse</em>
          </h1>
        </div>
        <Skeleton />
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-5xl mb-4">😔</p>
        <p className="text-sm" style={{ color: '#fb7185' }}>Could not load insights: {error}</p>
      </main>
    )
  }

  const chartSkills = topSkills.slice(0, 15).reverse()

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">

      {/* ── Hero ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-2">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: CYAN_DIM, letterSpacing: '0.08em' }}>Insights</p>
        <h1 className="font-display font-semibold text-3xl sm:text-4xl" style={{ color: 'var(--text-1)' }}>
          Berlin <em className="not-italic" style={{ color: CYAN }}>Tech Pulse</em>
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
          Live snapshot of skills, roles, and remote trends across {totalCompanies.toLocaleString()} companies.
        </p>
      </motion.div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Positions"  value={totalJobs.toLocaleString()}                    sub="updated daily"  delay={0.05} onClick={() => onNavigateJobs?.({ label: 'All' })} />
        <StatCard label="Companies Tracked" value={totalCompanies.toLocaleString()}               sub="& growing"      delay={0.10} onClick={onNavigateCompanies} />
        <StatCard label="Unique Skills"     value={topSkills.length > 0 ? `${topSkills.length}+` : '—'} sub="in job postings" delay={0.15} />
      </div>

      {/* ── Remote breakdown — clickable ── */}
      <Panel delay={0.2}>
        <SectionLabel>Work Style Breakdown</SectionLabel>
        <h2 className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text-1)' }}>How companies hire</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-4)' }}>Click a card to browse those jobs</p>
        <div className="flex gap-3">
          {remoteBreakdown.map(r => (
            <RemotePill key={r.type} {...r} total={totalRemote} onClick={() => onNavigateJobs?.({ remote_type: r.type, label: r.type })} />
          ))}
        </div>
      </Panel>

      {/* ── Top skills — clickable bars ── */}
      <Panel delay={0.25}>
        <SectionLabel>Most In-Demand Skills</SectionLabel>
        <h2 className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text-1)' }}>Top 15 technologies across all postings</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-4)' }}>Click a bar to search jobs with that skill</p>

        {chartSkills.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-4)' }}>No skill data yet — run the crawler to populate jobs.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartSkills.length * 28 + 24}>
            <BarChart data={chartSkills} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 90 }}>
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="skill" width={88} tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18} style={{ cursor: 'pointer' }} onClick={data => onNavigateJobs?.({ query: data.skill, label: data.skill })}>
                {chartSkills.map((entry, i) => (
                  <Cell key={entry.skill} fill={barColor(i, chartSkills.length)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── Role categories + Berlin map ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Role donut — clickable legend */}
        <Panel delay={0.3}>
          <SectionLabel>Role Categories</SectionLabel>
          <h2 className="font-display font-semibold text-lg mb-1" style={{ color: 'var(--text-1)' }}>What roles are hiring</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-4)' }}>Click a category to search those jobs</p>

          {roleCategories.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-4)' }}>No role data yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={roleCategories.slice(0, 10)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={88}
                    paddingAngle={2}
                    labelLine={false}
                    label={PieLabel}
                    style={{ cursor: 'pointer' }}
                    onClick={data => onNavigateJobs?.({ query: data.name })}
                  >
                    {roleCategories.slice(0, 10).map((entry, i) => (
                      <Cell key={entry.name} fill={ROLE_COLORS[i % ROLE_COLORS.length]} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-0.5 mt-2">
                {roleCategories.slice(0, 8).map((r, i) => (
                  <button
                    key={r.name}
                    onClick={() => onNavigateJobs?.({ query: r.name, label: r.name })}
                    className="flex items-center justify-between text-xs w-full rounded-lg px-2 py-1.5 transition-colors text-left"
                    style={{ color: 'var(--text-3)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }} />
                      <span>{r.name}</span>
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-2)' }}>{r.count}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* Berlin district map */}
        <Panel delay={0.35}>
          <BerlinMap onNavigateJobs={onNavigateJobs} />
        </Panel>
      </div>

    </main>
  )
}
