import { resolveConflict } from './conflict';
import { emit } from './context';
import { resolveDiscovery } from './discovery';
import { resolveInstability, runBureaucracy, updateCapitals } from './instability';
import { resolveGrowth, resolveMovement, resolveSurplus } from './population';
import { collectTax, runResources } from './resources';
import { resolveConversion, resolveSupport, resolveUrbanGrowth } from './settlements';
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
  movement: resolveMovement,
  conflict: resolveConflict,
  conversion: (ctx) => {
    resolveConversion(ctx);
    updateCapitals(ctx);
  },
  food: () => {},
  calamities: () => {},
  support: resolveSupport,
  instability: resolveInstability,
  growth: (ctx) => {
    resolveGrowth(ctx);
    resolveUrbanGrowth(ctx);
  },
  surplus: resolveSurplus,
  discovery: resolveDiscovery,
  figures: () => {},
  wonders: () => {},
  ast: () => {},
};

// Resources phase: goods are gathered, tax is collected, and Bureaucracy calms (design doc §6, §10).
export function runResourcesPhase(ctx: Context): void {
  runResources(ctx);
  collectTax(ctx);
  runBureaucracy(ctx);
}

export function runResolution(ctx: Context): void {
  for (const step of RESOLUTION_STEPS) {
    emit(ctx, { type: 'resolutionStep', step });
    resolutionSteps[step](ctx);
  }
}
