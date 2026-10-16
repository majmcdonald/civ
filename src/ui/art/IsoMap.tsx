import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { AreaId, GameMap, MapArea, Point, Terrain } from '../../engine';
import { AreaCount, PieceDefs, SettlementLabel, TokenStack, type MapPieces } from './pieces';
import { TerrainArt } from './terrainArt';

// Isometric board (development plan, Art): the flat atlas map tilted like a board on a table,
// with terrain and pieces drawn upright. Map data stays 2-D; the projection is presentation only.

export const TERRAIN_FILL: Record<Terrain, string> = {
  plains: '#e2ddaa',
  forest: '#c3cb98',
  hills: '#dcc697',
  mountains: '#c9b89c',
  desert: '#f2d595',
  marsh: '#c6d0b2',
};

// Civilization colors: distinct hues first (the default five), then lightness variants of them,
// so any two read apart on parchment.
export const CIV_COLORS = [
  '#b3261e', // crimson
  '#2456a6', // royal blue
  '#2e7d32', // forest green
  '#e0a100', // gold
  '#6a1b9a', // purple
  '#00838f', // teal
  '#e65100', // orange
  '#2b2b2b', // charcoal
  '#f3eee2', // ivory
  '#c2185b', // magenta
  '#6d4c41', // brown
  '#9ccc38', // lime
  '#5fb2ec', // sky blue
  '#9e9e9e', // grey
  '#f4a6c0', // pink
];

const BOARD_DEPTH = 14;
// Grid cell size in map units (engine map grid).
const CELL_SIZE = 10;
const PROJECTION = 'matrix(1 0.5 -1 0.5 0 0)';

export const project = ([x, y]: Point): Point => [x - y, (x + y) / 2];

const ringPath = (rings: Point[][]) =>
  rings.map((ring) => ring.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join('') + 'Z').join('');

const linePath = (points: Point[]) => points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join('');

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function jitter(x: number, y: number, salt: number): number {
  let h = Math.imul(Math.round(x * 10) * 374761393 + Math.round(y * 10) * 668265263 + salt, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5;
}

// Rivers are drawn as ribbons: a gently meandering course, smoothed, widening from source to mouth.
function riverRibbon(course: Point[], toSea: boolean): string {
  if (course.length < 2) return '';
  // Meander: offset each segment's midpoint sideways.
  const wavy: Point[] = [course[0]!];
  for (let i = 1; i < course.length; i++) {
    const [ax, ay] = course[i - 1]!;
    const [bx, by] = course[i]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const off = jitter(ax + bx, ay + by, 7) * 3.2;
    wavy.push([(ax + bx) / 2 + (-(by - ay) / len) * off, (ay + by) / 2 + ((bx - ax) / len) * off], [bx, by]);
  }
  // Chaikin smoothing, keeping both ends.
  let pts = wavy;
  for (let pass = 0; pass < 3; pass++) {
    const next: Point[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(pts[pts.length - 1]!);
    pts = next;
  }
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  }
  const total = lengths[lengths.length - 1]! || 1;
  const widthAt = (i: number) => {
    const t = lengths[i]! / total;
    const base = 1.1 + t * (toSea ? 2.9 : 1.7);
    return toSea && t > 0.9 ? base * (1 + (t - 0.9) * 8) : base;
  };
  const left: string[] = [];
  const right: string[] = [];
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[Math.max(0, i - 1)]!;
    const [nx, ny] = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(nx - px, ny - py) || 1;
    const w = widthAt(i) / 2;
    const ox = (-(ny - py) / len) * w;
    const oy = ((nx - px) / len) * w;
    left.push(`${(x + ox).toFixed(2)},${(y + oy).toFixed(2)}`);
    right.push(`${(x - ox).toFixed(2)},${(y - oy).toFixed(2)}`);
  });
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

// A trail between two neighboring areas: center to center through a point on their shared border.
function roadPath(a: MapArea, b: MapArea): string {
  const mine = new Set(a.outline.flat().map(String));
  const mx = (a.center[0] + b.center[0]) / 2;
  const my = (a.center[1] + b.center[1]) / 2;
  let via: Point = [mx, my];
  let best = Infinity;
  for (const p of b.outline.flat()) {
    if (!mine.has(String(p))) continue;
    const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2;
    if (d < best) {
      best = d;
      via = p;
    }
  }
  // Quadratic through `via`: control point chosen so the curve passes through it at t = 0.5.
  const cx = 2 * via[0] - mx;
  const cy = 2 * via[1] - my;
  return `M${a.center[0]},${a.center[1]} Q${cx},${cy} ${b.center[0]},${b.center[1]}`;
}

interface Glyph {
  key: string;
  symbol: string;
  x: number;
  y: number;
  scale: number;
}

// Upright terrain art placed on cell centers, painted back to front.
// `clear` gives, per area, a radius around its center kept free of terrain art (for pieces).
function terrainGlyphs(map: GameMap, clear: Map<AreaId, number>): Glyph[] {
  const glyphs: Glyph[] = [];
  // Keep the river's own cells clear so terrain art never hides it.
  const riverCells = new Set(map.rivers.flatMap((r) => r.course.map(String)));
  for (const area of map.areas) {
    if (area.kind !== 'land') continue;
    const radius = clear.get(area.id) ?? 0;
    area.cells.forEach((cell, i) => {
      const terrain = area.terrain!;
      if (radius > 0 && Math.hypot(cell[0] - area.center[0], cell[1] - area.center[1]) < radius) return;
      const every = terrain === 'plains' ? 3 : terrain === 'desert' || terrain === 'marsh' ? 2 : 1;
      if (i % every !== 0 || riverCells.has(String(cell))) return;
      const [x, y] = project([cell[0] + jitter(cell[0], cell[1], 1) * 4, cell[1] + jitter(cell[0], cell[1], 2) * 4]);
      glyphs.push({ key: `${area.id}-${i}`, symbol: terrain === 'forest' ? (jitter(cell[0], cell[1], 4) < 0 ? '#glyph-forest-broadleaf' : '#glyph-forest-engraved') : `#glyph-${terrain}`, x, y, scale: (0.85 + jitter(cell[0], cell[1], 3) * 0.3) * (terrain === 'plains' || terrain === 'marsh' ? 0.55 : 1) });
    });
    if (area.features.includes('volcanic') && radius === 0) {
      const [x, y] = project(area.center);
      glyphs.push({ key: `${area.id}-volcano`, symbol: '#glyph-volcano', x, y: y + 0.5, scale: 1.1 });
    }
  }
  return glyphs.sort((a, b) => a.y - b.y);
}

function GlyphDefs() {
  return (
    <defs>
      <symbol id="glyph-mountains" overflow="visible">
        <path d="M-7,0 L-1,-11 L5,0Z" fill="#b3a083" stroke="var(--ink)" strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M-1,-11 L1.5,0 L5,0Z" fill="#8f7c62" />
        <path d="M-2.6,-8.1 L-1,-11 L0.6,-8.2 L-0.6,-8.8Z" fill="#f4ecd8" />
        <path d="M2,0 L6,-7 L10,0Z" fill="#c2b092" stroke="var(--ink)" strokeWidth={0.5} strokeLinejoin="round" />
      </symbol>
      <symbol id="glyph-hills" overflow="visible">
        <path d="M-7,0 Q-3.5,-7 0,0Z" fill="#cdb27e" stroke="var(--ink)" strokeWidth={0.5} />
        <path d="M-2,0 Q2,-8 6,0Z" fill="#d8bf8c" stroke="var(--ink)" strokeWidth={0.5} />
      </symbol>
      <symbol id="glyph-marsh" overflow="visible">
        <path d="M-5,0 L5,0" stroke="var(--sea-ink)" strokeWidth={0.6} opacity={0.7} />
        <path d="M-3,0 L-4,-5 M-1.5,0 L-1.5,-6.5 M0,0 L1,-5 M3,0 L3.5,-4" stroke="#5d6e44" strokeWidth={0.6} fill="none" />
      </symbol>
      <symbol id="glyph-desert" overflow="visible">
        <path d="M-6,0 Q-3,-2.6 0,0 M-1,-1 Q2.5,-3.6 6,-1" stroke="#a88a52" strokeWidth={0.7} fill="none" />
      </symbol>
      <symbol id="glyph-plains" overflow="visible">
        <path d="M-2,0 L-3,-3 M0,0 L0,-3.6 M2,0 L3,-3" stroke="#9a9a5a" strokeWidth={0.55} fill="none" />
      </symbol>
      <TerrainArt />
      <PieceDefs />
      <symbol id="piece-start" overflow="visible">
        <ellipse cx={0} cy={0} rx={6} ry={3} fill="rgba(40,25,10,0.35)" />
        <path d="M0,0 L0,-26" stroke="var(--ink)" strokeWidth={1.2} />
        <path d="M0,-26 L13,-22 L0,-17Z" fill="currentColor" stroke="var(--ink)" strokeWidth={0.7} strokeLinejoin="round" />
        <circle cx={0} cy={-26.5} r={1.5} fill="#c9a24a" stroke="var(--ink)" strokeWidth={0.5} />
      </symbol>
      <pattern id="floodplain" width={5} height={5} patternUnits="userSpaceOnUse">
        <path d="M0,2.5 L3,2.5" stroke="var(--sea-ink)" strokeWidth={0.5} opacity={0.55} />
      </pattern>
      <filter id="board-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.1 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
  );
}

interface IsoMapProps {
  map: GameMap;
  // Screen pixels covered on the left (e.g., by a panel); the board centers in the rest.
  insetLeft?: number;
  pieces: MapPieces;
  // Tokens-over-limit badge per unsettled land area.
  showCounts: boolean;
  hovered: AreaId | null;
  onHover: (area: AreaId | null) => void;
  // Stress test hooks: drop the upright terrain art, and drive the view from outside. The game
  // screen also uses `handle` to center on an area.
  hideTerrainArt?: boolean;
  handle?: Ref<IsoMapHandle>;
}

export interface IsoMapHandle {
  home: () => View;
  setView: (view: View) => void;
  // Center on an area, zoomed in close enough to see its pieces.
  focus: (area: AreaId) => void;
  svg: () => SVGSVGElement | null;
}

export interface View {
  cx: number;
  cy: number;
  zoom: number;
}

export function IsoMap({ map, insetLeft = 0, pieces, showCounts, hovered, onHover, hideTerrainArt = false, handle }: IsoMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const { width: w, height: h } = map;
  const bounds = { minX: -h, maxX: w, minY: 0, maxY: (w + h) / 2 + BOARD_DEPTH };
  const home: View = { cx: (bounds.minX + bounds.maxX) / 2, cy: (bounds.minY + bounds.maxY) / 2, zoom: 1 };
  const [view, setView] = useState<View>(home);
  // Larger maps allow deeper zoom, so areas can always be seen at standard detail.
  const maxZoom = Math.max(8, w / 75);
  useImperativeHandle(handle, () => ({
    home: () => home,
    setView,
    focus: (id) => {
      const [cx, cy] = project(map.areas[id]!.center);
      setView({ cx, cy, zoom: maxZoom * 0.6 });
    },
    svg: () => svgRef.current,
  }));
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => setView(home), [map]);

  // Measure before the first paint so the board never renders at a placeholder size.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setSize({ width: rect.width || 1, height: rect.height || 1 });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Fit the whole board at zoom 1, with a margin.
  const margin = 1.08;
  const inset = Math.min(insetLeft, size.width * 0.5);
  const fit = Math.max(((bounds.maxX - bounds.minX) * margin) / (size.width - inset), ((bounds.maxY - bounds.minY) * margin) / size.height);
  const unitsPerPixel = fit / view.zoom;
  const vbW = size.width * unitsPerPixel;
  const vbH = size.height * unitsPerPixel;
  const viewBox = `${view.cx - vbW / 2 - (inset / 2) * unitsPerPixel} ${view.cy - vbH / 2} ${vbW} ${vbH}`;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      setView((v) => {
        const zoom = Math.min(maxZoom, Math.max(1, v.zoom * Math.exp(-event.deltaY * 0.0015)));
        const before = fit / v.zoom;
        const after = fit / zoom;
        const px = event.clientX - rect.left - rect.width / 2;
        const py = event.clientY - rect.top - rect.height / 2;
        return { zoom, cx: v.cx + px * (before - after), cy: v.cy + py * (before - after) };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [fit, maxZoom]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    setView({ ...d.view, cx: d.view.cx - dx * unitsPerPixel, cy: d.view.cy - dy * unitsPerPixel });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const land = useMemo(() => map.areas.filter((a) => a.kind === 'land'), [map]);
  const sea = useMemo(() => map.areas.filter((a) => a.kind === 'sea'), [map]);
  const clear = useMemo(() => {
    const radii = new Map<AreaId, number>();
    for (const s of pieces.settlements) radii.set(s.area, s.tier === 'town' ? 16 : 12);
    for (const s of pieces.stacks) if (!radii.has(s.area)) radii.set(s.area, 8);
    return radii;
  }, [pieces]);
  const glyphs = useMemo(() => terrainGlyphs(map, clear), [map, clear]);
  const roads = useMemo(() => pieces.roads.map(([a, b]) => roadPath(map.areas[a]!, map.areas[b]!)), [map, pieces]);
  const rivers = useMemo(
    () => map.rivers.map((river) => ({ id: river.id, d: riverRibbon(river.course, map.areas[river.outlet]!.kind === 'sea') })),
    [map],
  );

  const corners = { top: project([0, 0]), right: project([w, 0]), bottom: project([w, h]), left: project([0, h]) };
  const down = (p: Point): Point => [p[0], p[1] + BOARD_DEPTH];
  const hoveredArea = hovered === null ? null : map.areas[hovered];
  // Borders fade as cells shrink on screen; pieces never shrink below their standard size.
  const cellPixels = (CELL_SIZE / unitsPerPixel) * 1.2;
  const borderOpacity = 0.62 * Math.min(1, Math.max(0.2, (cellPixels - 3) / 6));
  const pieceScale = Math.min(12, Math.max(1, unitsPerPixel / 0.9));

  // Settlements, token stacks, count badges, and (without settlements) start flags, back to front.
  const piecesLayer = useMemo(() => {
    const items: { y: number; key: string; node: ReactNode }[] = [];
    // Pieces keep their size in map units so they stay inside their area; only start flags grow
    // when zoomed out.
    const place = (key: string, at: Point, node: ReactNode, size = 1) =>
      items.push({ y: at[1], key, node: <g key={key} transform={`translate(${at[0]} ${at[1]}) scale(${size})`}>{node}</g> });
    for (const s of pieces.settlements) {
      place(`s${s.area}`, project(map.areas[s.area]!.center), <use href={`#piece-${s.tier}`} color={CIV_COLORS[s.civ]} />, s.tier === 'town' ? 0.62 : 0.75);
    }
    const byArea = new Map<AreaId, MapPieces['stacks']>();
    for (const stack of pieces.stacks) byArea.set(stack.area, [...(byArea.get(stack.area) ?? []), stack]);
    for (const [area, stacks] of byArea) {
      const [cx, cy] = project(map.areas[area]!.center);
      stacks.forEach((stack, i) => {
        const dx = (i - (stacks.length - 1) / 2) * 5.5;
        place(`t${area}-${stack.civ}`, [cx + dx, cy], <TokenStack count={stack.count} color={CIV_COLORS[stack.civ]!} />, 0.55);
      });
    }
    if (pieces.settlements.length === 0) {
      map.starts.forEach((id, civ) => {
        place(
          `f${civ}`,
          project(map.areas[id]!.center),
          <g color={CIV_COLORS[civ]}>
            <use href="#piece-start" />
            <text x={6.5} y={-20} fontSize={5.5} fontFamily="var(--font-display)" fill="#f6eedb" textAnchor="middle">
              {civ + 1}
            </text>
          </g>,
          pieceScale,
        );
      });
    }
    if (showCounts) {
      const settled = new Set(pieces.settlements.map((p) => p.area));
      for (const area of map.areas) {
        if (area.kind !== 'land' || settled.has(area.id)) continue;
        const [cx, cy] = project(area.center);
        const total = (byArea.get(area.id) ?? []).reduce((sum, stack) => sum + stack.count, 0);
        // Badges sit just in front of the stacks and are painted last, so pieces never hide them.
        items.push({
          y: Infinity,
          key: `c${area.id}`,
          node: (
            <g key={`c${area.id}`} transform={`translate(${cx} ${cy + (total > 0 ? 3.4 : 0)}) scale(0.6)`}>
              <AreaCount total={total} limit={area.limit} />
            </g>
          ),
        });
      }
    }
    // Names go on top of everything, just below their settlement.
    for (const s of pieces.settlements) {
      if (!s.name) continue;
      const [cx, cy] = project(map.areas[s.area]!.center);
      items.push({
        y: Infinity,
        key: `n${s.area}`,
        node: (
          <g key={`n${s.area}`} transform={`translate(${cx} ${cy + (s.tier === 'town' ? 4.5 : 3)}) scale(0.6)`}>
            <SettlementLabel name={s.name} />
          </g>
        ),
      });
    }
    return items.sort((a, b) => a.y - b.y).map((item) => item.node);
  }, [map, pieces, showCounts, pieceScale]);

  // Everything that changes only with the map, so panning and zooming re-render cheaply.
  const board = useMemo(
    () => (
      <>
        {/* The flat board, drawn in map coordinates and projected. */}
        <g transform={PROJECTION}>
          <g clipPath="url(#board-clip)">
            <rect x={0} y={0} width={w} height={h} fill="var(--sea-wash)" />
            {sea.map((area) => (
              <path
                key={area.id}
                d={ringPath(area.outline)}
                fill="var(--sea-wash)"
                stroke="var(--sea-ink)"
                strokeWidth={0.6}
                strokeDasharray="2 3"
                style={{ strokeOpacity: 'calc(var(--border-opacity) * 0.95)' }}
                vectorEffect="non-scaling-stroke"
                onPointerEnter={() => onHoverRef.current(area.id)}
              />
            ))}
            {map.coastline.map((path, i) => (
              <path key={i} d={linePath(path)} fill="none" stroke="#d7ddd0" strokeWidth={7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.8} />
            ))}
            {land.map((area) => (
              <path
                key={area.id}
                d={ringPath(area.outline)}
                fill={TERRAIN_FILL[area.terrain!]}
                stroke={TERRAIN_FILL[area.terrain!]}
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                onPointerEnter={() => onHoverRef.current(area.id)}
              />
            ))}
            {land
              .filter((a) => a.features.includes('floodplain'))
              .map((area) => (
                <path key={area.id} d={ringPath(area.outline)} fill="url(#floodplain)" pointerEvents="none" />
              ))}
            <g fill="none" stroke="var(--ink)" strokeWidth={0.7} pointerEvents="none" style={{ strokeOpacity: 'var(--border-opacity)' }}>
              {land.map((area) => (
                <path key={area.id} d={ringPath(area.outline)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <g fill="none" stroke="var(--ink)" strokeWidth={1.4} strokeLinejoin="round" pointerEvents="none">
              {map.coastline.map((path, i) => (
                <path key={i} d={linePath(path)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <g fill="none" strokeLinecap="round" pointerEvents="none">
            {roads.map((d, i) => (
              <path key={`u${i}`} d={d} stroke="#f1e4c0" strokeWidth={4.2} opacity={0.8} vectorEffect="non-scaling-stroke" />
            ))}
            {roads.map((d, i) => (
              <path key={i} d={d} stroke="#6b4423" strokeWidth={2} strokeDasharray="3.5 2.2" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          <g fill="#86aabb" stroke="#3f6070" strokeLinejoin="round" pointerEvents="none">
              {rivers.map((river) => (
                <path key={river.id} d={river.d} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          </g>
          <rect x={0} y={0} width={w} height={h} filter="url(#board-grain)" pointerEvents="none" />
          <rect x={0} y={0} width={w} height={h} fill="none" stroke="var(--ink)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </g>

        {/* Upright pieces, painted back to front. */}
        <g pointerEvents="none">
          {!hideTerrainArt && glyphs.map((g) => (
            <use key={g.key} href={g.symbol} transform={`translate(${g.x} ${g.y}) scale(${g.scale})`} />
          ))}
        </g>
      </>
    ),
    [map, land, sea, glyphs, rivers, roads, w, h, hideTerrainArt],
  );

  return (
    <svg
      ref={svgRef}
      className="iso-map"
      viewBox={viewBox}
      style={{ '--border-opacity': borderOpacity } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => onHover(null)}
    >
      <GlyphDefs />
      <clipPath id="board-clip">
        <rect x={0} y={0} width={w} height={h} />
      </clipPath>

      {/* Board edge and shadow on the table. */}
      <path
        d={linePath([corners.left, corners.bottom, corners.right].map(down))}
        fill="none"
        stroke="rgba(20,12,4,0.35)"
        strokeWidth={18}
        strokeLinejoin="round"
        transform="translate(6 10)"
        style={{ filter: 'blur(8px)' }}
      />
      <path d={`${linePath([corners.left, corners.bottom, down(corners.bottom), down(corners.left)])}Z`} fill="#b39566" stroke="var(--ink)" strokeWidth={0.8} />
      <path d={`${linePath([corners.bottom, corners.right, down(corners.right), down(corners.bottom)])}Z`} fill="#9c7f54" stroke="var(--ink)" strokeWidth={0.8} />

      {board}
      {hoveredArea && (
        <g transform={PROJECTION} clipPath="url(#board-clip)" pointerEvents="none">
          <path
            d={ringPath(hoveredArea.outline)}
            fill="rgba(138,47,31,0.08)"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
      <g pointerEvents="none">{piecesLayer}</g>
    </svg>
  );
}
