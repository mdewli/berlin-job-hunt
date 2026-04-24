/**
 * LogoLotus — custom SVG lotus mark for Berlin Job Hunt.
 * Layered petals: deep magenta outer → bright pink middle → blush inner → golden stamen.
 * Matches the reference photo aesthetic: warm golden center, rich pink-magenta petals.
 */
export default function LogoLotus({ size = 28, className = '' }) {
  const cx = 20
  const cy = 20

  // Returns a petal path pointing straight "up" from (cx,cy)
  // d = reach (tip distance from centre), hw = half-width at widest
  const petal = (d, hw) =>
    `M ${cx},${cy} ` +
    `C ${cx - hw},${cy - d * 0.5} ${cx - hw * 0.85},${cy - d + 1.5} ${cx},${cy - d} ` +
    `C ${cx + hw * 0.85},${cy - d + 1.5} ${cx + hw},${cy - d * 0.5} ${cx},${cy}`

  const OUTER  = petal(16, 4.2)   // tips almost at edge of viewbox
  const MIDDLE = petal(10.5, 3.2) // intermediate ring
  const INNER  = petal(6.5, 2.1)  // close-in petals

  const rot = (angles, path, fill, opacity) =>
    angles.map(a => (
      <path
        key={a}
        d={path}
        fill={fill}
        fillOpacity={opacity}
        transform={`rotate(${a} ${cx} ${cy})`}
      />
    ))

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Berlin Job Hunt"
      role="img"
    >
      <defs>
        {/* Warm amber halo behind the flower */}
        <radialGradient id="lotusHalo" cx="50%" cy="58%" r="50%">
          <stop offset="0%"   stopColor="#FF9800" stopOpacity="0.45" />
          <stop offset="55%"  stopColor="#E91E63" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#AD1457" stopOpacity="0"    />
        </radialGradient>

        {/* Outer petal gradient — deep magenta → burgundy */}
        <linearGradient id="lpA" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#F06292" />
          <stop offset="100%" stopColor="#880E4F" />
        </linearGradient>

        {/* Middle petal gradient — vivid magenta */}
        <linearGradient id="lpB" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#F8BBD9" />
          <stop offset="100%" stopColor="#C2185B" />
        </linearGradient>

        {/* Inner petal gradient — pale blush → rosy pink */}
        <linearGradient id="lpC" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor="#FFEEF6" />
          <stop offset="100%" stopColor="#E91E63" />
        </linearGradient>

        {/* Golden stamen — ivory → amber → burnt orange */}
        <radialGradient id="lStamen" cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#FFFDE7" />
          <stop offset="45%"  stopColor="#FFD54F" />
          <stop offset="100%" stopColor="#E65100" />
        </radialGradient>

        {/* Subtle inner glow ring */}
        <radialGradient id="lCenterGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFF176" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF8F00" stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* ── Warm halo ── */}
      <circle cx={cx} cy={cy + 1.5} r="18" fill="url(#lotusHalo)" />

      {/* ── Outer petals ×8 (every 45°) ── */}
      {rot([0, 45, 90, 135, 180, 225, 270, 315], OUTER, 'url(#lpA)', 0.78)}

      {/* ── Middle petals ×8 (offset 22.5°) ── */}
      {rot([22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5], MIDDLE, 'url(#lpB)', 0.88)}

      {/* ── Inner petals ×6 (every 60°) ── */}
      {rot([0, 60, 120, 180, 240, 300], INNER, 'url(#lpC)', 0.96)}

      {/* ── Golden centre glow ── */}
      <circle cx={cx} cy={cy} r="5.5" fill="url(#lCenterGlow)" />

      {/* ── Stamen disc ── */}
      <circle cx={cx} cy={cy} r="4"   fill="url(#lStamen)" />
      <circle cx={cx} cy={cy} r="2.2" fill="#FFFDE7" fillOpacity="0.65" />

      {/* ── Tiny stamen highlight ── */}
      <circle cx={cx - 0.8} cy={cy - 1} r="0.9" fill="#FFFFFF" fillOpacity="0.5" />
    </svg>
  )
}
