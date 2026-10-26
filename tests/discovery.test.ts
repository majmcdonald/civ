import { describe, expect, it } from 'vitest';
import { content as stoneAge } from '../src/content';
import type { ContentBundle } from '../src/content/types';
import { mapFor, settlementAt, type AreaId, type Context, type Session, type Settlement, type SettlementTier } from '../src/engine';
import { conditionMet, discoveryView, firstRing, inputCount, learningPlan, refreshEffects, resolveDiscovery, stageOf } from '../src/engine/discovery';
import { strength } from '../src/engine/effects';
import { revealed, usable } from '../src/engine/resources';
import { advanceTurns, endPhaseAll, eventsOfType, expectRejected, newGame, play, testContent } from './harness';

// Test-only advances; the game's own are designed one at a time (Phase 4 step 2).
const bundle: ContentBundle = {
  eras: [
    { id: 'stone', name: 'Stone Age', order: 0, points: { developed: 1, mastered: 3, culture: 1 } },
    { id: 'iron', name: 'Iron Age', order: 2 },
  ],
  advances: [
    { id: 'fire', name: 'Fire', era: 'stone', domain: 'crafts', baseline: true, effects: [] },
    {
      id: 'settle',
      name: 'Permanent Settlement',
      era: 'stone',
      domain: 'land',
      plausible: [{ type: 'knows', advance: 'fire', stage: 'developed' }],
      known: { cost: 4, inputs: [{ per: 'area', amount: 1, where: { full: true } }] },
      developed: { cost: 3, inputs: [{ per: 'turn', amount: 1 }] },
      effects: [{ type: 'unlockTier', tier: 'town' }],
    },
    {
      id: 'pottery',
      name: 'Pottery',
      era: 'stone',
      domain: 'crafts',
      plausible: [{ type: 'knows', advance: 'settle', stage: 'known' }],
      known: { cost: 10, inputs: [{ per: 'turn', amount: 1 }] },
      developed: { cost: 10, inputs: [{ per: 'turn', amount: 1 }] },
      adoption: { inputs: [{ per: 'settlement', amount: 25 }] },
      effects: [],
    },
    {
      id: 'mysticism',
      name: 'Mysticism',
      era: 'stone',
      domain: 'beliefs',
      plausible: [{ type: 'settlements', min: 1 }],
      known: { cost: 10, inputs: [] },
      developed: { cost: 10, inputs: [] },
      effects: [],
    },
    {
      id: 'farming',
      name: 'Farming',
      era: 'stone',
      domain: 'land',
      plausible: [{ type: 'presence', where: { resource: 'grain' } }],
      known: { cost: 2, inputs: [{ per: 'area', amount: 1, where: { resource: 'grain' } }] },
      developed: { cost: 2, inputs: [{ per: 'worker', amount: 1, resource: 'grain' }, { per: 'turn', amount: 1 }] },
      effects: [],
    },
  ],
  resources: [{ id: 'grain', name: 'Grain', food: true, price: 5, requires: 'farming' }],
  calamities: [],
};

const content = testContent(bundle);

function scene(setup = {}) {
  const game = newGame(setup, content);
  const map = mapFor(game.setup);
  game.state.stacks = [];
  return { game, map };
}

function context(game: Session): Context {
  return { state: JSON.parse(JSON.stringify(game.state)), content, map: mapFor(game.setup), events: [], refugees: [] };
}

function settle(game: Session, area: AreaId, tier: SettlementTier = 'village', work: { resource: string; count: number }[] = []): void {
  game.state.settlements.push({ area, player: 'p1', tier, work });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

function know(game: Session, advance: string, stage: 'none' | 'known' | 'developed', progress = 0, adoption = 0): void {
  const p = game.state.players[0]!;
  p.advances = [...p.advances.filter((a) => a.advance !== advance), { advance, stage, progress, adoption }];
}

const view = (ctx: Pick<Context, 'state' | 'map'>, advance: string) => discoveryView(ctx.state, ctx.map, content, 'p1').find((v) => v.advance.id === advance)!;
const land = (game: Session) => mapFor(game.setup).areas.filter((a) => a.kind === 'land');

describe('starting knowledge', () => {
  it('grants the baseline Developed and Mastered, and nothing else', () => {
    const { game } = scene();
    for (const p of game.state.players) expect(p.advances).toEqual([{ advance: 'fire', stage: 'developed', progress: 0, adoption: 100 }]);
  });

  it('with Advanced start, gives each civilization 2 first-ring advances of its own from the seed', () => {
    expect(firstRing(content).map((a) => a.id)).toEqual(['settle', 'mysticism', 'farming']);
    const a = newGame({ advancedStart: true }, content);
    const b = newGame({ advancedStart: true }, content);
    expect(a.state.players).toEqual(b.state.players);
    for (const p of a.state.players) {
      const drawn = p.advances.filter((x) => x.advance !== 'fire');
      expect(drawn).toHaveLength(2);
      for (const x of drawn) expect(x).toMatchObject({ stage: 'developed', adoption: 100 });
      for (const x of drawn) expect(['settle', 'mysticism', 'farming']).toContain(x.advance);
    }
    const draws = a.log.filter((l) => l.kind === 'event' && (l.data as { type: string }).type === 'randomDraw');
    expect(draws).toHaveLength(4);
  });
});

describe('accumulators', () => {
  it('reach Known exactly when usage reaches its cost, with no learning needed', () => {
    const { game } = scene();
    const full = land(game).find((a) => a.limit === 2)!;
    game.state.stacks = [{ area: full.id, player: 'p1', count: 2 }];
    const ctx = context(game);
    expect(view(ctx, 'settle')).toMatchObject({ next: 'known', usageRate: 1, cost: 4, learning: 0, turns: 4 });
    for (let t = 0; t < 3; t++) resolveDiscovery(ctx);
    expect(stageOf(ctx.state, 'p1', 'settle')).toBe('none');
    resolveDiscovery(ctx);
    expect(stageOf(ctx.state, 'p1', 'settle')).toBe('known');
    expect(eventsOfType(ctx.events, 'advanceReached')).toEqual([{ type: 'advanceReached', player: 'p1', advance: 'settle', stage: 'known' }]);
    expect(view(ctx, 'settle')).toMatchObject({ next: 'developed', progress: 0, cost: 3, usageRate: 1, turns: 3 });
    // Pottery became plausible with Settlement known.
    expect(view(ctx, 'pottery').plausible).toBe(true);
  });

  it('pause while conditions lapse, keeping their progress', () => {
    const { game, map } = scene();
    const grain = map.areas.find((a) => a.resources.includes('grain'))!.id;
    game.state.stacks = [{ area: grain, player: 'p1', count: 1 }];
    know(game, 'farming', 'none', 1);
    const ctx = context(game);
    ctx.state.stacks = [];
    resolveDiscovery(ctx);
    expect(view(ctx, 'farming')).toMatchObject({ plausible: false, progress: 1, usageRate: 0, turns: null });
  });

  it('apply the advance’s effects when Developed', () => {
    const { game } = scene();
    know(game, 'settle', 'known', 2);
    const ctx = context(game);
    expect(ctx.state.players[0]!.tiers).not.toContain('town');
    resolveDiscovery(ctx);
    expect(stageOf(ctx.state, 'p1', 'settle')).toBe('developed');
    expect(ctx.state.players[0]!.tiers).toContain('town');
    // No adoption rules: Mastered on Developed.
    expect(eventsOfType(ctx.events, 'advanceReached').map((e) => e.stage)).toEqual(['developed', 'mastered']);
  });
});

describe('learning and the study queue', () => {
  it('speeds the queue in order, 2 progress per learning, taking only what usage leaves', () => {
    const { game } = scene();
    const [a] = land(game);
    settle(game, a!.id, 'town', [{ resource: 'highLearning', count: 2 }]);
    know(game, 'settle', 'known');
    know(game, 'pottery', 'known');
    game.state.players[0]!.study = ['settle', 'pottery'];
    const ctx = context(game);
    expect(learningPlan(ctx.state, ctx.map, content, 'p1')).toMatchObject({ pool: 2, queued: 2, split: 0, unused: 0 });
    // Settlement needs 2 beyond its +1 usage: 1 learning. The other goes on to Pottery.
    expect(view(ctx, 'settle')).toMatchObject({ learning: 1, learningRate: 2, rate: 3, turns: 1 });
    expect(view(ctx, 'pottery')).toMatchObject({ learning: 1, learningRate: 2, rate: 3, turns: 4, queued: 2 });
    expect(view(ctx, 'mysticism').learning).toBe(0);
    resolveDiscovery(ctx);
    expect(stageOf(ctx.state, 'p1', 'settle')).toBe('developed');
    expect(ctx.state.players[0]!.study).toEqual(['pottery']);
  });

  it('splits evenly with an empty queue, passing on what small needs cannot use, and warns', () => {
    const { game } = scene();
    const [a] = land(game);
    settle(game, a!.id, 'town', [{ resource: 'highLearning', count: 3 }]);
    know(game, 'settle', 'known', 1.5);
    know(game, 'pottery', 'known');
    const ctx = context(game);
    // Settlement needs 0.25 of its share of 1; Pottery (Developed) and Mysticism (Known) split the rest.
    expect(view(ctx, 'settle').learning).toBe(0.25);
    expect(view(ctx, 'pottery').learning).toBe(1.375);
    expect(view(ctx, 'mysticism').learning).toBe(1.375);
    resolveDiscovery(ctx);
    expect(eventsOfType(ctx.events, 'studyQueueEmpty')).toEqual([{ type: 'studyQueueEmpty', player: 'p1', learning: 3 }]);
  });

  it('skips implausible entries and drops finished ones', () => {
    const { game } = scene();
    know(game, 'settle', 'known', 2);
    game.state.players[0]!.study = ['farming', 'settle'];
    const ctx = context(game);
    expect(view(ctx, 'farming')).toMatchObject({ plausible: false, learning: 0 });
    resolveDiscovery(ctx);
    expect(stageOf(ctx.state, 'p1', 'settle')).toBe('developed');
    expect(ctx.state.players[0]!.study).toEqual(['farming']);
  });

  it('is set in allocation, without repeats, finished, or implausible advances; High Learning is assigned like Bureaucracy', () => {
    const { game } = scene();
    const [a] = land(game);
    settle(game, a!.id, 'town');
    know(game, 'settle', 'known');
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    play(game, { type: 'assignWork', player: 'p1', area: a!.id, resource: 'highLearning', count: 2 }, { type: 'setStudy', player: 'p1', queue: ['pottery', 'settle'] });
    expect(settlementAt(game.state, a!.id)!.work).toEqual([{ resource: 'highLearning', count: 2 }]);
    expect(game.state.players[0]!.study).toEqual(['pottery', 'settle']);
    expectRejected(game, { type: 'setStudy', player: 'p1', queue: ['pottery', 'pottery'] }, /twice/);
    expectRejected(game, { type: 'setStudy', player: 'p1', queue: ['fire'] }, /no more learning/);
    expectRejected(game, { type: 'setStudy', player: 'p1', queue: ['pottery', 'farming'] }, /not plausible/);
    // An entry queued while plausible can stay after it stops being plausible.
    game.state.players[0]!.study = ['farming'];
    play(game, { type: 'setStudy', player: 'p1', queue: ['pottery', 'farming'] });
    play(game, { type: 'setStudy', player: 'p1', queue: [] });
    expect(game.state.players[0]!.study).toEqual([]);
  });
});

describe('adoption', () => {
  it('masters at 200 points from usage and 10 per learning, and never falls', () => {
    const { game } = scene();
    const [a] = land(game);
    settle(game, a!.id, 'town', [{ resource: 'highLearning', count: 2 }]);
    know(game, 'settle', 'developed', 0, 100);
    know(game, 'pottery', 'developed');
    game.state.players[0]!.study = ['pottery'];
    const ctx = context(game);
    // +25 usage and +20 from 2 learning a turn toward 200.
    expect(view(ctx, 'pottery')).toMatchObject({ next: 'mastered', cost: 200, usageRate: 25, learning: 2, learningRate: 20, turns: 5 });
    resolveDiscovery(ctx);
    expect(view(ctx, 'pottery')).toMatchObject({ adoption: 22.5, progress: 45 });
    for (let t = 0; t < 4; t++) resolveDiscovery(ctx);
    expect(view(ctx, 'pottery')).toMatchObject({ adoption: 100, next: null });
    expect(eventsOfType(ctx.events, 'advanceReached')).toContainEqual({ type: 'advanceReached', player: 'p1', advance: 'pottery', stage: 'mastered' });
    ctx.state.settlements = [];
    resolveDiscovery(ctx);
    expect(view(ctx, 'pottery')).toMatchObject({ stage: 'developed', adoption: 100 });
  });
});

describe('resources', () => {
  it('are revealed when their advance is Known and usable when it is Developed', () => {
    const { game } = scene();
    expect([revealed(game.state, content, 'p1', 'grain'), usable(game.state, content, 'p1', 'grain')]).toEqual([false, false]);
    know(game, 'farming', 'known');
    expect([revealed(game.state, content, 'p1', 'grain'), usable(game.state, content, 'p1', 'grain')]).toEqual([true, false]);
    know(game, 'farming', 'developed');
    expect([revealed(game.state, content, 'p1', 'grain'), usable(game.state, content, 'p1', 'grain')]).toEqual([true, true]);
  });

  it('count their workers toward an advance', () => {
    const { game, map } = scene();
    const grain = map.areas.find((a) => a.resources.includes('grain'))!.id;
    settle(game, grain, 'town', [{ resource: 'grain', count: 2 }]);
    know(game, 'farming', 'known');
    expect(view(context(game), 'farming').usageRate).toBe(3);
  });
});

describe('resolution', () => {
  it('runs in resolution step 10 of every turn', () => {
    const { game } = scene();
    const full = land(game).find((a) => a.limit === 1)!;
    game.state.stacks = [{ area: full.id, player: 'p1', count: 1 }];
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    const events = endPhaseAll(game);
    const steps = eventsOfType(events, 'resolutionStep').map((e) => e.step);
    expect(steps.indexOf('discovery')).toBe(9);
    expect(game.state.players[0]!.advances.find((a) => a.advance === 'settle')).toMatchObject({ stage: 'none', progress: 1 });
  });
});

describe('the Stone Age content (v0.14)', () => {
  const stone = testContent(stoneAge);
  const game = () => newGame({ unlockedTiers: [] }, stone);
  const ctxOf = (g: Session): Context => ({ state: JSON.parse(JSON.stringify(g.state)), content: stone, map: mapFor(g.setup), events: [], refugees: [] });

  it('starts with the baseline, no settlement tiers, and grain and fish shown but not gatherable', () => {
    const g = game();
    const p = g.state.players[0]!;
    expect(p.advances.map((a) => a.advance)).toEqual(['fire', 'stoneTools', 'foraging']);
    expect(p.tiers).toEqual([]);
    expect([revealed(g.state, stone, 'p1', 'grain'), usable(g.state, stone, 'p1', 'grain')]).toEqual([true, false]);
    expect(revealed(g.state, stone, 'p1', 'livestock')).toBe(false);
  });

  it('has Permanent Settlement, Fishing, Archery, and Dugout Canoes as the first ring', () => {
    expect(firstRing(stone).map((a) => a.id)).toEqual(['permanentSettlement', 'fishing', 'archery', 'dugoutCanoes']);
  });

  it('masters Archery through conflicts fought: +0.25 strength Developed, +0.5 Mastered', () => {
    const g = game();
    const ctx = ctxOf(g);
    const p = ctx.state.players[0]!;
    // 180 of 200 adoption points.
    p.advances.push({ advance: 'archery', stage: 'developed', progress: 0, adoption: 90 });
    refreshEffects(ctx.state, stone, p);
    expect(strength(ctx.state, 'p1')).toBe(1.25);
    expect(strength(ctx.state, 'p1', 'ai1')).toBe(1.25);
    p.fought = { turn: ctx.state.turn, count: 1 };
    resolveDiscovery(ctx);
    expect(p.advances.find((a) => a.advance === 'archery')!.adoption).toBe(100);
    expect(strength(ctx.state, 'p1')).toBe(1.5);
    ctx.state.players[1]!.advances.push({ advance: 'palisades', stage: 'developed', progress: 0, adoption: 100 });
    expect(strength(ctx.state, 'p1', 'ai1')).toBe(1);
    delete p.fought;
    resolveDiscovery(ctx);
    expect(p.advances.find((a) => a.advance === 'archery')!.adoption).toBe(100);
    expect(strength(ctx.state, 'p1')).toBe(1.5);
  });

  it('unlocks villages with Permanent Settlement by turn 7 at the latest', () => {
    const g = game();
    advanceTurns(g, 7);
    for (const p of g.state.players) {
      expect(p.advances.find((a) => a.advance === 'permanentSettlement')?.stage).toBe('developed');
      expect(p.tiers).toEqual(['village']);
    }
  });

  it('keeps Mastered effects for good: adoption never falls', () => {
    const g = game();
    const p = g.state.players[0]!;
    p.advances.push({ advance: 'permanentSettlement', stage: 'developed', progress: 0, adoption: 100 }, { advance: 'agriculture', stage: 'developed', progress: 0, adoption: 100 });
    refreshEffects(g.state, stone, p);
    expect(p.tokenCap).toBe(60);
    expect(p.effects).toContainEqual({ type: 'gatherBonus', resource: 'grain', amount: 1 });
    const ctx = ctxOf(g);
    resolveDiscovery(ctx);
    const after = ctx.state.players[0]!;
    expect(after.advances.find((a) => a.advance === 'agriculture')!.adoption).toBe(100);
    expect(after.tokenCap).toBe(60);
    expect(after.effects).toContainEqual({ type: 'gatherBonus', resource: 'grain', amount: 1 });
  });

  it('counts contact, kinds of goods, attacks, gatherers, and distance from the capital', () => {
    const g = game();
    const map = mapFor(g.setup);
    g.state.stacks = [];
    const [a, b] = map.areas.filter((x) => x.kind === 'land' && x.neighbors.some((n) => map.areas[n]!.kind === 'land'));
    const next = map.areas[a!.id]!.neighbors.find((n) => map.areas[n]!.kind === 'land')!;
    const settlements: Settlement[] = [
      { area: a!.id, player: 'p1', tier: 'village', work: [{ resource: 'grain', count: 1 }], attacked: g.state.turn },
      { area: b!.id, player: 'p1', tier: 'village', work: [{ resource: 'copper', count: 1 }] },
    ];
    g.state.settlements = settlements.sort((x, y) => x.area - y.area);
    g.state.stacks = [{ area: next, player: 'ai1', count: 1 }];
    g.state.players[0]!.capital = a!.id;
    const count = (input: Parameters<typeof inputCount>[4]) => inputCount(g.state, map, stone, 'p1', input);
    expect(count({ per: 'rival', amount: 1 })).toBe(1);
    expect(count({ per: 'settlement', amount: 1, contact: true })).toBe(1);
    expect(count({ per: 'goodKind', amount: 1 })).toBe(2);
    expect(count({ per: 'attacked', amount: 3 })).toBe(1);
    expect(count({ per: 'fought', amount: 20 })).toBe(0);
    g.state.players[0]!.fought = { turn: g.state.turn, count: 2 };
    expect(count({ per: 'fought', amount: 20 })).toBe(2);
    g.state.players[0]!.fought = { turn: g.state.turn - 1, count: 2 };
    expect(count({ per: 'fought', amount: 20 })).toBe(0);
    expect(count({ per: 'settlement', amount: 1, gathering: 'food' })).toBe(1);
    expect(count({ per: 'settlement', amount: 1, gathering: 'any' })).toBe(2);
    expect(count({ per: 'settlement', amount: 1, beyond: 0 })).toBe(1);
    expect(count({ per: 'struck', amount: 3, calamity: 'superstition' })).toBe(0);
    expect(conditionMet(g.state, map, stone, 'p1', { type: 'contact' })).toBe(true);
    expect(conditionMet(g.state, map, stone, 'p1', { type: 'gathering', what: ['cloth'] })).toBe(false);
  });
});
