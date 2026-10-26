import { describe, expect, it } from 'vitest';
import { RESOLUTION_STEPS } from '../src/engine';
import { endPhaseAll, eventsOfType, expectRejected, newGame, play } from './harness';

describe('turn flow', () => {
  it('starts on turn 1 waiting for players in the allocation phase', () => {
    const game = newGame();
    expect(game.state.turn).toBe(1);
    expect(game.state.phase).toBe('allocation');
    expect(game.state.players.every((p) => !p.endedPhase)).toBe(true);
  });

  it('waits until every player has ended the phase', () => {
    const game = newGame();
    play(game, { type: 'endPhase', player: 'p1' });
    expect(game.state.turn).toBe(1);
    play(game, { type: 'endPhase', player: 'ai1' });
    expect(game.state.turn).toBe(2);
  });

  it('resolves all thirteen steps in the documented order, then starts the next turn', () => {
    const game = newGame();
    const events = endPhaseAll(game);
    expect(eventsOfType(events, 'resolutionStep').map((e) => e.step)).toEqual([...RESOLUTION_STEPS]);
    expect(eventsOfType(events, 'turnStarted')).toEqual([{ type: 'turnStarted', turn: 2 }]);
    expect(game.state.turn).toBe(2);
    expect(game.state.phase).toBe('allocation');
  });

  it('passes through the automatic phases in order', () => {
    const game = newGame();
    const phases = eventsOfType(endPhaseAll(game), 'phaseStarted').map((e) => e.phase);
    expect(phases).toEqual(['resolution', 'resources', 'allocation']);
  });

  it('rejects ending a phase twice', () => {
    const game = newGame();
    play(game, { type: 'endPhase', player: 'p1' });
    expectRejected(game, { type: 'endPhase', player: 'p1' }, /already ended/);
  });

  it('rejects commands from unknown players', () => {
    const game = newGame();
    expectRejected(game, { type: 'endPhase', player: 'nobody' }, /Unknown player/);
  });

  it('logs rejected commands without recording them for replay', () => {
    const game = newGame();
    expectRejected(game, { type: 'endPhase', player: 'nobody' }, /Unknown player/);
    expect(game.commands).toEqual([]);
    expect(game.log.at(-1)?.kind).toBe('rejected');
  });

  it('never mutates the state it was given', () => {
    const game = newGame();
    const before = JSON.stringify(game.state);
    const original = game.state;
    play(game, { type: 'endPhase', player: 'p1' });
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe('setup validation', () => {
  it('rejects more than one human player', () => {
    expect(() =>
      newGame({
        players: [
          { id: 'a', name: 'A', kind: 'human' },
          { id: 'b', name: 'B', kind: 'human' },
        ],
      }),
    ).toThrow(/at most one human/);
  });

  it('allows all-AI games for headless batch runs', () => {
    const game = newGame({ players: [{ id: 'ai1', name: 'A', kind: 'ai' }, { id: 'ai2', name: 'B', kind: 'ai' }] });
    expect(game.state.phase).toBe('allocation');
  });

  it('rejects duplicate player ids', () => {
    expect(() =>
      newGame({
        players: [
          { id: 'a', name: 'A', kind: 'ai' },
          { id: 'a', name: 'B', kind: 'ai' },
        ],
      }),
    ).toThrow(/unique/);
  });

  it('rejects an unknown final era', () => {
    // @ts-expect-error: deliberately invalid era id
    expect(() => newGame({ finalEra: 'space' })).toThrow(/Unknown final era/);
  });
});
