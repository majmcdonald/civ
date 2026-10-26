import type { Calamity, SettlementTier } from '../content/types';
import type { Content } from './content';
import { emit } from './context';
import { adoptionOf, grantLearning, reached } from './discovery';
import { riverLeg, raidImmune } from './effects';
import { addLocal, civInstability, landDistances, localInstability, threshold } from './instability';
import type { AreaId, GameMap } from './map/types';
import { marketOf } from './market';
import { adjust, tokensAt } from './population';
import { isFood, manpower } from './resources';
import { random } from './rng';
import { dropTier, settlementAt, TIERS, tierRules } from './settlements';
import type { Command, Context, GameState, PlayerId, PlayerState, Settlement } from './types';

// Calamities (design doc §12, v0.22). Once a turn, each civilization with a settlement rolls: 1%
// per settlement tier point plus 5% per turn in a row without a calamity. On a strike, one draw
// weighted by each settlement's exposure to each calamity picks both. Softening advances halve the
// damage. A marked calamity that can be bought off is averted for its cost, and still resets the
// build-up. An epidemic spreads to each civilization in the victim's market.

// The calamities whose rules the engine knows; content may list any of them.
export const CALAMITY_RULES = ['famine', 'superstition', 'civilDisorder', 'epidemic', 'raid', 'flood', 'earthquake', 'drought'] as const;

export const CHANCE_PER_TIER = 0.01;
export const CHANCE_PER_QUIET = 0.05;
// Risk levels shown for a weight: low below medium, high at or above high.
export const RISK_MEDIUM = 3;
export const RISK_HIGH = 5;

// Support tokens lost, by tier (village, town, city, metropolis).
const FAMINE_TOKENS = [3, 4, 6, 8];
// Villages carry no epidemic weight, but one can be struck by spread.
const EPIDEMIC_TOKENS = [2, 4, 6, 8];
const EPIDEMIC_NEARBY = 2;
const RAID_TOKENS = 3;
const QUAKE_TOKENS = 3;
const SUPERSTITION_UNREST = 3;
const UNREST = 2;
const DROUGHT_TURNS = 2;

type View = Pick<Context, 'state' | 'map' | 'content'>;

export interface Exposure {
  weight: number;
  reasons: string[];
}

const rank = (tier: SettlementTier) => TIERS.indexOf(tierRules(tier));
const landAround = (map: GameMap, area: AreaId) => map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function mastered(state: GameState, player: PlayerId, advance: string): boolean {
  return reached(state, player, advance, 'developed') && adoptionOf(state, player, advance) >= 100;
}

function gathersFood(content: Content, s: Settlement): boolean {
  return (s.work ?? []).some((w) => w.count > 0 && isFood(content, w.resource));
}

// Areas around a settlement with any of `features`, and its own if it has one.
function featured(map: GameMap, area: AreaId, test: (a: AreaId) => boolean): { own: boolean; around: number } {
  return { own: test(area), around: landAround(map, area).filter(test).length };
}

const WEIGHTS: Record<(typeof CALAMITY_RULES)[number], (view: View, calamity: Calamity, s: Settlement) => Exposure> = {
  famine({ state, content }, _, s) {
    const base = s.fed === state.turn - 1 ? 2 : gathersFood(content, s) ? 1 : 0;
    if (base === 0) return { weight: 0, reasons: [] };
    const reasons = [s.fed === state.turn - 1 ? 'ate food for support last turn' : 'gathers food'];
    if (rank(s.tier) >= 1) reasons.push('a town or larger: more mouths');
    return { weight: rank(s.tier) >= 1 ? base * 2 : base, reasons };
  },
  superstition({ state }, calamity, s) {
    const belief = calamity.grants?.advance;
    if (belief && !reached(state, s.player, belief, 'known')) return { weight: 2, reasons: ['no belief yet (Ritual not Known)'] };
    return { weight: 1, reasons: ['every settlement'] };
  },
  civilDisorder({ state, map }, _, s) {
    const total = localInstability(s) + civInstability(state, s.player);
    const limit = threshold(state, map, s);
    if (total * 2 < limit) return { weight: 0, reasons: [] };
    return { weight: total, reasons: [`instability ${total} of ${limit}`] };
  },
  epidemic({ state, map }, _, s) {
    if (rank(s.tier) === 0) return { weight: 0, reasons: [] };
    const traders = marketOf(state, map, s.player).length > 1;
    return { weight: rank(s.tier) + 1 + (traders ? 1 : 0), reasons: [`dense: a ${s.tier}`, ...(traders ? ['trades with other peoples'] : [])] };
  },
  raid({ state, map }, _, s) {
    // Walls of Jericho (design doc §9).
    if (raidImmune(state, s.player)) return { weight: 0, reasons: [] };
    const open = landAround(map, s.area).filter((a) => !settlementAt(state, a) && !state.stacks.some((x) => x.area === a)).length;
    return { weight: open, reasons: open > 0 ? [`${plural(open, 'empty area')} next to it`] : [] };
  },
  flood({ map }, _, s) {
    const wet = (a: AreaId) => map.areas[a]!.features.includes('floodplain') || map.areas[a]!.features.includes('river');
    const own = map.areas[s.area]!.features.includes('floodplain') ? 2 : map.areas[s.area]!.features.includes('river') ? 1 : 0;
    const around = landAround(map, s.area).filter(wet).length;
    const reasons = [...(own === 2 ? ['on a floodplain'] : own === 1 ? ['on a river'] : []), ...(around > 0 ? [`${plural(around, 'river or floodplain area')} next to it`] : [])];
    return { weight: own + around, reasons };
  },
  earthquake({ map }, _, s) {
    const { own, around } = featured(map, s.area, (a) => map.areas[a]!.features.includes('volcanic'));
    return { weight: (own ? 3 : 0) + around, reasons: [...(own ? ['on a volcanic area'] : []), ...(around > 0 ? [`${plural(around, 'volcanic area')} next to it`] : [])] };
  },
  drought({ map }, _, s) {
    const { own, around } = featured(map, s.area, (a) => map.areas[a]!.terrain === 'desert');
    return { weight: (own ? 2 : 0) + around, reasons: [...(own ? ['in the desert'] : []), ...(around > 0 ? [`${plural(around, 'desert area')} next to it`] : [])] };
  },
};

export function exposure(view: View, calamity: Calamity, s: Settlement): Exposure {
  return WEIGHTS[calamity.id as (typeof CALAMITY_RULES)[number]](view, calamity, s);
}

export function riskLevel(weight: number): 'none' | 'low' | 'medium' | 'high' {
  if (weight <= 0) return 'none';
  if (weight >= RISK_HIGH) return 'high';
  return weight >= RISK_MEDIUM ? 'medium' : 'low';
}

// How many times the damage is halved for this settlement.
export function halvings(state: GameState, calamity: Calamity, s: Settlement): number {
  return (calamity.softenedBy ?? []).filter((soft) => {
    if (soft.minTier && rank(s.tier) < rank(soft.minTier)) return false;
    return soft.stage === 'mastered' ? mastered(state, s.player, soft.advance) : reached(state, s.player, soft.advance, 'developed');
  }).length;
}

const halve = (n: number, times: number) => Math.floor(n / 2 ** times);

function sheltered(state: GameState, calamity: Calamity, s: Settlement): boolean {
  return rank(s.tier) >= 1 && (calamity.shelter ?? []).some((a) => reached(state, s.player, a, 'developed'));
}

export function tierPoints(state: GameState, player: PlayerId): number {
  return state.settlements.reduce((sum, s) => (s.player === player ? sum + rank(s.tier) + 1 : sum), 0);
}

export interface CalamityChance {
  base: number;
  buildUp: number;
  chance: number;
}

export function calamityChance(state: GameState, player: PlayerId): CalamityChance {
  const p = state.players.find((x) => x.id === player)!;
  const base = tierPoints(state, player) * CHANCE_PER_TIER;
  const buildUp = p.quiet * CHANCE_PER_QUIET;
  return { base, buildUp, chance: Math.min(1, base + buildUp) };
}

// Own loose tokens lost from the areas next to a settlement, lower areas first.
function loseSupport(state: GameState, map: GameMap, s: Settlement, count: number): number {
  let left = count;
  for (const a of [...landAround(map, s.area)].sort((x, y) => x - y)) {
    if (left === 0) break;
    const take = Math.min(left, tokensAt(state, a, s.player));
    if (take === 0) continue;
    adjust(state, a, s.player, -take);
    left -= take;
  }
  return count - left;
}

function idleNextTurn(state: GameState, s: Settlement, units: number): void {
  if (units > 0) s.idle = { turn: state.turn + 1, units: Math.min(units, manpower(state, s)) };
}

interface Damage {
  tokens: number;
  dropped: boolean;
}

const EFFECTS: Record<(typeof CALAMITY_RULES)[number], (ctx: Context, calamity: Calamity, s: Settlement, n: number) => Damage> = {
  famine(ctx, _, s, n) {
    const tokens = loseSupport(ctx.state, ctx.map, s, halve(FAMINE_TOKENS[rank(s.tier)]!, n));
    addLocal(ctx, s, halve(UNREST, n), 'calamity');
    return { tokens, dropped: false };
  },
  superstition(ctx, calamity, s, n) {
    addLocal(ctx, s, halve(SUPERSTITION_UNREST, n), 'calamity');
    idleNextTurn(ctx.state, s, halve(manpower(ctx.state, s), n));
    if (calamity.grants) grantLearning(ctx, s.player, calamity.grants.advance, calamity.grants.learning);
    return { tokens: 0, dropped: false };
  },
  civilDisorder(ctx, _, s, n) {
    idleNextTurn(ctx.state, s, halve(manpower(ctx.state, s), n));
    addLocal(ctx, s, halve(UNREST, n), 'calamity');
    return { tokens: 0, dropped: false };
  },
  epidemic(ctx, _, s, n) {
    const { state, map } = ctx;
    let tokens = loseSupport(state, map, s, halve(EPIDEMIC_TOKENS[rank(s.tier)]!, n));
    const near = landDistances(map, s.area, riverLeg(state, s.player));
    for (const other of state.settlements.filter((x) => x.player === s.player && x !== s && (near.get(x.area) ?? Infinity) <= EPIDEMIC_NEARBY)) {
      tokens += loseSupport(state, map, other, halve(1, n));
    }
    return { tokens, dropped: false };
  },
  raid(ctx, calamity, s, n) {
    const tokens = loseSupport(ctx.state, ctx.map, s, halve(RAID_TOKENS, n));
    addLocal(ctx, s, halve(UNREST, n), 'calamity');
    if (rank(s.tier) === 0 || sheltered(ctx.state, calamity, s)) return { tokens, dropped: false };
    dropTier(ctx, s);
    return { tokens, dropped: true };
  },
  flood(ctx, _, s) {
    const { state, map } = ctx;
    const wet = (a: AreaId) => map.areas[a]!.features.includes('floodplain') || map.areas[a]!.features.includes('river');
    let tokens = 0;
    for (const a of [s.area, ...landAround(map, s.area)].filter(wet)) {
      const lost = Math.ceil(tokensAt(state, a, s.player) / 2);
      if (lost === 0) continue;
      adjust(state, a, s.player, -lost);
      tokens += lost;
    }
    state.goods = state.goods.filter((g) => !(g.area === s.area && g.player === s.player && isFood(ctx.content, g.resource)));
    return { tokens, dropped: false };
  },
  earthquake(ctx, calamity, s) {
    if (sheltered(ctx.state, calamity, s)) return { tokens: loseSupport(ctx.state, ctx.map, s, QUAKE_TOKENS), dropped: false };
    dropTier(ctx, s);
    return { tokens: 0, dropped: true };
  },
  drought(ctx, _, s, n) {
    const { state, map } = ctx;
    const turns = halve(DROUGHT_TURNS, n);
    if (turns > 0) s.drought = state.turn + turns;
    const until = state.turn + DROUGHT_TURNS - 1;
    for (const a of landAround(map, s.area).filter((x) => !settlementAt(state, x))) {
      const dry = state.dry.find((d) => d.area === a);
      if (dry) dry.until = Math.max(dry.until, until);
      else state.dry.push({ area: a, until });
    }
    state.dry.sort((x, y) => x.area - y.area);
    return { tokens: 0, dropped: false };
  },
};

export function canBuyOff(state: GameState, calamity: Calamity, player: PlayerId): boolean {
  return Boolean(calamity.buyOff && (!calamity.buyOff.requires || reached(state, player, calamity.buyOff.requires, 'developed')));
}

function strike(ctx: Context, p: PlayerState, s: Settlement, calamity: Calamity, from?: PlayerId): void {
  const { state } = ctx;
  p.quiet = 0;
  const cost = calamity.buyOff?.cost ?? 0;
  const base = { type: 'calamity' as const, player: p.id, calamity: calamity.id, area: s.area, ...(from ? { from } : {}) };
  if (p.buyOff.includes(calamity.id) && canBuyOff(state, calamity, p.id) && p.treasury >= cost) {
    p.treasury -= cost;
    emit(ctx, { ...base, averted: true, paid: cost, tokens: 0, dropped: false });
    return;
  }
  s.struck = { turn: state.turn, calamity: calamity.id };
  const damage = EFFECTS[calamity.id as (typeof CALAMITY_RULES)[number]](ctx, calamity, s, halvings(state, calamity, s));
  emit(ctx, { ...base, averted: false, paid: 0, ...damage });
}

// Every settlement × calamity pair a civilization is exposed to, in settlement then content order.
export function exposures(view: View, player: PlayerId): { settlement: Settlement; calamity: Calamity; exposure: Exposure }[] {
  return view.state.settlements
    .filter((s) => s.player === player)
    .flatMap((settlement) => view.content.calamities.map((calamity) => ({ settlement, calamity, exposure: exposure(view, calamity, settlement) })))
    .filter((x) => x.exposure.weight > 0);
}

// Resolution step 5.
export function resolveCalamities(ctx: Context): void {
  const { state, map, content } = ctx;
  state.dry = state.dry.filter((d) => d.until >= state.turn);
  if (content.calamities.length === 0) return;
  const struck = new Set<PlayerId>();
  for (const p of state.players) {
    if (struck.has(p.id) || !state.settlements.some((s) => s.player === p.id)) continue;
    const { chance } = calamityChance(state, p.id);
    if (random(ctx, `calamity ${p.id}`) >= chance) {
      p.quiet += 1;
      continue;
    }
    const pairs = exposures(ctx, p.id);
    const total = pairs.reduce((sum, x) => sum + x.exposure.weight, 0);
    if (total === 0) {
      p.quiet += 1;
      continue;
    }
    let pick = random(ctx, `calamity choice ${p.id}`) * total;
    const chosen = pairs.find((x) => (pick -= x.exposure.weight) < 0) ?? pairs[pairs.length - 1]!;
    struck.add(p.id);
    const origin = chosen.settlement.area;
    const members = chosen.calamity.spreads ? marketOf(state, map, p.id).slice(1) : [];
    strike(ctx, p, chosen.settlement, chosen.calamity);
    for (const id of members) {
      const distances = landDistances(map, origin, riverLeg(state, id));
      const target = state.settlements.filter((s) => s.player === id).sort((a, b) => (distances.get(a.area) ?? Infinity) - (distances.get(b.area) ?? Infinity) || a.area - b.area)[0];
      if (!target) continue;
      struck.add(id);
      strike(ctx, state.players.find((x) => x.id === id)!, target, chosen.calamity, p.id);
    }
  }
}

export function validateBuyOff(ctx: Pick<Context, 'state' | 'content'>, command: Extract<Command, { type: 'setBuyOff' }>): string | null {
  const p = ctx.state.players.find((x) => x.id === command.player);
  if (!p) return `Unknown player "${command.player}"`;
  if (ctx.state.phase !== 'allocation') return 'Calamities to buy off are marked in the allocation phase';
  if (p.endedPhase) return `Player "${command.player}" already ended phase "allocation"`;
  if (new Set(command.calamities).size !== command.calamities.length) return 'A calamity is listed twice';
  for (const id of command.calamities) {
    const calamity = ctx.content.calamities.find((c) => c.id === id);
    if (!calamity) return `Unknown calamity "${id}"`;
    if (!calamity.buyOff) return `${calamity.name} cannot be bought off`;
  }
  return null;
}

export function setBuyOff(ctx: Context, command: Extract<Command, { type: 'setBuyOff' }>): void {
  const p = ctx.state.players.find((x) => x.id === command.player)!;
  p.buyOff = ctx.content.calamities.filter((c) => command.calamities.includes(c.id)).map((c) => c.id);
}

// An advance that softens a calamity for a settlement, and whether it is in force there.
export interface Counter {
  advance: string;
  name: string;
  stage: 'developed' | 'mastered';
  effect: 'halves' | 'shelter';
  met: boolean;
}

export interface SettlementRisk {
  area: AreaId;
  risks: { calamity: string; name: string; weight: number; level: 'low' | 'medium' | 'high'; reasons: string[]; halvings: number; share: number; counters: Counter[] }[];
}

// Every counter that applies to a settlement of this tier, met or not.
function countersFor(state: GameState, content: Content, calamity: Calamity, s: Settlement): Counter[] {
  const name = (id: string) => content.advances.find((a) => a.id === id)?.name ?? id;
  const halves = (calamity.softenedBy ?? [])
    .filter((x) => !x.minTier || rank(s.tier) >= rank(x.minTier))
    .map((x): Counter => {
      const stage = x.stage ?? 'developed';
      return { advance: x.advance, name: name(x.advance), stage, effect: 'halves', met: stage === 'mastered' ? mastered(state, s.player, x.advance) : reached(state, s.player, x.advance, 'developed') };
    });
  const shelter = rank(s.tier) >= 1 ? (calamity.shelter ?? []).map((id): Counter => ({ advance: id, name: name(id), stage: 'developed', effect: 'shelter', met: reached(state, s.player, id, 'developed') })) : [];
  return [...halves, ...shelter];
}

export interface CalamityView extends CalamityChance {
  quiet: number;
  settlements: SettlementRisk[];
  buyOff: { calamity: string; name: string; cost: number; available: boolean; requires?: string; marked: boolean }[];
}

// What the interface shows (design doc §12, risk levels): the chance this turn and its parts, each
// settlement's exposure with reasons and its share of the draw, and the calamities that can be
// bought off.
export function calamityView(state: GameState, map: GameMap, content: Content, player: PlayerId): CalamityView {
  const p = state.players.find((x) => x.id === player)!;
  const view = { state, map, content };
  const pairs = exposures(view, player);
  const total = pairs.reduce((sum, x) => sum + x.exposure.weight, 0);
  const settlements = state.settlements
    .filter((s) => s.player === player)
    .map((s) => ({
      area: s.area,
      risks: pairs
        .filter((x) => x.settlement === s)
        .map((x) => ({
          calamity: x.calamity.id,
          name: x.calamity.name,
          weight: x.exposure.weight,
          level: riskLevel(x.exposure.weight) as 'low' | 'medium' | 'high',
          reasons: x.exposure.reasons,
          halvings: halvings(state, x.calamity, s),
          share: x.exposure.weight / total,
          counters: countersFor(state, content, x.calamity, s),
        })),
    }));
  const buyOff = content.calamities
    .filter((c) => c.buyOff)
    .map((c) => ({ calamity: c.id, name: c.name, cost: c.buyOff!.cost, available: canBuyOff(state, c, player), ...(c.buyOff!.requires ? { requires: c.buyOff!.requires } : {}), marked: p.buyOff.includes(c.id) }));
  return { ...calamityChance(state, player), quiet: p.quiet, settlements, buyOff };
}

