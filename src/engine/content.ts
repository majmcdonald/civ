import type { Advance, AreaFilter, ContentBundle, Effect, Era, Input, Resource } from '../content/types';
import { hooks as defaultHooks, type HookRegistry } from './hooks';

export interface Content {
  eras: readonly Era[];
  advances: readonly Advance[];
  resources: readonly Resource[];
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

  const resourceIds = new Set<string>();
  for (const resource of bundle.resources) {
    if (resourceIds.has(resource.id)) errors.push(`Duplicate resource id "${resource.id}"`);
    resourceIds.add(resource.id);
    if (!advanceIds.has(resource.requires)) errors.push(`Resource "${resource.id}" requires unknown advance "${resource.requires}"`);
  }

  for (const advance of bundle.advances) {
    for (const problem of checkDiscovery(advance, advanceIds, resourceIds)) errors.push(`Advance "${advance.id}": ${problem}`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, content: { eras: bundle.eras, advances: bundle.advances, resources: bundle.resources, hooks } };
}

const DOMAIN_IDS = ['land', 'crafts', 'beliefs', 'travel', 'war'];

// Discovery data (design doc §8): a domain, both accumulators unless baseline, positive costs and
// amounts, and references to known advances and resources.
function checkDiscovery(advance: Advance, advances: Set<string>, resources: Set<string>): string[] {
  const problems: string[] = [];
  if (!DOMAIN_IDS.includes(advance.domain)) problems.push(`unknown domain "${advance.domain}"`);
  const filter = (where: AreaFilter | undefined) => {
    if (where?.resource !== undefined && !resources.has(where.resource)) problems.push(`unknown resource "${where.resource}"`);
  };
  const input = (i: Input) => {
    if (!(i.amount > 0)) problems.push(`input amount must be positive (got ${i.amount})`);
    if (i.per === 'area' || i.per === 'settlement') filter(i.where);
    if (i.per === 'worker' && !resources.has(i.resource)) problems.push(`unknown resource "${i.resource}"`);
  };
  for (const c of advance.plausible ?? []) {
    if (c.type === 'knows' && !advances.has(c.advance)) problems.push(`condition references unknown advance "${c.advance}"`);
    if (c.type === 'knows' && c.advance === advance.id) problems.push('condition references itself');
    if (c.type === 'presence') filter(c.where);
  }
  for (const stage of ['known', 'developed'] as const) {
    const rules = advance[stage];
    if (!rules) {
      if (!advance.baseline) problems.push(`needs ${stage} rules (or baseline)`);
      continue;
    }
    if (!(rules.cost > 0)) problems.push(`${stage} cost must be positive (got ${rules.cost})`);
    rules.inputs.forEach(input);
  }
  if (advance.adoption) {
    advance.adoption.inputs.forEach(input);
    if (!(advance.adoption.fall >= 0)) problems.push(`adoption fall must be 0 or more (got ${advance.adoption.fall})`);
  }
  return problems;
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
