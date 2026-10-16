import type { Advance, ContentBundle, Effect, Era } from '../content/types';
import { hooks as defaultHooks, type HookRegistry } from './hooks';

export interface Content {
  eras: readonly Era[];
  advances: readonly Advance[];
  hooks: HookRegistry;
}

export type LoadContentResult = { ok: true; content: Content } | { ok: false; errors: string[] };

// Validates references the compiler cannot check: unique ids, era and hook references, amounts.
export function loadContent(bundle: ContentBundle, hooks: HookRegistry = defaultHooks): LoadContentResult {
  const errors: string[] = [];

  const eraIds = new Set<string>();
  const eraOrders = new Set<number>();
  for (const era of bundle.eras) {
    if (eraIds.has(era.id)) errors.push(`Duplicate era id "${era.id}"`);
    if (eraOrders.has(era.order)) errors.push(`Duplicate era order ${era.order} ("${era.id}")`);
    eraIds.add(era.id);
    eraOrders.add(era.order);
  }

  const advanceIds = new Set<string>();
  for (const advance of bundle.advances) {
    if (advanceIds.has(advance.id)) errors.push(`Duplicate advance id "${advance.id}"`);
    advanceIds.add(advance.id);
    if (!eraIds.has(advance.era)) errors.push(`Advance "${advance.id}" references unknown era "${advance.era}"`);
    for (const effect of advance.effects) {
      const problem = checkEffect(effect, hooks);
      if (problem) errors.push(`Advance "${advance.id}": ${problem}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, content: { eras: bundle.eras, advances: bundle.advances, hooks } };
}

function checkEffect(effect: Effect, hooks: HookRegistry): string | null {
  switch (effect.type) {
    case 'unlockTier':
      return null;
    case 'raiseTokenCap':
    case 'raiseAreaLimit':
      if (!Number.isInteger(effect.amount) || effect.amount <= 0) {
        return `${effect.type} amount must be a positive integer (got ${effect.amount})`;
      }
      return null;
    case 'hook':
      if (!Object.hasOwn(hooks, effect.hook)) return `unknown hook "${effect.hook}"`;
      return null;
  }
}
