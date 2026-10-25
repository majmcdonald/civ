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
    expect(settlementAt(ctx.state, area)).toMatchObject({ area, player: 'p1', tier: 'village', name: 'Ur' });
    expect(at(ctx, area, 'p1')).toBe(0);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 5 });
  });

  it('takes a share of the defender’s treasury by the tier lost, rounded down', () => {
    // Town 20%, village 10% (design doc §11, Spoils).
    const { game, area, next } = scene();
    settle(game, area, 'town', 'ai1');
    place(game, area, 'p1', 13);
    game.state.players[1]!.treasury = 23;
    game.state.players[0]!.treasury = 1;
    const ctx = conflict(game);
    expect(ctx.state.players.map((p) => p.treasury)).toEqual([5, 19, 0]);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', spoils: 4 });

    const raid = scene().game;
    settle(raid, next, 'village', 'ai1');
    place(raid, next, 'p1', 9);
    raid.state.players[1]!.treasury = 23;
    expect(conflict(raid).state.players[1]!.treasury).toBe(21);
  });

  it('takes no spoils when the attack fails', () => {
    const { game, area } = scene();
    settle(game, area, 'village', 'ai1');
    place(game, area, 'p1', 6);
    game.state.players[1]!.treasury = 20;
    const ctx = conflict(game);
    expect(ctx.state.players[1]!.treasury).toBe(20);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: null, spoils: 0 });
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

describe('strength, volley, and power thresholds (v0.14)', () => {
  const bows = (game: Session, player: string, counteredBy?: string) => {
    game.state.players.find((p) => p.id === player)!.effects = [{ type: 'strength', amount: 0.25, ...(counteredBy ? { counteredBy } : {}) }];
  };

  it('turns bonus power into a volley before the first round', () => {
    // 4 archers vs 5: the volley removes 1 (4 vs 4); archers at power 5 vs 4 then win the order.
    const { game, area } = scene();
    place(game, area, 'p1', 4);
    place(game, area, 'ai1', 5);
    bows(game, 'p1');
    const ctx = conflict(game);
    expect([at(ctx, area, 'p1'), at(ctx, area, 'ai1')]).toEqual([2, 1]);
  });

  it('without bonuses, plays as before: 4 vs 5 ends 1 vs 2', () => {
    const { game, area } = scene();
    place(game, area, 'p1', 4);
    place(game, area, 'ai1', 5);
    const ctx = conflict(game);
    expect([at(ctx, area, 'p1'), at(ctx, area, 'ai1')]).toEqual([1, 2]);
  });

  it('checks settlement thresholds against power: 8 archers may attack a town', () => {
    // Design doc §11 example: town threshold 10, defends as 9; 8 archers (power 10, volley 2) capture with 2.
    const { game, area } = scene();
    settle(game, area, 'town');
    place(game, area, 'p1', 8);
    bows(game, 'p1');
    const ctx = conflict(game);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 2, repelled: [] });
    const plain = scene();
    settle(plain.game, plain.area, 'town');
    place(plain.game, plain.area, 'p1', 8);
    expect(eventsOfType(conflict(plain.game).events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: null, repelled: ['p1'] });
  });

  it('cancels a bonus the defender counters, and raises thresholds by settlement bonuses', () => {
    // Palisades (+1) on a town: threshold 11, defends as 10; archers countered need 11 tokens.
    const { game, area } = scene();
    settle(game, area, 'town');
    place(game, area, 'p1', 10);
    bows(game, 'p1', 'fishing');
    game.state.players.find((p) => p.id === 'ai1')!.effects = [{ type: 'settlementDefense', amount: 1 }];
    expect(eventsOfType(conflict(game).events, 'settlementAttacked')[0]).toMatchObject({ repelled: ['p1'] });
    game.state.stacks = [];
    place(game, area, 'p1', 11);
    expect(eventsOfType(conflict(game).events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 2 });
    // Without the counter advance, the bonus holds: 9 archers (power 11.25) attack.
    game.state.players.find((p) => p.id === 'ai1')!.advances = [];
    game.state.stacks = [];
    place(game, area, 'p1', 9);
    expect(eventsOfType(conflict(game).events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 2 });
  });

  it('limits settlement bonuses to their tier', () => {
    const { game, area } = scene();
    settle(game, area, 'village');
    place(game, area, 'p1', 7);
    game.state.players.find((p) => p.id === 'ai1')!.effects = [{ type: 'settlementDefense', amount: 1, minTier: 'town' }];
    expect(eventsOfType(conflict(game).events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1' });
  });

  it('gives the defender its own strength and volley, and marks the settlement attacked', () => {
    // Town defended by archers (9 at power 11.25, volley 2): 10 plain attackers lose, 12 capture with 2.
    const { game, area } = scene();
    settle(game, area, 'town');
    game.state.players.find((p) => p.id === 'ai1')!.effects = [{ type: 'strength', amount: 0.25 }];
    place(game, area, 'p1', 11);
    const held = conflict(game);
    expect(eventsOfType(held.events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: null });
    expect(settlementAt(held.state, area)!.attacked).toBe(game.state.turn);
    expect(held.state.players.filter((p) => p.fought).map((p) => [p.id, p.fought])).toEqual([
      ['p1', { turn: game.state.turn, count: 1 }],
      ['ai1', { turn: game.state.turn, count: 1 }],
    ]);
    game.state.stacks = [];
    place(game, area, 'p1', 12);
    expect(eventsOfType(conflict(game).events, 'settlementAttacked')[0]).toMatchObject({ capturedBy: 'p1', survivors: 2 });
  });
});
