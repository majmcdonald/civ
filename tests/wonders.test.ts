import { describe, expect, it } from 'vitest';
import { content as stoneAge } from '../src/content';
import type { ContentBundle, Wonder } from '../src/content/types';
import {
  calm,
  consolation,
  cultureSources,
  goodsHeld,
  learningPool,
  learningSources,
  loadContent,
  manpower,
  mapFor,
  movedTurns,
  raidImmune,
  scoreOf,
  settlementAt,
  wonderViews,
  workable,
  type AreaId,
  type Content,
  type Context,
  type Session,
  type SettlementTier,
} from '../src/engine';
import { resolveConflict } from '../src/engine/conflict';
import { runArtists } from '../src/engine/eras';
import { resolveInstability } from '../src/engine/instability';
import { runResources } from '../src/engine/resources';
import { resolveSupport } from '../src/engine/settlements';
import { checkSites, recordLabour, resolveWonders, WONDER } from '../src/engine/wonders';
import { eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

const wonder = (id: string, rest: Partial<Wonder>): Wonder => ({ id, name: id, era: 'stone', requires: ['agriculture'], turns: 2, manpower: 1, goods: [], effects: [], summary: id, ...rest });

// Stand-in wonders: costs and effects chosen to make each rule visible.
const bundle: ContentBundle = {
  ...standIn,
  advances: [...standIn.advances, { id: 'rite', name: 'Rite', era: 'stone', domain: 'beliefs', known: { cost: 99, inputs: [] }, developed: { cost: 99, inputs: [] }, effects: [] }],
  resources: [
    ...standIn.resources,
    { id: 'stone', name: 'Stone', food: false, price: 5, durable: true, requires: 'agriculture', terrain: ['hills', 'mountains'] },
    { id: 'copper', name: 'Copper', food: false, price: 10, luxury: true, durable: true, requires: 'agriculture' },
  ],
  wonders: [
    wonder('tepe', { turns: 4, manpower: 2, goods: [{ resource: 'stone', count: 1 }, { resource: 'food', count: 1 }], effects: [{ type: 'calm', amount: 1 }] }),
    wonder('huts', { goods: [{ resource: 'food', count: 1 }], effects: [{ type: 'manpower', amount: 1 }] }),
    wonder('henge', { requires: ['rite'], turns: 8, effects: [{ type: 'learning', amount: 2 }] }),
    wonder('mound', { effects: [{ type: 'culture', amount: 2 }] }),
    wonder('walls', { turns: 1, effects: [{ type: 'raidImmunity' }] }),
  ],
};

const players = [
  { id: 'p1', name: 'Player', kind: 'human' as const },
  { id: 'ai1', name: 'Rival', kind: 'ai' as const },
];

function scene() {
  const content = testContent(bundle);
  const game = newGame({ players, unlockedTiers: ['village', 'town'] }, content);
  game.state.stacks = [];
  game.state.settlements = [];
  game.state.goods = [];
  return { game, content, map: mapFor(game.setup) };
}

function ctxOf(game: Session, content: Content): Context {
  return { state: game.state, content, map: mapFor(game.setup), events: [], refugees: [] };
}

// Settlements on land areas no other settlement touches, so support and conflict stay local.
function settle(game: Session, tiers: SettlementTier[], player = 'p1'): AreaId[] {
  const map = mapFor(game.setup);
  const taken = (a: AreaId) => game.state.settlements.some((s) => s.area === a || map.areas[a]!.neighbors.includes(s.area));
  const free = map.areas.filter((a) => a.kind === 'land' && !taken(a.id));
  return tiers.map((tier) => {
    const area = free.find((a) => !taken(a.id))!.id;
    game.state.settlements.push({ area, player, tier });
    game.state.settlements.sort((a, b) => a.area - b.area);
    return area;
  });
}

function give(game: Session, resource: string, count: number, area: AreaId | null = null, player = 'p1'): void {
  game.state.goods.push({ area, player, resource, count });
}

const treasury = (game: Session, player = 'p1') => game.state.players.find((p) => p.id === player)!;

describe('stone and durable goods (v0.28)', () => {
  it('works stone in hills and mountains only', () => {
    const { content, map } = scene();
    const hills = map.areas.find((a) => a.terrain === 'hills')!;
    const plains = map.areas.find((a) => a.terrain === 'plains')!;
    expect(workable(map, content, hills.id)).toContain('stone');
    expect(workable(map, content, plains.id)).not.toContain('stone');
  });

  it('keeps durable goods in the stock from turn to turn; other goods are lost', () => {
    const { game, content } = scene();
    give(game, 'stone', 3, 5);
    give(game, 'stone', 2);
    give(game, 'grain', 4, 5);
    runResources(ctxOf(game, content));
    expect(game.state.goods).toEqual([{ area: null, player: 'p1', resource: 'stone', count: 5 }]);
  });

  it('uses durable luxuries only where a settlement has instability, keeping the rest', () => {
    const { game, content } = scene();
    const [, upset] = settle(game, ['village', 'village']);
    settlementAt(game.state, upset!)!.instability = 2;
    give(game, 'copper', 3);
    const ctx = ctxOf(game, content);
    resolveInstability(ctx);
    const calmed = eventsOfType(ctx.events, 'instabilityChanged').filter((e) => e.source === 'luxury');
    expect(calmed).toEqual([{ type: 'instabilityChanged', player: 'p1', area: upset!, amount: -1, source: 'luxury' }]);
    expect(goodsHeld(ctx.state, 'p1', 'copper')).toBe(2);
  });

  it('gives a capturer the same share of the stock as of the treasury', () => {
    const { game, content } = scene();
    const [town] = settle(game, ['town'], 'ai1');
    game.state.stacks.push({ area: town!, player: 'p1', count: 13 });
    give(game, 'stone', 20, null, 'ai1');
    give(game, 'copper', 10, null, 'ai1');
    const ctx = ctxOf(game, content);
    resolveConflict(ctx);
    expect(settlementAt(ctx.state, town!)!.player).toBe('p1');
    expect([goodsHeld(ctx.state, 'p1', 'stone'), goodsHeld(ctx.state, 'p1', 'copper')]).toEqual([4, 2]);
    expect([goodsHeld(ctx.state, 'ai1', 'stone'), goodsHeld(ctx.state, 'ai1', 'copper')]).toEqual([16, 8]);
    expect(eventsOfType(ctx.events, 'settlementAttacked')[0]!.goods).toEqual([{ resource: 'stone', count: 4 }, { resource: 'copper', count: 2 }]);
  });
});

describe('starting a wonder (v0.28)', () => {
  it('needs its advances Developed, the player’s own settlement, and a turn it can pay', () => {
    const { game } = scene();
    const [mine] = settle(game, ['town']);
    const [theirs] = settle(game, ['village'], 'ai1');
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'henge', area: mine! }, /Needs Rite Developed/);
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'huts', area: theirs! }, /no settlement there/);
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'tepe', area: mine! }, /Needs 1 stone a turn/);
    give(game, 'stone', 1);
    // The town's support eats 3 first (it has no tokens), leaving 1 for the wonder.
    give(game, 'grain', 4);
    const events = play(game, { type: 'startWonder', player: 'p1', wonder: 'tepe', area: mine! });
    expect(eventsOfType(events, 'wonderStarted')).toEqual([{ type: 'wonderStarted', player: 'p1', wonder: 'tepe', area: mine!, worked: 0 }]);
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'huts', area: mine! }, /already being built there/);
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'tepe', area: mine! }, /Already building it/);
  });

  it('counts currency for manpower the site lacks: 10 a unit', () => {
    const { game } = scene();
    const [village] = settle(game, ['village']);
    give(game, 'stone', 1);
    give(game, 'grain', 3);
    expectRejected(game, { type: 'startWonder', player: 'p1', wonder: 'tepe', area: village! }, /Needs 2 manpower/);
    treasury(game).treasury = 10;
    play(game, { type: 'startWonder', player: 'p1', wonder: 'tepe', area: village! });
  });

  it('lets manpower be assigned to a wonder only at its site', () => {
    const { game } = scene();
    const [a, b] = settle(game, ['town', 'town']);
    expectRejected(game, { type: 'assignWork', player: 'p1', area: a!, resource: WONDER, count: 1 }, /No wonder is being built here/);
    play(game, { type: 'startWonder', player: 'p1', wonder: 'walls', area: a! }, { type: 'assignWork', player: 'p1', area: a!, resource: WONDER, count: 1 });
    expectRejected(game, { type: 'assignWork', player: 'p1', area: b!, resource: WONDER, count: 1 }, /No wonder is being built here/);
  });
});

describe('working a wonder (v0.28)', () => {
  function building(units: number, money = 0) {
    const { game, content } = scene();
    const [site] = settle(game, ['town']);
    game.state.builds.push({ wonder: 'tepe', player: 'p1', area: site!, worked: 0, started: 0, labour: { turn: game.state.turn, units } });
    treasury(game).treasury = money;
    give(game, 'stone', 1);
    give(game, 'grain', 1, site!);
    return { game, content, site: site! };
  }

  it('takes the goods and the manpower counted in the resources phase', () => {
    const { game, content } = building(2);
    const ctx = ctxOf(game, content);
    resolveWonders(ctx);
    expect(game.state.builds[0]!.worked).toBe(1);
    expect(game.state.goods).toEqual([]);
    expect(eventsOfType(ctx.events, 'wonderWorked')).toEqual([{ type: 'wonderWorked', player: 'p1', wonder: 'tepe', worked: 1, currency: 0 }]);
  });

  it('covers missing manpower with 10 currency a unit, mixed with manpower', () => {
    const { game, content } = building(1, 15);
    resolveWonders(ctxOf(game, content));
    expect([game.state.builds[0]!.worked, treasury(game).treasury]).toEqual([1, 5]);
  });

  it('stalls without spending when a turn cannot be paid', () => {
    const { game, content } = building(0, 15);
    const ctx = ctxOf(game, content);
    resolveWonders(ctx);
    expect([game.state.builds[0]!.worked, treasury(game).treasury, game.state.goods.length]).toEqual([0, 15, 2]);
    expect(eventsOfType(ctx.events, 'wonderStalled')[0]!.reason).toMatch(/short of manpower: 0 of 2/);
  });

  it('is first worked the turn after it is started', () => {
    const { game, content } = building(2);
    game.state.builds[0]!.started = game.state.turn;
    resolveWonders(ctxOf(game, content));
    expect(game.state.builds[0]!.worked).toBe(0);
  });

  it('records the manpower on it in the resources phase', () => {
    const { game, content, site } = building(0);
    settlementAt(game.state, site)!.work = [{ resource: WONDER, count: 2 }];
    recordLabour(ctxOf(game, content));
    expect(game.state.builds[0]!.labour).toEqual({ turn: game.state.turn, units: 2 });
  });

  it('feeds support before the wonder', () => {
    const { game, content, site } = building(2);
    // The town needs 3 support and has only the grain: support eats it.
    game.state.goods = game.state.goods.map((g) => (g.resource === 'grain' ? { ...g, count: 3 } : g));
    const ctx = ctxOf(game, content);
    resolveSupport(ctx);
    expect(goodsHeld(ctx.state, 'p1', 'grain')).toBe(0);
    resolveWonders(ctx);
    expect(eventsOfType(ctx.events, 'wonderStalled')[0]!.reason).toMatch(/short of food: 0 of 1/);
    expect(settlementAt(ctx.state, site)!.tier).toBe('town');
  });
});

describe('completing a wonder (v0.28)', () => {
  it('belongs to the first to finish; rivals are outbuilt and choose in their next allocation', () => {
    const { game, content } = scene();
    const [mine] = settle(game, ['town']);
    const [theirs] = settle(game, ['town'], 'ai1');
    const turn = game.state.turn;
    settlementAt(game.state, mine!)!.work = [{ resource: WONDER, count: 1 }];
    game.state.builds.push({ wonder: 'huts', player: 'p1', area: mine!, worked: 1, started: 0, labour: { turn, units: 1 } });
    game.state.builds.push({ wonder: 'huts', player: 'ai1', area: theirs!, worked: 0, started: 0, labour: { turn, units: 1 } });
    give(game, 'grain', 1);
    const ctx = ctxOf(game, content);
    resolveWonders(ctx);
    expect(game.state.wonders).toEqual([{ wonder: 'huts', builder: 'p1', area: mine!, turn, effects: [{ type: 'manpower', amount: 1 }] }]);
    expect(game.state.builds).toEqual([{ wonder: 'huts', player: 'ai1', area: theirs!, worked: 0, started: 0, outbuilt: turn }]);
    expect(settlementAt(game.state, mine!)!.work).toEqual([]);
    expect(eventsOfType(ctx.events, 'wonderOutbuilt')).toEqual([{ type: 'wonderOutbuilt', player: 'ai1', wonder: 'huts', worked: 0, by: 'p1' }]);
    expect(scoreOf(game.state, content, 'p1').wonders).toBe(5);
    expect(wonderViews(game.state, mapFor(game.setup), content, 'ai1').find((v) => v.wonder.id === 'huts')!.closed).toBe('Already completed');
  });

  it('on a shared last turn, goes to the build started last; if it cannot pay, the next may finish (v0.30)', () => {
    const race = (paid: boolean) => {
      const { game, content } = scene();
      const [mine] = settle(game, ['town']);
      const [theirs] = settle(game, ['town'], 'ai1');
      const turn = game.state.turn;
      game.state.builds.push({ wonder: 'huts', player: 'p1', area: mine!, worked: 1, started: turn - 2, labour: { turn, units: 1 } });
      game.state.builds.push({ wonder: 'huts', player: 'ai1', area: theirs!, worked: 1, started: turn - 1, labour: { turn, units: 1 } });
      give(game, 'grain', 1);
      if (paid) give(game, 'grain', 1, null, 'ai1');
      const ctx = ctxOf(game, content);
      resolveWonders(ctx);
      expect(eventsOfType(ctx.events, 'randomDraw')).toEqual([]);
      return game.state.wonders[0]!.builder;
    };
    expect(race(true)).toBe('ai1');
    expect(race(false)).toBe('p1');
  });

  it('breaks a tie between builds started the same turn with one seeded draw (v0.30)', () => {
    const { game, content } = scene();
    const [mine] = settle(game, ['town']);
    const [theirs] = settle(game, ['town'], 'ai1');
    const turn = game.state.turn;
    game.state.builds.push({ wonder: 'huts', player: 'p1', area: mine!, worked: 1, started: turn - 1, labour: { turn, units: 1 } });
    game.state.builds.push({ wonder: 'huts', player: 'ai1', area: theirs!, worked: 1, started: turn - 1, labour: { turn, units: 1 } });
    give(game, 'grain', 1);
    give(game, 'grain', 1, null, 'ai1');
    const ctx = ctxOf(game, content);
    resolveWonders(ctx);
    const draws = eventsOfType(ctx.events, 'randomDraw');
    expect(draws.map((d) => d.label)).toEqual(['wonder tie huts']);
    expect(game.state.wonders[0]!.builder).toBe(draws[0]!.value < 0.5 ? 'p1' : 'ai1');
  });

  it('moves lost progress at the same share, or turns it into culture, both rounded down', () => {
    const tepe = bundle.wonders[0]!;
    const huts = bundle.wonders[1]!;
    const content = testContent(bundle);
    expect(movedTurns(tepe, 3, huts)).toBe(1);
    expect(consolation(content, tepe, 3)).toBe(3);

    const { game } = scene();
    const [a, b] = settle(game, ['town', 'town']);
    game.state.builds.push({ wonder: 'tepe', player: 'p1', area: a!, worked: 3, started: 0, outbuilt: game.state.turn - 1 });
    play(game, { type: 'redirectWonder', player: 'p1', wonder: 'tepe', to: { wonder: 'huts', area: b! } });
    expect(game.state.builds).toEqual([{ wonder: 'huts', player: 'p1', area: b!, worked: 1, started: game.state.turn }]);

    const other = scene().game;
    const [c] = settle(other, ['town']);
    other.state.builds.push({ wonder: 'tepe', player: 'p1', area: c!, worked: 3, started: 0, outbuilt: other.state.turn - 1 });
    play(other, { type: 'redirectWonder', player: 'p1', wonder: 'tepe' });
    expect([other.state.builds, treasury(other).culture]).toEqual([[], 3]);
  });

  it('turns progress into culture if the next allocation passes without a choice', () => {
    const { game, content } = scene();
    const [a] = settle(game, ['town']);
    game.state.builds.push({ wonder: 'tepe', player: 'p1', area: a!, worked: 2, started: 0, outbuilt: game.state.turn - 1 });
    const ctx = ctxOf(game, content);
    resolveWonders(ctx);
    expect([game.state.builds, treasury(game).culture]).toEqual([[], 2]);
    expect(eventsOfType(ctx.events, 'wonderConverted')).toEqual([{ type: 'wonderConverted', player: 'p1', wonder: 'tepe', points: 2 }]);
  });
});

describe('wonder effects and sites (v0.28)', () => {
  function completed(id: string) {
    const { game, content } = scene();
    const [site] = settle(game, ['town']);
    const rule = bundle.wonders.find((w) => w.id === id)!;
    game.state.wonders.push({ wonder: id, builder: 'p1', area: site!, turn: 1, effects: rule.effects });
    return { game, content, site: site! };
  }

  it('calm, manpower at the site, learning, culture progress, and raid immunity', () => {
    expect(calm(completed('tepe').game.state, 'p1')).toBe(1);
    const huts = completed('huts');
    expect(manpower(huts.game.state, settlementAt(huts.game.state, huts.site)!)).toBe(3);
    const henge = completed('henge');
    expect(learningPool(henge.game.state, 'p1')).toBe(2);
    expect(learningSources(henge.game.state, 'p1')).toEqual([{ source: 'highLearning', amount: 0 }, { source: 'henge', amount: 2 }]);
    expect(cultureSources(completed('mound').game.state, 'p1')).toEqual([{ source: 'artists', amount: 0 }, { source: 'mound', amount: 2 }]);
    const mound = completed('mound');
    runArtists(ctxOf(mound.game, mound.content));
    expect(treasury(mound.game).cultureProgress).toBe(2);
    expect(raidImmune(completed('walls').game.state, 'p1')).toBe(true);
  });

  it('follow whoever holds the settlement; the points stay with the builder', () => {
    const { game, content, site } = completed('tepe');
    settlementAt(game.state, site)!.player = 'ai1';
    expect([calm(game.state, 'p1'), calm(game.state, 'ai1')]).toEqual([0, 1]);
    expect([scoreOf(game.state, content, 'p1').wonders, scoreOf(game.state, content, 'ai1').wonders]).toEqual([5, 0]);
  });

  it('end when the settlement is gone, and the wonder cannot be built again', () => {
    const { game, content, site } = completed('tepe');
    game.state.settlements = [];
    const ctx = ctxOf(game, content);
    checkSites(ctx);
    expect(game.state.wonders[0]!.ruined).toBe(true);
    expect(eventsOfType(ctx.events, 'wonderRuined')).toEqual([{ type: 'wonderRuined', wonder: 'tepe', area: site }]);
    game.state.settlements.push({ area: site, player: 'p1', tier: 'village' });
    expect(calm(game.state, 'p1')).toBe(0);
    expect(scoreOf(game.state, content, 'p1').wonders).toBe(5);
  });

  it('lose a build’s progress when its settlement is captured or gone', () => {
    const { game, content } = scene();
    const [a, b] = settle(game, ['town', 'town']);
    game.state.builds.push({ wonder: 'tepe', player: 'p1', area: a!, worked: 3, started: 0 }, { wonder: 'huts', player: 'p1', area: b!, worked: 1, started: 0 });
    settlementAt(game.state, a!)!.player = 'ai1';
    game.state.settlements = game.state.settlements.filter((s) => s.area !== b);
    const ctx = ctxOf(game, content);
    checkSites(ctx);
    expect(game.state.builds).toEqual([]);
    expect(eventsOfType(ctx.events, 'wonderLost').map((e) => e.wonder)).toEqual(['tepe', 'huts']);
  });
});

describe('Stone Age wonders (v0.28)', () => {
  it('load with the game content', () => {
    const loaded = loadContent(stoneAge);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.content.wonders.map((w) => w.name)).toEqual(['Göbekli Tepe', 'Çatalhöyük', 'Walls of Jericho', 'Newgrange', 'Stonehenge']);
  });

  it('reject unknown advances and goods, and an era without wonder points', () => {
    const bad = loadContent({ ...bundle, wonders: [wonder('x', { requires: ['nope'], goods: [{ resource: 'gold', count: 1 }] }), wonder('y', { era: 'iron' })] });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors).toEqual(['Wonder "x" requires unknown advance "nope"', 'Wonder "x" needs unknown good "gold"', 'Wonder "y": era "iron" has no wonder points']);
  });
});

describe('wonder forecast (v0.29)', () => {
  it('says whether this turn is paid and the turn the build finishes if every turn is', () => {
    const { game, content, map } = scene();
    const [site] = settle(game, ['town']);
    game.state.builds.push({ wonder: 'huts', player: 'p1', area: site!, worked: 0, started: game.state.turn });
    const view = () => wonderViews(game.state, map, content, 'p1').find((v) => v.wonder.id === 'huts')!;
    // Started this turn: first worked next turn, and 2 turns of work.
    expect(view().forecast).toEqual({ worked: false, reason: null });
    expect(view().finish).toBe(game.state.turn + 2);
    game.state.builds[0]!.started = game.state.turn - 1;
    game.state.players[0]!.treasury = 0;
    expect(view().forecast).toEqual({ worked: false, reason: 'short of food (0 of 1)' });
    expect(view().finish).toBe(game.state.turn + 1);
  });
});
