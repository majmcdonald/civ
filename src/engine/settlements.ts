import { resolveConflict } from './conflict';
import { clone, emit } from './context';
import type { Content } from './content';
import { riverLeg, storeCap, transportNeighbors } from './effects';
import type { AreaId, GameMap } from './map/types';
import { adjust, areaTotals, looseLimit, looseTokens, resolveMovement, tokensAt } from './population';
import { addManpower, isFood, resetWork, trimWork } from './resources';
import type { Command, Context, GameState, PlayerId, Settlement, SettlementTier, TokenSource } from './types';

// Settlements: founding, upgrading, support, tier drop, and urban growth (design doc §5).
// Starting numbers; to be tuned.

export interface TierRules {
  id: SettlementTier;
  name: string;
  // Tokens the settlement is worth; a conversion costs the difference from the tier below.
  value: number;
  support: number;
  urbanGrowth: number;
  // Tokens one civilization needs in the area to attack the settlement, and the tokens it fights
  // as (design doc §11).
  attack: number;
  defense: number;
  // Base manpower (design doc §5, Tier abilities).
  manpower: number;
  // Instability (local plus civ-wide) at which the settlement collapses (design doc §10).
  threshold: number;
  // Currency paid into the treasury each resources phase (design doc §6, Currency).
  tax: number;
  // Share of the owner's treasury a capturer takes (design doc §11, Spoils).
  spoils: number;
}

export const TIERS: readonly TierRules[] = [
  { id: 'village', name: 'Village', value: 6, support: 2, urbanGrowth: 0, attack: 5, defense: 4, manpower: 1, threshold: 8, tax: 0, spoils: 0.1 },
  { id: 'town', name: 'Town', value: 12, support: 3, urbanGrowth: 1, attack: 10, defense: 9, manpower: 2, threshold: 10, tax: 1, spoils: 0.2 },
  { id: 'city', name: 'City', value: 20, support: 4, urbanGrowth: 2, attack: 15, defense: 14, manpower: 3, threshold: 12, tax: 2, spoils: 0.3 },
  { id: 'metropolis', name: 'Metropolis', value: 30, support: 6, urbanGrowth: 3, attack: 22, defense: 21, manpower: 4, threshold: 14, tax: 3, spoils: 0.4 },
];

export const NAME_MAX_LENGTH = 32;

export function tierRules(tier: SettlementTier): TierRules {
  return TIERS.find((t) => t.id === tier)!;
}

export function settlementAt(state: GameState, area: AreaId): Settlement | undefined {
  return state.settlements.find((s) => s.area === area);
}

// The tier a conversion here builds: a village on open land, else the next tier up.
export function nextTier(state: GameState, area: AreaId): TierRules | undefined {
  const here = settlementAt(state, area);
  return here ? TIERS[TIERS.indexOf(tierRules(here.tier)) + 1] : TIERS[0];
}

// Tokens a conversion consumes: the full value for a village, the difference for an upgrade.
export function conversionCost(tier: SettlementTier): number {
  const i = TIERS.indexOf(tierRules(tier));
  return TIERS[i]!.value - (TIERS[i - 1]?.value ?? 0);
}

function plural(tier: TierRules): string {
  return tier.id === 'city' ? 'Cities' : `${tier.name}s`;
}

// Problems that block a conversion both when ordered and when resolved.
function conversionProblem(state: GameState, map: GameMap, playerId: PlayerId, area: AreaId): string | null {
  const player = state.players.find((p) => p.id === playerId)!;
  if (map.areas[area]?.kind !== 'land') return 'Settlements are built on land';
  const here = settlementAt(state, area);
  if (here && here.player !== playerId) return "Another civilization's settlement is here";
  const tier = nextTier(state, area);
  if (!tier) return 'This settlement is already a metropolis';
  if (!player.tiers.includes(tier.id)) return `${plural(tier)} are not unlocked yet`;
  return null;
}

export function validateConversionOrder(ctx: Pick<Context, 'state' | 'map'>, command: Extract<Command, { type: 'orderConversion' }>): string | null {
  const { state, map } = ctx;
  const player = state.players.find((p) => p.id === command.player);
  if (!player) return `Unknown player "${command.player}"`;
  if (state.phase !== 'allocation') return 'Settlements are founded and upgraded in the allocation phase';
  if (player.endedPhase) return `Player "${command.player}" already ended phase "allocation"`;
  if (!command.ordered) {
    const exists = state.conversions.some((o) => o.player === command.player && o.area === command.area);
    return exists ? null : 'No conversion is ordered there';
  }
  return conversionProblem(state, map, command.player, command.area);
}

export function setConversionOrder(ctx: Context, command: Extract<Command, { type: 'orderConversion' }>): void {
  const orders = ctx.state.conversions.filter((o) => !(o.player === command.player && o.area === command.area));
  if (command.ordered) orders.push({ player: command.player, area: command.area });
  const index = new Map(ctx.state.players.map((p, i) => [p.id, i]));
  orders.sort((a, b) => a.area - b.area || index.get(a.player)! - index.get(b.player)!);
  ctx.state.conversions = orders;
}

export function validateName(ctx: Pick<Context, 'state'>, command: Extract<Command, { type: 'nameSettlement' }>): string | null {
  const here = settlementAt(ctx.state, command.area);
  if (!here || here.player !== command.player) return 'You have no settlement there';
  if (command.name.trim().length > NAME_MAX_LENGTH) return `Names are at most ${NAME_MAX_LENGTH} characters`;
  return null;
}

export function nameSettlement(ctx: Context, command: Extract<Command, { type: 'nameSettlement' }>): void {
  const here = settlementAt(ctx.state, command.area)!;
  const name = command.name.trim();
  if (name) here.name = name;
  else delete here.name;
}

// The area's own tokens first, then adjacent land areas holding the most of the player's tokens
// (lower area ids break ties). Returns null when fewer than `need` are in reach.
function drawTokens(state: GameState, map: GameMap, player: PlayerId, area: AreaId, need: number): TokenSource[] | null {
  const neighbors = map.areas[area]!.neighbors
    .filter((n) => map.areas[n]!.kind === 'land')
    .sort((a, b) => tokensAt(state, b, player) - tokensAt(state, a, player) || a - b);
  const from: TokenSource[] = [];
  let left = need;
  for (const source of [area, ...neighbors]) {
    const take = Math.min(left, tokensAt(state, source, player));
    if (take <= 0) continue;
    from.push({ area: source, count: take });
    left -= take;
    if (left === 0) return from;
  }
  return null;
}

export function tokensInReach(state: GameState, map: GameMap, player: PlayerId, area: AreaId): number {
  const land = map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
  return [area, ...land].reduce((sum, a) => sum + tokensAt(state, a, player), 0);
}

// Resolution step 3: conversions resolve in area order, from positions after movement.
export function resolveConversion(ctx: Context): void {
  const { state, map } = ctx;
  for (const order of state.conversions) {
    const fail = (reason: string) => emit(ctx, { type: 'conversionFailed', player: order.player, area: order.area, reason });
    const problem = conversionProblem(state, map, order.player, order.area);
    if (problem) {
      fail(problem);
      continue;
    }
    if (state.stacks.some((s) => s.area === order.area && s.player !== order.player)) {
      fail("Another civilization's tokens are in the area");
      continue;
    }
    const tier = nextTier(state, order.area)!;
    const need = conversionCost(tier.id);
    const from = drawTokens(state, map, order.player, order.area, need);
    if (!from) {
      fail(`Needs ${need} tokens in or next to the area; ${tokensInReach(state, map, order.player, order.area)} in reach`);
      continue;
    }
    for (const f of from) adjust(state, f.area, order.player, -f.count);
    const here = settlementAt(state, order.area);
    if (here) {
      const before = tierRules(here.tier).manpower;
      here.tier = tier.id;
      addManpower(ctx, here, tier.manpower - before);
    } else {
      const built: Settlement = { area: order.area, player: order.player, tier: tier.id };
      resetWork(ctx, built);
      state.settlements.push(built);
      state.settlements.sort((a, b) => a.area - b.area);
    }
    emit(ctx, { type: 'settlementBuilt', player: order.player, area: order.area, tier: tier.id, from });
  }
  state.conversions = [];
}

// Food one player holds in one area for the support check: what a settlement there stored last
// turn, food that spoils, and food that keeps (design doc §6, Storage). Used in that order, so
// food that keeps is left over to store.
interface Pantry {
  stored: number;
  spoils: number;
  keeps: number;
}

function pantryOf(state: GameState, content: Content, area: AreaId, player: PlayerId): Pantry {
  const here = settlementAt(state, area);
  const pantry: Pantry = { stored: here?.player === player ? (here.stored ?? 0) : 0, spoils: 0, keeps: 0 };
  for (const g of state.goods) {
    if (g.area !== area || g.player !== player || !isFood(content, g.resource)) continue;
    if (storeCap(state, player, g.resource) > 0) pantry.keeps += g.count;
    else pantry.spoils += g.count;
  }
  return pantry;
}

// Food bought on the market: it does not keep.
function poolOf(state: GameState, content: Content, player: PlayerId): Pantry {
  const spoils = state.goods.reduce((sum, g) => (g.area === null && g.player === player && isFood(content, g.resource) ? sum + g.count : sum), 0);
  return { stored: 0, spoils, keeps: 0 };
}

function takeFood(pantry: Pantry, want: number): number {
  let got = 0;
  for (const kind of ['stored', 'spoils', 'keeps'] as const) {
    const take = Math.min(pantry[kind], want - got);
    pantry[kind] -= take;
    got += take;
  }
  return got;
}

// Food a player's settlements keep into the next turn: the most any of its food goods allows.
function keepLimit(state: GameState, content: Content, player: PlayerId): number {
  return Math.max(0, ...content.resources.filter((r) => r.food).map((r) => storeCap(state, player, r.id)));
}

// Support each settlement receives: loose tokens of its civilization in adjacent unsettled areas,
// one settlement per token. Larger tiers claim first, then lower area ids (design doc §5). Then
// food covers what tokens could not, 1 food per token, from the settlement's own goods and stores
// or those of its civilization's settlements one transport step away (adjacent, or along a river
// with Dugout Canoes), in the same order (design doc §6, Food). `support` counts both; `fed` is the
// food part; `ateOwn` holds the settlements that gathered food and ate some of their own; `kept` is
// the food each settlement stores for next turn; `left` the food goods not eaten or stored, by
// "area:player" ("pool:player" for food bought). Also returns the tokens left over, by "area:player".
export function allocateSupport(
  state: GameState,
  map: GameMap,
  content: Content,
): { support: Map<AreaId, number>; fed: Map<AreaId, number>; ateOwn: Set<AreaId>; kept: Map<AreaId, number>; left: Map<string, number>; spare: Map<string, number> } {
  const spare = new Map(state.stacks.map((s) => [`${s.area}:${s.player}`, s.count]));
  const order = [...state.settlements].sort((a, b) => tierRules(b.tier).value - tierRules(a.tier).value || a.area - b.area);
  const support = new Map<AreaId, number>();
  const fed = new Map<AreaId, number>();
  const ateOwn = new Set<AreaId>();
  const pantries = new Map<string, Pantry>();
  const pantry = (area: AreaId, player: PlayerId) => {
    const key = `${area}:${player}`;
    if (!pantries.has(key)) pantries.set(key, pantryOf(state, content, area, player));
    return pantries.get(key)!;
  };
  for (const s of order) {
    const need = tierRules(s.tier).support;
    let got = 0;
    for (const n of [...map.areas[s.area]!.neighbors].sort((a, b) => a - b)) {
      if (got === need) break;
      if (settlementAt(state, n)) continue;
      const key = `${n}:${s.player}`;
      const take = Math.min(spare.get(key) ?? 0, need - got);
      if (take <= 0) continue;
      spare.set(key, spare.get(key)! - take);
      got += take;
    }
    support.set(s.area, got);
  }
  for (const s of order) {
    const need = tierRules(s.tier).support;
    let got = 0;
    for (const a of [s.area, ...transportNeighbors(map, s.area, riverLeg(state, s.player))]) {
      if (support.get(s.area)! + got >= need) break;
      const gathering = a === s.area && state.goods.some((g) => g.area === a && g.player === s.player && g.count > 0 && isFood(content, g.resource));
      const take = takeFood(pantry(a, s.player), need - support.get(s.area)! - got);
      if (gathering && take > 0) ateOwn.add(s.area);
      got += take;
    }
    if (got === 0) continue;
    fed.set(s.area, got);
    support.set(s.area, support.get(s.area)! + got);
  }
  // Food bought on the market covers any shortfall left, in the same order (design doc §7).
  const pools = new Map<PlayerId, Pantry>();
  for (const s of order) {
    const short = tierRules(s.tier).support - support.get(s.area)!;
    if (short <= 0) continue;
    if (!pools.has(s.player)) pools.set(s.player, poolOf(state, content, s.player));
    const take = takeFood(pools.get(s.player)!, short);
    if (take === 0) continue;
    fed.set(s.area, (fed.get(s.area) ?? 0) + take);
    support.set(s.area, support.get(s.area)! + take);
  }
  const kept = new Map<AreaId, number>();
  const left = new Map<string, number>();
  for (const s of state.settlements) {
    const rest = pantry(s.area, s.player);
    const keep = Math.min(keepLimit(state, content, s.player), rest.stored + rest.keeps);
    if (keep > 0) kept.set(s.area, keep);
    left.set(`${s.area}:${s.player}`, rest.spoils + rest.keeps - Math.max(0, keep - rest.stored));
  }
  for (const p of state.players) left.set(`pool:${p.id}`, (pools.get(p.id) ?? poolOf(state, content, p.id)).spoils);
  return { support, fed, ateOwn, kept, left, spare };
}

export function assignSupport(state: GameState, map: GameMap, content: Content): Map<AreaId, number> {
  return allocateSupport(state, map, content).support;
}

// Food goods eaten or stored leave the civilization's goods, so only what is left can build
// wonders (design doc §9, support comes first). Food that spoils goes first, as in the check.
function eatFood(state: GameState, content: Content, left: Map<string, number>): void {
  for (const [key, rest] of left) {
    const [where, player] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const area = where === 'pool' ? null : Number(where);
    const food = state.goods
      .filter((g) => g.player === player && g.area === area && isFood(content, g.resource))
      .sort((a, b) => Number(storeCap(state, player, a.resource) > 0) - Number(storeCap(state, player, b.resource) > 0));
    let over = food.reduce((sum, g) => sum + g.count, 0) - rest;
    for (const g of food) {
      const n = Math.min(over, g.count);
      g.count -= n;
      over -= n;
    }
  }
  state.goods = state.goods.filter((g) => g.count > 0);
}

// Resolution step 6: a settlement short of support drops one tier. Food that keeps and is left
// over is stored for next turn's check (Pottery).
export function resolveSupport(ctx: Context): void {
  const { support, fed, ateOwn, kept, left } = allocateSupport(ctx.state, ctx.map, ctx.content);
  eatFood(ctx.state, ctx.content, left);
  for (const s of ctx.state.settlements) {
    if (ateOwn.has(s.area)) s.ateOwn = ctx.state.turn;
    const count = fed.get(s.area);
    if (count) {
      s.fed = ctx.state.turn;
      emit(ctx, { type: 'foodSupport', player: s.player, area: s.area, count });
    }
    const keep = kept.get(s.area);
    if (keep) s.stored = keep;
    else delete s.stored;
  }
  const short = ctx.state.settlements.filter((s) => support.get(s.area)! < tierRules(s.tier).support);
  for (const s of short) dropTier(ctx, s);
}

// One tier down (design doc §5, Tier drop). A village dissolves. The freed tokens become refugees.
export function dropTier(ctx: Context, settlement: Settlement): void {
  const { state } = ctx;
  const i = TIERS.indexOf(tierRules(settlement.tier));
  const freed = conversionCost(settlement.tier);
  const below = TIERS[i - 1];
  if (below) {
    settlement.tier = below.id;
    trimWork(state, settlement);
  } else state.settlements = state.settlements.filter((s) => s !== settlement);
  const placed = placeRefugees(ctx, settlement.player, settlement.area, freed, !below);
  emit(ctx, { type: 'settlementDropped', player: settlement.player, area: settlement.area, tier: below?.id ?? null, refugees: placed, lost: freed - placed });
}

function addRefugees(ctx: Context, area: AreaId, player: PlayerId, count: number): void {
  adjust(ctx.state, area, player, count);
  const r = ctx.refugees.find((x) => x.area === area && x.player === player);
  if (r) r.count += count;
  else ctx.refugees.push({ area, player, count });
}

// Refugees fill the dissolved settlement's own area up to its limit, then go one at a time to
// adjacent unsettled areas that are the player's own or empty, most room first. Other
// civilizations' areas take them only when there is nowhere else. Returns how many were placed.
function placeRefugees(ctx: Context, player: PlayerId, area: AreaId, count: number, dissolved: boolean): number {
  const { state, map } = ctx;
  const totals = areaTotals(state);
  const room = (a: AreaId) => looseLimit(state, map, a) - (totals.get(a) ?? 0);
  let left = count;
  if (dissolved) {
    const put = Math.min(left, Math.max(0, room(area)));
    if (put > 0) {
      addRefugees(ctx, area, player, put);
      totals.set(area, (totals.get(area) ?? 0) + put);
      left -= put;
    }
  }
  const open = map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land' && !settlementAt(state, n));
  const ownOrEmpty = open.filter((n) => !state.stacks.some((s) => s.area === n && s.player !== player));
  const targets = ownOrEmpty.length > 0 ? ownOrEmpty : open;
  if (targets.length === 0) {
    if (!dissolved) return count - left;
    // Nowhere to go: they stay in the dissolved area, over its limit, until next turn.
    if (left > 0) addRefugees(ctx, area, player, left);
    return count;
  }
  while (left > 0) {
    const to = [...targets].sort((a, b) => room(b) - room(a) || a - b)[0]!;
    addRefugees(ctx, to, player, 1);
    totals.set(to, (totals.get(to) ?? 0) + 1);
    left -= 1;
  }
  return count;
}

// Urban growth, part of resolution step 8: settlements add tokens to adjacent unsettled areas that
// are the civilization's own or empty and have room, most room first; within the token cap. Towns
// and larger add by tier, and any settlement that gathered food and ate its own this turn adds 1
// more. Growth with nowhere to go is lost.
export function urbanGrowthOf(state: GameState, s: Settlement): number {
  return tierRules(s.tier).urbanGrowth + (s.ateOwn === state.turn ? 1 : 0);
}

export function resolveUrbanGrowth(ctx: Context): void {
  const { state, map } = ctx;
  const totals = areaTotals(state);
  for (const s of [...state.settlements]) {
    const player = state.players.find((p) => p.id === s.player)!;
    const room = (a: AreaId) => looseLimit(state, map, a) - (totals.get(a) ?? 0);
    const added = new Map<AreaId, number>();
    for (let k = 0; k < urbanGrowthOf(state, s); k++) {
      if (looseTokens(state, player.id) >= player.tokenCap) break;
      const to = map.areas[s.area]!.neighbors
        .filter((n) => map.areas[n]!.kind === 'land' && room(n) > 0 && !state.stacks.some((x) => x.area === n && x.player !== player.id))
        .sort((a, b) => room(b) - room(a) || a - b)[0];
      if (to === undefined) break;
      adjust(state, to, player.id, 1);
      totals.set(to, (totals.get(to) ?? 0) + 1);
      added.set(to, (added.get(to) ?? 0) + 1);
    }
    for (const [to, count] of [...added].sort((a, b) => a[0] - b[0])) emit(ctx, { type: 'urbanGrowth', player: player.id, from: s.area, to, count });
  }
}

// What a player's ordered conversions would do if the turn resolved now, with this turn's planned
// moves: the interface shows it while planning. Calamities are not predicted.
export interface ConversionPreview {
  area: AreaId;
  tier: SettlementTier;
  built: boolean;
  reason?: string;
  from: TokenSource[];
  // Loose tokens left in the area afterwards, removed as surplus.
  leftover: number;
  support: number;
  needed: number;
}

// The state after this turn's movement, conflict, and conversions, as resolution would leave it
// before the support check, from the orders given so far. Calamities are not predicted.
export function projectTurn(state: GameState, map: GameMap, content: Content): { state: GameState; events: Context['events'] } {
  const ctx: Context = { state: clone(state), content, map, events: [], refugees: [] };
  resolveMovement(ctx);
  resolveConflict(ctx);
  resolveConversion(ctx);
  return { state: ctx.state, events: ctx.events };
}

export function previewConversions(state: GameState, map: GameMap, content: Content, player: PlayerId): ConversionPreview[] {
  const orders = state.conversions.filter((o) => o.player === player);
  const tiers = new Map(orders.map((o) => [o.area, nextTier(state, o.area)?.id ?? 'metropolis']));
  const projected = projectTurn(state, map, content);
  const support = assignSupport(projected.state, map, content);
  return orders.map((o) => {
    const tier = tiers.get(o.area)!;
    const preview: ConversionPreview = { area: o.area, tier, built: false, from: [], leftover: 0, support: 0, needed: tierRules(tier).support };
    for (const { event } of projected.events) {
      if (event.type === 'settlementBuilt' && event.area === o.area && event.player === player) {
        preview.built = true;
        preview.from = event.from;
        preview.leftover = tokensAt(projected.state, o.area, player);
        preview.support = support.get(o.area) ?? 0;
      }
      if (event.type === 'conversionFailed' && event.area === o.area && event.player === player) preview.reason = event.reason;
    }
    return preview;
  });
}

// A civilization's support at this turn's support check, with its planned moves and conversions
// (the Civilization overview).
export interface SupportSummary {
  // Support all settlements need, and how much they get.
  needed: number;
  supplied: number;
  // Loose tokens not supporting any settlement.
  free: number;
  // Support counts food; `food` is the part food covers; `ateOwn` when it eats its own gathered
  // food, for +1 urban growth.
  settlements: { area: AreaId; tier: SettlementTier; support: number; food: number; ateOwn: boolean; needed: number }[];
  // Unsettled areas where a new village would have its 6 tokens and 2 support from free tokens
  // alone: at least 8 free tokens in the area and its neighbors.
  villageSites: AreaId[];
}

export function supportSummary(state: GameState, map: GameMap, content: Content, player: PlayerId): SupportSummary {
  const projected = projectTurn(state, map, content).state;
  const { support, fed, ateOwn, spare } = allocateSupport(projected, map, content);
  const free = (area: AreaId) => spare.get(`${area}:${player}`) ?? 0;
  const settlements = projected.settlements
    .filter((s) => s.player === player)
    .map((s) => ({ area: s.area, tier: s.tier, support: support.get(s.area)!, food: fed.get(s.area) ?? 0, ateOwn: ateOwn.has(s.area), needed: tierRules(s.tier).support }));
  const villageCost = TIERS[0]!.value + TIERS[0]!.support;
  const villageSites = map.areas
    .filter((a) => a.kind === 'land' && !settlementAt(projected, a.id) && !projected.stacks.some((s) => s.area === a.id && s.player !== player))
    .filter((a) => [a.id, ...a.neighbors.filter((n) => map.areas[n]!.kind === 'land')].reduce((sum, n) => sum + free(n), 0) >= villageCost)
    .map((a) => a.id);
  return {
    needed: settlements.reduce((sum, s) => sum + s.needed, 0),
    supplied: settlements.reduce((sum, s) => sum + s.support, 0),
    free: projected.stacks.filter((s) => s.player === player).reduce((sum, s) => sum + free(s.area), 0),
    settlements,
    villageSites,
  };
}
