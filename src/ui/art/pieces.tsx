// Upright game pieces for the isometric map: settlements and token stacks. Screen units, base at
// y = 0. Pieces take their civilization color from `currentColor`.

import type { AreaId } from '../../engine';

export type SettlementTier = 'village' | 'town';

// What play puts on the map, as the map screen draws it.
export interface MapPieces {
  // `growth`: progress toward the next token (design doc §4).
  stacks: { area: AreaId; civ: number; count: number; growth?: number }[];
  // `work`: manpower on the area's resources and Bureaucracy (design doc §6). `instability`: the
  // local meter; `threshold`: where it collapses; `risk`: within 2 of collapse, marked on the map;
  // `capital`: the civilization's capital (design doc §10).
  settlements: {
    area: AreaId;
    civ: number;
    tier: SettlementTier;
    name?: string;
    work?: { resource: string; count: number }[];
    instability?: number;
    threshold?: number;
    risk?: boolean;
    capital?: boolean;
  }[];
  roads: [AreaId, AreaId][];
}

export const NO_PIECES: MapPieces = { stacks: [], settlements: [], roads: [] };

const INK = 'var(--ink)';

function Hut({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-3,0 L-3,-3 L3,-3 L3,0 Q0,1.2 -3,0Z" fill="#b08a5a" stroke={INK} strokeWidth={0.5} />
      <path d="M-0.8,0.5 L-0.8,-1.6 L0.8,-1.6 L0.8,0.5Z" fill="#3b2a1a" />
      <path d="M-4,-2.6 Q0,-1.4 4,-2.6 L0,-8.5Z" fill="#c9a24a" stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
      <path d="M0,-8.5 L1.4,-2.1 Q3,-2.2 4,-2.6Z" fill="#a37f30" />
    </g>
  );
}

function House({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={0.45} strokeLinejoin="round">
      <path d="M-3,0 L-3,-3.4 L1,-3.4 L1,0Z" fill="#dcc8a0" />
      <path d="M1,0 L1,-3.4 L4,-4.9 L4,-1.5Z" fill="#b89f74" />
      <path d="M-3,-3.4 L-1,-6.2 L1,-3.4Z" fill="#dcc8a0" />
      <path d="M-1,-6.2 L2,-7.7 L4,-4.9 L1,-3.4Z" fill="#b8913f" />
      <path d="M-1.6,0 L-1.6,-1.8 L-0.4,-1.8 L-0.4,0" fill="#3b2a1a" stroke="none" />
    </g>
  );
}

function Pennant({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0,0 L0,${-h}`} stroke={INK} strokeWidth={0.8} />
      <path d={`M0,${-h} L7,${-h + 2.2} L0,${-h + 4.4}Z`} fill="currentColor" stroke={INK} strokeWidth={0.5} strokeLinejoin="round" />
    </g>
  );
}

// Palisade stakes on an ellipse; `front` selects the near half, drawn after the buildings.
function Palisade({ rx, ry, front }: { rx: number; ry: number; front: boolean }) {
  const stakes = [];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const sin = Math.sin(a);
    if (front !== sin > 0) continue;
    const x = Math.cos(a) * rx;
    const y = sin * ry;
    stakes.push(<path key={i} d={`M${x.toFixed(2)},${y.toFixed(2)} l0,-3.2 l0.5,-0.7 l0.5,0.7 l0,3.2Z`} />);
  }
  return (
    <g fill="#8a6a42" stroke={INK} strokeWidth={0.35}>
      {stakes}
    </g>
  );
}

export function PieceDefs() {
  return (
    <>
      <symbol id="piece-village" overflow="visible">
        <ellipse cx={0} cy={-1} rx={11} ry={5} fill="#cfb27e" opacity={0.7} />
        <Pennant x={-7} y={-2} h={15} />
        <Hut x={-2.5} y={-3} />
        <Hut x={4.5} y={-1.5} />
        <Hut x={-0.5} y={2.5} />
      </symbol>
      <symbol id="piece-town" overflow="visible">
        <ellipse cx={0} cy={0} rx={15} ry={7.2} fill="#cbb07c" opacity={0.75} />
        <Palisade rx={14} ry={6.6} front={false} />
        <Pennant x={-1} y={-4} h={20} />
        <House x={-6.5} y={-2.5} />
        <House x={1.5} y={-3.5} />
        <House x={7} y={-0.5} />
        <House x={-2} y={2} s={1.25} />
        <House x={-9} y={2.5} s={0.9} />
        <House x={5} y={4} s={0.9} />
        <Palisade rx={14} ry={6.6} front />
      </symbol>
      <symbol id="token-cube" overflow="visible">
        <path d="M0,-6 L3.6,-4.2 L0,-2.4 L-3.6,-4.2Z" fill="currentColor" />
        <path d="M0,-6 L3.6,-4.2 L0,-2.4 L-3.6,-4.2Z" fill="rgba(255,255,255,0.32)" />
        <path d="M-3.6,-4.2 L0,-2.4 L0,1.2 L-3.6,-0.6Z" fill="currentColor" />
        <path d="M0,-2.4 L3.6,-4.2 L3.6,-0.6 L0,1.2Z" fill="currentColor" />
        <path d="M0,-2.4 L3.6,-4.2 L3.6,-0.6 L0,1.2Z" fill="rgba(0,0,0,0.28)" />
        <path d="M0,-6 L3.6,-4.2 L3.6,-0.6 L0,1.2 L-3.6,-0.6 L-3.6,-4.2Z M-3.6,-4.2 L0,-2.4 L3.6,-4.2 M0,-2.4 L0,1.2" fill="none" stroke={INK} strokeWidth={0.45} strokeLinejoin="round" />
      </symbol>
    </>
  );
}

export const MAX_CUBES = 5;

// A civilization's loose tokens in one area: one cube per token, up to MAX_CUBES, then "+n".
export function TokenStack({ count, color }: { count: number; color: string }) {
  const cubes = Math.min(count, MAX_CUBES);
  return (
    <g color={color}>
      <ellipse cx={0} cy={0.6} rx={4.4} ry={1.9} fill="rgba(40,25,10,0.3)" />
      {Array.from({ length: cubes }, (_, i) => (
        <use key={i} href="#token-cube" y={-i * 3.6} />
      ))}
      {count > MAX_CUBES && (
        <text x={5} y={-cubes * 3.6} fontSize={5} fontWeight={700} fontFamily="var(--font-display)" fill="var(--ink)">
          +{count - MAX_CUBES}
        </text>
      )}
    </g>
  );
}

export type CountState = 'empty' | 'open' | 'full' | 'over';

export function countState(total: number, limit: number): CountState {
  if (total === 0) return 'empty';
  if (total > limit) return 'over';
  return total === limit ? 'full' : 'open';
}

const COUNT_STYLE: Record<CountState, { fill: string; stroke: string; text: string; opacity: number }> = {
  empty: { fill: 'rgba(251,244,226,0.55)', stroke: 'rgba(59,42,26,0.45)', text: 'rgba(59,42,26,0.7)', opacity: 0.85 },
  open: { fill: '#fbf4e2', stroke: INK, text: INK, opacity: 1 },
  full: { fill: '#4a3624', stroke: INK, text: '#f4ead2', opacity: 1 },
  over: { fill: '#a3301c', stroke: '#3b1208', text: '#fff4e6', opacity: 1 },
};

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

// Growth progress as a short fraction: ½, ¼, ¾, else two decimals (".3").
export function fraction(progress: number): string {
  return FRACTIONS[String(progress)] ?? progress.toFixed(2).replace(/^0/, '').replace(/0$/, '');
}

// Tokens in the area (all civilizations) over its population limit, e.g. "3/5". Over the limit
// means conflict (design doc §11). Tokens ordered out this turn show as "4−3/4"; growth progress
// toward the next token as "1/5 +½" (design doc §4).
export function AreaCount({ total, limit, leaving = 0, progress = 0 }: { total: number; limit: number; leaving?: number; progress?: number }) {
  const state = countState(total, limit);
  const style = COUNT_STYLE[state];
  const label = (leaving > 0 ? `${total}−${leaving}/${limit}` : `${total}/${limit}`) + (progress > 0 ? ` +${fraction(progress)}` : '');
  const width = 4 + label.length * 3.4;
  return (
    <g opacity={style.opacity}>
      <rect x={-width / 2} y={-3.4} width={width} height={6.8} rx={3.4} fill={style.fill} stroke={style.stroke} strokeWidth={0.6} />
      {state === 'over' && <path d={`M${width / 2 - 1},-3.6 l2.4,-2.4 m-2.4,0 l2.4,2.4`} stroke="#a3301c" strokeWidth={0.9} />}
      <text y={1.9} fontSize={5.2} fontWeight={700} fontFamily="var(--font-display)" fill={style.text} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

// A resource marker for an area (design doc §6): a sheaf of grain or a fish, on a small disc.
export function ResourceIcon({ resource }: { resource: string }) {
  return (
    <g>
      <circle r={3.6} fill="#fbf4e2" stroke={INK} strokeWidth={0.5} opacity={0.92} />
      {resource === 'fish' ? (
        <g fill="#2f6f8f" stroke="none">
          <ellipse cx={-0.5} cy={0} rx={1.9} ry={1.05} />
          <path d="M1.1,0 L2.6,-1.1 L2.6,1.1 Z" />
        </g>
      ) : (
        <g stroke="#9a6b14" strokeWidth={0.45} fill="#d9a630" strokeLinecap="round">
          <path d="M0,2.4 V-1.2 M-1.1,2.4 L-0.5,-0.4 M1.1,2.4 L0.5,-0.4" fill="none" />
          <ellipse cx={0} cy={-1.8} rx={0.55} ry={1} />
          <ellipse cx={-0.75} cy={-0.9} rx={0.5} ry={0.85} transform="rotate(-25 -0.75 -0.9)" />
          <ellipse cx={0.75} cy={-0.9} rx={0.5} ry={0.85} transform="rotate(25 0.75 -0.9)" />
        </g>
      )}
      <title>{resource.charAt(0).toUpperCase() + resource.slice(1)}</title>
    </g>
  );
}

// A settlement's name on a small banner, centered under the piece.
// A settlement's name below its piece; a capital gets a gold star to the left of it, or alone
// when unnamed.
export function SettlementLabel({ name, capital = false }: { name?: string; capital?: boolean }) {
  const width = name ? 6 + name.length * 2.9 : 0;
  return (
    <g>
      {name && (
        <>
          <rect x={-width / 2} y={0} width={width} height={7} rx={1} fill="#fbf4e2" stroke={INK} strokeWidth={0.5} opacity={0.92} />
          <text y={5.1} fontSize={5.2} fontFamily="var(--font-display)" fontWeight={700} fill={INK} textAnchor="middle">
            {name}
          </text>
        </>
      )}
      {capital && (
        <g transform={`translate(${name ? -width / 2 - 5 : 0} 3.5) scale(1.4)`}>
          <title>Capital</title>
          <path d="M0,-3 L0.9,-0.9 L3,-0.9 L1.3,0.4 L1.9,2.6 L0,1.3 L-1.9,2.6 L-1.3,0.4 L-3,-0.9 L-0.9,-0.9Z" fill="#e2b33c" stroke="#5a4210" strokeWidth={0.5} strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}
