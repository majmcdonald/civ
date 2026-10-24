import type { DomainId, Effect, EraId } from '../content/types';
import type { Content } from './content';
import type { InstabilitySource } from './instability';
import type { AreaId, GameMap, MapType, ResourceId, RoomToExpand } from './map/types';
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
  // The player's name for the game, used to label saves; no effect on the rules.
  name?: string;
  seed: number;
  players: PlayerSetup[];
  finalEra: EraId;
  map: MapSetup;
  // Settlement tiers every civilization starts with, beyond those its advances unlock; none by
  // default, since Permanent Settlement unlocks villages (design doc §5, §8).
  unlockedTiers?: SettlementTier[];
  // Each civilization draws first-ring advances at the start (design doc §2, Setup options).
  advancedStart?: boolean;
}

// One civilization's standing on one advance (design doc §8). `progress` builds toward the next
// stage; `adoption` (0–100) applies once Developed, and 100 is Mastered.
export interface AdvanceProgress {
  advance: string;
  stage: 'none' | 'known' | 'developed';
  progress: number;
  adoption: number;
}

export type SettlementTier = 'village' | 'town' | 'city' | 'metropolis';

// A player's loose tokens in one area (design doc §4).
export interface Stack {
  area: AreaId;
  player: PlayerId;
  count: number;
  // Growth progress toward the next token, kept while the stack exists (design doc §4).
  growth?: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  kind: 'human' | 'ai';
  endedPhase: boolean;
  // Most loose tokens the civilization may have (design doc §4): the starting cap plus its
  // advances' rises.
  tokenCap: number;
  // Areas a token moves per turn (design doc §4); transport advances raise it.
  movement: number;
  // Civ-wide instability meter, added to every settlement's local meter (design doc §10).
  instability: number;
  // The capital's area: the first settlement, then the largest remaining (design doc §10).
  capital: AreaId | null;
  // Settlement tiers the civilization can build (design doc §5): the setup's plus its advances'.
  tiers: SettlementTier[];
  // Effects in force from its advances: each Developed advance's, plus its Mastered ones at
  // adoption 100 (design doc §8). Kept in step with `advances`.
  effects: Effect[];
  // Advances with any progress or stage, in content order (design doc §8).
  advances: AdvanceProgress[];
  // The domain High Learning goes to; null splits it across every advance in progress.
  focus: DomainId | null;
}

// Manpower on one resource of the settlement's area, or on Bureaucracy ('bureaucracy') (design doc
// §6, Manpower). Standing orders, most recently changed last; manpower not listed is unassigned.
export interface Work {
  resource: ResourceId;
  count: number;
}

// Goods gathered in the resources phase, held where they were gathered; lost at the end of the
// turn (design doc §6).
export interface Good {
  area: AreaId;
  player: PlayerId;
  resource: ResourceId;
  count: number;
}

// One settlement per area (design doc §5).
export interface Settlement {
  area: AreaId;
  player: PlayerId;
  tier: SettlementTier;
  name?: string;
  work?: Work[];
  // Local instability meter (design doc §10); absent means 0.
  instability?: number;
  // Food kept from last turn's support check (Pottery, design doc §6, Storage); absent means 0.
  stored?: number;
  // The last turn it was attacked (design doc §8, Palisades).
  attacked?: number;
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
  goods: Good[];
}

export type Command =
  | { type: 'endPhase'; player: PlayerId }
  // Sets how many tokens move from `from` to `to` this turn; 0 cancels the order.
  | { type: 'orderMove'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  // Orders (or with `ordered: false`, cancels) founding a village or upgrading the settlement here.
  | { type: 'orderConversion'; player: PlayerId; area: AreaId; ordered: boolean }
  // Names a settlement; an empty name clears it.
  | { type: 'nameSettlement'; player: PlayerId; area: AreaId; name: string }
  // Sets how much of a settlement's manpower works one of its area's resources; 0 unassigns it.
  | { type: 'assignWork'; player: PlayerId; area: AreaId; resource: ResourceId; count: number }
  // Points High Learning at a discovery domain; null removes the focus.
  | { type: 'setFocus'; player: PlayerId; domain: DomainId | null };

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
  | { type: 'goodsProduced'; player: PlayerId; area: AreaId; resource: ResourceId; count: number }
  | { type: 'foodSupport'; player: PlayerId; area: AreaId; count: number }
  | { type: 'instabilityChanged'; player: PlayerId; area: AreaId | null; amount: number; source: InstabilitySource }
  | { type: 'settlementCollapsed'; player: PlayerId; area: AreaId; tier: SettlementTier }
  | { type: 'capitalMoved'; player: PlayerId; area: AreaId | null }
  | { type: 'advanceReached'; player: PlayerId; advance: string; stage: 'known' | 'developed' | 'mastered' }
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
