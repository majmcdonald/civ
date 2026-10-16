import type { EraId } from '../content/types';
import type { Content } from './content';
import type { AreaId, GameMap, MapType, RoomToExpand } from './map/types';
import type { ResolutionStepId } from './phases';
import type { RngState } from './rng';

export type PlayerId = string;

// Design doc §3. Resources and Resolution run automatically; players act in Trade and Allocation.
export type Phase = 'resources' | 'trade' | 'allocation' | 'resolution';
export const PHASES: readonly Phase[] = ['resources', 'trade', 'allocation', 'resolution'];
export const PLAYER_PHASES: readonly Phase[] = ['trade', 'allocation'];

export interface PlayerSetup {
  id: PlayerId;
  name: string;
  kind: 'human' | 'ai';
}

// Procedural map options (design doc §2). The map uses the game seed, with one civilization per
// player, in player order.
export interface MapSetup {
  type: MapType;
  room: RoomToExpand;
}

export interface GameSetup {
  seed: number;
  players: PlayerSetup[];
  finalEra: EraId;
  map: MapSetup;
}

// A player's loose tokens in one area (design doc §4).
export interface Stack {
  area: AreaId;
  player: PlayerId;
  count: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  kind: 'human' | 'ai';
  endedPhase: boolean;
  // Most loose tokens the civilization may have (design doc §4).
  tokenCap: number;
}

// Tokens ordered in allocation to move from one area to an adjacent one; resolved together.
export interface MoveOrder {
  player: PlayerId;
  from: AreaId;
  to: AreaId;
  count: number;
}

// The whole game in one serializable object (save/load, replay, tests).
export interface GameState {
  schemaVersion: number;
  setup: GameSetup;
  rng: RngState;
  turn: number;
  phase: Phase;
  players: PlayerState[];
  stacks: Stack[];
  orders: MoveOrder[];
}

export type Command =
  | { type: 'endPhase'; player: PlayerId }
  // Sets how many tokens move from `from` to `to` this turn; 0 cancels the order.
  | { type: 'orderMove'; player: PlayerId; from: AreaId; to: AreaId; count: number };

export type GameEvent =
  | { type: 'gameStarted'; seed: number; players: PlayerId[] }
  | { type: 'turnStarted'; turn: number }
  | { type: 'phaseStarted'; phase: Phase }
  | { type: 'phaseEnded'; player: PlayerId; phase: Phase }
  | { type: 'resolutionStep'; step: ResolutionStepId }
  | { type: 'randomDraw'; label: string; value: number }
  | { type: 'tokensMoved'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  | { type: 'tokensGrew'; player: PlayerId; count: number }
  | { type: 'surplusRemoved'; player: PlayerId; area: AreaId; count: number };

export interface StampedEvent {
  turn: number;
  phase: Phase;
  event: GameEvent;
}

// Mutable working copy used while one command is applied. Callers only ever see finished states.
export interface Context {
  state: GameState;
  content: Content;
  map: GameMap;
  events: StampedEvent[];
}

export type ApplyResult =
  | { ok: true; state: GameState; events: StampedEvent[] }
  | { ok: false; reason: string };
