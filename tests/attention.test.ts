import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../src/content/types';
import { attentionItems, goodsLedger, mapFor, settlementAt, treasuryForecast, type AreaId, type Session, type SettlementTier } from '../src/engine';
import { newGame, standIn, testContent } from './harness';

const bundle: ContentBundle = {
  ...standIn,
  resources: [...standIn.resources, { id: 'stone', name: 'Stone', food: false, price: 5, durable: true, requires: 'agriculture', terrain: ['hills', 'mountains'] }],
  calamities: [{ id: 'famine', name: 'Famine', buyOff: { cost: 10 } }],
  wonders: [{ id: 'cairn', name: 'Cairn', era: 'stone', requires: ['agriculture'], turns: 3, manpower: 1, goods: [{ resource: 'stone', count: 1 }], effects: [], summary: 'cairn' }],
};

const players = [
  { id: 'p1', name: 'Player', kind: 'human' as const },
  { id: 'ai1', name: 'Rival', kind: 'ai' as const },
];

function scene() {
  const content = testContent(bundle);
  const game = newGame({ players }, content);
  game.state.stacks = [];
  game.state.settlements = [];
  game.state.goods = [];
  return { game, content, map: mapFor(game.setup) };
}

const land = (game: Session) => mapFor(game.setup).areas.filter((a) => a.kind === 'land');

// A settlement with its support: 3 loose tokens in a neighbouring unsettled area.
function settle(game: Session, tier: SettlementTier = 'village', supported = true): AreaId {
  const map = mapFor(game.setup);
  const used = (a: AreaId) => game.state.settlements.some((s) => s.area === a || map.areas[a]!.neighbors.includes(s.area)) || game.state.stacks.some((s) => s.area === a);
  const area = land(game).find((a) => !used(a.id) && a.neighbors.some((n) => map.areas[n]!.kind === 'land' && !used(n) && map.areas[n]!.limit >= 3))!;
  game.state.settlements.push({ area: area.id, player: 'p1', tier, work: [] });
  game.state.settlements.sort((a, b) => a.area - b.area);
  if (supported) {
    const next = area.neighbors.find((n) => map.areas[n]!.kind === 'land' && map.areas[n]!.limit >= 3)!;
    game.state.stacks.push({ area: next, player: 'p1', count: 3 });
    game.state.stacks.sort((a, b) => a.area - b.area);
  }
  return area.id;
}

const items = (game: Session, content = testContent(bundle)) => attentionItems(game.state, mapFor(game.setup), content, 'p1');

describe('attention items (v0.29)', () => {
  it('lists nothing when nothing will go wrong', () => {
    const { game } = scene();
    const area = settle(game);
    settlementAt(game.state, area)!.work = [{ resource: 'highLearning', count: 1 }];
    expect(items(game)).toEqual([]);
  });

  it('flags idle manpower, a support shortfall, and a settlement near collapse', () => {
    const { game } = scene();
    const area = settle(game, 'village', false);
    settlementAt(game.state, area)!.instability = 6;
    expect(items(game)).toEqual([
      { type: 'idle', area, units: 1 },
      { type: 'support', area, tier: 'village', support: 0, needed: 2 },
      { type: 'collapse', area, instability: 6, threshold: 8 },
    ]);
  });

  it('flags a wonder that will stall and a race to resolve', () => {
    const { game } = scene();
    const area = settle(game);
    settlementAt(game.state, area)!.work = [{ resource: 'wonder', count: 1 }];
    game.state.builds.push({ wonder: 'cairn', player: 'p1', area, worked: 1, started: 0, labour: { turn: game.state.turn, units: 1 } });
    expect(items(game)).toEqual([{ type: 'wonderStall', wonder: 'cairn', area, reason: 'short of stone (0 of 1)' }]);
    game.state.goods.push({ area: null, player: 'p1', resource: 'stone', count: 1 });
    expect(items(game)).toEqual([]);
    game.state.builds[0]!.outbuilt = game.state.turn - 1;
    expect(items(game)).toEqual([{ type: 'raceLost', wonder: 'cairn', worked: 1 }]);
  });

  it('flags tokens over an area limit and over the cap', () => {
    const { game } = scene();
    const area = land(game).find((a) => a.limit <= 3)!;
    game.state.stacks.push({ area: area.id, player: 'p1', count: area.limit + 2 });
    expect(items(game)).toEqual([{ type: 'overLimit', area: area.id, count: 2 }]);
    game.state.players[0]!.tokenCap = 1;
    expect(items(game)).toContainEqual({ type: 'overCap', count: area.limit + 1 });
  });

  it('flags a buy order the treasury cannot fill, after this turn’s wonder currency and next turn’s tax', () => {
    const { game, content } = scene();
    settle(game, 'town');
    settlementAt(game.state, game.state.settlements[0]!.area)!.work = [{ resource: 'highLearning', count: 2 }];
    game.state.players[0]!.treasury = 9;
    game.state.players[0]!.orders = [{ resource: 'stone', side: 'buy', count: 3 }];
    // 9 + 1 tax = 10: two stone at 5.
    expect(items(game)).toEqual([{ type: 'order', resource: 'stone', count: 3, affordable: 2 }]);
    expect(treasuryForecast(game.state, mapFor(game.setup), content, 'p1')).toEqual({ treasury: 9, tax: 1, sales: 0, orders: 15, wonders: 0, expected: -5 });
  });

  it('flags a marked buy-off only when the treasury cannot pay it', () => {
    const { game } = scene();
    settlementAt(game.state, settle(game))!.work = [{ resource: 'highLearning', count: 1 }];
    game.state.players[0]!.treasury = 6;
    expect(items(game)).toEqual([]);
    game.state.players[0]!.buyOff = ['famine'];
    expect(items(game)).toEqual([{ type: 'buyOff', calamity: 'famine', cost: 10, treasury: 6 }]);
  });

  it('flags a planned move into a fight', () => {
    const { game } = scene();
    const area = land(game).find((a) => a.limit === 3 && a.neighbors.some((n) => mapFor(game.setup).areas[n]!.kind === 'land'))!;
    const next = area.neighbors.find((n) => mapFor(game.setup).areas[n]!.kind === 'land')!;
    game.state.stacks.push({ area: area.id, player: 'ai1', count: 3 }, { area: next, player: 'p1', count: 3 });
    game.state.stacks.sort((a, b) => a.area - b.area);
    game.state.orders.push({ player: 'p1', from: next, to: area.id, count: 3 });
    expect(items(game)).toContainEqual({ type: 'fight', area: area.id });
  });

  it('lists goods gathered, held with the kept part, and needed by kind and by wonder', () => {
    const { game, content, map } = scene();
    const area = settle(game, 'village', false);
    const s = settlementAt(game.state, area)!;
    s.work = [{ resource: 'grain', count: 1 }];
    s.instability = 1;
    game.state.goods.push({ area, player: 'p1', resource: 'grain', count: 1 }, { area: null, player: 'p1', resource: 'stone', count: 2 });
    game.state.builds.push({ wonder: 'cairn', player: 'p1', area, worked: 1, started: 0 });
    const ledger = goodsLedger(game.state, map, content, 'p1');
    expect(ledger.goods.find((g) => g.resource === 'grain')).toEqual({ resource: 'grain', gathered: 1, where: [{ area, count: 1 }], held: 1, kept: 0, needed: 0 });
    expect(ledger.goods.find((g) => g.resource === 'stone')).toEqual({ resource: 'stone', gathered: 0, where: [], held: 2, kept: 2, needed: 1 });
    // The unsupported village needs 2 food for support.
    expect(ledger.food).toEqual({ gathered: 1, held: 1, needed: 2, support: 2, wonders: 0 });
    expect(ledger.luxury).toEqual({ gathered: 0, held: 0, needed: 1 });
  });
});
