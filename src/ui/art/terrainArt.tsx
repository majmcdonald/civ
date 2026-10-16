// Upright terrain symbols for the isometric map, in screen units with the base at y = 0.

const INK = 'var(--ink)';

function Broadleaf({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0,0 L0,${-r * 0.9}`} stroke={INK} strokeWidth={0.7} />
      <circle cx={0} cy={-r * 1.6} r={r} fill="#86a259" stroke={INK} strokeWidth={0.5} />
      <path d={`M0,${-r * 2.6} A${r},${r} 0 0 1 0,${-r * 0.6} A${r * 0.55},${r} 0 0 0 0,${-r * 2.6}Z`} fill="#62803f" />
      <circle cx={-r * 0.35} cy={-r * 1.95} r={r * 0.28} fill="#a9bf78" />
    </g>
  );
}

function Pine({ x, h }: { x: number; h: number }) {
  const w = h * 0.36;
  const tiers = `M0,${-h} L${-w * 0.5},${-h * 0.66} L${-w * 0.28},${-h * 0.66} L${-w * 0.78},${-h * 0.34} L${-w * 0.5},${-h * 0.34} L${-w},${-h * 0.06} L${w},${-h * 0.06} L${w * 0.5},${-h * 0.34} L${w * 0.78},${-h * 0.34} L${w * 0.28},${-h * 0.66} L${w * 0.5},${-h * 0.66}Z`;
  const shade = `M0,${-h} L${w * 0.5},${-h * 0.66} L${w * 0.28},${-h * 0.66} L${w * 0.78},${-h * 0.34} L${w * 0.5},${-h * 0.34} L${w},${-h * 0.06} L0,${-h * 0.06}Z`;
  return (
    <g transform={`translate(${x} 0)`}>
      <path d={`M0,0 L0,${-h * 0.1}`} stroke={INK} strokeWidth={0.8} />
      <path d={tiers} fill="#5a7a4a" stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
      <path d={shade} fill="#425f39" />
    </g>
  );
}

function EngravedTree({ x, s }: { x: number; s: number }) {
  return (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <path d="M0,0 L0,-3" stroke={INK} strokeWidth={0.8} />
      <path
        d="M-3.6,-4.6 C-5.2,-5.4 -4.6,-8 -2.8,-7.8 C-2.6,-10 0.2,-10.6 1.2,-9 C3,-9.6 4.6,-7.8 3.6,-6.2 C5,-5 4,-2.8 2.2,-3.2 C1.4,-2.2 -1.6,-2.2 -2.2,-3.2 C-3.6,-2.8 -4.6,-3.8 -3.6,-4.6Z"
        fill="#aab879"
        stroke={INK}
        strokeWidth={0.6}
      />
      <path d="M1.6,-7.6 L1,-4.4 M2.8,-6.8 L2.3,-4.2 M0.4,-8.2 L-0.1,-5" stroke={INK} strokeWidth={0.4} opacity={0.75} />
    </g>
  );
}

export function TerrainArt() {
  return (
    <>
      <symbol id="glyph-forest-broadleaf" overflow="visible">
        <Broadleaf x={0.5} y={-1.2} r={3.4} />
        <Broadleaf x={-3.8} y={0} r={2.9} />
        <Broadleaf x={4.2} y={0.4} r={2.7} />
      </symbol>
      <symbol id="glyph-forest-engraved" overflow="visible">
        <EngravedTree x={-2.4} s={1} />
        <EngravedTree x={3.2} s={0.8} />
      </symbol>
      <symbol id="glyph-volcano" overflow="visible">
        <path d="M-10,0 C-6,-2 -4,-8 -2.6,-13 L2.6,-13 C4,-8 6,-2 10,0Z" fill="#9a8068" stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M0.5,-13 L2.6,-13 C4,-8 6,-2 10,0 L3,0 C3,-5 2,-9 0.5,-13Z" fill="#7a624e" />
        <ellipse cx={0} cy={-13} rx={2.6} ry={0.9} fill="#3b2a1a" />
        <path d="M-0.8,-12.6 C-1.4,-10.4 -0.4,-8.8 -1.4,-6.6 C-2,-5.2 -1.6,-3.8 -2.2,-2.6" stroke="#d9541f" strokeWidth={1} fill="none" strokeLinecap="round" />
        <ellipse cx={-0.4} cy={-13} rx={1.4} ry={0.45} fill="#e8742a" />
      </symbol>
    </>
  );
}
