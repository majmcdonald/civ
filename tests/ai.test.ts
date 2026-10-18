import { describe, expect, it } from 'vitest';
import { aiCommands, looseTokens, submit, type Session } from '../src/engine';
import { newGame } from './harness';

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
    expect(game.state.phase).not.toBe('allocation');
    expect(aiCommands(game.state, game.content, 'ai1')).toEqual([]);
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

  it('gives the same orders for the same state', () => {
    const a = newGame();
    const b = newGame();
    playTurns(a, 15);
    playTurns(b, 15);
    expect(a.state).toEqual(b.state);
  });
});
