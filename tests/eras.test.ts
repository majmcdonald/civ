import { describe, expect, it } from 'vitest';
import { eras } from '../src/content/eras';
import type { Advance, ContentBundle } from '../src/content/types';
import { ARTISTS, COUNTDOWN, eraView, knowledgePoints, loadContent, mapFor, scoreOf, scores, settlementPoints, type AreaId, type Content, type Context, type Session, type SettlementTier } from '../src/engine';
import { resolveEras, runArtists } from '../src/engine/eras';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play, standIn, testContent } from './harness';

// Stone Age advances with an adoption stage (a1–a6) and one without (plain).
const adopted = (id: string): Advance => ({ id, name: id, era: 'stone', domain: 'crafts', known: { cost: 10, inputs: [] }, developed: { cost: 10, inputs: [] }, adoption: { inputs: [] }, effects: [] });
const bundle: ContentBundle = {
  ...standIn,
  advances: [...standIn.advances, ...['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map(adopted), { id: 'plain', name: 'Plain', era: 'stone', domain: 'crafts', known: { cost: 10, inputs: [] }, developed: { cost: 10, inputs: [] }, effects: [] }],
};

function scene(finalEra: 'stone' | 'iron' = 'stone') {
  const content = testContent(bundle);
  const game = newGame({ finalEra, unlockedTiers: ['village', 'town'] }, content);
  game.state.stacks = [];
  game.state.settlements = [];
  return { game, content };
}

function ctxOf(game: Session, content: Content): Context {
  return { state: game.state, content, map: mapFor(game.setup), events: [], refugees: [] };
}

const landAreas = (game: Session) => mapFor(game.setup).areas.filter((a) => a.kind === 'land').map((a) => a.id);

function settle(game: Session, tiers: SettlementTier[], player = 'p1', skip = 0): AreaId[] {
  const free = landAreas(game).filter((a) => !game.state.settlements.some((s) => s.area === a)).slice(skip);
  const areas = tiers.map((tier, i) => {
    game.state.settlements.push({ area: free[i]!, player, tier });
    return free[i]!;
  });
  game.state.settlements.sort((a, b) => a.area - b.area);
  return areas;
}

function reach(game: Session, advance: string, mastered: boolean, player = 'p1'): void {
  game.state.players.find((p) => p.id === player)!.advances.push({ advance, stage: 'developed', progress: 0, adoption: mastered ? 100 : 0 });
}

// 12 knowledge points (four Mastered) and 5 settlement points (a town and three villages).
function qualify(game: Session, player = 'p1'): void {
  for (const a of ['a1', 'a2', 'a3', 'a4']) reach(game, a, true, player);
  settle(game, ['town', 'village', 'village', 'village'], player);
}

describe('points (v0.26)', () => {
  it('scores settlements village 1, town 2', () => {
    const { game } = scene();
    settle(game, ['town', 'village', 'village']);
    expect(settlementPoints(game.state, 'p1')).toBe(4);
  });

  it('scores knowledge Developed 1, Mastered 3; no adoption stage 1; baseline 0', () => {
    const { game, content } = scene();
    reach(game, 'a1', false);
    reach(game, 'a2', true);
    reach(game, 'plain', true);
    expect(knowledgePoints(game.state, content, 'p1')).toBe(1 + 3 + 1);
    expect(eraView(game.state, content, 'p1').knowledge).toEqual([{ era: 'stone', developed: 2, mastered: 1, points: 5 }]);
  });

  it('adds knowledge, settlement, and culture points into the score', () => {
    const { game, content } = scene();
    reach(game, 'a1', true);
    settle(game, ['town']);
    game.state.players[0]!.culture = 4;
    expect(scoreOf(game.state, content, 'p1')).toEqual({ player: 'p1', knowledge: 3, settlement: 2, wonders: 0, culture: 4, total: 9 });
  });
});

describe('era gates (v0.26)', () => {
  it('starts every civilization in the Stone Age', () => {
    const { game } = scene();
    expect(game.state.players.map((p) => p.era)).toEqual(['stone', 'stone']);
  });

  it('enters the Bronze Age at 5 settlement and 12 knowledge points', () => {
    const { game, content } = scene('iron');
    qualify(game);
    for (const a of ['a1', 'a2', 'a3']) reach(game, a, true, 'ai1');
    settle(game, ['town', 'village', 'village', 'village'], 'ai1');
    const ctx = ctxOf(game, content);
    resolveEras(ctx);
    expect(game.state.players.map((p) => p.era)).toEqual(['bronze', 'stone']);
    expect(eventsOfType(ctx.events, 'eraEntered')).toEqual([{ type: 'eraEntered', player: 'p1', era: 'bronze' }]);
  });

  it('keeps the era after falling below its gate', () => {
    const { game, content } = scene('iron');
    qualify(game);
    resolveEras(ctxOf(game, content));
    game.state.settlements = [];
    resolveEras(ctxOf(game, content));
    expect(game.state.players[0]!.era).toBe('bronze');
  });

  it('stops at an era with no gate yet', () => {
    const { game, content } = scene('iron');
    qualify(game);
    resolveEras(ctxOf(game, content));
    expect(game.state.players[0]!.era).toBe('bronze');
    expect(eraView(game.state, content, 'p1').next).toBeNull();
  });
});

describe('endgame (v0.26)', () => {
  it('does not start the countdown before the final era is complete', () => {
    const { game, content } = scene('iron');
    qualify(game);
    const ctx = ctxOf(game, content);
    resolveEras(ctx);
    expect(game.state.endgame).toBeNull();
    expect(eventsOfType(ctx.events, 'endgameBegan')).toEqual([]);
  });

  it('starts a 5-turn countdown when a civilization meets the gate after the final era', () => {
    const { game, content } = scene('stone');
    qualify(game);
    const ctx = ctxOf(game, content);
    resolveEras(ctx);
    const turn = game.state.turn;
    expect(game.state.endgame).toEqual({ began: turn, ends: turn + COUNTDOWN, by: ['p1'] });
    expect(eventsOfType(ctx.events, 'endgameBegan')).toEqual([{ type: 'endgameBegan', by: ['p1'], ends: turn + COUNTDOWN }]);
  });

  it('ends the game with the countdown’s last turn and names the highest score', () => {
    const { game, content } = scene('stone');
    const turn = game.state.turn;
    game.state.endgame = { began: turn, ends: turn + COUNTDOWN, by: ['ai1'] };
    reach(game, 'a1', true, 'ai1');
    let ended: ReturnType<typeof eventsOfType<'gameEnded'>> = [];
    for (let i = 0; i <= COUNTDOWN && !game.state.over; i++) ended = eventsOfType(endPhaseAll(game), 'gameEnded');
    expect(game.state.over).toBe(true);
    expect(game.state.turn).toBe(turn + COUNTDOWN);
    expect(ended).toHaveLength(1);
    expect(ended[0]!.winners).toEqual(['ai1']);
    expect(ended[0]!.scores).toEqual(scores(game.state, content));
    expectRejected(game, { type: 'endPhase', player: 'p1' }, /game is over/);
  });

  it('names every civilization tied for the top', () => {
    const { game, content } = scene('stone');
    game.state.endgame = { began: 0, ends: game.state.turn, by: ['p1'] };
    const ctx = ctxOf(game, content);
    resolveEras(ctx);
    expect(eventsOfType(ctx.events, 'gameEnded')[0]!.winners).toEqual(['p1', 'ai1']);
  });

  it('starts the countdown at the last era’s closing gate', () => {
    const closing = eras.map((e) => (e.id === 'modern' ? { ...e, closing: { settlement: 1, knowledge: 0 } } : e));
    const content = testContent({ ...bundle, eras: closing });
    const game = newGame({ finalEra: 'modern' }, content);
    game.state.players[0]!.era = 'modern';
    game.state.settlements = [];
    settle(game, ['village']);
    resolveEras(ctxOf(game, content));
    expect(game.state.endgame?.by).toEqual(['p1']);
  });
});

describe('Artists (v0.26)', () => {
  it('earn 1 culture point per 5 unit-turns in the Stone Age, keeping the remainder', () => {
    const { game, content } = scene();
    const [area] = settle(game, ['town']);
    game.state.settlements.find((s) => s.area === area)!.work = [{ resource: ARTISTS, count: 2 }];
    const ctx = ctxOf(game, content);
    for (let i = 0; i < 3; i++) runArtists(ctx);
    expect(game.state.players[0]!.culture).toBe(1);
    expect(game.state.players[0]!.cultureProgress).toBe(1);
    expect(eventsOfType(ctx.events, 'cultureGained')).toEqual([{ type: 'cultureGained', player: 'p1', points: 1 }]);
  });

  it('earn more per award in the Bronze Age', () => {
    const { game, content } = scene();
    const [area] = settle(game, ['town']);
    game.state.settlements.find((s) => s.area === area)!.work = [{ resource: ARTISTS, count: 1 }];
    game.state.players[0]!.era = 'bronze';
    game.state.players[0]!.cultureProgress = 4;
    runArtists(ctxOf(game, content));
    expect(game.state.players[0]!.culture).toBe(3);
  });

  it('are assigned like any specialist', () => {
    const content = testContent(bundle);
    const game = newGame({}, content);
    const area = game.state.stacks.find((s) => s.player === 'p1')!.area;
    game.state.settlements.push({ area, player: 'p1', tier: 'village', work: [] });
    play(game, { type: 'assignWork', player: 'p1', area, resource: ARTISTS, count: 1 });
    expect(game.state.settlements.find((s) => s.area === area)!.work).toEqual([{ resource: ARTISTS, count: 1 }]);
  });
});

describe('era content (v0.26)', () => {
  it('rejects a gate without points and a closing gate before the last era', () => {
    const result = loadContent({
      ...bundle,
      eras: [
        { id: 'stone', name: 'Stone Age', order: 0, points: { developed: 1, mastered: 3, culture: 1 }, closing: { settlement: 1, knowledge: 1 } },
        { id: 'bronze', name: 'Bronze Age', order: 1, gate: { settlement: 5, knowledge: 12 } },
      ],
    });
    expect(result.ok ? [] : result.errors).toEqual(['Era "bronze" has a gate but no points', 'Era "stone": only the last era has a closing gate']);
  });
});
