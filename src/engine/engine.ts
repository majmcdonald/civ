import type { Content } from './content';
import { clone, emit } from './context';
import { grantStartingKnowledge, setStudy, validateStudy } from './discovery';
import { setOrder, validateOrder } from './market';
import { setBuyOff, validateBuyOff } from './calamities';
import { runResolution, runResourcesPhase } from './phases';
import { BASE_MOVEMENT, setMoveOrder, STARTING_TOKEN_CAP, validateMoveOrder } from './population';
import { setWork, validateWork } from './resources';
import { nameSettlement, setConversionOrder, TIERS, validateConversionOrder, validateName } from './settlements';
import { createRng } from './rng';
import { mapFor, validateMap } from './world';
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

export const SCHEMA_VERSION = 15;

interface CommandHandler<C extends Command> {
  validate(ctx: Pick<Context, 'state' | 'map' | 'content'>, command: C): string | null;
  execute(ctx: Context, command: C): void;
}

type CommandHandlers = { [K in Command['type']]: CommandHandler<Extract<Command, { type: K }>> };

const handlers: CommandHandlers = {
  endPhase: {
    validate({ state }, command) {
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
  orderMove: {
    validate(ctx, command) {
      return validateMoveOrder(ctx, command);
    },
    execute(ctx, command) {
      setMoveOrder(ctx, command);
    },
  },
  orderConversion: {
    validate(ctx, command) {
      return validateConversionOrder(ctx, command);
    },
    execute(ctx, command) {
      setConversionOrder(ctx, command);
    },
  },
  nameSettlement: {
    validate(ctx, command) {
      return validateName(ctx, command);
    },
    execute(ctx, command) {
      nameSettlement(ctx, command);
    },
  },
  assignWork: {
    validate(ctx, command) {
      return validateWork(ctx, command);
    },
    execute(ctx, command) {
      setWork(ctx, command);
    },
  },
  setStudy: {
    validate(ctx, command) {
      return validateStudy(ctx, command);
    },
    execute(ctx, command) {
      setStudy(ctx, command);
    },
  },
  setOrder: {
    validate(ctx, command) {
      return validateOrder(ctx, command);
    },
    execute(ctx, command) {
      setOrder(ctx, command);
    },
  },
  setBuyOff: {
    validate(ctx, command) {
      return validateBuyOff(ctx, command);
    },
    execute(ctx, command) {
      setBuyOff(ctx, command);
    },
  },
};

export function validateSetup(setup: GameSetup, content: Content): string | null {
  if (!Number.isInteger(setup.seed)) return 'Seed must be an integer';
  const ids = new Set(setup.players.map((p) => p.id));
  if (ids.size !== setup.players.length) return 'Player ids must be unique';
  if (setup.players.filter((p) => p.kind === 'human').length > 1) return 'Version 1 allows at most one human player';
  if (!content.eras.some((e) => e.id === setup.finalEra)) return `Unknown final era "${setup.finalEra}"`;
  if ((setup.unlockedTiers ?? []).some((t) => !TIERS.some((rule) => rule.id === t))) return 'Unlocked tiers must be known tiers';
  // Also checks the player count against the civilizations a map supports (2–15).
  return validateMap(setup);
}

export function createGame(setup: GameSetup, content: Content): ApplyResult {
  const problem = validateSetup(setup, content);
  if (problem) return { ok: false, reason: problem };

  const map = mapFor(setup);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    setup: clone(setup),
    rng: createRng(setup.seed),
    turn: 1,
    phase: 'resources',
    players: setup.players.map((p) => ({ id: p.id, name: p.name, kind: p.kind, endedPhase: false, tokenCap: STARTING_TOKEN_CAP, movement: BASE_MOVEMENT, instability: 0, treasury: 0, prices: {}, orders: [], quiet: 0, buyOff: [], capital: null, tiers: [...(setup.unlockedTiers ?? [])], effects: [], advances: [], study: [] })),
    // Each civilization starts with one token in its starting area (design doc §4).
    stacks: setup.players
      .map((p, i) => ({ area: map.starts[i]!, player: p.id, count: 1 }))
      .sort((a, b) => a.area - b.area),
    orders: [],
    settlements: [],
    conversions: [],
    goods: [],
    dry: [],
  };
  const ctx: Context = { state, content, map, events: [], refugees: [] };
  emit(ctx, { type: 'gameStarted', seed: setup.seed, players: setup.players.map((p) => p.id) });
  grantStartingKnowledge(ctx);
  emit(ctx, { type: 'turnStarted', turn: 1 });
  emit(ctx, { type: 'phaseStarted', phase: 'resources' });
  runUntilPlayerInput(ctx);
  return { ok: true, state: ctx.state, events: ctx.events };
}

// The single entry point for the player, the AI, tests, and replays. Never mutates `state`.
export function applyCommand(state: GameState, command: Command, content: Content): ApplyResult {
  const handler = handlers[command.type] as CommandHandler<Command>;
  const map = mapFor(state.setup);
  const problem = handler.validate({ state, map, content }, command);
  if (problem) return { ok: false, reason: problem };

  const ctx: Context = { state: clone(state), content, map, events: [], refugees: [] };
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
    if (ctx.state.phase === 'resources') runResourcesPhase(ctx);
    else runResolution(ctx);
    advancePhase(ctx);
  }
}
