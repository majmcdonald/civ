import { createRng, stepRng } from '../rng';
import { boundaryPaths, buildGrid, hash, type HexGrid } from './grid';
import type { AreaId, Feature, GameMap, MapArea, MapOptions, MapType, Point, River, ResourceId, RoomToExpand, Terrain } from './types';

// Procedural map generator (design doc §4, Procedural maps). Deterministic: the same options
// always give the same map. Builds a fine hex grid, raises land from a shape plus noise, groups
// cells into areas, then assigns terrain, features, rivers, and fair starting positions.

export const LAND_AREAS_PER_CIVILIZATION = 64;
export const MAX_CIVILIZATIONS = 15;
// Land areas per civilization relative to standard (design doc §2, Room to expand).
export const ROOM_FACTOR: Record<RoomToExpand, number> = { veryCrowded: 0.25, crowded: 0.5, standard: 1, spacious: 2 };
// Grid cells on a standard five-civilization map; noise frequency scales from it so terrain
// patches keep their size in areas as maps grow.
const REFERENCE_CELLS = 2760;
const CELLS_PER_LAND_AREA = 5;
const CELLS_PER_SEA_AREA = 14;
const ASPECT = 1.35;
const MAX_ATTEMPTS = 25;

const LAND_SHARE: Record<MapType, number> = { inlandSea: 0.58, continents: 0.45, singleLandmass: 0.78 };

// Starting limit range per terrain (tuning, §17).
const LIMITS: Record<Terrain, [number, number]> = {
  plains: [3, 5],
  forest: [2, 4],
  hills: [2, 3],
  mountains: [1, 2],
  desert: [1, 2],
  marsh: [1, 2],
};

const START_REACH = 3;
const START_MAX_POOR_SHARE = 0.3;
const START_QUALITY_SHARE = 0.85;
const START_TRIALS = 60;
// Fewest moves between two starts; very crowded maps allow closer starts so 2–15 civilizations fit
// and fighting starts early (design doc §2, Room to expand).
const MIN_START_SPACING: Record<RoomToExpand, number> = { veryCrowded: 3, crowded: 4, standard: 4, spacious: 4 };

type Random = () => number;

function makeRandom(seed: number): Random {
  let rng = createRng(seed);
  return () => {
    const [value, next] = stepRng(rng);
    rng = next;
    return value;
  };
}

function shuffle<T>(items: T[], rand: Random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(x0, y0, seed) + (hash(x0 + 1, y0, seed) - hash(x0, y0, seed)) * sx;
  const bottom = hash(x0, y0 + 1, seed) + (hash(x0 + 1, y0 + 1, seed) - hash(x0, y0 + 1, seed)) * sx;
  return top + (bottom - top) * sy;
}

function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let norm = 0;
  let amp = 1;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// Minimal binary heap keyed by cost.
class Heap {
  private items: { cost: number; value: number; tag: number }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(cost: number, value: number, tag = 0): void {
    const items = this.items;
    items.push({ cost, value, tag });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent]!.cost <= items[i]!.cost) break;
      [items[parent], items[i]] = [items[i]!, items[parent]!];
      i = parent;
    }
  }
  pop(): { cost: number; value: number; tag: number } {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l]!.cost < items[m]!.cost) m = l;
        if (r < items.length && items[r]!.cost < items[m]!.cost) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i]!, items[m]!];
        i = m;
      }
    }
    return top;
  }
}

export function validateMapOptions(options: MapOptions): string | null {
  if (!Number.isInteger(options.seed)) return 'Seed must be an integer';
  if (!Number.isInteger(options.civilizations) || options.civilizations < 2 || options.civilizations > MAX_CIVILIZATIONS) {
    return `Civilizations must be 2–${MAX_CIVILIZATIONS}`;
  }
  if (!(options.room in ROOM_FACTOR)) return `Unknown room to expand "${options.room}"`;
  if (!(options.type in LAND_SHARE)) return `Unknown map type "${options.type}"`;
  return null;
}

export function generateMap(options: MapOptions): GameMap {
  const problem = validateMapOptions(options);
  if (problem) throw new RangeError(problem);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = tryGenerate(options, attempt);
    if (map) return map;
  }
  throw new Error(`No valid map after ${MAX_ATTEMPTS} attempts`);
}

type Shape = (u: number, v: number) => number;

function shapeFor(type: MapType, civilizations: number, rand: Random): Shape | null {
  const radial = (u: number, v: number) => {
    const dx = (u - 0.5) * 2;
    const dy = (v - 0.5) * 2;
    return Math.sqrt(dx * dx + dy * dy);
  };
  if (type === 'inlandSea') return (u, v) => 1 - Math.abs(radial(u, v) - 0.6) * 2;
  if (type === 'singleLandmass') return (u, v) => 1 - radial(u, v) * 0.8;

  const count = civilizations <= 3 ? 2 : civilizations <= 5 ? 3 : civilizations <= 7 ? 4 : civilizations <= 10 ? 5 : 6;
  const separation = 0.62 / Math.sqrt(count);
  const reach = 0.78 / Math.sqrt(count);
  const centers: Point[] = [];
  for (let tries = 0; centers.length < count && tries < 2000; tries++) {
    const c: Point = [0.15 + rand() * 0.7, 0.17 + rand() * 0.66];
    if (centers.every(([x, y]) => Math.sqrt((x - c[0]) ** 2 + (y - c[1]) ** 2) > separation)) centers.push(c);
  }
  if (centers.length < count) return null;
  // Distance to the nearest center, with an ocean channel where two continents' reaches meet.
  return (u, v) => {
    const d = centers.map(([x, y]) => Math.sqrt((u - x) ** 2 + ((v - y) * 0.8) ** 2)).sort((a, b) => a - b);
    const gap = d[1]! - d[0]!;
    return 1 - d[0]! / reach - Math.max(0, 0.1 - gap) * 12;
  };
}

function components(grid: HexGrid, same: (a: number, b: number) => boolean): number[] {
  const label = new Array<number>(grid.count).fill(-1);
  let next = 0;
  for (let i = 0; i < grid.count; i++) {
    if (label[i] !== -1) continue;
    const stack = [i];
    label[i] = next;
    while (stack.length > 0) {
      const cell = stack.pop()!;
      for (const n of grid.neighbors[cell]!) {
        if (n >= 0 && label[n] === -1 && same(cell, n)) {
          label[n] = next;
          stack.push(n);
        }
      }
    }
    next++;
  }
  return label;
}

function groupBy(labels: number[]): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  labels.forEach((label, cell) => {
    const group = groups.get(label);
    if (group) group.push(cell);
    else groups.set(label, [cell]);
  });
  return groups;
}

// Grows `count` irregular regions over `cells` from spaced seeds. Writes region ids into `regionOf`.
function growRegions(grid: HexGrid, cells: number[], count: number, firstId: number, regionOf: number[], rand: Random): void {
  const inSet = new Set(cells);
  const perRegion = cells.length / count;
  const seeds: number[] = [];
  const isSeed = new Set<number>();
  const order = shuffle([...cells], rand);
  for (let spacing = Math.max(1, Math.floor(Math.sqrt(perRegion) * 0.9)); seeds.length < count && spacing >= 0; spacing--) {
    // Cells within `spacing` of a seed are blocked.
    const blocked = new Set<number>();
    const block = (seed: number) => {
      let ring = [seed];
      blocked.add(seed);
      for (let d = 0; d < spacing; d++) {
        const next: number[] = [];
        for (const c of ring) {
          for (const n of grid.neighbors[c]!) {
            if (n >= 0 && !blocked.has(n)) {
              blocked.add(n);
              next.push(n);
            }
          }
        }
        ring = next;
      }
    };
    for (const seed of seeds) block(seed);
    for (const cell of order) {
      if (seeds.length >= count) break;
      if (isSeed.has(cell) || blocked.has(cell)) continue;
      seeds.push(cell);
      isSeed.add(cell);
      block(cell);
    }
  }

  const size = new Array<number>(seeds.length).fill(0);
  const heap = new Heap();
  seeds.forEach((cell, i) => heap.push(0, cell, i));
  while (heap.size > 0) {
    const { cost, value: cell, tag: region } = heap.pop();
    if (regionOf[cell] !== -1) continue;
    regionOf[cell] = firstId + region;
    size[region]! += 1;
    for (const n of grid.neighbors[cell]!) {
      if (n < 0 || !inSet.has(n) || regionOf[n] !== -1) continue;
      heap.push(cost + 1 + rand() * 1.2 + (0.5 * size[region]!) / perRegion, n, region);
    }
  }
}

function tryGenerate(options: MapOptions, attempt: number): GameMap | null {
  const { civilizations, type, room } = options;
  const seed = (options.seed ^ Math.imul(attempt + 1, 0x9e3779b1)) | 0;
  const rand = makeRandom(seed);

  const landAreaTarget = Math.round(LAND_AREAS_PER_CIVILIZATION * ROOM_FACTOR[room] * civilizations);
  const landShare = LAND_SHARE[type];
  const totalCells = Math.round((landAreaTarget * CELLS_PER_LAND_AREA) / landShare);
  const rows = Math.round(Math.sqrt(totalCells / (0.866 * ASPECT)));
  const cols = Math.round(totalCells / rows);
  const grid = buildGrid(cols, rows, seed);
  const freq = Math.sqrt(totalCells / REFERENCE_CELLS);

  // Land and sea.
  const shape = shapeFor(type, civilizations, rand);
  if (!shape) return null;
  const elevation: number[] = [];
  for (let i = 0; i < grid.count; i++) {
    const u = grid.x[i]! / grid.width;
    const v = grid.y[i]! / grid.height;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const edgePenalty = edge < 0.08 ? (0.08 - edge) * 8 : 0;
    const noise = fbm(u * 5 * freq, (v * 5 * freq * grid.height) / grid.width, seed);
    elevation.push(shape(u, v) * 0.7 + (noise - 0.5) * 0.9 - edgePenalty);
  }
  const sorted = [...elevation].sort((a, b) => a - b);
  const sea = sorted[Math.floor((1 - landShare) * grid.count)]!;
  const land = elevation.map((e) => e > sea);

  // Fill small enclosed lakes; drown specks of land.
  const waterBodies = groupBy(components(grid, (a, b) => land[a] === land[b]));
  for (const cells of waterBodies.values()) {
    const isLand = land[cells[0]!]!;
    const touchesEdge = cells.some((c) => grid.neighbors[c]!.includes(-1));
    if (!isLand && !touchesEdge && cells.length < 10) for (const c of cells) land[c] = true;
    if (isLand && cells.length < 3) for (const c of cells) land[c] = false;
  }
  const bodyOf = components(grid, (a, b) => land[a] === land[b]);
  const bodies = groupBy(bodyOf);
  const landCells = land.filter(Boolean).length;

  if (type === 'continents') {
    const large = [...bodies.values()].filter((cells) => land[cells[0]!] && cells.length >= landCells * 0.12);
    if (large.length < 2) return null;
  }

  // Areas: land bodies share the land-area target by size; water bodies get sea areas by size.
  const regionOf = new Array<number>(grid.count).fill(-1);
  let nextRegion = 0;
  const landBodies = [...bodies.values()].filter((cells) => land[cells[0]!]);
  const seaBodies = [...bodies.values()].filter((cells) => !land[cells[0]!]);
  for (const cells of [...landBodies, ...seaBodies]) {
    const isLand = land[cells[0]!]!;
    const count = isLand
      ? Math.max(1, Math.round((cells.length / landCells) * landAreaTarget))
      : Math.max(1, Math.round(cells.length / CELLS_PER_SEA_AREA));
    const regions = Math.min(count, cells.length);
    growRegions(grid, cells, regions, nextRegion, regionOf, rand);
    nextRegion += regions;
  }
  // Fold single-cell land areas into a neighbor.
  const regionCells = groupBy(regionOf);
  for (const [region, cells] of regionCells) {
    if (cells.length > 1 || !land[cells[0]!]) continue;
    const cell = cells[0]!;
    const targets = grid.neighbors[cell]!.filter((n) => n >= 0 && land[n] && regionOf[n] !== region);
    const target = targets.sort((a, b) => regionCells.get(regionOf[a]!)!.length - regionCells.get(regionOf[b]!)!.length)[0];
    if (target === undefined) continue;
    regionOf[cell] = regionOf[target]!;
    regionCells.get(regionOf[target]!)!.push(cell);
    regionCells.delete(region);
  }

  // Compact ids: land areas first, then sea.
  const ordered = [...regionCells.entries()].sort(([ra, a], [rb, b]) => Number(land[b[0]!]) - Number(land[a[0]!]) || ra - rb);
  const areaOf = new Array<number>(grid.count).fill(-1);
  ordered.forEach(([, cells], id) => {
    for (const c of cells) areaOf[c] = id;
  });

  // Moisture: noise plus nearness to water.
  const waterDistance = new Array<number>(grid.count).fill(Infinity);
  const queue: number[] = [];
  for (let i = 0; i < grid.count; i++) {
    if (!land[i]) {
      waterDistance[i] = 0;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q]!;
    for (const n of grid.neighbors[cell]!) {
      if (n >= 0 && waterDistance[n] === Infinity) {
        waterDistance[n] = waterDistance[cell]! + 1;
        queue.push(n);
      }
    }
  }
  const moisture = elevation.map((_, i) => {
    const u = grid.x[i]! / grid.width;
    const v = grid.y[i]! / grid.height;
    return fbm(u * 6 * freq + 17, (v * 6 * freq * grid.height) / grid.width + 5, seed + 7, 3) * 0.75 + (1 - Math.min(waterDistance[i]!, 10) / 10) * 0.35;
  });

  // Ruggedness: ridged noise, so mountains and hills form chains rather than one block.
  const ridge = elevation.map((e, i) => {
    const u = grid.x[i]! / grid.width;
    const v = grid.y[i]! / grid.height;
    const r = 1 - Math.abs(2 * fbm(u * 6 * freq + 31, (v * 6 * freq * grid.height) / grid.width + 11, seed + 13, 3) - 1);
    return r * r * 0.75 + e * 0.25;
  });

  const areas: MapArea[] = [];
  const height: number[] = [];
  const wetness: number[] = [];
  const rugged: number[] = [];
  const centerCells: number[] = [];
  ordered.forEach(([, cells], id) => {
    const neighborSet = new Set<number>();
    let sx = 0;
    let sy = 0;
    let se = 0;
    let sm = 0;
    let sr = 0;
    for (const c of cells) {
      sr += ridge[c]!;
      sx += grid.x[c]!;
      sy += grid.y[c]!;
      se += elevation[c]!;
      sm += moisture[c]!;
      for (const n of grid.neighbors[c]!) if (n >= 0 && areaOf[n] !== id) neighborSet.add(areaOf[n]!);
    }
    const mx = sx / cells.length;
    const my = sy / cells.length;
    const centerCell = cells.reduce((best, c) =>
      (grid.x[c]! - mx) ** 2 + (grid.y[c]! - my) ** 2 < (grid.x[best]! - mx) ** 2 + (grid.y[best]! - my) ** 2 ? c : best,
    );
    const isLand = land[cells[0]!]!;
    centerCells.push(centerCell);
    height.push(se / cells.length);
    wetness.push(sm / cells.length);
    rugged.push(sr / cells.length);
    areas.push({
      id,
      kind: isLand ? 'land' : 'sea',
      terrain: null,
      features: [],
      limit: 0,
      resources: [],
      neighbors: [...neighborSet].sort((a, b) => a - b),
      center: [Math.round(grid.x[centerCell]! * 100) / 100, Math.round(grid.y[centerCell]! * 100) / 100],
      outline: boundaryPaths(grid, cells, (_, n) => n < 0 || areaOf[n] !== id),
      cells: cells.map((c): Point => [Math.round(grid.x[c]! * 100) / 100, Math.round(grid.y[c]! * 100) / 100]),
      body: bodyOf[cells[0]!]!,
    });
  });

  const landAreas = areas.filter((a) => a.kind === 'land');
  const isSea = (id: AreaId) => areas[id]!.kind === 'sea';
  const addFeature = (area: MapArea, feature: Feature) => {
    if (!area.features.includes(feature)) area.features.push(feature);
  };
  for (const area of landAreas) if (area.neighbors.some(isSea)) addFeature(area, 'coastal');

  assignTerrain(landAreas, height, wetness, rugged);
  const rivers = placeRivers(areas, landAreas, height, rand);
  for (const river of rivers) {
    river.areas.forEach((id, i) => {
      const area = areas[id]!;
      addFeature(area, 'river');
      const nearMouth = isSea(river.outlet) && i >= river.areas.length - 3;
      if (area.terrain === 'desert' || (nearMouth && (area.terrain === 'plains' || area.terrain === 'marsh'))) {
        addFeature(area, 'floodplain');
      }
    });
  }
  for (const river of rivers) river.course = riverCourse(grid, areaOf, centerCells, river, isSea(river.outlet));
  placeFaults(areas, landAreas, rand);

  for (const area of landAreas) {
    const [min, max] = LIMITS[area.terrain!];
    let limit = min + Math.floor(rand() * (max - min + 1));
    if (area.features.includes('river')) limit += 1;
    if (area.features.includes('floodplain')) limit = Math.max(limit, 4);
    area.limit = Math.min(limit, 5);
  }

  const starts = placeStarts(areas, landAreas, civilizations, MIN_START_SPACING[room], rand);
  if (!starts) return null;
  placeFood(areas, landAreas, starts, makeRandom(seed ^ 0x5eedf00d));
  placeGoods(landAreas, makeRandom(seed ^ 0x2c0ffee5));

  for (const area of areas) area.features.sort();
  return {
    options: { ...options },
    attempt,
    width: Math.round(grid.width * 100) / 100,
    height: Math.round(grid.height * 100) / 100,
    areas,
    rivers,
    starts,
    coastline: boundaryPaths(grid, land.flatMap((isLand, c) => (isLand ? [c] : [])), (_, n) => n >= 0 && !land[n]),
  };
}

// Terrain by rank: most rugged areas are mountains, then hills; of the rest, driest are desert,
// wettest lowlands are marsh, next wettest forest, the remainder plains.
function assignTerrain(landAreas: MapArea[], height: number[], wetness: number[], rugged: number[]): void {
  const n = landAreas.length;
  [...landAreas]
    .sort((a, b) => rugged[b.id]! - rugged[a.id]!)
    .forEach((area, i) => {
      if (i < n * 0.08) area.terrain = 'mountains';
      else if (i < n * 0.22) area.terrain = 'hills';
    });
  const byHeight = [...landAreas].sort((a, b) => height[b.id]! - height[a.id]!);
  const lowlandCut = height[byHeight[Math.floor(n * 0.6)]?.id ?? 0] ?? -Infinity;
  const rest = byHeight.filter((a) => a.terrain === null).sort((a, b) => wetness[a.id]! - wetness[b.id]!);
  rest.forEach((area, i) => {
    if (i < n * 0.12) area.terrain = 'desert';
  });
  const wet = rest.filter((a) => a.terrain === null).reverse();
  let marsh = 0;
  let forest = 0;
  for (const area of wet) {
    if (marsh < n * 0.06 && height[area.id]! <= lowlandCut) {
      area.terrain = 'marsh';
      marsh++;
    } else if (forest < n * 0.28) {
      area.terrain = 'forest';
      forest++;
    } else {
      area.terrain = 'plains';
    }
  }
}

// About one river per 40 land areas.
function placeRivers(areas: MapArea[], landAreas: MapArea[], height: number[], rand: Random): River[] {
  const target = Math.max(1, Math.round(landAreas.length / 40));
  const onRiver = new Map<AreaId, number>();
  const rivers: River[] = [];
  // Prefer high ground inland; fall back to other inland areas, highest first (small maps).
  const inland = landAreas.filter((a) => !a.features.includes('coastal'));
  const high = (a: MapArea) => a.terrain === 'mountains' || a.terrain === 'hills';
  const sources = [
    ...shuffle(inland.filter(high), rand),
    ...inland.filter((a) => !high(a)).sort((a, b) => height[b.id]! - height[a.id]!),
  ];
  // Rivers run at least 3 areas; maps with too little inland room also accept 2.
  for (const minLength of [3, 2]) {
    if (minLength === 2 && rivers.length > 0) break;
    for (const source of sources) {
      if (rivers.length >= target) break;
      if (onRiver.has(source.id) || source.neighbors.some((n) => onRiver.has(n))) continue;
      const path: AreaId[] = [source.id];
      let outlet: AreaId | null = null;
      while (outlet === null && path.length <= 14) {
        const current = areas[path[path.length - 1]!]!;
        const seas = current.neighbors.filter((n) => areas[n]!.kind === 'sea');
        if (seas.length > 0) {
          outlet = seas.sort((a, b) => height[a]! - height[b]!)[0]!;
          break;
        }
        const joins = current.neighbors.filter((n) => onRiver.has(n));
        if (joins.length > 0 && path.length >= 3) {
          outlet = joins[0]!;
          break;
        }
        const options = current.neighbors.filter((n) => areas[n]!.kind === 'land' && !path.includes(n) && !onRiver.has(n));
        const next = options.sort((a, b) => height[a]! - height[b]!)[0];
        if (next === undefined) break;
        path.push(next);
      }
      if (outlet === null || path.length < minLength) continue;
      const id = rivers.length;
      for (const a of path) onRiver.set(a, id);
      rivers.push({ id, areas: path, outlet, course: [] });
    }
  }
  return rivers;
}

// Shortest cell route from `from` until `done`, through cells where `allowed` holds.
function cellRoute(grid: HexGrid, from: number, allowed: (cell: number) => boolean, done: (cell: number) => boolean): number[] {
  const previous = new Map<number, number>([[from, -1]]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q]!;
    if (done(cell)) {
      const route: number[] = [];
      for (let c = cell; c !== -1; c = previous.get(c)!) route.push(c);
      return route.reverse();
    }
    for (const n of grid.neighbors[cell]!) {
      if (n < 0 || previous.has(n) || !allowed(n)) continue;
      previous.set(n, cell);
      queue.push(n);
    }
  }
  return [from];
}

// The drawn course of a river: through land cells only, from the source's center, through each
// area's center, to the coast (or to the center of the river it joins).
function riverCourse(grid: HexGrid, areaOf: number[], centerCells: number[], river: River, toSea: boolean): Point[] {
  const cells = [centerCells[river.areas[0]!]!];
  const extend = (route: number[]) => cells.push(...route.slice(1));
  for (let i = 1; i < river.areas.length; i++) {
    const a = river.areas[i - 1]!;
    const b = river.areas[i]!;
    const target = centerCells[b]!;
    extend(cellRoute(grid, cells[cells.length - 1]!, (c) => areaOf[c] === a || areaOf[c] === b, (c) => c === target));
  }
  const last = river.areas[river.areas.length - 1]!;
  const point = (c: number): Point => [Math.round(grid.x[c]! * 100) / 100, Math.round(grid.y[c]! * 100) / 100];
  if (!toSea) {
    const target = centerCells[river.outlet]!;
    extend(cellRoute(grid, cells[cells.length - 1]!, (c) => areaOf[c] === last || areaOf[c] === river.outlet, (c) => c === target));
    return cells.map(point);
  }
  const bySea = (c: number) => grid.neighbors[c]!.some((n) => n >= 0 && areaOf[n] === river.outlet);
  extend(cellRoute(grid, cells[cells.length - 1]!, (c) => areaOf[c] === last, bySea));
  const mouth = cells[cells.length - 1]!;
  const k = grid.neighbors[mouth]!.findIndex((n) => n >= 0 && areaOf[n] === river.outlet);
  const course = cells.map(point);
  if (k >= 0) {
    const keys = grid.cornerKeys[mouth]!;
    const [ax, ay] = grid.corners.get(keys[k]!)!;
    const [bx, by] = grid.corners.get(keys[(k + 1) % 6]!)!;
    course.push([Math.round(((ax + bx) / 2) * 100) / 100, Math.round(((ay + by) / 2) * 100) / 100]);
  }
  return course;
}

// Short chains of volcanic/fault areas starting in mountains.
function placeFaults(areas: MapArea[], landAreas: MapArea[], rand: Random): void {
  const count = Math.max(1, Math.round(landAreas.length / 107));
  const origins = shuffle(landAreas.filter((a) => a.terrain === 'mountains'), rand).slice(0, count);
  for (const origin of origins) {
    let current = origin;
    const length = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < length; i++) {
      if (!current.features.includes('volcanic')) current.features.push('volcanic');
      const options = current.neighbors.filter((n) => areas[n]!.kind === 'land' && !areas[n]!.features.includes('volcanic'));
      if (options.length === 0) break;
      current = areas[options[Math.floor(rand() * options.length)]!]!;
    }
  }
}

// Travel cost by area: land moves cost 1, sea moves 2 (ships).
export function travelDistances(map: Pick<GameMap, 'areas'>, from: AreaId): number[] {
  const dist = new Array<number>(map.areas.length).fill(Infinity);
  const heap = new Heap();
  dist[from] = 0;
  heap.push(0, from);
  while (heap.size > 0) {
    const { cost, value } = heap.pop();
    if (cost > dist[value]!) continue;
    for (const n of map.areas[value]!.neighbors) {
      const next = cost + (map.areas[n]!.kind === 'sea' ? 2 : 1);
      if (next < dist[n]!) {
        dist[n] = next;
        heap.push(next, n);
      }
    }
  }
  return dist;
}

function landWithin(areas: MapArea[], from: MapArea, reach: number): MapArea[] {
  const seen = new Map<AreaId, number>([[from.id, 0]]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const area = queue[q]!;
    const d = seen.get(area.id)!;
    if (d === reach) continue;
    for (const n of area.neighbors) {
      const neighbor = areas[n]!;
      if (neighbor.kind !== 'land' || seen.has(n)) continue;
      seen.set(n, d + 1);
      queue.push(neighbor);
    }
  }
  return queue;
}

export interface StartQuality {
  totalLimit: number;
  poorShare: number;
}

// Start check (§4): total limit within reach, and the share of mountains and desert.
export function startQuality(map: Pick<GameMap, 'areas'>, start: AreaId): StartQuality {
  const nearby = landWithin(map.areas, map.areas[start]!, START_REACH);
  const poor = nearby.filter((a) => a.terrain === 'mountains' || a.terrain === 'desert').length;
  return { totalLimit: nearby.reduce((sum, a) => sum + a.limit, 0), poorShare: poor / nearby.length };
}

function placeStarts(areas: MapArea[], landAreas: MapArea[], civilizations: number, minSpacing: number, rand: Random): AreaId[] | null {
  const candidates = landAreas
    .filter((a) => (a.terrain === 'plains' || a.terrain === 'forest' || a.terrain === 'hills') && a.limit >= 3 && !a.features.includes('volcanic'))
    .map((a) => ({ area: a, quality: startQuality({ areas }, a.id) }))
    .filter((c) => c.quality.poorShare <= START_MAX_POOR_SHARE);
  if (candidates.length < civilizations) return null;
  const totals = candidates.map((c) => c.quality.totalLimit).sort((a, b) => a - b);
  const floor = totals[Math.floor(totals.length / 2)]! * START_QUALITY_SHARE;
  const qualified = candidates.filter((c) => c.quality.totalLimit >= floor).map((c) => c.area.id);
  if (qualified.length < civilizations) return null;

  const cache = new Map<AreaId, number[]>();
  const distances = (id: AreaId) => {
    let d = cache.get(id);
    if (!d) {
      d = travelDistances({ areas }, id);
      cache.set(id, d);
    }
    return d;
  };

  let best: AreaId[] | null = null;
  let bestScore = -1;
  for (let trial = 0; trial < START_TRIALS; trial++) {
    const order = shuffle([...qualified], rand);
    const chosen = [order[0]!];
    while (chosen.length < civilizations) {
      let pick: AreaId | null = null;
      let pickScore = -1;
      for (const id of order) {
        if (chosen.includes(id)) continue;
        const score = Math.min(...chosen.map((c) => distances(c)[id]!));
        if (score > pickScore) {
          pick = id;
          pickScore = score;
        }
      }
      if (pick === null) break;
      chosen.push(pick);
    }
    if (chosen.length < civilizations) continue;
    let spacing = Infinity;
    for (const a of chosen) for (const b of chosen) if (a !== b) spacing = Math.min(spacing, distances(a)[b]!);
    if (spacing < minSpacing) continue;
    // Spacing weighted by balance: the smallest nearest-land share over the largest.
    const share = new Array<number>(chosen.length).fill(0);
    for (const area of landAreas) {
      let nearest = 0;
      chosen.forEach((c, i) => {
        if (distances(c)[area.id]! < distances(chosen[nearest]!)[area.id]!) nearest = i;
      });
      share[nearest]! += 1;
    }
    const score = Math.min(spacing, 1000) * (Math.min(...share) / Math.max(...share)) ** 2;
    if (score > bestScore) {
      best = chosen;
      bestScore = score;
    }
  }
  return best;
}

// Food odds per area (design doc §4, Procedural maps; tuning). Grain by terrain and features; fish
// on any coast.
const FISH_CHANCE = 0.25;

function grainChance(area: MapArea): number {
  if (area.features.includes('floodplain')) return 1;
  if (area.terrain === 'plains') return area.features.includes('river') ? 0.5 : 0.2;
  if (area.terrain === 'marsh' || area.terrain === 'forest' || area.terrain === 'hills') return 0.1;
  return 0;
}

// Food goes on its own random stream, so placing it moves nothing else on the map. Grain and fish
// are rolled separately; when both succeed, the likelier one is placed. A start with no food within
// reach gets grain on its likeliest area in reach (nearest first).
function placeFood(areas: MapArea[], landAreas: MapArea[], starts: AreaId[], rand: Random): void {
  for (const area of landAreas) {
    const grain = rand() < grainChance(area);
    const fish = area.features.includes('coastal') && rand() < FISH_CHANCE;
    const food: ResourceId | null = grain && fish ? (grainChance(area) >= FISH_CHANCE ? 'grain' : 'fish') : grain ? 'grain' : fish ? 'fish' : null;
    if (food) area.resources.push(food);
  }
  for (const start of starts) {
    const nearby = landWithin(areas, areas[start]!, START_REACH);
    if (nearby.some((a) => a.resources.length > 0)) continue;
    const best = nearby.filter((a) => grainChance(a) > 0).sort((a, b) => grainChance(b) - grainChance(a))[0];
    // Starts are plains, forest, or hills, so the start itself always qualifies.
    best?.resources.push('grain');
  }
}

// Livestock and copper odds per area (design doc §8, Herding and Copper Working; tuning).
const LIVESTOCK_CHANCE: Partial<Record<Terrain, number>> = { plains: 0.25, hills: 0.2 };
const COPPER_CHANCE: Partial<Record<Terrain, number>> = { hills: 0.15, mountains: 0.3 };

// Livestock on plains and hills, then copper on hills and mountains, only where no other resource
// lies, so each area holds at most one. On their own random stream, so placing them moves nothing
// else on the map.
function placeGoods(landAreas: MapArea[], rand: Random): void {
  for (const [resource, chance] of [['livestock', LIVESTOCK_CHANCE], ['copper', COPPER_CHANCE]] as const) {
    for (const area of landAreas) {
      const odds = chance[area.terrain!] ?? 0;
      if (rand() < odds && area.resources.length === 0) area.resources.push(resource);
    }
  }
}

// Each land area's nearest start by travel distance (index into `starts`), for checking fairness.
export function nearestStart(map: GameMap): number[] {
  const dist = map.starts.map((s) => travelDistances(map, s));
  return map.areas.map((area) => {
    if (area.kind !== 'land') return -1;
    let best = -1;
    let bestDistance = Infinity;
    dist.forEach((d, i) => {
      if (d[area.id]! < bestDistance) {
        best = i;
        bestDistance = d[area.id]!;
      }
    });
    return best;
  });
}
