import type { Advance, AreaFilter, ContentBundle, Effect, Era, Gathering, Input, Resource } from '../content/types';
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
  }

  const resourceIds = new Set<string>();
  for (const resource of bundle.resources) {
    if (resourceIds.has(resource.id)) errors.push(`Duplicate resource id "${resource.id}"`);
    resourceIds.add(resource.id);
    if (!advanceIds.has(resource.requires)) errors.push(`Resource "${resource.id}" requires unknown advance "${resource.requires}"`);
    if (resource.revealedBy !== undefined && !advanceIds.has(resource.revealedBy)) errors.push(`Resource "${resource.id}" is revealed by unknown advance "${resource.revealedBy}"`);
  }
  for (const resource of bundle.resources) {
    for (const from of resource.from ?? []) if (!resourceIds.has(from)) errors.push(`Resource "${resource.id}" is worked from unknown resource "${from}"`);
  }

  for (const advance of bundle.advances) {
    for (const effect of [...advance.effects, ...(advance.mastered ?? [])]) {
      const problem = checkEffect(effect, hooks, advanceIds, resourceIds);
      if (problem) errors.push(`Advance "${advance.id}": ${problem}`);
    }
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
  const resource = (id: string) => {
    if (!resources.has(id)) problems.push(`unknown resource "${id}"`);
  };
  const filter = (where: AreaFilter | undefined) => {
    if (where?.resource !== undefined) [where.resource].flat().forEach(resource);
  };
  const gathering = (what: Gathering | undefined) => {
    if (Array.isArray(what)) what.forEach(resource);
  };
  const input = (i: Input) => {
    if (!(i.amount > 0)) problems.push(`input amount must be positive (got ${i.amount})`);
    if (i.per === 'area') filter(i.where);
    if (i.per === 'settlement') {
      filter(i.where);
      gathering(i.gathering);
    }
    if (i.per === 'worker' && i.resource !== 'bureaucracy') resource(i.resource);
  };
  for (const c of advance.plausible ?? []) {
    if (c.type === 'knows' && !advances.has(c.advance)) problems.push(`condition references unknown advance "${c.advance}"`);
    if (c.type === 'knows' && c.advance === advance.id) problems.push('condition references itself');
    if (c.type === 'presence') filter(c.where);
    if (c.type === 'gathering') gathering(c.what);
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

function checkEffect(effect: Effect, hooks: HookRegistry, advances: Set<string>, resources: Set<string>): string | null {
  const positive = (n: number) => (n > 0 ? null : `${effect.type} amount must be positive (got ${n})`);
  switch (effect.type) {
    case 'unlockTier':
    case 'marketAccess':
      return null;
    case 'strength':
      if (effect.counteredBy !== undefined && !advances.has(effect.counteredBy)) return `strength countered by unknown advance "${effect.counteredBy}"`;
      return positive(effect.amount);
    case 'settlementDefense':
    case 'calm':
    case 'capitalReach':
    case 'marketReach':
      return Number.isInteger(effect.amount) && effect.amount > 0 ? null : `${effect.type} amount must be a positive integer (got ${effect.amount})`;
    case 'riverLeg':
      return Number.isInteger(effect.areas) && effect.areas >= 2 ? null : `riverLeg areas must be a whole number, 2 or more (got ${effect.areas})`;
    case 'store':
    case 'gatherBonus':
      if (!resources.has(effect.resource)) return `${effect.type} references unknown resource "${effect.resource}"`;
      return Number.isInteger(effect.amount) && effect.amount > 0 ? null : `${effect.type} amount must be a positive integer (got ${effect.amount})`;
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
