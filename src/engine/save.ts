import type { Content } from './content';
import { startSession, submit, type Session } from './session';
import type { Command, GameSetup, GameState } from './types';

export const SAVE_VERSION = 1;

export interface SaveFile {
  saveVersion: number;
  setup: GameSetup;
  state: GameState;
  commands: Command[];
}

export function saveGame(session: Session): string {
  const save: SaveFile = {
    saveVersion: SAVE_VERSION,
    setup: session.setup,
    state: session.state,
    commands: session.commands,
  };
  return JSON.stringify(save);
}

// Rebuilds a session from its seed and commands. Throws if any command is rejected.
export function replay(setup: GameSetup, commands: readonly Command[], content: Content): Session {
  const session = startSession(setup, content);
  for (const [i, command] of commands.entries()) {
    const result = submit(session, command);
    if (!result.ok) throw new Error(`Replay failed at command ${i}: ${result.reason}`);
  }
  return session;
}

// Loading replays the commands, which rebuilds the full game log and verifies the saved state.
// A mismatch means the rules changed since the game was saved.
export function loadGame(json: string, content: Content): Session {
  const save = JSON.parse(json) as SaveFile;
  if (save.saveVersion !== SAVE_VERSION) {
    throw new Error(`Unsupported save version ${save.saveVersion} (expected ${SAVE_VERSION})`);
  }
  const session = replay(save.setup, save.commands, content);
  if (JSON.stringify(session.state) !== JSON.stringify(save.state)) {
    throw new Error('Saved state does not match its replay; the rules have changed since this game was saved');
  }
  return session;
}
