import { describe, expect, it } from 'vitest';
import { loadGame, mapFor, reachable, saveGame, tokensAt, type AreaId, type GameMap, type Session } from '../src/engine';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, testContent } from './harness';

function toAllocation(game: Session): void {
  while (game.state.phase !== 'allocation') endPhaseAll(game);
}

// Ends allocation for everyone, which resolves the turn.
function resolveTurn(game: Session) {
  return endPhaseAll(game);
}

function setup() {
  const game = newGame();
  const map = mapFor(game.setup);
  const start = map.starts[0]!;
  return { game, map, start };
}

function landNeighbor(map: GameMap, area: AreaId, minLimit = 1): AreaId {
  const n = map.areas[area]!.neighbors.find((id) => map.areas[id]!.kind === 'land' && map.areas[id]!.limit >= minLimit);
  if (n === undefined) throw new Error('No land neighbor in the test map');
  return n;
}

// Puts tokens directly into the state, as a test fixture.
function place(game: Session, area: AreaId, player: string, count: number): void {
  game.state.stacks = game.state.stacks.filter((s) => !(s.area === area && s.player === player));
  game.state.stacks.push({ area, player, count });
  game.state.stacks.sort((a, b) => a.area - b.area || (a.player < b.player ? -1 : 1));
}

describe('move orders', () => {
  it('are only accepted in the allocation phase', () => {
    const { game, map, start } = setup();
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: landNeighbor(map, start), count: 1 }, /allocation phase/);
  });

  it('are recorded, replaced, and cancelled with 0', () => {
    const { game, map, start } = setup();
    place(game, start, 'p1', 3);
    toAllocation(game);
    const to = landNeighbor(map, start);
    play(game, { type: 'orderMove', player: 'p1', from: start, to, count: 1 });
    play(game, { type: 'orderMove', player: 'p1', from: start, to, count: 2 });
    expect(game.state.orders).toEqual([{ player: 'p1', from: start, to, count: 2 }]);
    play(game, { type: 'orderMove', player: 'p1', from: start, to, count: 0 });
    expect(game.state.orders).toEqual([]);
  });

  it('cannot send more tokens than the area holds, across all its orders', () => {
    const { game, map, start } = setup();
    place(game, start, 'p1', 3);
    toAllocation(game);
    const targets = map.areas[start]!.neighbors.filter((id) => map.areas[id]!.kind === 'land');
    play(game, { type: 'orderMove', player: 'p1', from: start, to: targets[0]!, count: 2 });
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: targets[1]!, count: 2 }, /Only 1 token left/);
  });

  it('move one adjacent land area only, without a settlement on the way', () => {
    const { game, map, start } = setup();
    toAllocation(game);
    const far = map.areas.find((a) => a.kind === 'land' && a.id !== start && !map.areas[start]!.neighbors.includes(a.id))!;
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: far.id, count: 1 }, /out of reach/);
    const coastal = map.areas.find((a) => a.kind === 'land' && a.neighbors.some((n) => map.areas[n]!.kind === 'sea'))!;
    const sea = coastal.neighbors.find((n) => map.areas[n]!.kind === 'sea')!;
    place(game, coastal.id, 'p1', 1);
    expectRejected(game, { type: 'orderMove', player: 'p1', from: coastal.id, to: sea, count: 1 }, /ships/);
  });

  it('pass through one of the player’s own settlements into one area beyond', () => {
    const { game, map, start } = setup();
    const land = (a: AreaId) => map.areas[a]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
    // A neighbour V of the start with a land neighbour B that is not next to the start, and a
    // neighbour C of B, also not next to the start or V.
    const [v, b, c] = land(start)
      .flatMap((v) => land(v).filter((b) => b !== start && !land(start).includes(b)).flatMap((b) => land(b).filter((c) => c !== v && !land(start).includes(c) && !land(v).includes(c)).map((c) => [v, b, c] as const)))[0]!;
    game.state.stacks = [];
    place(game, start, 'p1', 3);
    toAllocation(game);
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: b, count: 1 }, /out of reach/);
    game.state.settlements = [{ area: v, player: 'p1', tier: 'village', work: [] }];
    play(game, { type: 'orderMove', player: 'p1', from: start, to: b, count: 1 });
    play(game, { type: 'orderMove', player: 'p1', from: start, to: v, count: 1 });
    expect(reachable(game.state, map, 'p1', start)).not.toContain(c);
    // Only one settlement per move: a second settlement on the way ends the move there.
    game.state.settlements.push({ area: b, player: 'p1', tier: 'village', work: [] });
    expect(reachable(game.state, map, 'p1', start)).toContain(b);
    expect(reachable(game.state, map, 'p1', start)).not.toContain(c);
    expect(eventsOfType(resolveTurn(game), 'tokensMoved').map((e) => e.to)).toEqual(expect.arrayContaining([b, v]));
  });

  it('do not pass through a rival’s settlement', () => {
    const { game, map, start } = setup();
    const land = (a: AreaId) => map.areas[a]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
    const [v, b] = land(start).flatMap((v) => land(v).filter((b) => b !== start && !land(start).includes(b)).map((b) => [v, b] as const))[0]!;
    game.state.settlements = [{ area: v, player: 'ai1', tier: 'village', work: [] }];
    expect(reachable(game.state, map, 'p1', start)).toContain(v);
    expect(reachable(game.state, map, 'p1', start)).not.toContain(b);
  });

  it('reach farther with more movement', () => {
    const { game, map, start } = setup();
    game.state.settlements = [];
    const one = reachable(game.state, map, 'p1', start);
    game.state.players[0]!.movement = 2;
    const two = reachable(game.state, map, 'p1', start);
    expect(one).toEqual(map.areas[start]!.neighbors.filter((n) => map.areas[n]!.kind === 'land').sort((a, b) => a - b));
    expect(two.length).toBeGreaterThan(one.length);
    for (const a of one) expect(two).toContain(a);
  });

  it('cannot change after the player ends allocation', () => {
    const { game, map, start } = setup();
    toAllocation(game);
    play(game, { type: 'endPhase', player: 'p1' });
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: landNeighbor(map, start), count: 1 }, /already ended/);
  });
});

describe('movement', () => {
  it('moves every ordered token at once in resolution and clears the orders', () => {
    const { game, map, start } = setup();
    place(game, start, 'p1', 4);
    toAllocation(game);
    const b = landNeighbor(map, start, 4);
    const a = map.areas[start]!.neighbors.find((id) => id !== b && map.areas[id]!.kind === 'land' && map.areas[id]!.limit >= 2)!;
    expect(a).toBeDefined();
    play(game, { type: 'orderMove', player: 'p1', from: start, to: a, count: 1 }, { type: 'orderMove', player: 'p1', from: start, to: b, count: 2 });
    const events = resolveTurn(game);
    expect(eventsOfType(events, 'tokensMoved')).toHaveLength(2);
    expect(game.state.orders).toEqual([]);
    // Moved tokens then grow 0.5 each: 1 keeps ½ in progress, and 2 becomes 3.
    expect(tokensAt(game.state, a, 'p1')).toBe(1);
    expect(tokensAt(game.state, b, 'p1')).toBe(3);
  });

  it('moves tokens from where they stood at the end of allocation, so a token moves only once', () => {
    const { game, map, start } = setup();
    toAllocation(game);
    const to = landNeighbor(map, start, 2);
    const beyond = landNeighbor(map, to);
    play(game, { type: 'orderMove', player: 'p1', from: start, to, count: 1 });
    expectRejected(game, { type: 'orderMove', player: 'p1', from: to, to: beyond, count: 1 }, /Only 0 tokens left/);
  });
});

describe('growth', () => {
  it('adds 0.5 per token, carrying the fraction, up to the limit', () => {
    // Design doc §4: 1 → 1 +½ → 2 → 3 → 4 +½ → 5 (limit 5).
    const { game, map, start } = setup();
    const limit = map.areas[start]!.limit;
    let count = 1;
    let progress = 0;
    for (let turn = 0; turn < 6; turn++) {
      toAllocation(game);
      resolveTurn(game);
      if (count < limit) {
        progress += count * 0.5;
        const add = Math.min(Math.floor(progress), limit - count);
        progress -= Math.floor(progress);
        count += add;
      }
      expect(tokensAt(game.state, start, 'p1')).toBe(count);
      expect(game.state.stacks.find((s) => s.area === start && s.player === 'p1')!.growth ?? 0).toBe(progress);
    }
  });

  it('keeps progress in a full area without adding to it, and resumes when room opens', () => {
    // Design doc §4: limit 3 holding 3 with ½ stays at ½; after 1 leaves, 2 × 0.5 + ½ adds 1 and keeps ½.
    const { game, map } = setup();
    const area = map.areas.find((a) => a.kind === 'land' && a.limit === 3 && a.neighbors.some((n) => map.areas[n]!.kind === 'land' && map.areas[n]!.limit >= 3))!;
    const out = area.neighbors.find((n) => map.areas[n]!.kind === 'land' && map.areas[n]!.limit >= 3)!;
    game.state.stacks = [{ area: area.id, player: 'p1', count: 3, growth: 0.5 }];
    toAllocation(game);
    resolveTurn(game);
    expect(game.state.stacks).toEqual([{ area: area.id, player: 'p1', count: 3, growth: 0.5 }]);
    toAllocation(game);
    play(game, { type: 'orderMove', player: 'p1', from: area.id, to: out, count: 1 });
    resolveTurn(game);
    expect(game.state.stacks.find((s) => s.area === area.id)).toEqual({ area: area.id, player: 'p1', count: 3, growth: 0.5 });
  });

  it('loses whole tokens beyond the room but keeps the fraction', () => {
    const { game, map } = setup();
    const area = map.areas.find((a) => a.kind === 'land' && a.limit === 5)!;
    // 4 tokens with ½: 2.5 to add, room for 1.
    game.state.stacks = [{ area: area.id, player: 'p1', count: 4, growth: 0.5 }];
    toAllocation(game);
    resolveTurn(game);
    expect(game.state.stacks).toEqual([{ area: area.id, player: 'p1', count: 5, growth: 0.5 }]);
  });

  it('loses progress when the last token leaves', () => {
    const { game, map, start } = setup();
    toAllocation(game);
    resolveTurn(game);
    expect(game.state.stacks.find((s) => s.area === start)!.growth).toBe(0.5);
    const to = landNeighbor(map, start, 2);
    toAllocation(game);
    play(game, { type: 'orderMove', player: 'p1', from: start, to, count: 1 });
    resolveTurn(game);
    // The ½ did not travel with the token (it would have made 2): it was lost with the stack.
    expect(game.state.stacks).toEqual([
      ...game.state.stacks.filter((s) => s.player !== 'p1'),
      { area: to, player: 'p1', count: 1, growth: 0.5 },
    ].sort((a, b) => a.area - b.area));
  });

  it('stops at the civilization token cap', () => {
    const { game, start } = setup();
    game.state.players[0]!.tokenCap = 1;
    toAllocation(game);
    const events = resolveTurn(game);
    expect(tokensAt(game.state, start, 'p1')).toBe(1);
    expect(eventsOfType(events, 'tokensGrew').some((e) => e.player === 'p1')).toBe(false);
  });

  it('counts every civilization in an area against its limit', () => {
    const { game, map, start } = setup();
    const area = map.areas[start]!;
    place(game, start, 'p1', 1);
    place(game, start, 'ai1', area.limit - 1);
    toAllocation(game);
    resolveTurn(game);
    expect(tokensAt(game.state, start, 'p1') + tokensAt(game.state, start, 'ai1')).toBe(area.limit);
  });
});

describe('surplus removal', () => {
  it('removes tokens over the limit in an area held by one civilization', () => {
    const { game, map, start } = setup();
    const limit = map.areas[start]!.limit;
    place(game, start, 'p1', limit + 3);
    toAllocation(game);
    const events = resolveTurn(game);
    expect(tokensAt(game.state, start, 'p1')).toBe(limit);
    expect(eventsOfType(events, 'surplusRemoved')).toContainEqual({ type: 'surplusRemoved', player: 'p1', area: start, count: 3 });
  });

  it('leaves shared areas over the limit to conflict', () => {
    const { game, map, start } = setup();
    const limit = map.areas[start]!.limit;
    place(game, start, 'p1', limit);
    place(game, start, 'ai1', 2);
    toAllocation(game);
    const events = resolveTurn(game);
    expect(eventsOfType(events, 'conflict').map((e) => e.area)).toContain(start);
    expect(eventsOfType(events, 'surplusRemoved').filter((e) => e.area === start)).toEqual([]);
  });
});

describe('save and replay with movement', () => {
  it('replays move orders to the same state', () => {
    const { game, map, start } = setup();
    for (let i = 0; i < 2; i++) {
      toAllocation(game);
      resolveTurn(game);
    }
    toAllocation(game);
    play(game, { type: 'orderMove', player: 'p1', from: start, to: landNeighbor(map, start), count: 1 });
    resolveTurn(game);
    expect(loadGame(saveGame(game), testContent()).state).toEqual(game.state);
  });
});
