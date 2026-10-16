import type { Content } from './content';
import { clone, emit } from './context';
import { runResolution, runResources } from './phases';
import { createRng } from './rng';
import {
  PHASES,
  PLAYER_PHASES,
  type ApplyResult,
  type Command,
  type Context,
  type GameSetup,
  type GameState,
  type Phase,
} from './types';

export const SCHEMA_VERSION = 1;

interface CommandHandler<C extends Command> {
  validate(state: GameState, command: C): string | null;
  execute(ctx: Context, command: C): void;
}

type CommandHandlers = { [K in Command['type']]: CommandHandler<Extract<Command, { type: K }>> };

const handlers: CommandHandlers = {
  endPhase: {
    validate(state, command) {
      const player = state.players.find((p) => p.id === command.player);
      if (!player) return `Unknown player "${command.player}"`;
      if (!PLAYER_PHASES.includes(state.phase)) return `Phase "${state.phase}" takes no player input`;
      if (player.endedPhase) return `Player "${command.player}" already ended phase "${state.phase}"`;
      return null;
    },
    execute(ctx, command) {
      const player = ctx.state.players.find((p) => p.id === command.player)!;
      player.endedPhase = true;
      emit(ctx, { type: 'phaseEnded', player: player.id, phase: ctx.state.phase });
      // Simultaneous turns: the phase closes once every player has ended it.
      if (ctx.state.players.every((p) => p.endedPhase)) {
        advancePhase(ctx);
        runUntilPlayerInput(ctx);
      }
    },
  },
};

export function validateSetup(setup: GameSetup, content: Content): string | null {
  if (!Number.isInteger(setup.seed)) return 'Seed must be an integer';
  if (setup.players.length === 0) return 'At least one player is required';
  const ids = new Set(setup.players.map((p) => p.id));
  if (ids.size !== setup.players.length) return 'Player ids must be unique';
  if (setup.players.filter((p) => p.kind === 'human').length > 1) return 'Version 1 allows at most one human player';
  if (!content.eras.some((e) => e.id === setup.finalEra)) return `Unknown final era "${setup.finalEra}"`;
  return null;
}

export function createGame(setup: GameSetup, content: Content): ApplyResult {
  const problem = validateSetup(setup, content);
  if (problem) return { ok: false, reason: problem };

  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    setup: clone(setup),
    rng: createRng(setup.seed),
    turn: 1,
    phase: 'resources',
    players: setup.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind, endedPhase: false })),
  };
  const ctx: Context = { state, content, events: [] };
  emit(ctx, { type: 'gameStarted', seed: setup.seed, players: setup.players.map((p) => p.id) });
  emit(ctx, { type: 'turnStarted', turn: 1 });
  emit(ctx, { type: 'phaseStarted', phase: 'resources' });
  runUntilPlayerInput(ctx);
  return { ok: true, state: ctx.state, events: ctx.events };
}

// The single entry point for the player, the AI, tests, and replays. Never mutates `state`.
export function applyCommand(state: GameState, command: Command, content: Content): ApplyResult {
  const handler = handlers[command.type] as CommandHandler<Command>;
  const problem = handler.validate(state, command);
  if (problem) return { ok: false, reason: problem };

  const ctx: Context = { state: clone(state), content, events: [] };
  handler.execute(ctx, command);
  return { ok: true, state: ctx.state, events: ctx.events };
}

function enterPhase(ctx: Context, phase: Phase): void {
  ctx.state.phase = phase;
  for (const p of ctx.state.players) p.endedPhase = false;
  emit(ctx, { type: 'phaseStarted', phase });
}

function advancePhase(ctx: Context): void {
  const index = PHASES.indexOf(ctx.state.phase);
  const next = PHASES[index + 1];
  if (next) {
    enterPhase(ctx, next);
    return;
  }
  ctx.state.turn += 1;
  emit(ctx, { type: 'turnStarted', turn: ctx.state.turn });
  enterPhase(ctx, 'resources');
}

// Runs automatic phases until the game waits on players.
function runUntilPlayerInput(ctx: Context): void {
  while (!PLAYER_PHASES.includes(ctx.state.phase)) {
    if (ctx.state.phase === 'resources') runResources(ctx);
    else runResolution(ctx);
    advancePhase(ctx);
  }
}
