import { describe, expect, it } from 'vitest';
import { mapFor, settlementAt, type AreaId, type Context, type GameEvent, type GameMap, type Session, type Settlement, type SettlementTier } from '../src/engine';
import { resolveConflict } from '../src/engine/conflict';
import { resolveDiscovery } from '../src/engine/discovery';
import { landDistances, resolveInstability, runBureaucracy, threshold, updateCapitals } from '../src/engine/instability';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

const land = (map: GameMap, area: AreaId) => map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land').sort((a, b) => a - b);

function scene() {
  const game = newGame({ unlockedTiers: ['village', 'town'] });
  const map = mapFor(game.setup);
  game.state.stacks = [];
  game.state.settlements = [];
  const home = map.areas.find((a) => a.kind === 'land' && land(map, a.id).length >= 2)!.id;
  return { game, map, home };
}

function settle(game: Session, area: AreaId, tier: SettlementTier, extra: Partial<Settlement> = {}, player = 'p1'): void {
  game.state.settlements.push({ area, player, tier, work: [], ...extra });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

// A resolution context with these events already emitted this turn.
function context(game: Session, events: GameEvent[] = []): Context {
  const state = JSON.parse(JSON.stringify(game.state));
  return { state, content: testContent(), map: mapFor(game.setup), events: events.map((event) => ({ turn: 1, phase: 'resolution', event })), refugees: [] };
}

const civ = (ctx: Context, player = 'p1') => ctx.state.players.find((p) => p.id === player)!.instability;

describe('instability sources', () => {
  it('raises the civ-wide meter by 1 per settlement beyond 6', () => {
    const { game, map } = scene();
    const areas = map.areas.filter((a) => a.kind === 'land').slice(0, 8);
    for (const a of areas) settle(game, a.id, 'village');
    const ctx = context(game);
    resolveInstability(ctx);
    expect(civ(ctx)).toBe(2);
    expect(eventsOfType(ctx.events, 'instabilityChanged')).toContainEqual({ type: 'instabilityChanged', player: 'p1', area: null, amount: 2, source: 'overextension' });
  });

  it('counts tiers lost to support failure and capture civ-wide, and lost support locally', () => {
    const { game, home } = scene();
    settle(game, home, 'village');
    const ctx = context(game, [
      { type: 'resolutionStep', step: 'conflict' },
      { type: 'settlementAttacked', area: 999, defender: 'p1', tier: 'town', attackers: [{ player: 'ai1', count: 12 }], repelled: [], losses: [], capturedBy: 'ai1', survivors: 3, spoils: 0 },
      { type: 'resolutionStep', step: 'support' },
      { type: 'settlementDropped', player: 'p1', area: home, tier: 'village', refugees: 6, lost: 0 },
      { type: 'resolutionStep', step: 'instability' },
    ]);
    resolveInstability(ctx);
    expect(civ(ctx)).toBe(3);
    expect(settlementAt(ctx.state, home)!.instability).toBe(2);
  });

  it('raises the local meter by 1 where the civilization lost tokens in or next to the settlement', () => {
    const { game, map, home } = scene();
    const [n] = land(map, home);
    const far = map.areas.find((a) => a.kind === 'land' && a.id !== home && !map.areas[home]!.neighbors.includes(a.id))!.id;
    settle(game, home, 'village');
    settle(game, far, 'village', {}, 'ai1');
    const ctx = context(game, [{ type: 'resolutionStep', step: 'conflict' }, { type: 'conflict', area: n!, losses: [{ player: 'p1', count: 1 }, { player: 'ai1', count: 2 }] }]);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)!.instability).toBe(1);
    expect(settlementAt(ctx.state, far)!.instability ?? 0).toBe(0);
  });

  it('adds nothing for a fight next to it with no friendly losses', () => {
    const { game, map, home } = scene();
    const [n] = land(map, home);
    settle(game, home, 'village');
    const ctx = context(game, [{ type: 'resolutionStep', step: 'conflict' }, { type: 'conflict', area: n!, losses: [{ player: 'ai1', count: 2 }, { player: 'ai2', count: 1 }] }]);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)!.instability ?? 0).toBe(0);
  });

  it('raises the local meter by 3 when the settlement itself is attacked, held or not, and not also by 1', () => {
    const { game, map, home } = scene();
    const [n] = land(map, home);
    settle(game, home, 'village');
    const ctx = context(game, [
      { type: 'resolutionStep', step: 'conflict' },
      { type: 'settlementAttacked', area: home, defender: 'p1', tier: 'village', attackers: [{ player: 'ai1', count: 5 }], repelled: ['ai1'], losses: [{ player: 'ai1', count: 5 }], capturedBy: null, survivors: 0, spoils: 0 },
      { type: 'conflict', area: n!, losses: [{ player: 'p1', count: 1 }] },
    ]);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)!.instability).toBe(3);
  });
});

describe('collapse', () => {
  it('drops a settlement at its threshold one tier and halves its local meter', () => {
    const { game, home } = scene();
    settle(game, home, 'town', { instability: 7 });
    game.state.players[0]!.instability = 3;
    const ctx = context(game);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)).toMatchObject({ tier: 'village', instability: 3 });
    expect(eventsOfType(ctx.events, 'settlementCollapsed')).toEqual([{ type: 'settlementCollapsed', player: 'p1', area: home, tier: 'town' }]);
    expect(eventsOfType(ctx.events, 'settlementDropped')).toHaveLength(1);
    // A collapse is not counted as a loss.
    expect(civ(ctx)).toBe(3);
  });

  it('resets the civ-wide meter when a civilization has no settlements left', () => {
    const { game, home } = scene();
    settle(game, home, 'village');
    game.state.players[0]!.instability = 12;
    const ctx = context(game);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)).toBeUndefined();
    expect(civ(ctx)).toBe(0);
    expect(eventsOfType(ctx.events, 'instabilityChanged').at(-1)).toEqual({ type: 'instabilityChanged', player: 'p1', area: null, amount: -12, source: 'noSettlements' });
  });

  it('uses thresholds that rise with tier', () => {
    const { game, map, home } = scene();
    const [n] = land(map, home);
    settle(game, home, 'town');
    settle(game, n!, 'village');
    game.state.players[0]!.instability = 8;
    const ctx = context(game);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, home)!.tier).toBe('town');
    expect(settlementAt(ctx.state, n!)).toBeUndefined();
  });
});

describe('the capital', () => {
  it('is the first settlement, and moves to the largest remaining one nearest the old capital when lost', () => {
    const { game, map, home } = scene();
    settle(game, home, 'village');
    const ctx = context(game);
    updateCapitals(ctx);
    expect(ctx.state.players[0]!.capital).toBe(home);
    const dist = landDistances(map, home);
    const byDistance = [...dist].filter(([a, d]) => d >= 2 && map.areas[a]!.kind === 'land').sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const near = byDistance[0]![0];
    const far = byDistance[byDistance.length - 1]![0];
    const villages: Settlement[] = [
      { area: near, player: 'p1', tier: 'village', work: [] },
      { area: far, player: 'p1', tier: 'village', work: [] },
    ];
    ctx.state.settlements = villages.sort((a, b) => a.area - b.area);
    updateCapitals(ctx);
    expect(ctx.state.players[0]!.capital).toBe(near);
    ctx.state.settlements.find((s) => s.area === far)!.tier = 'town';
    ctx.state.players[0]!.capital = home;
    updateCapitals(ctx);
    expect(ctx.state.players[0]!.capital).toBe(far);
    expect(eventsOfType(ctx.events, 'capitalMoved').map((e) => e.area)).toEqual([home, near, far]);
    ctx.state.settlements = [];
    updateCapitals(ctx);
    expect(ctx.state.players[0]!.capital).toBeNull();
  });

  it('lowers the threshold of distant settlements, 1 per 2 land moves beyond 2, by at most 4', () => {
    const { game, map, home } = scene();
    game.state.players[0]!.capital = home;
    const dist = landDistances(map, home);
    const at = (d: number) => [...dist].find(([, x]) => x === d)?.[0];
    const expected: [number, number, number][] = [[0, 8, 10], [2, 8, 10], [3, 7, 9], [4, 7, 9], [5, 6, 8], [7, 5, 7], [9, 4, 6], [12, 4, 6]];
    for (const [d, village, town] of expected) {
      const area = at(d);
      if (area === undefined) continue;
      expect(threshold(game.state, map, { area, player: 'p1', tier: 'village' })).toBe(village);
      expect(threshold(game.state, map, { area, player: 'p1', tier: 'town' })).toBe(town);
    }
    const unreachable = map.areas.find((a) => a.kind === 'land' && !dist.has(a.id));
    if (unreachable) expect(threshold(game.state, map, { area: unreachable.id, player: 'p1', tier: 'city' })).toBe(8);
  });

  it('collapses the far edge first', () => {
    const { game, map, home } = scene();
    const dist = landDistances(map, home);
    const far = [...dist].find(([, d]) => d === 6)![0];
    settle(game, home, 'village');
    settle(game, far, 'village');
    game.state.players[0]!.capital = home;
    game.state.players[0]!.instability = 6;
    const ctx = context(game);
    resolveInstability(ctx);
    expect(settlementAt(ctx.state, far)).toBeUndefined();
    expect(settlementAt(ctx.state, home)).toBeDefined();
    expect(civ(ctx)).toBe(6);
  });

  it('has one free Bureaucracy unit', () => {
    const { game, home } = scene();
    settle(game, home, 'village', { instability: 2 });
    game.state.players[0]!.capital = home;
    const ctx = context(game);
    runBureaucracy(ctx);
    expect(settlementAt(ctx.state, home)!.instability).toBe(1);
  });
});

describe('bureaucracy', () => {
  it('lowers its own settlement first, then the civ-wide meter, never below 0', () => {
    const { game, map, home } = scene();
    const [n] = land(map, home);
    settle(game, home, 'city', { instability: 1, work: [{ resource: 'bureaucracy', count: 3 }] });
    settle(game, n!, 'village', { work: [{ resource: 'bureaucracy', count: 1 }] });
    game.state.players[0]!.instability = 1;
    const ctx = context(game);
    runBureaucracy(ctx);
    expect(settlementAt(ctx.state, home)!.instability).toBe(0);
    expect(civ(ctx)).toBe(0);
  });

  it('is assigned like a resource, in any area, within manpower', () => {
    const { game, home } = scene();
    settle(game, home, 'town');
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    play(game, { type: 'assignWork', player: 'p1', area: home, resource: 'bureaucracy', count: 2 });
    expect(settlementAt(game.state, home)!.work).toEqual([{ resource: 'bureaucracy', count: 2 }]);
    expectRejected(game, { type: 'assignWork', player: 'p1', area: home, resource: 'bureaucracy', count: 3 }, /Only 2 manpower free/);
  });

  it('works in the next resources phase', () => {
    const { game, map, home } = scene();
    for (const n of land(map, home)) game.state.stacks.push({ area: n, player: 'p1', count: 1 });
    game.state.stacks.sort((a, b) => a.area - b.area);
    settle(game, home, 'village', { work: [{ resource: 'bureaucracy', count: 1 }] });
    game.state.players[0]!.instability = 3;
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    const events = endPhaseAll(game);
    // The village became the capital at resolution, so its free unit works alongside the assigned one.
    expect(game.state.players[0]!.capital).toBe(home);
    expect(eventsOfType(events, 'instabilityChanged')).toContainEqual({ type: 'instabilityChanged', player: 'p1', area: null, amount: -2, source: 'bureaucracy' });
    expect(game.state.players[0]!.instability).toBe(1);
  });
});

describe('capture', () => {
  it('starts the captured settlement’s local meter over for its new owner', () => {
    const { game, home } = scene();
    settle(game, home, 'town', { instability: 5 }, 'ai1');
    game.state.stacks.push({ area: home, player: 'p1', count: 13 });
    const ctx = context(game);
    resolveConflict(ctx);
    expect(settlementAt(ctx.state, home)).toMatchObject({ player: 'p1', tier: 'village' });
    expect(settlementAt(ctx.state, home)!.instability).toBeUndefined();
  });
});

describe('advances and luxuries (v0.14)', () => {
  it('calms the civ-wide meter each turn with Ritual-like effects', () => {
    const { game, home } = scene();
    settle(game, home, 'village');
    game.state.players[0]!.instability = 3;
    game.state.players[0]!.effects = [{ type: 'calm', amount: 2 }];
    const ctx = context(game);
    runBureaucracy(ctx);
    expect(civ(ctx)).toBe(1);
    expect(eventsOfType(ctx.events, 'instabilityChanged')).toContainEqual({ type: 'instabilityChanged', player: 'p1', area: null, amount: -2, source: 'calm' });
  });

  it('shifts the capital-distance penalty with Tallies-like reach', () => {
    const { game, map, home } = scene();
    settle(game, home, 'village');
    updateCapitals(context(game));
    game.state.players[0]!.capital = home;
    const dist = landDistances(map, home);
    const far = [...dist].find(([, d]) => d === 6)![0];
    const village = { area: far, player: 'p1', tier: 'village' as const };
    expect(threshold(game.state, map, village)).toBe(6);
    game.state.players[0]!.effects = [{ type: 'capitalReach', amount: 2 }];
    expect(threshold(game.state, map, village)).toBe(7);
    game.state.players[0]!.effects = [{ type: 'capitalReach', amount: 2 }, { type: 'capitalReach', amount: 2 }];
    expect(threshold(game.state, map, village)).toBe(8);
  });

  it('counts a stretch along a river as one move with a river leg', () => {
    const { map } = scene();
    const river = map.rivers.find((r) => r.areas.length >= 3)!;
    const [source, , third] = river.areas;
    expect(landDistances(map, source!, 3).get(third!)).toBe(1);
    expect(landDistances(map, source!).get(third!)).toBeGreaterThanOrEqual(1);
  });

  it('uses luxuries on the settlements nearest collapse, one each, the rest civ-wide', () => {
    const { game, map, home } = scene();
    const [b, c] = land(map, home);
    settle(game, home, 'village', { instability: 1 });
    settle(game, b!, 'village', { instability: 5 });
    settle(game, c!, 'village', { instability: 0 });
    game.state.players[0]!.capital = home;
    game.state.players[0]!.instability = 2;
    game.state.goods = [{ area: home, player: 'p1', resource: 'copper', count: 4 }];
    const content = testContent({ ...standIn, advances: standIn.advances, resources: [...standIn.resources, { id: 'copper', name: 'Copper', food: false, price: 10, luxury: true, requires: 'agriculture' }] });
    const ctx = { ...context(game), content };
    resolveInstability(ctx);
    const local = (area: AreaId) => settlementAt(ctx.state, area)!.instability ?? 0;
    // b (5 + 2 of 8) first, then home (1 + 2), then c (0 local: its luxury comes off the civ-wide meter), then 1 more civ-wide.
    expect([local(b!), local(home), local(c!)]).toEqual([4, 0, 0]);
    expect(civ(ctx)).toBe(0);
    expect(ctx.state.goods).toEqual([]);
  });
});

describe('rapid change (v0.25)', () => {
  it('adds 1 civ-wide per advance step beyond 2 reached in one turn', () => {
    const quick = (id: string) => ({ id, name: id, era: 'stone' as const, domain: 'crafts' as const, known: { cost: 1, inputs: [{ per: 'turn' as const, amount: 1 }] }, developed: { cost: 99, inputs: [] }, effects: [] });
    const content = testContent({ ...standIn, advances: [...standIn.advances, quick('a'), quick('b'), quick('c'), quick('d')] });
    const game = newGame({}, content);
    const ctx: Context = { state: JSON.parse(JSON.stringify(game.state)), content, map: mapFor(game.setup), events: [], refugees: [] };
    resolveDiscovery(ctx);
    expect(ctx.state.players[0]!.instability).toBe(2);
    expect(eventsOfType(ctx.events, 'instabilityChanged')).toContainEqual({ type: 'instabilityChanged', player: 'p1', area: null, amount: 2, source: 'rapidChange' });
  });
});
