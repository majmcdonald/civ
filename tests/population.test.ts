import { describe, expect, it } from 'vitest';
import { generateMap, mapFor } from '../src/engine';
import { newGame } from './harness';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `ai${i}`, name: `Civ ${i}`, kind: 'ai' as const }));

describe('starting population', () => {
  it('gives each civilization one token in its starting area', () => {
    const game = newGame({ players: players(5) });
    const map = mapFor(game.setup);
    const expected = game.state.players.map((p, i) => ({ area: map.starts[i]!, player: p.id, count: 1 }));
    expect(game.state.stacks).toEqual(expected.sort((a, b) => a.area - b.area));
  });

  it('builds the map from the setup: game seed, one civilization per player, type, and room', () => {
    const game = newGame({ seed: 77, players: players(3), map: { type: 'continents', room: 'crowded' } });
    expect(mapFor(game.setup)).toEqual(generateMap({ seed: 77, civilizations: 3, type: 'continents', room: 'crowded' }));
  });

  it('keeps the map out of the saved state', () => {
    const game = newGame();
    expect(Object.keys(game.state)).not.toContain('map');
  });

  it('places tokens only on land, one civilization per starting area', () => {
    const game = newGame({ players: players(7), map: { type: 'singleLandmass', room: 'standard' } });
    const map = mapFor(game.setup);
    const areas = game.state.stacks.map((s) => s.area);
    expect(new Set(areas).size).toBe(7);
    for (const area of areas) expect(map.areas[area]!.kind).toBe('land');
  });
});

describe('setup validation for the map', () => {
  it('requires 2–15 players, the civilizations a map supports', () => {
    expect(() => newGame({ players: players(1) })).toThrow(/Civilizations must be 2–15/);
    expect(() => newGame({ players: players(16) })).toThrow(/Civilizations must be 2–15/);
  });

  it('rejects an unknown map type', () => {
    // @ts-expect-error: deliberately invalid map type
    expect(() => newGame({ map: { type: 'archipelago', room: 'standard' } })).toThrow();
  });
});
