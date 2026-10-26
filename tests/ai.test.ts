import { describe, expect, it } from 'vitest';
import { aiCommands, looseTokens, mapFor, submit, type Session } from '../src/engine';
import { endPhaseAll, newGame } from './harness';

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
