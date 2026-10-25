// Content schema. Content is plain, serializable data: no functions. Unusual rules reference
// scripted hooks by id (see engine/hooks.ts).

import type { Feature, Terrain } from '../engine/map/types';

export type EraId =
  | 'stone'
  | 'bronze'
  | 'iron'
  | 'classical'
  | 'medieval'
  | 'renaissance'
  | 'industrial'
  | 'modern';

export interface Era {
  id: EraId;
  name: string;
  order: number;
}

export type SettlementTier = 'village' | 'town' | 'city' | 'metropolis';

export type HookParams = Readonly<Record<string, string | number | boolean>>;

// The effect library. New effect types are added here as systems are built.
export type Effect =
  | { type: 'unlockTier'; tier: SettlementTier }
  | { type: 'raiseTokenCap'; amount: number }
  | { type: 'raiseAreaLimit'; amount: number }
  // Added to each token's strength in conflict (design doc §11). Cancelled when attacking a
  // settlement whose owner has `counteredBy` Developed.
  | { type: 'strength'; amount: number; counteredBy?: string }
  // Added to the attack threshold and defense value of the civilization's settlements of
  // `minTier` or larger (all tiers without it).
  | { type: 'settlementDefense'; amount: number; minTier?: SettlementTier }
  // Civ-wide instability removed each turn (design doc §10).
  | { type: 'calm'; amount: number }
  // One step along a river may cover a stretch of up to `areas` areas, for movement and for
  // everything measured by transport distance (design doc §4, §6).
  | { type: 'riverLeg'; areas: number }
  // Each settlement keeps up to `amount` unused `resource` into the next turn's support check.
  | { type: 'store'; resource: string; amount: number }
  // The capital-distance penalty starts `amount` land moves later (design doc §10).
  | { type: 'capitalReach'; amount: number }
  // Each settlement gathering (or making) at least 1 of `resource` gets `amount` more.
  | { type: 'gatherBonus'; resource: string; amount: number }
  // Access to the market (design doc §7); the market arrives in Phase 4 step 4.
  | { type: 'marketAccess' }
  // Steps of market reach added (design doc §7).
  | { type: 'marketReach'; amount: number }
  | { type: 'hook'; hook: string; params?: HookParams };

// Discovery domains; a discovery focus picks one (design doc §8, Ruler levers).
export type DomainId = 'land' | 'crafts' | 'beliefs' | 'travel' | 'war';

// Which areas count: every condition given must hold; a list matches any of its entries. `full`:
// at its limit (loose tokens).
export interface AreaFilter {
  resource?: string | string[];
  terrain?: Terrain | Terrain[];
  feature?: Feature;
  full?: boolean;
}

export type AdvanceStage = 'known' | 'developed';

// Plausibility conditions (design doc §8, Lifecycle): all must hold for progress to build.
export type Condition =
  | { type: 'knows'; advance: string; stage: AdvanceStage }
  // At least `min` (default 1) areas where the civilization has tokens or a settlement.
  | { type: 'presence'; where: AreaFilter; min?: number }
  | { type: 'settlements'; min: number; tier?: SettlementTier }
  // Another civilization's tokens or settlement in or next to an area the civilization holds.
  | { type: 'contact' }
  // At least one settlement working the goods.
  | { type: 'gathering'; what: Gathering };

// Settlements counted by what their manpower works: `food` (any food), `any` (any good), or a list
// of resources (any of them).
export type Gathering = 'food' | 'any' | string[];

// Progress a turn from the civilization's situation: `amount` for each thing counted.
export type Input =
  | { per: 'turn'; amount: number }
  // Areas with the civilization's tokens or a settlement.
  | { per: 'area'; amount: number; where?: AreaFilter }
  // `gathering`: only settlements working those goods; `beyond`: only settlements more than that
  // many moves from the capital; `contact`: only settlements in or next to an area another
  // civilization holds.
  | { per: 'settlement'; amount: number; tier?: SettlementTier; where?: AreaFilter; gathering?: Gathering; beyond?: number; contact?: boolean }
  // Manpower units working a resource (or Bureaucracy, 'bureaucracy').
  | { per: 'worker'; amount: number; resource: string }
  // Points on the civilization's civ-wide instability meter.
  | { per: 'instability'; amount: number }
  // Other civilizations in contact (see the contact condition).
  | { per: 'rival'; amount: number }
  // Kinds of goods the civilization gathers this turn.
  | { per: 'goodKind'; amount: number }
  // The civilization's settlements attacked this turn.
  | { per: 'attacked'; amount: number }
  // Conflicts the civilization's tokens or settlements took part in this turn (design doc §11).
  | { per: 'fought'; amount: number }
  // The civilization's settlements struck by `calamity` this turn (calamities: Phase 4 step 5).
  | { per: 'struck'; amount: number; calamity: string }
  // Kinds of goods the civilization bought or sold on the market this turn (market: step 4).
  | { per: 'traded'; amount: number };

// One stage's accumulator: reached exactly when progress reaches `cost` (design doc §8).
export interface StageRules {
  cost: number;
  inputs: Input[];
}

// Adoption after Developed: points a turn from `inputs` toward the 200 that make Mastered (design
// doc §8, v0.17); it never falls.
export interface AdoptionRules {
  inputs: Input[];
}

export interface Advance {
  id: string;
  name: string;
  era: EraId;
  domain: DomainId;
  // Known, Developed, and Mastered from turn 1 (design doc §8, Starting knowledge).
  baseline?: boolean;
  plausible?: Condition[];
  known?: StageRules;
  developed?: StageRules;
  adoption?: AdoptionRules;
  // In force while the advance is Developed.
  effects: Effect[];
  // In force while it is Mastered (adoption 100), on top of `effects`.
  mastered?: Effect[];
}

// A good gathered by production manpower (design doc §6). Revealed on the map once its civilization
// knows `revealedBy` (default: `requires`), usable once `requires` is Developed; food goods can
// stand in for support tokens. Luxury goods lower instability (design doc §6). A good with `from`
// is not placed on the map: it is worked instead in areas holding any of those resources.
export interface Resource {
  id: string;
  name: string;
  food: boolean;
  requires: string;
  revealedBy?: string;
  luxury?: boolean;
  from?: string[];
}

export interface ContentBundle {
  eras: Era[];
  advances: Advance[];
  resources: Resource[];
}
