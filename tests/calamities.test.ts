import { describe, expect, it } from 'vitest';
import { content as stoneAge } from '../src/content';
import type { Advance, ContentBundle } from '../src/content/types';
import { calamityChance, mapFor, settlementAt, tokensAt, type AreaId, type Context, type GameMap, type Session, type SettlementTier } from '../src/engine';
import { exposure, resolveCalamities } from '../src/engine/calamities';
import { runResources } from '../src/engine/resources';
import { eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

// The stand-in plus the advances the Stone Age calamities name, none of them reached, and those
// calamities. `only` keeps one calamity so a strike is certain to be it.
const named = ['pottery', 'ritual', 'tallies', 'archery', 'palisades', 'masonry', 'barter'];
function bundle(only?: string): ContentBundle {
  const advances: Advance[] = named.map((id) => ({ id, name: id, era: 'stone', domain: 'crafts', known: { cost: 10, inputs: [] }, developed: { cost: 10, inputs: [] }, effects: [] }));
  return { ...standIn, advances: [...standIn.advances, ...advances], calamities: stoneAge.calamities.filter((c) => !only || c.id === only) };
}

function scene(only?: string) {
  const content = testContent(bundle(only));
  const game = newGame({ unlockedTiers: ['village', 'town'] }, content);
  const map = mapFor(game.setup);
  game.state.stacks = [];
  game.state.settlements = [];
  return { game, map, content };
}

const landAround = (map: GameMap, area: AreaId) => map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land').sort((a, b) => a - b);

function settle(game: Session, area: AreaId, tier: SettlementTier, player = 'p1'): void {
  game.state.settlements.push({ area, player, tier });
  game.state.settlements.sort((a, b) => a.area - b.area);
}

function place(game: Session, area: AreaId, player: string, count: number): void {
  game.state.stacks = game.state.stacks.filter((s) => !(s.area === area && s.player === player));
  game.state.stacks.push({ area, player, count });
  game.state.stacks.sort((a, b) => a.area - b.area || (a.player < b.player ? -1 : 1));
}

function reach(game: Session, player: string, advance: string, mastered = false): void {
  const p = game.state.players.find((x) => x.id === player)!;
  p.advances.push({ advance, stage: 'developed', progress: 0, adoption: mastered ? 100 : 0 });
}

// Resolves calamities with a strike certain (the build-up alone passes 100%).
function strike(game: Session, content: ReturnType<typeof testContent>, player = 'p1'): Context {
  game.state.players.find((p) => p.id === player)!.quiet = 20;
  const ctx: Context = { state: game.state, content, map: mapFor(game.setup), events: [], refugees: [] };
  resolveCalamities(ctx);
  return ctx;
}

// A land area with at least two land neighbours, none of them settled.
const inland = (map: GameMap, test: (a: AreaId) => boolean = () => true) => map.areas.find((a) => a.kind === 'land' && landAround(map, a.id).length >= 2 && test(a.id))!.id;

describe('calamity chance (v0.22)', () => {
  it('is 1% per settlement tier point plus 5% per quiet turn', () => {
    const { game, map } = scene();
    const [a, b] = landAround(map, inland(map));
    settle(game, a!, 'town');
    settle(game, b!, 'village');
    game.state.players[0]!.quiet = 4;
    expect(calamityChance(game.state, 'p1')).toEqual({ base: 0.03, buildUp: 0.2, chance: 0.23 });
  });

  it('builds up while nothing strikes, only with a settlement, and resets on a strike', () => {
    const { game, map, content } = scene('superstition');
    settle(game, inland(map), 'village');
    const ctx: Context = { state: game.state, content, map, events: [], refugees: [] };
    let quietTurns = 0;
    for (let i = 0; i < 5; i++) {
      const before = game.state.players[0]!.quiet;
      resolveCalamities(ctx);
      if (game.state.players[0]!.quiet === before + 1) quietTurns += 1;
      else expect(game.state.players[0]!.quiet).toBe(0);
    }
    expect(quietTurns).toBeGreaterThan(0);
    expect(game.state.players[1]!.quiet).toBe(0);
    strike(game, content);
    expect(game.state.players[0]!.quiet).toBe(0);
  });
});

describe('exposure (v0.22)', () => {
  it('weights each calamity by the settlement’s conditions', () => {
    const { game, map, content } = scene();
    const view = { state: game.state, map, content };
    const c = (id: string) => content.calamities.find((x) => x.id === id)!;
    const area = inland(map);
    settle(game, area, 'town');
    const s = game.state.settlements[0]!;
    expect(exposure(view, c('superstition'), s).weight).toBe(2);
    expect(exposure(view, c('epidemic'), s).weight).toBe(2);
    expect(exposure(view, c('famine'), s).weight).toBe(0);
    s.work = [{ resource: 'grain', count: 1 }];
    expect(exposure(view, c('famine'), s).weight).toBe(2);
    s.fed = game.state.turn - 1;
    expect(exposure(view, c('famine'), s).weight).toBe(4);
    expect(exposure(view, c('raid'), s).weight).toBe(landAround(map, area).length);
    s.instability = 5;
    expect(exposure(view, c('civilDisorder'), s).weight).toBe(5);
    s.instability = 4;
    expect(exposure(view, c('civilDisorder'), s).weight).toBe(0);
  });
});

describe('calamity effects (v0.22)', () => {
  it('Famine takes support tokens by tier, halved by Pottery and again when Mastered', () => {
    for (const [stage, lost] of [[0, 4], [1, 2], [2, 1]] as const) {
      const { game, map, content } = scene('famine');
      const area = inland(map);
      const [next] = landAround(map, area);
      settle(game, area, 'town');
      game.state.settlements[0]!.work = [{ resource: 'grain', count: 1 }];
      place(game, next!, 'p1', 6);
      if (stage > 0) reach(game, 'p1', 'pottery', stage === 2);
      const ctx = strike(game, content);
      expect(tokensAt(game.state, next!, 'p1')).toBe(6 - lost);
      expect(eventsOfType(ctx.events, 'calamity')[0]).toMatchObject({ calamity: 'famine', tokens: lost, averted: false });
    }
  });

  it('Superstition idles manpower next turn and gives Ritual a free learning unit', () => {
    const { game, map, content } = scene('superstition');
    const area = inland(map);
    settle(game, area, 'town');
    game.state.settlements[0]!.work = [{ resource: 'grain', count: 2 }];
    strike(game, content);
    const s = game.state.settlements[0]!;
    expect(s.instability).toBe(3);
    expect(s.idle).toEqual({ turn: game.state.turn + 1, units: 2 });
    expect(game.state.players[0]!.advances.find((a) => a.advance === 'ritual')).toMatchObject({ progress: 2 });
    game.state.turn += 1;
    runResources({ state: game.state, content, map, events: [], refugees: [] });
    expect(game.state.goods).toEqual([]);
  });

  it('a raid drops an unsheltered town a tier; Palisades shelter it and halve the loss', () => {
    const plain = scene('raid');
    const area = inland(plain.map);
    settle(plain.game, area, 'town');
    place(plain.game, landAround(plain.map, area)[0]!, 'p1', 5);
    const hit = strike(plain.game, plain.content);
    expect(settlementAt(plain.game.state, area)?.tier).toBe('village');
    expect(eventsOfType(hit.events, 'calamity')[0]).toMatchObject({ tokens: 3, dropped: true });

    const walled = scene('raid');
    settle(walled.game, area, 'town');
    place(walled.game, landAround(walled.map, area)[0]!, 'p1', 5);
    reach(walled.game, 'p1', 'palisades');
    const held = strike(walled.game, walled.content);
    expect(settlementAt(walled.game.state, area)?.tier).toBe('town');
    expect(eventsOfType(held.events, 'calamity')[0]).toMatchObject({ tokens: 1, dropped: false });
  });

  it('an earthquake drops a settlement on a volcanic area; Masonry spares a town for 3 tokens', () => {
    const { game, map, content } = scene('earthquake');
    const area = inland(map, (a) => map.areas[a]!.features.includes('volcanic'));
    settle(game, area, 'town');
    strike(game, content);
    expect(settlementAt(game.state, area)?.tier).toBe('village');

    const masons = scene('earthquake');
    settle(masons.game, area, 'town');
    place(masons.game, landAround(masons.map, area)[0]!, 'p1', 4);
    reach(masons.game, 'p1', 'masonry');
    strike(masons.game, masons.content);
    expect(settlementAt(masons.game.state, area)?.tier).toBe('town');
    expect(tokensAt(masons.game.state, landAround(masons.map, area)[0]!, 'p1')).toBe(1);
  });

  it('a flood takes half the tokens in wet areas around it and the food it gathered', () => {
    const { game, map, content } = scene('flood');
    const wet = (a: AreaId) => map.areas[a]!.features.includes('river') || map.areas[a]!.features.includes('floodplain');
    const area = inland(map, (a) => wet(a) && landAround(map, a).some(wet));
    const river = landAround(map, area).find(wet)!;
    settle(game, area, 'village');
    place(game, river, 'p1', 5);
    game.state.goods = [{ area, player: 'p1', resource: 'grain', count: 1 }];
    strike(game, content);
    expect(tokensAt(game.state, river, 'p1')).toBe(2);
    expect(game.state.goods).toEqual([]);
  });

  it('a drought stops food for 2 turns and lowers the limits around it', () => {
    const { game, map, content } = scene('drought');
    const area = inland(map, (a) => landAround(map, a).some((n) => map.areas[n]!.terrain === 'desert'));
    settle(game, area, 'village');
    strike(game, content);
    const s = game.state.settlements[0]!;
    expect(s.drought).toBe(game.state.turn + 2);
    expect(game.state.dry.map((d) => d.area)).toEqual(landAround(map, area));
  });

  it('an epidemic spreads to each civilization in the victim’s market', () => {
    const { game, map, content } = scene('epidemic');
    const area = inland(map);
    const next = landAround(map, area)[0]!;
    const far = landAround(map, next).find((a) => a !== area && !landAround(map, area).includes(a))!;
    settle(game, area, 'town');
    settle(game, far, 'village', 'ai1');
    for (const p of game.state.players) p.effects.push({ type: 'marketAccess' });
    const ctx = strike(game, content);
    const hits = eventsOfType(ctx.events, 'calamity');
    expect(hits.map((h) => [h.player, h.calamity, h.from])).toEqual([
      ['p1', 'epidemic', undefined],
      ['ai1', 'epidemic', 'p1'],
    ]);
    expect(game.state.players[1]!.quiet).toBe(0);
  });
});

describe('buying off (v0.22)', () => {
  it('pays 10 to avert a marked calamity, which still resets the build-up', () => {
    const { game, map, content } = scene('superstition');
    settle(game, inland(map), 'village');
    game.state.players[0]!.buyOff = ['superstition'];
    game.state.players[0]!.treasury = 12;
    const ctx = strike(game, content);
    expect(eventsOfType(ctx.events, 'calamity')[0]).toMatchObject({ averted: true, paid: 10 });
    expect(game.state.players[0]!.treasury).toBe(2);
    expect(game.state.players[0]!.quiet).toBe(0);
    expect(game.state.settlements[0]!.instability).toBeUndefined();
  });

  it('buys off Famine only with Barter Developed', () => {
    const { game, map, content } = scene('famine');
    settle(game, inland(map), 'village');
    game.state.settlements[0]!.work = [{ resource: 'grain', count: 1 }];
    game.state.players[0]!.buyOff = ['famine'];
    game.state.players[0]!.treasury = 50;
    expect(eventsOfType(strike(game, content).events, 'calamity')[0]).toMatchObject({ averted: false });
    reach(game, 'p1', 'barter');
    expect(eventsOfType(strike(game, content).events, 'calamity')[0]).toMatchObject({ averted: true });
  });

  it('is marked in allocation, only for calamities that can be bought off', () => {
    const { game } = scene();
    while (game.state.phase !== 'allocation') play(game, ...game.state.players.map((p) => ({ type: 'endPhase' as const, player: p.id })));
    play(game, { type: 'setBuyOff', player: 'p1', calamities: ['raid', 'famine'] });
    expect(game.state.players[0]!.buyOff).toEqual(['famine', 'raid']);
    expectRejected(game, { type: 'setBuyOff', player: 'p1', calamities: ['flood'] }, /cannot be bought off/);
  });
});
