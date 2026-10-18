import { describe, expect, it } from 'vitest';
import { mapFor, previewConflicts, settlementAt, tokensAt, type AreaId, type Context, type Session, type SettlementTier } from '../src/engine';
import { resolveConflict } from '../src/engine/conflict';
import { endPhaseAll, eventsOfType, newGame, play, testContent } from './harness';

const players = [
  { id: 'p1', name: 'Player', kind: 'human' as const },
  { id: 'ai1', name: 'Rival A', kind: 'ai' as const },
  { id: 'ai2', name: 'Rival B', kind: 'ai' as const },
];

// An empty board and a land area with limit 3 next to another land area.
function scene() {
  const game = newGame({ players });
  const map = mapFor(game.setup);
  game.state.stacks = [];
  const area = map.areas.find((a) => a.kind === 'land' && a.limit === 3 && a.neighbors.some((n) => map.areas[n]!.kind === 'land'))!.id;
  const next = map.areas[area]!.neighbors.find((n) => map.areas[n]!.kind === 'land')!;
  return { game, area, next };
}

function place(game: Session, area: AreaId, player: string, count: number): void {
  game.state.stacks.push({ area, player, count });
  const order = new Map(game.state.players.map((p, i) => [p.id, i]));
  game.state.stacks.sort((a, b) => a.area - b.area || order.get(a.player)! - order.get(b.player)!);
}

function settle(game: Session, area: AreaId, tier: SettlementTier, player = 'ai1', name?: string): void {
  game.state.settlements.push({ area, player, tier, ...(name ? { name } : {}) });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

function conflict(game: Session): Context {
  const ctx: Context = { state: JSON.parse(JSON.stringify(game.state)), content: testContent(), map: mapFor(game.setup), events: [], refugees: [] };
  resolveConflict(ctx);
  return ctx;
}

const at = (ctx: Context, area: AreaId, player: string) => tokensAt(ctx.state, area, player);

describe('conflict in an unsettled area', () => {
  it('leaves areas within their limit alone', () => {
    const { game, area } = scene();
    place(game, area, 'p1', 2);
    place(game, area, 'ai1', 1);
    const ctx = conflict(game);
    expect(ctx.events).toEqual([]);
    expect(at(ctx, area, 'p1')).toBe(2);
  });

  it('removes one token at a time, weakest first, until within the limit', () => {
    // Design doc §11: limit 3, 4 vs 2 runs 4/1, 3/1, 3/0.
    const { game, area } = scene();
    place(game, area, 'p1', 4);
    place(game, area, 'ai1', 2);
    const ctx = conflict(game);
    expect(at(ctx, area, 'p1')).toBe(3);
    expect(at(ctx, area, 'ai1')).toBe(0);
    expect(eventsOfType(ctx.events, 'conflict')[0]).toMatchObject({
      area,
      losses: [
        { player: 'p1', count: 1 },
        { player: 'ai1', count: 2 },
      ],
    });
  });

  it('has equal powers remove together, even past the limit', () => {
    const { game, area } = scene();
    place(game, area, 'p1', 2);
    place(game, area, 'ai1', 2);
    const ctx = conflict(game);
    expect(at(ctx, area, 'p1')).toBe(1);
    expect(at(ctx, area, 'ai1')).toBe(1);
  });

  it('runs three sides in the same order', () => {
    // 3/2/1 runs 3/2/0, 3/1/0, 2/1/0.
    const { game, area } = scene();
    place(game, area, 'p1', 3);
    place(game, area, 'ai1', 2);
    place(game, area, 'ai2', 1);
    const ctx = conflict(game);
    expect([at(ctx, area, 'p1'), at(ctx, area, 'ai1'), at(ctx, area, 'ai2')]).toEqual([2, 1, 0]);
  });

  it('stops when one side is left, even over the limit', () => {
    const { game, area } = scene();
    place(game, area, 'p1', 8);
    place(game, area, 'ai1', 1);
    const ctx = conflict(game);
    expect(at(ctx, area, 'p1')).toBe(8);
    expect(at(ctx, area, 'ai1')).toBe(0);
  });
});

describe('attacking a settlement', () => {
  it('destroys attackers below the threshold and leaves the settlement unharmed', () => {
    const { game, area } = scene();
    settle(game, area, 'village');
    place(game, area, 'p1', 6);
    const ctx = conflict(game);
    expect(at(ctx, area, 'p1')).toBe(0);
    expect(settlementAt(ctx.state, area)).toMatchObject({ player: 'ai1', tier: 'village' });
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ repelled: ['p1'], capturedBy: null, losses: [{ player: 'p1', count: 6 }] });
  });

  it('fights the defense value and destroys a captured village, leaving survivors', () => {
    // 9 vs 6: the village removes first each round and is gone after its sixth removal, with 4 left.
    const { game, area } = scene();
    settle(game, area, 'village');
    place(game, area, 'p1', 9);
    const ctx = conflict(game);
    expect(settlementAt(ctx.state, area)).toBeUndefined();
    expect(at(ctx, area, 'p1')).toBe(4);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 4, tier: 'village' });
  });

  it('captures a town one tier lower, keeps its name, and garrisons the survivors', () => {
    const { game, area } = scene();
    settle(game, area, 'town', 'ai1', 'Ur');
    place(game, area, 'p1', 13);
    const ctx = conflict(game);
    expect(settlementAt(ctx.state, area)).toEqual({ area, player: 'p1', tier: 'village', name: 'Ur' });
    expect(at(ctx, area, 'p1')).toBe(0);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 5 });
  });

  it('adds the defender’s tokens in the area to the defense', () => {
    // 8 attackers meet the village threshold, but 6 + 3 reinforcements is stronger.
    const { game, area } = scene();
    settle(game, area, 'village');
    place(game, area, 'p1', 8);
    place(game, area, 'ai1', 3);
    const ctx = conflict(game);
    expect(settlementAt(ctx.state, area)).toMatchObject({ player: 'ai1' });
    expect(at(ctx, area, 'p1')).toBe(0);
    // The defense loses 7; reinforcements fall first.
    expect(at(ctx, area, 'ai1')).toBe(0);
  });

  it('keeps reinforcements the defense did not lose', () => {
    const { game, area } = scene();
    settle(game, area, 'town');
    place(game, area, 'p1', 10);
    place(game, area, 'ai1', 10);
    const ctx = conflict(game);
    // 10 vs 19: the attackers remove first and fall after 10 rounds; the defense loses 9.
    expect(at(ctx, area, 'ai1')).toBe(1);
  });

  it('holds when the last tokens on both sides fall together', () => {
    const { game, area } = scene();
    settle(game, area, 'village');
    place(game, area, 'p1', 7);
    place(game, area, 'ai1', 1);
    const ctx = conflict(game);
    expect(settlementAt(ctx.state, area)).toMatchObject({ player: 'ai1', tier: 'village' });
    expect(at(ctx, area, 'p1')).toBe(0);
  });

  it('fights several attackers and the settlement in one fight', () => {
    // Village 6, A 8, B 7: after six rounds 0/2/1, then B removes and A captures with 2.
    const { game, area } = scene();
    settle(game, area, 'village', 'p1');
    place(game, area, 'ai1', 8);
    place(game, area, 'ai2', 7);
    const ctx = conflict(game);
    expect(settlementAt(ctx.state, area)).toBeUndefined();
    expect(at(ctx, area, 'ai1')).toBe(2);
    expect(at(ctx, area, 'ai2')).toBe(0);
  });

  it('destroys attackers below the threshold before the fight', () => {
    const { game, area } = scene();
    settle(game, area, 'village', 'p1');
    place(game, area, 'ai1', 9);
    place(game, area, 'ai2', 3);
    const ctx = conflict(game);
    expect(at(ctx, area, 'ai2')).toBe(0);
    expect(at(ctx, area, 'ai1')).toBe(4);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ repelled: ['ai2'], capturedBy: 'ai1' });
  });

  it('releases no refugees on capture', () => {
    const { game, area } = scene();
    settle(game, area, 'town');
    place(game, area, 'p1', 13);
    const ctx = conflict(game);
    expect(ctx.refugees).toEqual([]);
    expect(ctx.state.stacks.filter((s) => s.player === 'ai1')).toEqual([]);
  });
});

describe('conflict during resolution', () => {
  it('runs after movement, before conversion', () => {
    const { game, area, next } = scene();
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    settle(game, area, 'village');
    place(game, next, 'p1', 9);
    play(game, { type: 'orderMove', player: 'p1', from: next, to: area, count: 9 });
    const events = endPhaseAll(game).map((e) => e.event);
    const steps = events.filter((e) => e.type === 'resolutionStep').map((e) => e.step);
    expect(steps.slice(0, 3)).toEqual(['movement', 'conflict', 'conversion']);
    const attacked = events.findIndex((e) => e.type === 'settlementAttacked');
    expect(attacked).toBeGreaterThan(events.findIndex((e) => e.type === 'resolutionStep' && e.step === 'conflict'));
    expect(settlementAt(game.state, area)).toBeUndefined();
  });
});

describe('conflict preview', () => {
  it('forecasts the fights planned moves lead to, without changing the state', () => {
    const { game, area, next } = scene();
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    settle(game, area, 'village');
    place(game, next, 'p1', 9);
    play(game, { type: 'orderMove', player: 'p1', from: next, to: area, count: 9 });
    const [attack] = previewConflicts(game.state, mapFor(game.setup), testContent(), 'p1');
    expect(attack).toMatchObject({ type: 'settlementAttacked', area, capturedBy: 'p1', survivors: 4 });
    expect(previewConflicts(game.state, mapFor(game.setup), testContent(), 'ai2')).toEqual([]);
    expect(settlementAt(game.state, area)).toBeDefined();
  });
});
