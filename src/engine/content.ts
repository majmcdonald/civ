import type { Advance, AreaFilter, Calamity, ContentBundle, Effect, Era, Gathering, Input, Resource, Wonder } from '../content/types';
import { CALAMITY_RULES } from './calamities';
import { hooks as defaultHooks, type HookRegistry } from './hooks';

export interface Content {
  eras: readonly Era[];
  advances: readonly Advance[];
  resources: readonly Resource[];
  calamities: readonly Calamity[];
  wonders: readonly Wonder[];
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
    for (const [name, gate] of [['gate', era.gate], ['closing gate', era.closing]] as const) {
      if (gate && ![gate.settlement, gate.knowledge].every((n) => Number.isInteger(n) && n >= 0)) errors.push(`Era "${era.id}": ${name} values must be whole numbers, 0 or more`);
    }
    if (era.points && ![era.points.developed, era.points.mastered, era.points.culture, era.points.wonder ?? 1].every((n) => Number.isInteger(n) && n > 0)) errors.push(`Era "${era.id}": points must be positive integers`);
    if (era.gate && !era.points) errors.push(`Era "${era.id}" has a gate but no points`);
  }
  const last = [...bundle.eras].sort((a, b) => b.order - a.order)[0];
  for (const era of bundle.eras) if (era.closing && era !== last) errors.push(`Era "${era.id}": only the last era has a closing gate`);
  const order = [...bundle.eras].sort((a, b) => a.order - b.order);
  if (order[0] && !order[0].points) errors.push(`Era "${order[0].id}": the first era needs points`);

  const advanceIds = new Set<string>();
  for (const advance of bundle.advances) {
    if (advanceIds.has(advance.id)) errors.push(`Duplicate advance id "${advance.id}"`);
    advanceIds.add(advance.id);
    if (!eraIds.has(advance.era)) errors.push(`Advance "${advance.id}" references unknown era "${advance.era}"`);
    else if (!advance.baseline && !bundle.eras.find((e) => e.id === advance.era)!.points) errors.push(`Advance "${advance.id}": era "${advance.era}" has no knowledge points`);
  }

  const resourceIds = new Set<string>();
  for (const resource of bundle.resources) {
    if (resourceIds.has(resource.id)) errors.push(`Duplicate resource id "${resource.id}"`);
    resourceIds.add(resource.id);
    if (!advanceIds.has(resource.requires)) errors.push(`Resource "${resource.id}" requires unknown advance "${resource.requires}"`);
    if (resource.revealedBy !== undefined && !advanceIds.has(resource.revealedBy)) errors.push(`Resource "${resource.id}" is revealed by unknown advance "${resource.revealedBy}"`);
    if (!(resource.price > 0)) errors.push(`Resource "${resource.id}" needs a positive starting price (got ${resource.price})`);
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

  const calamityIds = new Set<string>();
  for (const calamity of bundle.calamities) {
    const at = `Calamity "${calamity.id}"`;
    if (calamityIds.has(calamity.id)) errors.push(`Duplicate calamity id "${calamity.id}"`);
    calamityIds.add(calamity.id);
    if (!(CALAMITY_RULES as readonly string[]).includes(calamity.id)) errors.push(`${at} has no rules in the engine`);
    const advance = (id: string, what: string) => {
      if (!advanceIds.has(id)) errors.push(`${at}: ${what} references unknown advance "${id}"`);
    };
    for (const soft of calamity.softenedBy ?? []) advance(soft.advance, 'softenedBy');
    for (const id of calamity.shelter ?? []) advance(id, 'shelter');
    if (calamity.buyOff) {
      if (!(Number.isInteger(calamity.buyOff.cost) && calamity.buyOff.cost > 0)) errors.push(`${at}: buy-off cost must be a positive integer`);
      if (calamity.buyOff.requires !== undefined) advance(calamity.buyOff.requires, 'buyOff');
    }
    if (calamity.grants) {
      advance(calamity.grants.advance, 'grants');
      if (!(Number.isInteger(calamity.grants.learning) && calamity.grants.learning > 0)) errors.push(`${at}: granted learning must be a positive integer`);
    }
  }

  const wonderIds = new Set<string>();
  for (const wonder of bundle.wonders) {
    const at = `Wonder "${wonder.id}"`;
    if (wonderIds.has(wonder.id)) errors.push(`Duplicate wonder id "${wonder.id}"`);
    wonderIds.add(wonder.id);
    const era = bundle.eras.find((e) => e.id === wonder.era);
    if (!era) errors.push(`${at} references unknown era "${wonder.era}"`);
    else if (era.points?.wonder === undefined) errors.push(`${at}: era "${wonder.era}" has no wonder points`);
    if (wonder.requires.length === 0) errors.push(`${at} needs an advance to open it`);
    for (const id of wonder.requires) if (!advanceIds.has(id)) errors.push(`${at} requires unknown advance "${id}"`);
    if (![wonder.turns, wonder.manpower].every((n) => Number.isInteger(n) && n > 0)) errors.push(`${at}: turns and manpower must be positive integers`);
    for (const g of wonder.goods) {
      if (g.resource !== FOOD && !resourceIds.has(g.resource)) errors.push(`${at} needs unknown good "${g.resource}"`);
      if (!(Number.isInteger(g.count) && g.count > 0)) errors.push(`${at}: goods counts must be positive integers`);
    }
    for (const effect of wonder.effects) {
      const problem = checkEffect(effect, hooks, advanceIds, resourceIds);
      if (problem) errors.push(`${at}: ${problem}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, content: { eras: bundle.eras, advances: bundle.advances, resources: bundle.resources, calamities: bundle.calamities, wonders: bundle.wonders, hooks } };
}

// A wonder's goods entry for any food good.
export const FOOD = 'food';

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
  }
  return problems;
}

function checkEffect(effect: Effect, hooks: HookRegistry, advances: Set<string>, resources: Set<string>): string | null {
  const positive = (n: number) => (n > 0 ? null : `${effect.type} amount must be positive (got ${n})`);
  switch (effect.type) {
    case 'unlockTier':
    case 'marketAccess':
    case 'raidImmunity':
      return null;
    case 'strength':
      if (effect.counteredBy !== undefined && !advances.has(effect.counteredBy)) return `strength countered by unknown advance "${effect.counteredBy}"`;
      return positive(effect.amount);
    case 'settlementDefense':
    case 'calm':
    case 'capitalReach':
    case 'marketReach':
    case 'manpower':
    case 'culture':
    case 'learning':
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
