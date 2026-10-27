import { describe, expect, it } from 'vitest';
import { content as stoneAge } from '../src/content';
import { AI_APPROACHES, aiCommands, createGame, hooks, loadContent, looseTokens, mapFor, submit, type AiApproach, type Session } from '../src/engine';
import { endPhaseAll, newGame, testContent, testSetup } from './harness';

// Every player is run by the minimal AI. Fails on any rejected command.
function playTurns(game: Session, turns: number): void {
  const target = game.state.turn + turns;
  while (game.state.turn < target) {
    for (const p of game.state.players) {
      for (const command of aiCommands(game.state, game.content, p.id)) {
        const result = submit(game, command);
        if (!result.ok) throw new Error(`AI command rejected: ${JSON.stringify(command)}: ${result.reason}`);
      }
      const result = submit(game, { type: 'endPhase', player: p.id });
      if (!result.ok) throw new Error(result.reason);
    }
  }
}

describe('minimal AI', () => {
  it('only acts in the allocation phase', () => {
    const game = newGame();
    expect(aiCommands({ ...game.state, phase: 'resolution' }, game.content, 'ai1')).toEqual([]);
  });

  it('expands into new areas and founds villages', () => {
    const game = newGame();
    playTurns(game, 30);
    for (const p of game.state.players) {
      const areas = game.state.stacks.filter((s) => s.player === p.id).length;
      const villages = game.state.settlements.filter((s) => s.player === p.id).length;
      expect(areas).toBeGreaterThan(5);
      expect(villages).toBeGreaterThan(0);
      expect(looseTokens(game.state, p.id)).toBeGreaterThan(10);
    }
  });

  it('puts a third of its manpower on High Learning and leaves the study queue empty', () => {
    const game = newGame();
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    const land = mapFor(game.setup).areas.filter((a) => a.kind === 'land');
    game.state.stacks = [];
    game.state.settlements = land.slice(0, 3).map((a) => ({ area: a.id, player: 'ai1', tier: 'village' as const }));
    const commands = aiCommands(game.state, game.content, 'ai1');
    expect(commands.filter((c) => c.type === 'assignWork' && c.resource === 'highLearning')).toEqual([{ type: 'assignWork', player: 'ai1', area: land[0]!.id, resource: 'highLearning', count: 1 }]);
    expect(commands.some((c) => c.type === 'setStudy')).toBe(false);
  });

  it('gives the same orders for the same state', () => {
    const a = newGame();
    const b = newGame();
    playTurns(a, 15);
    playTurns(b, 15);
    expect(a.state).toEqual(b.state);
  });
});

const rivals = (approaches: (AiApproach | 'random' | undefined)[]) => [
  { id: 'p1', name: 'Player', kind: 'human' as const },
  ...approaches.map((approach, i) => ({ id: `ai${i + 1}`, name: `Rival ${i + 1}`, kind: 'ai' as const, ...(approach ? { approach } : {}) })),
];

describe('AI approaches (v0.32)', () => {
  it('draws random approaches from the seed without repeats until all are used; set ones count as used', () => {
    const game = newGame({ players: rivals(Array(7).fill(undefined)), map: { type: 'inlandSea', room: 'crowded' } });
    const drawn = game.state.players.slice(1).map((p) => p.approach!);
    expect(new Set(drawn.slice(0, 6))).toEqual(new Set(AI_APPROACHES));
    expect(newGame({ players: rivals(Array(7).fill(undefined)), map: { type: 'inlandSea', room: 'crowded' } }).state.players).toEqual(game.state.players);

    const set = newGame({ players: rivals(['aggression', 'random', 'random', 'random', 'random', 'random']), map: { type: 'inlandSea', room: 'crowded' } });
    const approaches = set.state.players.slice(1).map((p) => p.approach!);
    expect(approaches[0]).toBe('aggression');
    expect(new Set(approaches)).toEqual(new Set(AI_APPROACHES));
    expect(set.state.players[0]!.approach).toBeUndefined();
  });

  it('keeps the game’s main random sequence whatever the approaches', () => {
    const a = newGame({ players: rivals(['balanced']) });
    const b = newGame({ players: rivals(['study']) });
    expect(a.state.rng).toEqual(b.state.rng);
  });

  it('rejects an approach for the human player or an unknown one', () => {
    const content = testContent();
    expect(createGame(testSetup({ players: [{ id: 'p1', name: 'P', kind: 'human', approach: 'study' }, { id: 'ai1', name: 'R', kind: 'ai' }] }), content)).toMatchObject({ ok: false });
    expect(createGame(testSetup({ players: [{ id: 'p1', name: 'P', kind: 'human' }, { id: 'ai1', name: 'R', kind: 'ai', approach: 'trade' as AiApproach }] }), content)).toMatchObject({ ok: false });
  });

  it('plays every approach through 40 Stone Age turns with no rejected command', () => {
    const loaded = loadContent(stoneAge, hooks);
    if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
    const players = AI_APPROACHES.map((approach, i) => ({ id: `c${i + 1}`, name: approach, kind: 'ai' as const, approach }));
    const game = newGame({ players, finalEra: 'iron', unlockedTiers: [], map: { type: 'inlandSea', room: 'standard' } }, loaded.content);
    playTurns(game, 40);
    const by = (a: AiApproach) => game.state.players.find((p) => p.approach === a)!;
    const workers = (a: AiApproach, job: string) => game.state.settlements.filter((s) => s.player === by(a).id).reduce((n, s) => n + (s.work ?? []).filter((w) => w.resource === job).reduce((m, w) => m + w.count, 0), 0);
    expect(workers('expansion', 'highLearning')).toBe(0);
    expect(workers('culture', 'artists')).toBeGreaterThan(0);
    expect(game.state.settlements.filter((s) => s.player === by('expansion').id).length).toBeGreaterThan(0);
  });

  it('Study queues the cheapest steps; Culture and Aggression queue their advances', () => {
    const loaded = loadContent(stoneAge, hooks);
    if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
    const players = [
      { id: 'p1', name: 'Player', kind: 'human' as const },
      { id: 'ai1', name: 'Study', kind: 'ai' as const, approach: 'study' as const },
    ];
    const game = newGame({ players, finalEra: 'iron', unlockedTiers: [] }, loaded.content);
    playTurns(game, 12);
    expect(game.state.players[1]!.study.length).toBeGreaterThan(0);
  });

  it('Aggression attacks the easiest rival village once its spare tokens beside it reach the threshold', () => {
    const game = newGame({ players: rivals(['aggression']) });
    while (game.state.phase !== 'allocation') endPhaseAll(game);
    const map = mapFor(game.setup);
    game.state.stacks = [];
    game.state.settlements = [];
    const land = (a: number) => map.areas[a]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
    const village = map.areas.find((a) => a.kind === 'land' && land(a.id).filter((n) => map.areas[n]!.limit >= 4).length >= 2)!.id;
    game.state.settlements.push({ area: village, player: 'p1', tier: 'village', work: [] });
    const [x, y] = land(village).filter((n) => map.areas[n]!.limit >= 4);
    game.state.stacks.push({ area: x!, player: 'ai1', count: 4 }, { area: y!, player: 'ai1', count: 3 });
    game.state.stacks.sort((a, b) => a.area - b.area);
    const attacks = aiCommands(game.state, game.content, 'ai1').filter((c) => c.type === 'orderMove' && c.to === village);
    expect(attacks.reduce((n, c) => n + (c.type === 'orderMove' ? c.count : 0), 0)).toBe(7);

    // One short: it masses instead of attacking.
    game.state.stacks.find((s) => s.area === y)!.count = 2;
    expect(aiCommands(game.state, game.content, 'ai1').some((c) => c.type === 'orderMove' && c.to === village)).toBe(false);
  });
});
