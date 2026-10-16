import { emit } from './context';
import type { Context } from './types';

// Resolution order, design doc §3.
export const RESOLUTION_STEPS = [
  'movement',
  'conflict',
  'conversion',
  'food',
  'calamities',
  'support',
  'instability',
  'growth',
  'surplus',
  'discovery',
  'figures',
  'wonders',
  'ast',
] as const;

export type ResolutionStepId = (typeof RESOLUTION_STEPS)[number];

// Each step's rules are filled in as its system is built (Phase 3 onward).
const resolutionSteps: Record<ResolutionStepId, (ctx: Context) => void> = {
  movement: () => {},
  conflict: () => {},
  conversion: () => {},
  food: () => {},
  calamities: () => {},
  support: () => {},
  instability: () => {},
  growth: () => {},
  surplus: () => {},
  discovery: () => {},
  figures: () => {},
  wonders: () => {},
  ast: () => {},
};

export function runResources(_ctx: Context): void {}

export function runResolution(ctx: Context): void {
  for (const step of RESOLUTION_STEPS) {
    emit(ctx, { type: 'resolutionStep', step });
    resolutionSteps[step](ctx);
  }
}
