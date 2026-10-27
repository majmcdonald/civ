import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../src/content/types';
import { aiCommands, mapFor, marketOf, marketView, settlementAt, type AreaId, type Context, type Session, type SettlementTier } from '../src/engine';
import { landDistances } from '../src/engine/instability';
import { resolveMarket } from '../src/engine/market';
import { resolveSupport } from '../src/engine/settlements';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

// The stand-in with market access from the start, and copper: a luxury no one can gather yet.
const bundle: ContentBundle = {
  ...standIn,
  advances: [
    ...standIn.advances,
    { id: 'barter', name: 'Barter', era: 'stone', domain: 'travel', baseline: true, effects: [{ type: 'marketAccess' }] },
    { id: 'copperWorking', name: 'Copper Working', era: 'stone', domain: 'crafts', known: { cost: 99, inputs: [] }, developed: { cost: 99, inputs: [] }, effects: [] },
  ],
  resources: [...standIn.resources, { id: 'copper', name: 'Copper', food: false, luxury: true, price: 10, requires: 'copperWorking' }],
};
const content = testContent(bundle);

// An empty board in the trade phase: p1 settled at `home`, and land areas 2 and 3 steps away.
function scene() {
  const game = newGame({}, content);
  const map = mapFor(game.setup);
  game.state.stacks = [];
  game.state.settlements = [];
  const home = map.areas.find((a) => {
    if (a.kind !== 'land') return false;
    const d = landDistances(map, a.id);
    return [...d.values()].includes(2) && [...d.values()].includes(3);
  })!.id;
  const d = landDistances(map, home);
  const at = (n: number) => [...d.entries()].filter(([, v]) => v === n).map(([k]) => k).sort((a, b) => a - b)[0]!;
  settle(game, home, 'village', 'p1');
  return { game, map, home, two: at(2), three: at(3) };
}

function settle(game: Session, area: AreaId, tier: SettlementTier, player: string): void {
  game.state.settlements.push({ area, player, tier });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

// Support tokens around the village so it survives the turn.
function place(game: Session, home: AreaId): void {
  const map = mapFor(game.setup);
  const next = map.areas[home]!.neighbors.find((n) => map.areas[n]!.kind === 'land' && !settlementAt(game.state, n))!;
  game.state.stacks.push({ area: next, player: 'p1', count: 3 });
  game.state.stacks.sort((a, b) => a.area - b.area);
}

function market(game: Session): Context {
  const ctx: Context = { state: game.state, content, map: mapFor(game.setup), events: [], refugees: [] };
  resolveMarket(ctx);
  return ctx;
}

const p1 = (game: Session) => game.state.players[0]!;
const ai1 = (game: Session) => game.state.players[1]!;

describe('market orders (v0.21)', () => {
  it('takes standing orders in the allocation phase', () => {
    const { game } = scene();
    expect(game.state.phase).toBe('allocation');
    play(game, { type: 'setOrder', player: 'p1', resource: 'grain', side: 'buy', count: 2 }, { type: 'setOrder', player: 'p1', resource: 'copper', side: 'buy', count: 1, limit: 12 });
    expect(p1(game).orders).toEqual([
      { resource: 'grain', side: 'buy', count: 2 },
      { resource: 'copper', side: 'buy', count: 1, limit: 12 },
    ]);
    play(game, { type: 'setOrder', player: 'p1', resource: 'grain', side: 'buy', count: 0 });
    expect(p1(game).orders).toEqual([{ resource: 'copper', side: 'buy', count: 1, limit: 12 }]);
  });

  it('rejects selling a good the civilization cannot use, and orders after the phase has ended', () => {
    const { game } = scene();
    expectRejected(game, { type: 'setOrder', player: 'p1', resource: 'copper', side: 'sell', count: 1 }, /sell only goods you can use/);
    play(game, { type: 'endPhase', player: 'p1' });
    expectRejected(game, { type: 'setOrder', player: 'p1', resource: 'grain', side: 'buy', count: 1 }, /already ended/);
  });
});

describe('timing (v0.24)', () => {
  it('fills standing orders in the next resources phase, before allocation', () => {
    const { game, home } = scene();
    place(game, home);
    p1(game).treasury = 20;
    play(game, { type: 'setOrder', player: 'p1', resource: 'grain', side: 'buy', count: 1 });
    const events = endPhaseAll(game);
    expect(game.state.phase).toBe('allocation');
    expect(eventsOfType(events, 'marketTrade')).toEqual([{ type: 'marketTrade', player: 'p1', resource: 'grain', side: 'buy', count: 1, price: 6 }]);
    expect(game.state.goods).toContainEqual({ area: null, player: 'p1', resource: 'grain', count: 1 });
  });
});

describe('prices (v0.21)', () => {
  it('move 10% of the starting price per unit of imbalance, and orders fill at the rounded new price', () => {
    // Grain at 5, 4 bought: 7, and the 4 cost 28 (design doc §7).
    const { game } = scene();
    p1(game).treasury = 100;
    p1(game).orders = [{ resource: 'grain', side: 'buy', count: 4 }];
    const ctx = market(game);
    expect(p1(game).prices.grain).toBe(7);
    expect(p1(game).treasury).toBe(72);
    expect(game.state.goods).toEqual([{ area: null, player: 'p1', resource: 'grain', count: 4 }]);
    expect(eventsOfType(ctx.events, 'marketTrade')).toEqual([{ type: 'marketTrade', player: 'p1', resource: 'grain', side: 'buy', count: 4, price: 7 }]);
  });

  it('stay between half and triple the starting price and do not recover on quiet turns', () => {
    const { game } = scene();
    p1(game).treasury = 1000;
    p1(game).orders = [{ resource: 'grain', side: 'buy', count: 50 }];
    market(game);
    expect(p1(game).prices.grain).toBe(15);
    p1(game).orders = [];
    market(game);
    expect(p1(game).prices.grain).toBe(15);
  });

  it('count limit orders the new price misses, which then go unfilled', () => {
    const { game } = scene();
    p1(game).treasury = 100;
    p1(game).orders = [{ resource: 'copper', side: 'buy', count: 3, limit: 12 }];
    market(game);
    expect(p1(game).prices.copper).toBe(13);
    expect(p1(game).treasury).toBe(100);
  });
});

describe('filling (v0.21)', () => {
  it('sells held goods first, then buys as far as the treasury allows', () => {
    // Fish 5 → 4.5 after 1 sold (fills at 5); grain 5 → 5.5 after 3 ordered (fills at 6).
    const { game, home } = scene();
    game.state.goods = [{ area: home, player: 'p1', resource: 'fish', count: 1 }];
    p1(game).treasury = 7;
    p1(game).orders = [
      { resource: 'grain', side: 'buy', count: 1 },
      { resource: 'fish', side: 'sell', count: 3 },
    ];
    market(game);
    expect(p1(game).treasury).toBe(7 + 5 - 6);
    expect(game.state.goods).toEqual([{ area: null, player: 'p1', resource: 'grain', count: 1 }]);
  });

  it('buys goods without their advance; bought food covers a shortfall anywhere', () => {
    const { game, map, home, three } = scene();
    settle(game, three, 'village', 'p1');
    p1(game).treasury = 50;
    p1(game).orders = [{ resource: 'grain', side: 'buy', count: 2 }];
    market(game);
    // No tokens anywhere: each village needs 2 support; 2 bought grain cover one of them.
    const ctx: Context = { state: game.state, content, map, events: [], refugees: [] };
    resolveSupport(ctx);
    expect(eventsOfType(ctx.events, 'foodSupport')).toEqual([{ type: 'foodSupport', player: 'p1', area: Math.min(home, three), count: 2 }]);
    expect(settlementAt(game.state, Math.min(home, three))).toBeDefined();
    expect(settlementAt(game.state, Math.max(home, three))).toBeUndefined();
  });

  it('records the kinds of goods traded for Barter’s adoption', () => {
    const { game } = scene();
    p1(game).treasury = 50;
    p1(game).orders = [
      { resource: 'grain', side: 'buy', count: 1 },
      { resource: 'copper', side: 'buy', count: 1 },
    ];
    market(game);
    expect(p1(game).traded).toEqual({ turn: game.state.turn, resources: ['grain', 'copper'] });
  });
});

describe('reach (v0.21)', () => {
  it('joins markets 2 steps apart, settlement to settlement, and their orders move each other’s prices', () => {
    const { game, map, two } = scene();
    settle(game, two, 'village', 'ai1');
    expect(marketOf(game.state, map, 'p1')).toEqual(['p1', 'ai1']);
    ai1(game).treasury = 100;
    ai1(game).orders = [{ resource: 'grain', side: 'buy', count: 2 }];
    market(game);
    expect(p1(game).prices.grain).toBe(6);
    expect(ai1(game).prices.grain).toBe(6);
  });

  it('keeps markets 3 steps apart separate until Barter Mastered adds a step', () => {
    const { game, map, three } = scene();
    settle(game, three, 'village', 'ai1');
    expect(marketOf(game.state, map, 'p1')).toEqual(['p1']);
    ai1(game).effects.push({ type: 'marketReach', amount: 1 });
    // Mutual: the rival's reach joins both markets.
    expect(marketOf(game.state, map, 'p1')).toEqual(['p1', 'ai1']);
  });

  it('shows the forecast price at the close from the standing orders', () => {
    const { game, map } = scene();
    p1(game).orders = [{ resource: 'copper', side: 'buy', count: 2 }];
    const copper = marketView(game.state, map, content, 'p1').goods.find((g) => g.resource === 'copper')!;
    expect(copper).toMatchObject({ price: 10, forecast: 12, imbalance: 2, canSell: false });
  });
});

describe('the minimal AI (v0.21)', () => {
  it('buys the cheapest food for its forecast support shortfall and never sells', () => {
    const { game, two } = scene();
    settle(game, two, 'village', 'ai1');
    ai1(game).treasury = 30;
    const commands = aiCommands(game.state, content, 'ai1');
    expect(commands).toEqual([{ type: 'setOrder', player: 'ai1', resource: 'grain', side: 'buy', count: 2 }]);
  });
});
