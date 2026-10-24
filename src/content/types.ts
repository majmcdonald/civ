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
  | { type: 'hook'; hook: string; params?: HookParams };

// Discovery domains; a discovery focus picks one (design doc §8, Ruler levers).
export type DomainId = 'land' | 'crafts' | 'beliefs' | 'travel' | 'war';

// Which areas count: every condition given must hold. `full`: at its limit (loose tokens).
export interface AreaFilter {
  resource?: string;
  terrain?: Terrain;
  feature?: Feature;
  full?: boolean;
}

export type AdvanceStage = 'known' | 'developed';

// Plausibility conditions (design doc §8, Lifecycle): all must hold for progress to build.
export type Condition =
  | { type: 'knows'; advance: string; stage: AdvanceStage }
  // At least `min` (default 1) areas where the civilization has tokens or a settlement.
  | { type: 'presence'; where: AreaFilter; min?: number }
  | { type: 'settlements'; min: number; tier?: SettlementTier };

// Progress a turn from the civilization's situation: `amount` for each thing counted.
export type Input =
  | { per: 'turn'; amount: number }
  // Areas with the civilization's tokens or a settlement.
  | { per: 'area'; amount: number; where?: AreaFilter }
  | { per: 'settlement'; amount: number; tier?: SettlementTier; where?: AreaFilter }
  // Manpower units working a resource.
  | { per: 'worker'; amount: number; resource: string };

// One stage's accumulator: reached exactly when progress reaches `cost` (design doc §8).
export interface StageRules {
  cost: number;
  inputs: Input[];
}

// Adoption after Developed: percentage points a turn from `inputs`; with none, it falls by `fall`.
export interface AdoptionRules {
  inputs: Input[];
  fall: number;
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
  // Applied when the advance is Developed.
  effects: Effect[];
}

// A good gathered by production manpower (design doc §6). Revealed on the map once its civilization
// knows the required advance, usable once it is Developed; food goods can stand in for support
// tokens.
export interface Resource {
  id: string;
  name: string;
  food: boolean;
  requires: string;
}

export interface ContentBundle {
  eras: Era[];
  advances: Advance[];
  resources: Resource[];
}
