// Content schema. Content is plain, serializable data: no functions. Unusual rules reference
// scripted hooks by id (see engine/hooks.ts).

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

export interface Advance {
  id: string;
  name: string;
  era: EraId;
  effects: Effect[];
}

export interface ContentBundle {
  eras: Era[];
  advances: Advance[];
}
