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
  // Settlement tiers every civilization starts with; villages only by default (design doc §5).
  // Advances unlock the rest once they exist.
  unlockedTiers?: SettlementTier[];
}

export type SettlementTier = 'village' | 'town' | 'city' | 'metropolis';

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
  // Settlement tiers the civilization can build (design doc §5).
  tiers: SettlementTier[];
}

// One settlement per area (design doc §5).
export interface Settlement {
  area: AreaId;
  player: PlayerId;
  tier: SettlementTier;
  name?: string;
}

// A founding (no settlement in the area) or an upgrade to the next tier, ordered in allocation.
export interface ConversionOrder {
  player: PlayerId;
  area: AreaId;
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
  settlements: Settlement[];
  conversions: ConversionOrder[];
}

export type Command =
  | { type: 'endPhase'; player: PlayerId }
  // Sets how many tokens move from `from` to `to` this turn; 0 cancels the order.
  | { type: 'orderMove'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  // Orders (or with `ordered: false`, cancels) founding a village or upgrading the settlement here.
  | { type: 'orderConversion'; player: PlayerId; area: AreaId; ordered: boolean }
  // Names a settlement; an empty name clears it.
  | { type: 'nameSettlement'; player: PlayerId; area: AreaId; name: string };

// Tokens taken from one area by a conversion.
export interface TokenSource {
  area: AreaId;
  count: number;
}

// A number of one player's tokens: losses, attacking forces.
export interface TokenCount {
  player: PlayerId;
  count: number;
}

export type GameEvent =
  | { type: 'gameStarted'; seed: number; players: PlayerId[] }
  | { type: 'turnStarted'; turn: number }
  | { type: 'phaseStarted'; phase: Phase }
  | { type: 'phaseEnded'; player: PlayerId; phase: Phase }
  | { type: 'resolutionStep'; step: ResolutionStepId }
  | { type: 'randomDraw'; label: string; value: number }
  | { type: 'tokensMoved'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  | { type: 'tokensGrew'; player: PlayerId; count: number }
  | { type: 'surplusRemoved'; player: PlayerId; area: AreaId; count: number }
  | { type: 'overCapRemoved'; player: PlayerId; count: number }
  | { type: 'settlementBuilt'; player: PlayerId; area: AreaId; tier: SettlementTier; from: TokenSource[] }
  | { type: 'conversionFailed'; player: PlayerId; area: AreaId; reason: string }
  | { type: 'settlementDropped'; player: PlayerId; area: AreaId; tier: SettlementTier | null; refugees: number; lost: number }
  | { type: 'urbanGrowth'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  | { type: 'conflict'; area: AreaId; losses: TokenCount[] }
  | {
      type: 'settlementAttacked';
      area: AreaId;
      defender: PlayerId;
      // The settlement's tier before the attack.
      tier: SettlementTier;
      attackers: TokenCount[];
      // Attackers below the threshold, destroyed without a fight.
      repelled: PlayerId[];
      losses: TokenCount[];
      capturedBy: PlayerId | null;
      survivors: number;
    };

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
  // Refugees placed during this resolution; they ignore area limits and the token cap until the
  // next turn's surplus removal (design doc §5).
  refugees: Stack[];
}

export type ApplyResult =
  | { ok: true; state: GameState; events: StampedEvent[] }
  | { ok: false; reason: string };
