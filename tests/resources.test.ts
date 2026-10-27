import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { generateMap, mapFor, MAP_TYPES, settlementAt, supportSummary, type AreaId, type Context, type GameMap, type Session, type Settlement, type SettlementTier } from '../src/engine';
import { resolveConflict } from '../src/engine/conflict';
import { collectTax, runResources } from '../src/engine/resources';
import { dropTier, resolveSupport } from '../src/engine/settlements';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

function toAllocation(game: Session): void {
  while (game.state.phase !== 'allocation') endPhaseAll(game);
}

const land = (map: GameMap, area: AreaId) => map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land').sort((a, b) => a - b);

// An empty board around a grain area with at least two land neighbours, and a land area with no food.
function scene() {
  const game = newGame({ unlockedTiers: ['village', 'town'] });
  const map = mapFor(game.setup);
  game.state.stacks = [];
  const grain = map.areas.find((a) => a.resources.includes('grain') && land(map, a.id).length >= 2)!.id;
  const [b, c] = land(map, grain) as [AreaId, AreaId];
  const barren = map.areas.find((a) => a.kind === 'land' && a.resources.length === 0 && land(map, a.id).length >= 2)!.id;
  return { game, map, grain, b, c, barren };
}

function place(game: Session, area: AreaId, player: string, count: number): void {
  game.state.stacks = game.state.stacks.filter((s) => !(s.area === area && s.player === player));
  game.state.stacks.push({ area, player, count });
  game.state.stacks.sort((a, b) => a.area - b.area || (a.player < b.player ? -1 : 1));
}

function settle(game: Session, area: AreaId, tier: SettlementTier, work: { resource: string; count: number }[] = [], player = 'p1'): void {
  game.state.settlements.push({ area, player, tier, work });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

function context(game: Session): Context {
  return { state: JSON.parse(JSON.stringify(game.state)), content: testContent(), map: mapFor(game.setup), events: [], refugees: [] };
}

describe('food on the map', () => {
  const maps = [1, 2, 3].flatMap((seed) => MAP_TYPES.map((type) => generateMap({ seed, civilizations: 5, type, room: 'standard' })));

  it('places grain and fish only where the odds allow', () => {
    for (const map of maps) {
      for (const area of map.areas) {
        if (area.kind === 'sea') expect(area.resources).toEqual([]);
        if (area.features.includes('floodplain')) expect(area.resources).toEqual(['grain']);
        if (area.resources.includes('fish')) expect(area.features).toContain('coastal');
        if ((area.terrain === 'mountains' || area.terrain === 'desert') && !area.features.includes('floodplain')) expect(area.resources).not.toContain('grain');
        expect(area.resources.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives every start food within 3 land moves', () => {
    for (const map of maps) {
      for (const start of map.starts) {
        const seen = new Set([start]);
        let frontier = [start];
        for (let d = 0; d < 3; d++) frontier = frontier.flatMap((a) => land(map, a).filter((n) => !seen.has(n) && seen.add(n)));
        expect([...seen].some((a) => map.areas[a]!.resources.length > 0)).toBe(true);
      }
    }
  });

  it('places food on a minority of land, every good defined in content', () => {
    const ids = new Set(content.resources.map((r) => r.id));
    for (const map of maps) {
      const landAreas = map.areas.filter((a) => a.kind === 'land');
      const withFood = landAreas.filter((a) => a.resources.length > 0);
      expect(withFood.length / landAreas.length).toBeGreaterThan(0.05);
      expect(withFood.length / landAreas.length).toBeLessThan(0.5);
      for (const a of withFood) for (const r of a.resources) expect(ids.has(r)).toBe(true);
    }
  });
});

describe('the farming stand-in', () => {
  it('has every civilization know the advances its resources need from turn 1', () => {
    const game = newGame();
    for (const p of game.state.players) expect(p.advances.map((a) => [a.advance, a.stage, a.adoption])).toEqual([['agriculture', 'developed', 100], ['fishing', 'developed', 100]]);
  });
});

describe('manpower', () => {
  it('assigns new manpower on founding and upgrading', () => {
    const { game, grain, b, c } = scene();
    place(game, grain, 'p1', 6);
    place(game, b, 'p1', 4);
    place(game, c, 'p1', 3);
    toAllocation(game);
    play(game, { type: 'orderConversion', player: 'p1', area: grain, ordered: true });
    endPhaseAll(game);
    expect(settlementAt(game.state, grain)).toMatchObject({ tier: 'village', work: [{ resource: 'grain', count: 1 }] });
    place(game, b, 'p1', 9);
    toAllocation(game);
    play(game, { type: 'orderConversion', player: 'p1', area: grain, ordered: true });
    endPhaseAll(game);
    expect(settlementAt(game.state, grain)).toMatchObject({ tier: 'town', work: [{ resource: 'grain', count: 2 }] });
  });

  it('leaves manpower unassigned in an area without food', () => {
    const { game, barren } = scene();
    place(game, barren, 'p1', 6);
    for (const n of land(mapFor(game.setup), barren)) place(game, n, 'p1', 2);
    toAllocation(game);
    play(game, { type: 'orderConversion', player: 'p1', area: barren, ordered: true });
    endPhaseAll(game);
    expect(settlementAt(game.state, barren)).toMatchObject({ tier: 'village', work: [] });
  });

  it('takes assignments only in allocation, for the player’s own settlement, within its manpower', () => {
    const { game, grain, barren } = scene();
    settle(game, grain, 'town');
    settle(game, barren, 'village', [], 'ai1');
    const command = { type: 'assignWork' as const, player: 'p1', area: grain, resource: 'grain', count: 1 };
    toAllocation(game);
    expectRejected(game, { ...command, area: barren }, /no settlement there/);
    expectRejected(game, { ...command, resource: 'fish' }, /not in this area/);
    expectRejected(game, { ...command, count: 3 }, /Only 2 manpower free/);
    expectRejected(game, { ...command, count: 0.5 }, /whole number/);
    play(game, { ...command, count: 2 });
    expect(settlementAt(game.state, grain)!.work).toEqual([{ resource: 'grain', count: 2 }]);
    play(game, { ...command, count: 0 });
    expect(settlementAt(game.state, grain)!.work).toEqual([]);
  });

  it('refuses resources the civilization cannot gather yet', () => {
    const { game, grain } = scene();
    settle(game, grain, 'village');
    game.state.players[0]!.advances = [];
    toAllocation(game);
    expectRejected(game, { type: 'assignWork', player: 'p1', area: grain, resource: 'grain', count: 1 }, /cannot gather/);
  });

  it('drops unassigned manpower first, then the most recent assignment, when a settlement drops a tier', () => {
    const { game, grain } = scene();
    settle(game, grain, 'town', [{ resource: 'grain', count: 1 }]);
    const ctx = context(game);
    dropTier(ctx, settlementAt(ctx.state, grain)!);
    expect(settlementAt(ctx.state, grain)).toMatchObject({ tier: 'village', work: [{ resource: 'grain', count: 1 }] });
    game.state.settlements = [];
    settle(game, grain, 'city', [{ resource: 'grain', count: 3 }]);
    const ctx2 = context(game);
    dropTier(ctx2, settlementAt(ctx2.state, grain)!);
    expect(settlementAt(ctx2.state, grain)!.work).toEqual([{ resource: 'grain', count: 2 }]);
  });

  it('resets a captured settlement’s assignments for its new owner', () => {
    const { game, grain } = scene();
    settle(game, grain, 'town', [], 'ai1');
    place(game, grain, 'p1', 13);
    const ctx = context(game);
    resolveConflict(ctx);
    expect(settlementAt(ctx.state, grain)).toMatchObject({ player: 'p1', tier: 'village', work: [{ resource: 'grain', count: 1 }] });
  });
});

describe('goods', () => {
  it('are gathered in the next resources phase from standing assignments, and last one turn', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    place(game, b, 'p1', 2);
    toAllocation(game);
    expect(game.state.goods).toEqual([]);
    const events = endPhaseAll(game);
    expect(eventsOfType(events, 'goodsProduced')).toEqual([{ type: 'goodsProduced', player: 'p1', area: grain, resource: 'grain', count: 1 }]);
    expect(game.state.goods).toEqual([{ area: grain, player: 'p1', resource: 'grain', count: 1 }]);
    // Unassigned now: next turn's resources phase gathers nothing and this turn's grain is gone.
    toAllocation(game);
    play(game, { type: 'assignWork', player: 'p1', area: grain, resource: 'grain', count: 0 });
    endPhaseAll(game);
    expect(game.state.goods).toEqual([]);
  });

  it('are not gathered when the civilization cannot use the resource', () => {
    const { game, grain } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    game.state.players[0]!.advances = [];
    toAllocation(game);
    expect(eventsOfType(endPhaseAll(game), 'goodsProduced')).toEqual([]);
  });
});

describe('food as support', () => {
  it('adds 1 urban growth to a settlement that gathers food and eats its own', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    place(game, b, 'p1', 1);
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    toAllocation(game);
    const turn = game.state.turn;
    const grown = eventsOfType(endPhaseAll(game), 'urbanGrowth');
    expect(settlementAt(game.state, grain)!.ateOwn).toBe(turn);
    expect(grown).toEqual([expect.objectContaining({ player: 'p1', from: grain, count: 1 })]);
  });

  it('adds no urban growth when tokens cover the support and the food goes uneaten', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    place(game, b, 'p1', 2);
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    toAllocation(game);
    expect(eventsOfType(endPhaseAll(game), 'urbanGrowth')).toEqual([]);
    expect(settlementAt(game.state, grain)!.ateOwn).toBeUndefined();
  });

  it('covers missing support tokens, 1 food per token', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village');
    place(game, b, 'p1', 1);
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    toAllocation(game);
    const events = endPhaseAll(game);
    expect(settlementAt(game.state, grain)).toBeDefined();
    expect(eventsOfType(events, 'foodSupport')).toEqual([{ type: 'foodSupport', player: 'p1', area: grain, count: 1 }]);
  });

  it('is not enough when tokens and food together fall short', () => {
    const { game, grain } = scene();
    settle(game, grain, 'village');
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    toAllocation(game);
    endPhaseAll(game);
    expect(settlementAt(game.state, grain)).toBeUndefined();
  });

  it('comes from an adjacent settlement of the same civilization, not a farther one or a rival', () => {
    const { game, map, grain, b } = scene();
    settle(game, grain, 'village');
    place(game, b, 'p1', 1);
    const near = land(map, grain).find((n) => n !== b)!;
    const far = map.areas.find((a) => a.kind === 'land' && a.id !== grain && !map.areas[grain]!.neighbors.includes(a.id) && !a.neighbors.includes(b))!.id;
    game.state.goods = [{ area: far, player: 'p1', resource: 'grain', count: 5 }];
    expect(supportSummary(game.state, map, game.content, 'p1').settlements[0]).toMatchObject({ support: 1, food: 0 });
    game.state.goods = [{ area: near, player: 'ai1', resource: 'grain', count: 5 }];
    expect(supportSummary(game.state, map, game.content, 'p1').settlements[0]).toMatchObject({ support: 1, food: 0 });
    game.state.goods = [{ area: near, player: 'p1', resource: 'fish', count: 5 }];
    expect(supportSummary(game.state, map, game.content, 'p1').settlements[0]).toMatchObject({ support: 2, food: 1 });
  });

  it('goes to larger settlements first, after support tokens', () => {
    const { game, map, grain, b } = scene();
    settle(game, grain, 'town');
    settle(game, b, 'village');
    game.state.goods = [{ area: b, player: 'p1', resource: 'grain', count: 3 }];
    const summary = supportSummary(game.state, map, game.content, 'p1').settlements;
    expect(summary.find((s) => s.area === grain)).toMatchObject({ support: 3, food: 3 });
    expect(summary.find((s) => s.area === b)).toMatchObject({ support: 0, food: 0 });
  });
});

describe('Stone Age goods (v0.14)', () => {
  const maps = [1, 2, 3].flatMap((seed) => MAP_TYPES.map((type) => generateMap({ seed, civilizations: 5, type, room: 'standard' })));

  it('places livestock on plains and hills and copper on hills and mountains, alone in their area', () => {
    let livestock = 0;
    let copper = 0;
    for (const map of maps) {
      for (const area of map.areas) {
        if (area.resources.includes('livestock')) {
          livestock += 1;
          expect(['plains', 'hills']).toContain(area.terrain);
        }
        if (area.resources.includes('copper')) {
          copper += 1;
          expect(['hills', 'mountains']).toContain(area.terrain);
        }
        expect(area.resources.length).toBeLessThanOrEqual(1);
      }
    }
    expect(livestock).toBeGreaterThan(0);
    expect(copper).toBeGreaterThan(0);
  });

  it('adds a Mastered gathering bonus to each settlement gathering the good', () => {
    const { game, grain } = scene();
    settle(game, grain, 'town', [{ resource: 'grain', count: 2 }]);
    game.state.players[0]!.effects = [{ type: 'gatherBonus', resource: 'grain', amount: 1 }];
    const ctx = context(game);
    runResources(ctx);
    expect(ctx.state.goods).toEqual([{ area: grain, player: 'p1', resource: 'grain', count: 3 }]);
  });

  it('stores unused grain with Pottery and uses it first in the next support check', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    place(game, b, 'p1', 2);
    game.state.players[0]!.effects = [{ type: 'store', resource: 'grain', amount: 1 }];
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    const ctx = context(game);
    resolveSupport(ctx);
    expect(settlementAt(ctx.state, grain)!.stored).toBe(1);
    // Next turn: 1 support token and no grain gathered; the stored grain covers the gap.
    ctx.state.goods = [];
    place({ ...game, state: ctx.state }, b, 'p1', 1);
    resolveSupport(ctx);
    expect(settlementAt(ctx.state, grain)).toMatchObject({ tier: 'village' });
    expect(settlementAt(ctx.state, grain)!.stored).toBeUndefined();
  });

  it('does not store food that spoils', () => {
    const { game, grain, b } = scene();
    settle(game, grain, 'village', [{ resource: 'grain', count: 1 }]);
    place(game, b, 'p1', 2);
    game.state.goods = [{ area: grain, player: 'p1', resource: 'grain', count: 1 }];
    const ctx = context(game);
    resolveSupport(ctx);
    expect(settlementAt(ctx.state, grain)!.stored).toBeUndefined();
  });

  it('works cloth instead of food in grain or livestock areas', () => {
    const bundle = { ...standIn, resources: [...standIn.resources, { id: 'cloth', name: 'Cloth', food: false, price: 10, luxury: true, requires: 'agriculture', from: ['grain'] }] };
    const content = testContent(bundle);
    const { game, grain, barren } = scene();
    const session = newGame({ unlockedTiers: ['village', 'town'] }, content);
    const settlements: Settlement[] = [
      { area: grain, player: 'p1', tier: 'village', work: [] },
      { area: barren, player: 'p1', tier: 'village', work: [] },
    ];
    session.state.settlements = settlements.sort((a, b) => a.area - b.area);
    toAllocation(session);
    play(session, { type: 'assignWork', player: 'p1', area: grain, resource: 'cloth', count: 1 });
    expectRejected(session, { type: 'assignWork', player: 'p1', area: barren, resource: 'cloth', count: 1 }, /not in this area/);
    void game;
  });

  it('feeds settlements along a river with a river leg', () => {
    const { game, map } = scene();
    const river = map.rivers.find((r) => r.areas.length >= 3 && !map.areas[r.areas[0]!]!.neighbors.includes(r.areas[2]!))!;
    const [home, , far] = river.areas as [AreaId, AreaId, AreaId];
    game.state.settlements = [];
    settle(game, home, 'village');
    settle(game, far, 'village', [{ resource: 'grain', count: 1 }]);
    game.state.goods = [{ area: far, player: 'p1', resource: 'grain', count: 4 }];
    const near = land(map, home).find((n) => n !== river.areas[1] && !game.state.settlements.some((s) => s.area === n))!;
    place(game, near, 'p1', 1);
    const fed = (g: Session) => supportSummary(g.state, map, g.content, 'p1').settlements.find((s) => s.area === home)!;
    expect(fed(game)).toMatchObject({ food: 0 });
    game.state.players[0]!.effects = [{ type: 'riverLeg', areas: 3 }];
    expect(fed(game)).toMatchObject({ food: 1, support: 2 });
  });
});

describe('tax (v0.20)', () => {
  it('collects a fixed tax from towns and larger into a treasury that keeps', () => {
    // Village 0, town 1 (design doc §6, Currency, v0.29).
    const { game, grain, b, c } = scene();
    game.state.settlements = [
      { area: grain, player: 'p1', tier: 'town' },
      { area: b, player: 'p1', tier: 'village' },
      { area: c, player: 'ai1', tier: 'village' },
    ].sort((x, y) => x.area - y.area) as Settlement[];
    const ctx: Context = { state: game.state, content: testContent(), map: mapFor(game.setup), events: [], refugees: [] };
    collectTax(ctx);
    collectTax(ctx);
    expect(game.state.players.find((p) => p.id === 'p1')!.treasury).toBe(2);
    expect(game.state.players.find((p) => p.id === 'ai1')!.treasury).toBe(0);
    expect(eventsOfType(ctx.events, 'taxCollected')).toEqual([
      { type: 'taxCollected', player: 'p1', amount: 1 },
      { type: 'taxCollected', player: 'p1', amount: 1 },
    ]);
  });

  it('is collected in the resources phase', () => {
    const { game, grain, b } = scene();
    game.state.settlements = [{ area: grain, player: 'p1', tier: 'town' }];
    place(game, b, 'p1', 3);
    const before = game.state.turn;
    while (game.state.turn === before) endPhaseAll(game);
    expect(settlementAt(game.state, grain)?.tier).toBe('town');
    expect(game.state.players.find((p) => p.id === 'p1')!.treasury).toBe(1);
  });
});
