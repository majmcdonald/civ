import { describe, expect, it } from 'vitest';
import { loadGame, mapFor, saveGame, tokensAt, type AreaId, type GameMap, type Session } from '../src/engine';
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

  it('move one adjacent land area only', () => {
    const { game, map, start } = setup();
    toAllocation(game);
    const far = map.areas.find((a) => a.kind === 'land' && a.id !== start && !map.areas[start]!.neighbors.includes(a.id))!;
    expectRejected(game, { type: 'orderMove', player: 'p1', from: start, to: far.id, count: 1 }, /one adjacent area/);
    const coastal = map.areas.find((a) => a.kind === 'land' && a.neighbors.some((n) => map.areas[n]!.kind === 'sea'))!;
    const sea = coastal.neighbors.find((n) => map.areas[n]!.kind === 'sea')!;
    place(game, coastal.id, 'p1', 1);
    expectRejected(game, { type: 'orderMove', player: 'p1', from: coastal.id, to: sea, count: 1 }, /ships/);
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
    // Moved tokens then grow: 1 becomes 2, and 2 becomes 4.
    expect(tokensAt(game.state, a, 'p1')).toBe(2);
    expect(tokensAt(game.state, b, 'p1')).toBe(4);
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
  it('adds 1 to an area with 1 token and 2 to an area with 2 or more, up to the limit', () => {
    const { game, map, start } = setup();
    const limit = map.areas[start]!.limit;
    let count = 1;
    for (let turn = 0; turn < 4; turn++) {
      toAllocation(game);
      resolveTurn(game);
      count = Math.min(limit, count + (count >= 2 ? 2 : 1));
      expect(tokensAt(game.state, start, 'p1')).toBe(count);
    }
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
    resolveTurn(game);
    expect(tokensAt(game.state, start, 'p1')).toBe(limit);
    expect(tokensAt(game.state, start, 'ai1')).toBe(2);
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
