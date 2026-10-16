import { describe, expect, it } from 'vitest';
import {
  generateMap,
  LAND_AREAS_PER_CIVILIZATION,
  MAP_TYPES,
  ROOM_FACTOR,
  startQuality,
  TERRAINS,
  travelDistances,
  type GameMap,
  type RoomToExpand,
  type MapType,
} from '../src/engine';

type Case = [MapType, number, number, RoomToExpand];
const cases: Case[] = [
  ...MAP_TYPES.flatMap((type) =>
    [2, 5, 7].flatMap((civilizations) => [11, 42].map((seed): Case => [type, civilizations, seed, 'standard'])),
  ),
  ...MAP_TYPES.flatMap((type): Case[] => [
    [type, 2, 5, 'crowded'],
    [type, 10, 5, 'spacious'],
  ]),
  ['inlandSea', 15, 5, 'spacious'],
];
const maps = new Map<string, GameMap>();
const mapFor = (type: MapType, civilizations: number, seed: number, room: RoomToExpand = 'standard') => {
  const key = `${type}/${civilizations}/${seed}/${room}`;
  if (!maps.has(key)) maps.set(key, generateMap({ seed, civilizations, type, room }));
  return maps.get(key)!;
};

describe('map generator', () => {
  it('is deterministic', () => {
    const options = { seed: 7, civilizations: 5, type: 'inlandSea' as const, room: 'standard' as const };
    expect(JSON.stringify(generateMap(options))).toBe(JSON.stringify(generateMap(options)));
    expect(JSON.stringify(generateMap({ ...options, seed: 8 }))).not.toBe(JSON.stringify(generateMap(options)));
  });

  it('rejects invalid options', () => {
    const base = { seed: 1, civilizations: 5, type: 'inlandSea' as const, room: 'standard' as const };
    expect(() => generateMap({ ...base, civilizations: 1 })).toThrow(/2–15/);
    expect(() => generateMap({ ...base, civilizations: 16 })).toThrow(/2–15/);
    expect(() => generateMap({ ...base, seed: 1.5 })).toThrow(/integer/);
    expect(() => generateMap({ ...base, room: 'huge' as RoomToExpand })).toThrow(/room/);
  });

  describe.each(cases)('%s, %i civilizations, seed %i, %s', (type, civilizations, seed, room) => {
    const map = () => mapFor(type, civilizations, seed, room);

    it('scales land areas with the civilization count and room to expand', () => {
      const land = map().areas.filter((a) => a.kind === 'land').length;
      const target = LAND_AREAS_PER_CIVILIZATION * ROOM_FACTOR[room] * civilizations;
      expect(land).toBeGreaterThan(target * 0.93);
      expect(land).toBeLessThan(target * 1.07);
    });

    it('has symmetric adjacency and indexed ids', () => {
      map().areas.forEach((area, i) => {
        expect(area.id).toBe(i);
        expect(area.neighbors).not.toContain(area.id);
        for (const n of area.neighbors) expect(map().areas[n]!.neighbors).toContain(area.id);
      });
    });

    it('gives land a terrain and a starting limit of 1–5, and sea neither', () => {
      for (const area of map().areas) {
        if (area.kind === 'sea') {
          expect(area.terrain).toBeNull();
          expect(area.limit).toBe(0);
          expect(area.features).toEqual([]);
          continue;
        }
        expect(TERRAINS).toContain(area.terrain);
        expect(area.limit).toBeGreaterThanOrEqual(1);
        expect(area.limit).toBeLessThanOrEqual(5);
      }
    });

    it('marks land next to sea as coastal', () => {
      for (const area of map().areas.filter((a) => a.kind === 'land')) {
        const bySea = area.neighbors.some((n) => map().areas[n]!.kind === 'sea');
        expect(area.features.includes('coastal')).toBe(bySea);
      }
    });

    it('runs rivers through adjacent land areas to the sea or another river', () => {
      const m = map();
      expect(m.rivers.length).toBeGreaterThan(0);
      for (const river of m.rivers) {
        expect(river.areas.length).toBeGreaterThanOrEqual(2);
        river.areas.forEach((id, i) => {
          const area = m.areas[id]!;
          expect(area.kind).toBe('land');
          expect(area.features).toContain('river');
          if (i > 0) expect(area.neighbors).toContain(river.areas[i - 1]);
        });
        const last = m.areas[river.areas[river.areas.length - 1]!]!;
        expect(last.neighbors).toContain(river.outlet);
        const outlet = m.areas[river.outlet]!;
        expect(outlet.kind === 'sea' || outlet.features.includes('river')).toBe(true);
        // The drawn course stays on land: every point but a sea mouth is a cell of a river area.
        const riverCells = new Set(
          [...river.areas, river.outlet].flatMap((id) => (m.areas[id]!.kind === 'land' ? m.areas[id]!.cells.map(String) : [])),
        );
        const inland = outlet.kind === 'sea' ? river.course.slice(0, -1) : river.course;
        expect(river.course[0]).toEqual(m.areas[river.areas[0]!]!.center);
        for (const point of inland) expect(riverCells.has(String(point))).toBe(true);
      }
    });

    it('places one fair, spaced start per civilization', () => {
      const m = map();
      expect(m.starts).toHaveLength(civilizations);
      expect(new Set(m.starts).size).toBe(civilizations);
      for (const start of m.starts) {
        const area = m.areas[start]!;
        expect(area.kind).toBe('land');
        expect(area.limit).toBeGreaterThanOrEqual(3);
        expect(startQuality(m, start).poorShare).toBeLessThanOrEqual(0.3);
      }
      for (const a of m.starts) {
        const dist = travelDistances(m, a);
        for (const b of m.starts) if (a !== b) expect(dist[b]).toBeGreaterThanOrEqual(4);
      }
    });

    it('outlines every area with closed rings', () => {
      for (const area of map().areas) {
        expect(area.outline.length).toBeGreaterThan(0);
        for (const ring of area.outline) expect(ring.length).toBeGreaterThanOrEqual(6);
      }
    });
  });

  it('separates continents by sea', () => {
    for (const seed of [11, 42]) {
      const m = mapFor('continents', 5, seed);
      expect(new Set(m.areas.filter((a) => a.kind === 'land').map((a) => a.body)).size).toBeGreaterThanOrEqual(2);
    }
  });
});
