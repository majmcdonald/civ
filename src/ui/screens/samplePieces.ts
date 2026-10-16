import { nearestStart, type AreaId, type GameMap } from '../../engine';
import type { MapPieces } from '../art/pieces';

// Review-only sample of what play puts on the map (tokens, settlements, roads), until the engine
// tracks them. Deterministic per map.

function pick(id: number, salt: number): number {
  let h = Math.imul(id * 374761393 + salt * 668265263, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Land-only shortest path between two areas, staying inside `allowed`.
function landPath(map: GameMap, from: AreaId, to: AreaId, allowed: (id: AreaId) => boolean): AreaId[] | null {
  const previous = new Map<AreaId, AreaId>([[from, -1]]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const id = queue[q]!;
    if (id === to) {
      const path: AreaId[] = [];
      for (let a = id; a !== -1; a = previous.get(a)!) path.push(a);
      return path.reverse();
    }
    for (const n of map.areas[id]!.neighbors) {
      if (previous.has(n) || map.areas[n]!.kind !== 'land' || !allowed(n)) continue;
      previous.set(n, id);
      queue.push(n);
    }
  }
  return null;
}

function landDistances(map: GameMap, from: AreaId, owner: number[], civ: number): Map<AreaId, number> {
  const dist = new Map<AreaId, number>([[from, 0]]);
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const id = queue[q]!;
    for (const n of map.areas[id]!.neighbors) {
      if (dist.has(n) || owner[n] !== civ) continue;
      dist.set(n, dist.get(id)! + 1);
      queue.push(n);
    }
  }
  return dist;
}

// `reach` is how far from its start each civilization has spread, in moves.
export function samplePieces(map: GameMap, reach = 4): MapPieces {
  const owner = nearestStart(map);
  const pieces: MapPieces = { stacks: [], settlements: [], roads: [] };
  const roadKeys = new Set<string>();
  const addRoad = (a: AreaId, b: AreaId) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (roadKeys.has(key)) return;
    roadKeys.add(key);
    pieces.roads.push([a, b]);
  };

  map.starts.forEach((start, civ) => {
    const dist = landDistances(map, start, owner, civ);
    const near = [...dist.entries()].filter(([, d]) => d <= reach).sort((a, b) => pick(a[0], 1) - pick(b[0], 1));
    const settled = new Set<AreaId>([start]);
    pieces.settlements.push({ area: start, civ, tier: 'town' });

    // Villages two or more moves out, never adjacent to another settlement.
    const villages: AreaId[] = [];
    for (const [id, d] of near) {
      if (villages.length >= Math.max(2, reach - 1)) break;
      if (d < 2 || map.areas[id]!.neighbors.some((n) => settled.has(n))) continue;
      villages.push(id);
      settled.add(id);
      pieces.settlements.push({ area: id, civ, tier: 'village' });
    }

    for (const village of villages) {
      const path = landPath(map, start, village, (id) => owner[id] === civ);
      if (!path) continue;
      for (let i = 1; i < path.length; i++) addRoad(path[i - 1]!, path[i]!);
    }

    // Loose tokens in most unsettled areas within reach.
    for (const [id] of near) {
      if (settled.has(id) || pick(id, 2) < 0.3) continue;
      const limit = map.areas[id]!.limit;
      pieces.stacks.push({ area: id, civ, count: 1 + Math.floor(pick(id, 3) * limit) });
    }
  });

  // Border areas shared by two civilizations: some below the limit (coexistence), some over it
  // (conflict, design doc §11).
  const settled = new Set(pieces.settlements.map((p) => p.area));
  for (const area of map.areas) {
    if (area.kind !== 'land' || settled.has(area.id) || area.limit < 2 || pick(area.id, 4) > 0.25) continue;
    const mine = owner[area.id]!;
    const other = area.neighbors.map((n) => owner[n]!).find((o) => o >= 0 && o !== mine);
    if (other === undefined) continue;
    pieces.stacks = pieces.stacks.filter((s) => s.area !== area.id);
    const first = 1 + Math.floor(pick(area.id, 5) * (area.limit - 1));
    const conflict = pick(area.id, 6) < 0.5;
    const second = conflict ? area.limit - first + 1 + Math.floor(pick(area.id, 7) * 2) : Math.max(1, area.limit - first - 1);
    pieces.stacks.push({ area: area.id, civ: mine, count: first }, { area: area.id, civ: other, count: second });
  }
  return pieces;
}

// Late-game load for the stress test: about half of each civilization's land settled, loose
// tokens in the rest, trails between neighboring settlements, and border conflicts.
// `turn` varies the layout, standing in for the board changing between turns.
export function lateGamePieces(map: GameMap, turn = 0): MapPieces {
  const owner = nearestStart(map);
  const pieces: MapPieces = { stacks: [], settlements: [], roads: [] };
  const settled = new Set<AreaId>();
  for (const area of map.areas) {
    if (area.kind !== 'land' || owner[area.id]! < 0 || pick(area.id, 11 + turn) > 0.5) continue;
    settled.add(area.id);
    pieces.settlements.push({ area: area.id, civ: owner[area.id]!, tier: pick(area.id, 12 + turn) < 0.3 ? 'town' : 'village' });
  }
  for (const area of map.areas) {
    if (area.kind !== 'land' || settled.has(area.id)) continue;
    pieces.stacks.push({ area: area.id, civ: owner[area.id]!, count: 1 + Math.floor(pick(area.id, 13 + turn) * area.limit) });
    const other = area.neighbors.map((n) => owner[n]!).find((o) => o >= 0 && o !== owner[area.id]);
    if (other !== undefined && pick(area.id, 14) < 0.3) pieces.stacks.push({ area: area.id, civ: other, count: 1 + Math.floor(pick(area.id, 15) * 3) });
  }
  for (const id of settled) {
    for (const n of map.areas[id]!.neighbors) {
      if (n > id && map.areas[n]!.kind === 'land' && owner[n] === owner[id] && pick(id * 7919 + n, 16 + turn) < 0.4) pieces.roads.push([id, n]);
    }
  }
  return pieces;
}
