import type { Effect, EraId } from '../content/types';
import type { Content } from './content';
import type { InstabilitySource } from './instability';
import type { AreaId, GameMap, MapType, ResourceId, RoomToExpand } from './map/types';
import type { ResolutionStepId } from './phases';
import type { RngState } from './rng';

export type PlayerId = string;

// Design doc §3. Resources and Resolution run automatically; players act in Trade and Allocation.
export type Phase = 'resources' | 'allocation' | 'resolution';
export const PHASES: readonly Phase[] = ['resources', 'allocation', 'resolution'];
export const PLAYER_PHASES: readonly Phase[] = ['allocation'];

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

// One civilization's standing on one advance (design doc §8). `progress` is usage and learning
// toward Known or Developed. `adoption` (0–100) applies once Developed, and 100 is Mastered.
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
  // Currency held; it keeps from turn to turn (design doc §6, Currency).
  treasury: number;
  // Market prices in this player's market, unrounded; a good not listed is at its starting price
  // (design doc §7).
  prices: Record<ResourceId, number>;
  // Standing market orders, at most one per good (design doc §7).
  orders: MarketOrder[];
  // Goods it bought or sold during `turn`'s trade phase (Barter's adoption); absent means none.
  traded?: { turn: number; resources: ResourceId[] };
  // Turns in a row with a settlement and no calamity: each adds to the calamity chance (design doc
  // §12).
  quiet: number;
  // Calamities to buy off when they strike (design doc §12, Buying off); a standing choice.
  buyOff: string[];
  // The capital's area: the first settlement, then the largest remaining (design doc §10).
  capital: AreaId | null;
  // Settlement tiers the civilization can build (design doc §5): the setup's plus its advances'.
  tiers: SettlementTier[];
  // Effects in force from its advances: each Developed advance's, plus its Mastered ones at
  // adoption 100 (design doc §8). Kept in step with `advances`.
  effects: Effect[];
  // Advances with any progress or stage, in content order (design doc §8).
  advances: AdvanceProgress[];
  // Advances learning goes to, in order (design doc §8, study queue).
  study: string[];
  // Conflicts it took part in during `turn`'s resolution (design doc §8, Archery); absent means none.
  fought?: { turn: number; count: number };
  // The era it has entered; kept even if it falls below the gate (design doc §14).
  era: EraId;
  // Culture points earned, and Artists progress toward the next (design doc §6).
  culture: number;
  cultureProgress: number;
}

// The endgame countdown (design doc §15): it began in `began`, when `by` completed the final era,
// and the game ends with resolution of turn `ends`.
export interface Endgame {
  began: number;
  ends: number;
  by: PlayerId[];
}

// One civilization's points (design doc §15). Wonders arrive with the wonder system.
export interface Score {
  player: PlayerId;
  knowledge: number;
  settlement: number;
  wonders: number;
  culture: number;
  total: number;
}

// Manpower on one resource of the settlement's area, or on a specialist assignment ('bureaucracy',
// 'highLearning', 'artists') (design doc §6, Manpower). Standing orders, most recently changed last; manpower not listed is unassigned.
export interface Work {
  resource: ResourceId;
  count: number;
}

// A standing market order (design doc §7): buy or sell up to `count` each turn, at no more (buy) or
// no less (sell) than `limit`; without a limit, at the market price.
export interface MarketOrder {
  resource: ResourceId;
  side: 'buy' | 'sell';
  count: number;
  limit?: number;
}

// Goods gathered in the resources phase, held where they were gathered; lost at the end of the
// turn (design doc §6). Goods bought on the market have no area: they are in the civilization's
// pool (design doc §7, Delivery).
export interface Good {
  area: AreaId | null;
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
  // The last turn it gathered food and ate some of its own for support: +1 urban growth (design
  // doc §5, Urban growth).
  ateOwn?: number;
  // The last turn food covered any of its support (Famine's weight).
  fed?: number;
  // The last calamity to strike it (design doc §12).
  struck?: { turn: number; calamity: string };
  // Manpower idle in `turn` (Superstition, Civil disorder): the most recent assignments first.
  idle?: { turn: number; units: number };
  // It gathers no food through this turn (Drought).
  drought?: number;
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
  // Areas whose limit is lowered by 1 through `until` (Drought, design doc §12).
  dry: { area: AreaId; until: number }[];
  endgame: Endgame | null;
  // The countdown has run out; no further commands are accepted.
  over: boolean;
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
  // Orders the study queue; an empty queue splits learning evenly.
  | { type: 'setStudy'; player: PlayerId; queue: string[] }
  // Sets the standing market order for one good; a count of 0 cancels it.
  | { type: 'setOrder'; player: PlayerId; resource: ResourceId; side: 'buy' | 'sell'; count: number; limit?: number }
  // Sets which calamities to buy off when they strike.
  | { type: 'setBuyOff'; player: PlayerId; calamities: string[] };

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
  | { type: 'taxCollected'; player: PlayerId; amount: number }
  // A market price moved: `imbalance` units bought minus sold in that player's market.
  | { type: 'priceChanged'; player: PlayerId; resource: ResourceId; from: number; to: number; imbalance: number }
  | { type: 'marketTrade'; player: PlayerId; resource: ResourceId; side: 'buy' | 'sell'; count: number; price: number }
  // A calamity struck (or was bought off): `tokens` lost, `dropped` if the settlement lost a tier;
  // `from` is the civilization an epidemic spread from.
  | { type: 'calamity'; player: PlayerId; calamity: string; area: AreaId; averted: boolean; paid: number; tokens: number; dropped: boolean; from?: PlayerId }
  | { type: 'instabilityChanged'; player: PlayerId; area: AreaId | null; amount: number; source: InstabilitySource }
  | { type: 'settlementCollapsed'; player: PlayerId; area: AreaId; tier: SettlementTier }
  | { type: 'capitalMoved'; player: PlayerId; area: AreaId | null }
  | { type: 'advanceReached'; player: PlayerId; advance: string; stage: 'known' | 'developed' | 'mastered' }
  // Learning the study queue could not use, split evenly among advances waiting for it.
  | { type: 'studyQueueEmpty'; player: PlayerId; learning: number }
  | { type: 'urbanGrowth'; player: PlayerId; from: AreaId; to: AreaId; count: number }
  | { type: 'cultureGained'; player: PlayerId; points: number }
  | { type: 'eraEntered'; player: PlayerId; era: EraId }
  | { type: 'endgameBegan'; by: PlayerId[]; ends: number }
  // Final scores, highest first; every civilization tied for the top is a winner.
  | { type: 'gameEnded'; scores: Score[]; winners: PlayerId[] }
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
      // Currency the capturer took from the defender's treasury.
      spoils: number;
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
