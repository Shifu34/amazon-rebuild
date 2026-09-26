const STAR = '10,1.3 12.6,7 18.8,7.6 14.1,11.7 15.5,17.8 10,14.6 4.5,17.8 5.9,11.7 1.2,7.6 7.4,7'

function Row({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 20" className={className} style={style} aria-hidden>
      {[0, 20, 40, 60, 80].map((x) => (
        <polygon key={x} points={STAR} transform={`translate(${x} 0)`} strokeWidth="1.2" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

// Partial stars by clipping a filled row over an outlined one, so 4.3 shows 4 and a bit.
export function Stars({ rating, className = 'h-4' }: { rating: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100))
  return (
    <span role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`} className={`relative inline-block aspect-[5/1] shrink-0 ${className}`}>
      <Row className="absolute inset-0 size-full fill-white stroke-star" />
      <Row className="absolute inset-0 size-full fill-star stroke-star" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
    </span>
  )
}
