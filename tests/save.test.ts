import { describe, expect, it } from 'vitest';
import { loadGame, openSave, replay, SAVE_VERSION, saveGame, toJsonLines, type LogLine } from '../src/engine';
import { advanceTurns, newGame, play, testContent } from './harness';

describe('save and load', () => {
  it('round-trips a game through a save file', () => {
    const game = newGame();
    advanceTurns(game, 3);
    play(game, { type: 'endPhase', player: 'p1' });
    const loaded = loadGame(saveGame(game), testContent());
    expect(loaded.state).toEqual(game.state);
    expect(loaded.commands).toEqual(game.commands);
  });

  it('rebuilds the full game log on load', () => {
    const game = newGame();
    advanceTurns(game, 2);
    const loaded = loadGame(saveGame(game), testContent());
    expect(loaded.log).toEqual(game.log);
  });

  it('rejects an unsupported save version', () => {
    const save = JSON.parse(saveGame(newGame()));
    save.saveVersion = SAVE_VERSION + 1;
    expect(() => loadGame(JSON.stringify(save), testContent())).toThrow(/Unsupported save version/);
  });

  it('detects a saved state that no longer matches its replay', () => {
    const game = newGame();
    advanceTurns(game, 1);
    const save = JSON.parse(saveGame(game));
    save.state.turn = 99;
    expect(() => loadGame(JSON.stringify(save), testContent())).toThrow(/does not match/);
  });
});

describe('opening a save', () => {
  it('opens a matching save without a warning', () => {
    const game = newGame();
    advanceTurns(game, 2);
    const { session, warning } = openSave(saveGame(game), testContent());
    expect(warning).toBeNull();
    expect(session.state).toEqual(game.state);
  });

  it('opens a save whose replay no longer matches from its saved state, with a warning', () => {
    const game = newGame();
    advanceTurns(game, 1);
    const save = JSON.parse(saveGame(game));
    save.state.turn = 99;
    const { session, warning } = openSave(JSON.stringify(save), testContent());
    expect(warning).toMatch(/rules have changed/);
    expect(session.state.turn).toBe(99);
    expect(session.commands).toEqual(game.commands);
  });

  it('refuses a save from an older state layout', () => {
    const save = JSON.parse(saveGame(newGame()));
    save.state.turn = 99;
    save.state.schemaVersion = 1;
    expect(() => openSave(JSON.stringify(save), testContent())).toThrow(/does not match/);
  });
});

describe('replay', () => {
  it('reproduces the same game from the seed and commands', () => {
    const game = newGame({ seed: 42 });
    advanceTurns(game, 5);
    const replayed = replay(game.setup, game.commands, testContent());
    expect(JSON.stringify(replayed.state)).toBe(JSON.stringify(game.state));
  });

  it('fails loudly when a command no longer applies', () => {
    const game = newGame();
    expect(() => replay(game.setup, [{ type: 'endPhase', player: 'ghost' }], testContent())).toThrow(
      /Replay failed at command 0/,
    );
  });
});

describe('game log', () => {
  it('writes one parseable JSON object per line, in sequence', () => {
    const game = newGame();
    advanceTurns(game, 1);
    const lines = toJsonLines(game.log).trimEnd().split('\n');
    const parsed = lines.map((l) => JSON.parse(l) as LogLine);
    expect(parsed.map((l) => l.seq)).toEqual(parsed.map((_, i) => i));
    expect(parsed[0]).toMatchObject({ kind: 'event', turn: 1, data: { type: 'gameStarted' } });
  });

  it('tags each line with its turn and phase', () => {
    const game = newGame();
    advanceTurns(game, 1);
    const command = game.log.find((l) => l.kind === 'command');
    expect(command).toMatchObject({ turn: 1, phase: 'allocation' });
  });
});
