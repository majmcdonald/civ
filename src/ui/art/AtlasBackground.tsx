import { useMemo } from 'react';

// Decorative parchment with faint irregular areas and a coastline, hinting at the game map.
// Purely visual: the real map comes from the procedural generator.

const WIDTH = 1600;
const HEIGHT = 1000;
const CELL = 74;

function hash(x: number, y: number, salt: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Cell {
  points: [number, number][];
  sea: boolean;
}

function buildCells(): Cell[] {
  const cells: Cell[] = [];
  const rowHeight = CELL * 0.866;
  // Shared corners get the same jitter, so neighboring cells meet cleanly.
  const corner = (cx: number, cy: number): [number, number] => {
    const kx = Math.round(cx * 2);
    const ky = Math.round(cy * 2);
    return [cx + (hash(kx, ky, 1) - 0.5) * CELL * 0.45, cy + (hash(kx, ky, 2) - 0.5) * CELL * 0.45];
  };
  for (let row = -1; row * rowHeight < HEIGHT + CELL; row++) {
    for (let col = -1; col * CELL < WIDTH + CELL; col++) {
      const cx = col * CELL + (row % 2 === 0 ? 0 : CELL / 2);
      const cy = row * rowHeight;
      const r = CELL / Math.sqrt(3);
      const points: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        points.push(corner(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      const coast = 360 + Math.sin(cy / 170) * 120 + Math.sin(cy / 61) * 35;
      cells.push({ points, sea: cx < coast });
    }
  }
  return cells;
}

const toPath = (points: [number, number][]) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join('') + 'Z';

export function AtlasBackground() {
  const cells = useMemo(buildCells, []);
  return (
    <svg
      className="atlas-background"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.09 0"
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="blotches" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="2" seed="3" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.22  0 0 0 0.22 -0.06"
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="48%" r="75%">
          <stop offset="55%" stopColor="#8b6a3e" stopOpacity="0" />
          <stop offset="100%" stopColor="#6b4a24" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="var(--parchment)" />
      <rect width={WIDTH} height={HEIGHT} filter="url(#blotches)" />

      <g>
        {cells.map((cell, i) =>
          cell.sea ? <path key={i} d={toPath(cell.points)} fill="var(--sea-wash)" opacity={0.55} /> : null,
        )}
      </g>
      <g fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.16}>
        {cells.map((cell, i) => (cell.sea ? null : <path key={i} d={toPath(cell.points)} />))}
      </g>

      <rect width={WIDTH} height={HEIGHT} filter="url(#paper-grain)" />
      <rect width={WIDTH} height={HEIGHT} fill="url(#vignette)" />
    </svg>
  );
}
