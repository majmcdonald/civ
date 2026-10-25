import type { Content } from './content';
import { emit } from './context';
import { marketAccess, marketReach, riverLeg, storeCap, transportNeighbors } from './effects';
import type { AreaId, GameMap, ResourceId } from './map/types';
import { usable } from './resources';
import type { Command, Context, GameState, MarketOrder, PlayerId } from './types';

// The market (design doc §7). Each player's market holds its own orders and those of every player
// in reach with market access. Each turn, at the close of the trade phase, a good's price moves by
// the imbalance of units ordered bought and sold in that market, then the player's own orders fill
// against the game at the new price: sales first, then purchases as far as the treasury allows.
// Bought goods go to the civilization's pool.

// Steps of transport distance, settlement to settlement, before Barter Mastered.
export const BASE_REACH = 2;
// Price change per unit of imbalance, as a share of the starting price.
export const PRICE_STEP = 0.1;
// Prices stay within these multiples of the starting price.
export const PRICE_FLOOR = 0.5;
export const PRICE_CEILING = 3;
export const ORDER_MAX = 99;

const playerOf = (state: GameState, id: PlayerId) => state.players.find((p) => p.id === id)!;

function startPrice(content: Content, resource: ResourceId): number {
  return content.resources.find((r) => r.id === resource)!.price;
}

// The unrounded price in a player's market.
export function exactPrice(state: GameState, content: Content, player: PlayerId, resource: ResourceId): number {
  return playerOf(state, player).prices[resource] ?? startPrice(content, resource);
}

// The price trades fill at: the market price rounded to whole currency.
export function priceOf(state: GameState, content: Content, player: PlayerId, resource: ResourceId): number {
  return Math.round(exactPrice(state, content, player, resource));
}

export function priceBounds(content: Content, resource: ResourceId): { min: number; max: number } {
  const start = startPrice(content, resource);
  return { min: start * PRICE_FLOOR, max: start * PRICE_CEILING };
}

// The price after `imbalance` more units bought than sold.
export function movedPrice(content: Content, resource: ResourceId, price: number, imbalance: number): number {
  const { min, max } = priceBounds(content, resource);
  return Math.min(max, Math.max(min, price + PRICE_STEP * startPrice(content, resource) * imbalance));
}

// A civilization trades once it has market access and a settlement to trade from.
export function canTrade(state: GameState, player: PlayerId): boolean {
  return marketAccess(state, player) && state.settlements.some((s) => s.player === player);
}

export function reachOf(state: GameState, player: PlayerId): number {
  return BASE_REACH + marketReach(state, player);
}

// Areas within `max` transport steps of any of `from`.
function within(map: GameMap, from: AreaId[], leg: number, max: number): Set<AreaId> {
  const seen = new Set(from);
  let frontier = from;
  for (let step = 0; step < max && frontier.length > 0; step++) {
    const next: AreaId[] = [];
    for (const a of frontier) {
      for (const n of transportNeighbors(map, a, leg)) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

// Whether `a` reaches one of `b`'s settlements from one of its own.
function reaches(state: GameState, map: GameMap, a: PlayerId, b: PlayerId): boolean {
  const own = state.settlements.filter((s) => s.player === a).map((s) => s.area);
  const near = within(map, own, riverLeg(state, a), reachOf(state, a));
  return state.settlements.some((s) => s.player === b && near.has(s.area));
}

// The players in a player's market, itself first, then the others in player order. Reach is
// mutual and direct only (design doc §7).
export function marketOf(state: GameState, map: GameMap, player: PlayerId): PlayerId[] {
  if (!canTrade(state, player)) return [];
  const others = state.players.filter((p) => p.id !== player && canTrade(state, p.id) && (reaches(state, map, player, p.id) || reaches(state, map, p.id, player)));
  return [player, ...others.map((p) => p.id)];
}

// Units of a good the player holds to sell: goods gathered this turn, and stored food of a kind
// that keeps (Pottery's grain).
export function held(state: GameState, player: PlayerId, resource: ResourceId): number {
  const goods = state.goods.reduce((sum, g) => (g.player === player && g.resource === resource ? sum + g.count : sum), 0);
  const stored = storeCap(state, player, resource) > 0 ? state.settlements.reduce((sum, s) => (s.player === player ? sum + (s.stored ?? 0) : sum), 0) : 0;
  return goods + stored;
}

// Units an order puts into the imbalance: a sale counts only what is held.
function units(state: GameState, player: PlayerId, order: MarketOrder): number {
  return order.side === 'buy' ? order.count : -Math.min(order.count, held(state, player, order.resource));
}

// Units bought minus sold of a good in a player's market, from the standing orders.
export function imbalance(state: GameState, map: GameMap, player: PlayerId, resource: ResourceId, members = marketOf(state, map, player)): number {
  return members.reduce((sum, m) => sum + playerOf(state, m).orders.filter((o) => o.resource === resource).reduce((n, o) => n + units(state, m, o), 0), 0);
}

function fills(order: MarketOrder, price: number): boolean {
  if (order.limit === undefined) return true;
  return order.side === 'buy' ? price <= order.limit : price >= order.limit;
}

// Removes sold goods: this turn's goods by area, then stored food.
function removeHeld(state: GameState, player: PlayerId, resource: ResourceId, count: number): void {
  let left = count;
  for (const g of state.goods.filter((x) => x.player === player && x.resource === resource).sort((x, y) => (x.area ?? -1) - (y.area ?? -1))) {
    const take = Math.min(left, g.count);
    g.count -= take;
    left -= take;
  }
  state.goods = state.goods.filter((g) => g.count > 0);
  for (const s of state.settlements.filter((x) => x.player === player)) {
    if (left === 0) break;
    const take = Math.min(left, s.stored ?? 0);
    if (take === 0) continue;
    s.stored! -= take;
    if (s.stored === 0) delete s.stored;
    left -= take;
  }
}

// The close of the trade phase (phase 2): prices move in every market, then orders fill.
export function resolveMarket(ctx: Context): void {
  const { state, map, content } = ctx;
  const traders = state.players.filter((p) => canTrade(state, p.id));
  if (traders.length === 0) return;
  const moves = traders.flatMap((p) => {
    const members = marketOf(state, map, p.id);
    return content.resources.map((r) => ({ player: p, resource: r.id, imbalance: imbalance(state, map, p.id, r.id, members) })).filter((m) => m.imbalance !== 0);
  });
  for (const m of moves) {
    const from = exactPrice(state, content, m.player.id, m.resource);
    const to = movedPrice(content, m.resource, from, m.imbalance);
    if (to === from) continue;
    m.player.prices[m.resource] = to;
    emit(ctx, { type: 'priceChanged', player: m.player.id, resource: m.resource, from, to, imbalance: m.imbalance });
  }
  for (const p of traders) {
    const traded = new Set<ResourceId>();
    const orders = [...p.orders.filter((o) => o.side === 'sell'), ...p.orders.filter((o) => o.side === 'buy')];
    for (const order of orders) {
      const price = priceOf(state, content, p.id, order.resource);
      if (!fills(order, price)) continue;
      const count = order.side === 'sell' ? Math.min(order.count, held(state, p.id, order.resource)) : Math.min(order.count, Math.floor(p.treasury / price));
      if (count <= 0) continue;
      if (order.side === 'sell') {
        removeHeld(state, p.id, order.resource, count);
        p.treasury += count * price;
      } else {
        p.treasury -= count * price;
        state.goods.push({ area: null, player: p.id, resource: order.resource, count });
      }
      traded.add(order.resource);
      emit(ctx, { type: 'marketTrade', player: p.id, resource: order.resource, side: order.side, count, price });
    }
    if (traded.size > 0) p.traded = { turn: state.turn, resources: [...traded] };
  }
}

export function validateOrder(ctx: Pick<Context, 'state' | 'content'>, command: Extract<Command, { type: 'setOrder' }>): string | null {
  const { state, content } = ctx;
  const player = state.players.find((p) => p.id === command.player);
  if (!player) return `Unknown player "${command.player}"`;
  if (state.phase !== 'trade') return 'Market orders are placed in the trade phase';
  if (player.endedPhase) return 'You have already ended the trade phase';
  if (!marketAccess(state, command.player)) return 'No market access (Barter)';
  if (!content.resources.some((r) => r.id === command.resource)) return `Unknown good "${command.resource}"`;
  if (!Number.isInteger(command.count) || command.count < 0 || command.count > ORDER_MAX) return `Order between 0 and ${ORDER_MAX} units`;
  if (command.limit !== undefined && !(Number.isInteger(command.limit) && command.limit > 0)) return 'A limit is a whole price above 0';
  if (command.count > 0 && command.side === 'sell' && !usable(state, content, command.player, command.resource)) return 'You can sell only goods you can use';
  return null;
}

export function setOrder(ctx: Context, command: Extract<Command, { type: 'setOrder' }>): void {
  const player = playerOf(ctx.state, command.player);
  const kept = player.orders.filter((o) => o.resource !== command.resource);
  if (command.count === 0) {
    player.orders = kept;
    return;
  }
  const order: MarketOrder = { resource: command.resource, side: command.side, count: command.count, ...(command.limit !== undefined ? { limit: command.limit } : {}) };
  const rank = (o: MarketOrder) => ctx.content.resources.findIndex((r) => r.id === o.resource);
  player.orders = [...kept, order].sort((a, b) => rank(a) - rank(b));
}

export interface GoodView {
  resource: ResourceId;
  name: string;
  food: boolean;
  luxury: boolean;
  start: number;
  // The price orders fill at now, and unrounded.
  price: number;
  exact: number;
  min: number;
  max: number;
  held: number;
  canSell: boolean;
  order: MarketOrder | null;
  // Units bought minus sold in the player's market from the standing orders, and the price they
  // would move it to at the close of the trade phase.
  imbalance: number;
  forecast: number;
}

export interface MarketView {
  access: boolean;
  // Access and a settlement to trade from.
  trading: boolean;
  reach: number;
  // Players in the market, the player first.
  members: PlayerId[];
  goods: GoodView[];
}

// Everything the Market screen shows (design doc §7), with the sources behind each number.
export function marketView(state: GameState, map: GameMap, content: Content, player: PlayerId): MarketView {
  const members = marketOf(state, map, player);
  const me = playerOf(state, player);
  const goods = content.resources.map((r): GoodView => {
    const exact = exactPrice(state, content, player, r.id);
    const due = members.length > 0 ? imbalance(state, map, player, r.id, members) : 0;
    return {
      resource: r.id,
      name: r.name,
      food: r.food,
      luxury: Boolean(r.luxury),
      start: r.price,
      price: Math.round(exact),
      exact,
      ...priceBounds(content, r.id),
      held: held(state, player, r.id),
      canSell: usable(state, content, player, r.id),
      order: me.orders.find((o) => o.resource === r.id) ?? null,
      imbalance: due,
      forecast: Math.round(movedPrice(content, r.id, exact, due)),
    };
  });
  return { access: marketAccess(state, player), trading: canTrade(state, player), reach: reachOf(state, player), members, goods };
}
