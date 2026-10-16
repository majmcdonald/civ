import type { Content } from './content';
import { applyCommand, createGame } from './engine';
import type { ApplyResult, Command, GameSetup, GameState, Phase } from './types';

// One line of the game log. Serialized as JSON lines; the seed plus accepted commands replays a game.
export interface LogLine {
  seq: number;
  turn: number;
  phase: Phase;
  kind: 'command' | 'rejected' | 'event';
  data: unknown;
}

export interface Session {
  content: Content;
  setup: GameSetup;
  state: GameState;
  commands: Command[];
  log: LogLine[];
}

export function startSession(setup: GameSetup, content: Content): Session {
  const result = createGame(setup, content);
  if (!result.ok) throw new Error(`Invalid game setup: ${result.reason}`);
  const session: Session = { content, setup, state: result.state, commands: [], log: [] };
  for (const e of result.events) append(session, e.turn, e.phase, 'event', e.event);
  return session;
}

// Applies a command and records it. Rejected commands are logged but not replayed.
export function submit(session: Session, command: Command): ApplyResult {
  const { turn, phase } = session.state;
  const result = applyCommand(session.state, command, session.content);
  if (!result.ok) {
    append(session, turn, phase, 'rejected', { command, reason: result.reason });
    return result;
  }
  append(session, turn, phase, 'command', command);
  for (const e of result.events) append(session, e.turn, e.phase, 'event', e.event);
  session.commands.push(command);
  session.state = result.state;
  return result;
}

export function toJsonLines(log: readonly LogLine[]): string {
  return log.map((line) => JSON.stringify(line)).join('\n') + '\n';
}

function append(session: Session, turn: number, phase: Phase, kind: LogLine['kind'], data: unknown): void {
  session.log.push({ seq: session.log.length, turn, phase, kind, data });
}
