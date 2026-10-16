interface CompassRoseProps {
  size?: number;
  className?: string;
}

// Eight-point compass rose in sepia ink.
export function CompassRose({ size = 140, className }: CompassRoseProps) {
  const long = 46;
  const short = 26;
  const waist = 7;
  const point = (angle: number, length: number, side: 1 | -1) => {
    const a = (angle * Math.PI) / 180;
    const b = ((angle + 90 * side) * Math.PI) / 180;
    return `M0,0 L${(Math.cos(b) * waist).toFixed(2)},${(Math.sin(b) * waist).toFixed(2)} L${(Math.cos(a) * length).toFixed(2)},${(Math.sin(a) * length).toFixed(2)}Z`;
  };
  const arms = [
    ...[-90, 0, 90, 180].map((angle) => ({ angle, length: long })),
    ...[-45, 45, 135, 225].map((angle) => ({ angle, length: short })),
  ];
  return (
    <svg className={className} width={size} height={size} viewBox="-60 -60 120 120" aria-hidden="true">
      <circle r={52} fill="none" stroke="var(--ink)" strokeWidth={0.8} opacity={0.6} />
      <circle r={48} fill="none" stroke="var(--ink)" strokeWidth={0.4} opacity={0.5} />
      {Array.from({ length: 32 }, (_, i) => {
        const a = (i * Math.PI * 2) / 32;
        const inner = i % 4 === 0 ? 43 : 46;
        return (
          <line
            key={i}
            x1={Math.cos(a) * inner}
            y1={Math.sin(a) * inner}
            x2={Math.cos(a) * 48}
            y2={Math.sin(a) * 48}
            stroke="var(--ink)"
            strokeWidth={0.5}
            opacity={0.6}
          />
        );
      })}
      {arms.map(({ angle, length }) => (
        <g key={angle}>
          <path d={point(angle, length, 1)} fill="var(--ink)" opacity={0.85} />
          <path d={point(angle, length, -1)} fill="var(--parchment)" stroke="var(--ink)" strokeWidth={0.6} />
        </g>
      ))}
      <circle r={3} fill="var(--accent)" />
      <text
        y={-54}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={9}
        fill="var(--ink)"
        dominantBaseline="auto"
      >
        N
      </text>
    </svg>
  );
}
