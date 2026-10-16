import type { EraId } from '../content/types';
import type { Content } from './content';
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

export interface GameSetup {
  seed: number;
  players: PlayerSetup[];
  finalEra: EraId;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  kind: 'human' | 'ai';
  endedPhase: boolean;
}

// The whole game in one serializable object (save/load, replay, tests).
export interface GameState {
  schemaVersion: number;
  setup: GameSetup;
  rng: RngState;
  turn: number;
  phase: Phase;
  players: PlayerState[];
}

export type Command = { type: 'endPhase'; player: PlayerId };

export type GameEvent =
  | { type: 'gameStarted'; seed: number; players: PlayerId[] }
  | { type: 'turnStarted'; turn: number }
  | { type: 'phaseStarted'; phase: Phase }
  | { type: 'phaseEnded'; player: PlayerId; phase: Phase }
  | { type: 'resolutionStep'; step: ResolutionStepId }
  | { type: 'randomDraw'; label: string; value: number };

export interface StampedEvent {
  turn: number;
  phase: Phase;
  event: GameEvent;
}

// Mutable working copy used while one command is applied. Callers only ever see finished states.
export interface Context {
  state: GameState;
  content: Content;
  events: StampedEvent[];
}

export type ApplyResult =
  | { ok: true; state: GameState; events: StampedEvent[] }
  | { ok: false; reason: string };
