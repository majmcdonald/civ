import { describe, expect, it } from 'vitest';
import { assignSupport, mapFor, previewConversions, supportSummary, settlementAt, tokensAt, type AreaId, type Context, type GameMap, type GameSetup, type Session, type SettlementTier } from '../src/engine';
import { dropTier } from '../src/engine/settlements';
import { resolveSurplus } from '../src/engine/population';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, testContent } from './harness';

function toAllocation(game: Session): void {
  while (game.state.phase !== 'allocation') endPhaseAll(game);
}

function landNeighbors(map: GameMap, area: AreaId): AreaId[] {
  return map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land').sort((a, b) => a - b);
}

// An empty board around a land area with at least three land neighbors.
function scene(setup: Partial<GameSetup> = {}) {
  const game = newGame(setup);
  const map = mapFor(game.setup);
  game.state.stacks = [];
  const area = map.areas.find((a) => a.kind === 'land' && a.limit >= 2 && landNeighbors(map, a.id).length >= 3)!.id;
  const [b, c, d] = landNeighbors(map, area) as [AreaId, AreaId, AreaId];
  return { game, map, area, b, c, d };
}

// Fixtures write the state directly.
function place(game: Session, area: AreaId, player: string, count: number): void {
  game.state.stacks = game.state.stacks.filter((s) => !(s.area === area && s.player === player));
  game.state.stacks.push({ area, player, count });
  game.state.stacks.sort((a, b) => a.area - b.area || (a.player < b.player ? -1 : 1));
}

function settle(game: Session, area: AreaId, tier: SettlementTier, player = 'p1'): void {
  game.state.settlements.push({ area, player, tier });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

function found(game: Session, area: AreaId) {
  toAllocation(game);
  play(game, { type: 'orderConversion', player: 'p1', area, ordered: true });
  return endPhaseAll(game);
}

function context(game: Session): Context {
  return { state: JSON.parse(JSON.stringify(game.state)), content: testContent(), map: mapFor(game.setup), events: [], refugees: [] };
}

describe('conversion orders', () => {
  it('are refused once the player has ended the allocation phase', () => {
    const { game, area } = scene();
    play(game, { type: 'endPhase', player: 'p1' });
    expectRejected(game, { type: 'orderConversion', player: 'p1', area, ordered: true }, /already ended/);
  });

  it('are recorded and cancelled', () => {
    const { game, area } = scene();
    toAllocation(game);
    play(game, { type: 'orderConversion', player: 'p1', area, ordered: true });
    expect(game.state.conversions).toEqual([{ player: 'p1', area }]);
    play(game, { type: 'orderConversion', player: 'p1', area, ordered: false });
    expect(game.state.conversions).toEqual([]);
    expectRejected(game, { type: 'orderConversion', player: 'p1', area, ordered: false }, /No conversion/);
  });

  it('are refused at sea, on a rival settlement, and for locked tiers', () => {
    const { game, map, area, b } = scene();
    toAllocation(game);
    const sea = map.areas.find((a) => a.kind === 'sea')!.id;
    expectRejected(game, { type: 'orderConversion', player: 'p1', area: sea, ordered: true }, /on land/);
    settle(game, b, 'village', 'ai1');
    expectRejected(game, { type: 'orderConversion', player: 'p1', area: b, ordered: true }, /Another civilization's settlement/);
    settle(game, area, 'village');
    expectRejected(game, { type: 'orderConversion', player: 'p1', area, ordered: true }, /Towns are not unlocked/);
  });
});

describe('founding', () => {
  it('builds a village from 6 tokens, taking them in resolution', () => {
    const { game, area, b } = scene();
    place(game, area, 'p1', 6);
    place(game, b, 'p1', 2);
    const events = found(game, area);
    expect(eventsOfType(events, 'settlementBuilt')).toEqual([{ type: 'settlementBuilt', player: 'p1', area, tier: 'village', from: [{ area, count: 6 }] }]);
    expect(settlementAt(game.state, area)).toMatchObject({ area, player: 'p1', tier: 'village' });
    expect(tokensAt(game.state, area, 'p1')).toBe(0);
    expect(game.state.conversions).toEqual([]);
  });

  it("takes the area's own tokens first, then the fullest neighbors", () => {
    const { game, area, b, c } = scene();
    place(game, area, 'p1', 3);
    place(game, b, 'p1', 2);
    place(game, c, 'p1', 4);
    const events = found(game, area);
    expect(eventsOfType(events, 'settlementBuilt')[0]!.from).toEqual([
      { area, count: 3 },
      { area: c, count: 3 },
    ]);
  });

  it('fails with a reason when too few tokens are in reach', () => {
    const { game, area, b } = scene();
    place(game, area, 'p1', 3);
    place(game, b, 'p1', 2);
    const events = found(game, area);
    expect(eventsOfType(events, 'conversionFailed')).toEqual([{ type: 'conversionFailed', player: 'p1', area, reason: 'Needs 6 tokens in or next to the area; 5 in reach' }]);
    expect(settlementAt(game.state, area)).toBeUndefined();
  });

  it('counts tokens that move in the same turn', () => {
    const { game, area, b, c } = scene();
    place(game, b, 'p1', 6);
    place(game, c, 'p1', 2);
    toAllocation(game);
    play(game, { type: 'orderMove', player: 'p1', from: b, to: area, count: 6 }, { type: 'orderConversion', player: 'p1', area, ordered: true });
    const events = endPhaseAll(game);
    expect(eventsOfType(events, 'settlementBuilt')[0]!.from).toEqual([{ area, count: 6 }]);
  });

  it('removes loose tokens left in a settled area as surplus', () => {
    const { game, area, b } = scene();
    place(game, area, 'p1', 8);
    place(game, b, 'p1', 2);
    const events = found(game, area);
    expect(eventsOfType(events, 'surplusRemoved')).toContainEqual({ type: 'surplusRemoved', player: 'p1', area, count: 2 });
    expect(tokensAt(game.state, area, 'p1')).toBe(0);
  });

  it('fails when another civilization has tokens in the area', () => {
    const { game, area, b } = scene();
    place(game, area, 'p1', 1);
    place(game, b, 'p1', 5);
    place(game, area, 'ai1', 1);
    const events = found(game, area);
    expect(eventsOfType(events, 'conversionFailed')[0]!.reason).toMatch(/Another civilization's tokens/);
  });
});

describe('upgrading', () => {
  it('turns a village into a town with 6 tokens from adjacent areas', () => {
    const { game, area, b, c } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'village');
    place(game, b, 'p1', 5);
    place(game, c, 'p1', 4);
    const events = found(game, area);
    expect(eventsOfType(events, 'settlementBuilt')).toEqual([
      { type: 'settlementBuilt', player: 'p1', area, tier: 'town', from: [{ area: b, count: 5 }, { area: c, count: 1 }] },
    ]);
    expect(settlementAt(game.state, area)!.tier).toBe('town');
  });
});

describe('support', () => {
  it('is checked the turn a settlement is founded: an unsupported village dissolves', () => {
    const { game, map, area } = scene();
    place(game, area, 'p1', 6);
    const events = found(game, area);
    expect(eventsOfType(events, 'settlementDropped')).toEqual([{ type: 'settlementDropped', player: 'p1', area, tier: null, refugees: 6, lost: 0 }]);
    expect(settlementAt(game.state, area)).toBeUndefined();
    // Refugees fill the area itself up to its limit first.
    expect(tokensAt(game.state, area, 'p1')).toBe(Math.min(6, map.areas[area]!.limit));
  });

  it('goes to larger settlements first', () => {
    const { game, map } = scene({ unlockedTiers: ['village', 'town'] });
    const shared = map.areas.find((a) => a.kind === 'land' && landNeighbors(map, a.id).length >= 2)!.id;
    const [town, village] = landNeighbors(map, shared) as [AreaId, AreaId];
    settle(game, village, 'village');
    settle(game, town, 'town');
    place(game, shared, 'p1', 3);
    const support = assignSupport(game.state, map, game.content);
    expect(support.get(town)).toBe(3);
    expect(support.get(village)).toBe(0);
  });
});

describe('tier drop', () => {
  it('drops a town to a village and sends 6 refugees to adjacent areas', () => {
    const { game, area } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'town');
    const ctx = context(game);
    dropTier(ctx, ctx.state.settlements[0]!);
    expect(ctx.state.settlements[0]!.tier).toBe('village');
    expect(eventsOfType(ctx.events, 'settlementDropped')).toEqual([{ type: 'settlementDropped', player: 'p1', area, tier: 'village', refugees: 6, lost: 0 }]);
    expect(ctx.state.stacks.reduce((sum, s) => sum + s.count, 0)).toBe(6);
    expect(tokensAt(ctx.state, area, 'p1')).toBe(0);
  });

  it('lets refugees ignore area limits until the next turn', () => {
    const { game, map, area } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'town');
    for (const n of landNeighbors(map, area)) place(game, n, 'p1', map.areas[n]!.limit);
    const ctx = context(game);
    dropTier(ctx, ctx.state.settlements[0]!);
    const total = () => ctx.state.stacks.reduce((sum, s) => sum + s.count, 0);
    const before = total();
    resolveSurplus(ctx);
    expect(total()).toBe(before);
    const nextTurn = { ...ctx, events: [], refugees: [] };
    resolveSurplus(nextTurn);
    expect(total()).toBe(before - 6);
  });

  it('lets refugees exceed the token cap until the next turn', () => {
    const { game, area } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'town');
    game.state.players[0]!.tokenCap = 2;
    const ctx = context(game);
    dropTier(ctx, ctx.state.settlements[0]!);
    resolveSurplus(ctx);
    expect(eventsOfType(ctx.events, 'overCapRemoved')).toEqual([]);
    const nextTurn: Context = { ...ctx, events: [], refugees: [] };
    resolveSurplus(nextTurn);
    expect(eventsOfType(nextTurn.events, 'overCapRemoved')).toEqual([{ type: 'overCapRemoved', player: 'p1', count: 4 }]);
    expect(ctx.state.stacks.reduce((sum, s) => sum + s.count, 0)).toBe(2);
  });
});

describe('urban growth', () => {
  it('adds a town token to an adjacent area with room', () => {
    const { game, map, area, b } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'town');
    place(game, b, 'p1', 3);
    toAllocation(game);
    const grown = eventsOfType(endPhaseAll(game), 'urbanGrowth');
    expect(grown).toHaveLength(1);
    expect(grown[0]).toMatchObject({ player: 'p1', from: area, count: 1 });
    expect(landNeighbors(map, area)).toContain(grown[0]!.to);
  });
});

describe('naming', () => {
  it('names, renames, and clears a settlement, keeping the name through an upgrade', () => {
    const { game, area, b, c } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'village');
    play(game, { type: 'nameSettlement', player: 'p1', area, name: '  Jericho ' });
    expect(settlementAt(game.state, area)!.name).toBe('Jericho');
    place(game, b, 'p1', 6);
    place(game, c, 'p1', 3);
    found(game, area);
    expect(settlementAt(game.state, area)).toMatchObject({ tier: 'town', name: 'Jericho' });
    play(game, { type: 'nameSettlement', player: 'p1', area, name: '' });
    expect(settlementAt(game.state, area)!.name).toBeUndefined();
  });

  it("is refused for another civilization's settlement and for long names", () => {
    const { game, area, b } = scene();
    settle(game, area, 'village');
    settle(game, b, 'village', 'ai1');
    expectRejected(game, { type: 'nameSettlement', player: 'p1', area: b, name: 'Ur' }, /no settlement there/);
    expectRejected(game, { type: 'nameSettlement', player: 'p1', area, name: 'x'.repeat(33) }, /at most 32/);
  });
});

describe('conversion preview', () => {
  it('reports the tokens taken, support afterwards, and failures', () => {
    const { game, map, area, b, d } = scene();
    place(game, area, 'p1', 4);
    place(game, b, 'p1', 3);
    toAllocation(game);
    play(game, { type: 'orderConversion', player: 'p1', area, ordered: true });
    expect(previewConversions(game.state, map, game.content, 'p1')).toEqual([
      { area, tier: 'village', built: true, from: [{ area, count: 4 }, { area: b, count: 2 }], leftover: 0, support: 1, needed: 2 },
    ]);
    play(game, { type: 'orderConversion', player: 'p1', area: d, ordered: true });
    const failed = previewConversions(game.state, map, game.content, 'p1').find((p) => p.area === d)!;
    expect(failed.built).toBe(false);
    expect(failed.reason).toMatch(/Needs 6 tokens/);
  });
});

describe('support summary', () => {
  it('reports support needed and supplied, free tokens, and short settlements', () => {
    const { game, map, area, b, c } = scene({ unlockedTiers: ['village', 'town'] });
    settle(game, area, 'town');
    place(game, b, 'p1', 2);
    place(game, c, 'p1', 4);
    const summary = supportSummary(game.state, map, game.content, 'p1');
    expect(summary).toMatchObject({ needed: 3, supplied: 3, free: 3, settlements: [{ area, tier: 'town', support: 3, needed: 3 }] });
  });

  it('includes planned moves', () => {
    const { game, map, area, b } = scene();
    settle(game, area, 'village');
    place(game, b, 'p1', 2);
    toAllocation(game);
    const away = landNeighbors(map, b).find((n) => n !== area && !map.areas[area]!.neighbors.includes(n))!;
    play(game, { type: 'orderMove', player: 'p1', from: b, to: away, count: 2 });
    const summary = supportSummary(game.state, map, game.content, 'p1');
    expect(summary.settlements).toEqual([{ area, tier: 'village', support: 0, food: 0, ateOwn: false, needed: 2 }]);
  });

  it('counts village sites with 8 free tokens in reach', () => {
    const { game, map, area, b } = scene();
    place(game, area, 'p1', 5);
    place(game, b, 'p1', 3);
    expect(supportSummary(game.state, map, game.content, 'p1').villageSites).toContain(area);
    place(game, b, 'p1', 2);
    expect(supportSummary(game.state, map, game.content, 'p1').villageSites).not.toContain(area);
  });
});
