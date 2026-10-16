import { emit } from './context';
import type { AreaId } from './map/types';
import type { Context, GameState, MoveOrder, PlayerId, Stack } from './types';

// Loose tokens: movement, growth, and surplus removal (design doc §4).

export const STARTING_TOKEN_CAP = 55;

export function tokensAt(state: GameState, area: AreaId, player: PlayerId): number {
  return state.stacks.find((s) => s.area === area && s.player === player)?.count ?? 0;
}

export function looseTokens(state: GameState, player: PlayerId): number {
  return state.stacks.reduce((sum, s) => (s.player === player ? sum + s.count : sum), 0);
}

// Tokens already ordered out of an area, leaving out one order (the one being changed).
function orderedOut(state: GameState, player: PlayerId, from: AreaId, except: AreaId): number {
  return state.orders.reduce((sum, o) => (o.player === player && o.from === from && o.to !== except ? sum + o.count : sum), 0);
}

export function validateMoveOrder(ctx: Pick<Context, 'state' | 'map'>, order: MoveOrder): string | null {
  const { state, map } = ctx;
  const player = state.players.find((p) => p.id === order.player);
  if (!player) return `Unknown player "${order.player}"`;
  if (state.phase !== 'allocation') return 'Movement is ordered in the allocation phase';
  if (player.endedPhase) return `Player "${order.player}" already ended phase "allocation"`;
  if (!Number.isInteger(order.count) || order.count < 0) return 'Token count must be a whole number, 0 or more';
  const from = map.areas[order.from];
  const to = map.areas[order.to];
  if (!from || !to) return 'Unknown area';
  if (!from.neighbors.includes(order.to)) return 'Tokens move one adjacent area per turn';
  // Rivers and seas need ships (§4), which no one has yet.
  if (to.kind !== 'land') return 'Moving by sea requires ships';
  const available = tokensAt(state, order.from, order.player) - orderedOut(state, order.player, order.from, order.to);
  if (order.count > available) return `Only ${available} token${available === 1 ? '' : 's'} left to move from that area`;
  return null;
}

export function setMoveOrder(ctx: Context, order: MoveOrder): void {
  const orders = ctx.state.orders.filter((o) => !(o.player === order.player && o.from === order.from && o.to === order.to));
  if (order.count > 0) orders.push({ player: order.player, from: order.from, to: order.to, count: order.count });
  orders.sort((a, b) => a.from - b.from || a.to - b.to || compare(a.player, b.player));
  ctx.state.orders = orders;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Adds `delta` to a player's stack in an area, dropping empty stacks and keeping a stable order.
function adjust(state: GameState, area: AreaId, player: PlayerId, delta: number): void {
  const stack = state.stacks.find((s) => s.area === area && s.player === player);
  if (stack) stack.count += delta;
  else state.stacks.push({ area, player, count: delta });
  const order = new Map(state.players.map((p, i) => [p.id, i]));
  state.stacks = state.stacks
    .filter((s) => s.count > 0)
    .sort((a, b) => a.area - b.area || order.get(a.player)! - order.get(b.player)!);
}

// Resolution step 1: every order moves at once, from the positions at the end of allocation.
export function resolveMovement(ctx: Context): void {
  const { state } = ctx;
  for (const o of state.orders) adjust(state, o.from, o.player, -o.count);
  for (const o of state.orders) {
    adjust(state, o.to, o.player, o.count);
    emit(ctx, { type: 'tokensMoved', player: o.player, from: o.from, to: o.to, count: o.count });
  }
  state.orders = [];
}

function areaTotals(state: GameState): Map<AreaId, number> {
  const totals = new Map<AreaId, number>();
  for (const s of state.stacks) totals.set(s.area, (totals.get(s.area) ?? 0) + s.count);
  return totals;
}

// Resolution step 8: an area with 1 loose token gains 1, with 2 or more gains 2, never past the
// area's limit or the civilization's cap. Growth is counted from the tokens present before any of
// it is added. When the limit or cap runs out, lower area ids, then earlier players, grow first.
export function resolveGrowth(ctx: Context): void {
  const { state, map } = ctx;
  const totals = areaTotals(state);
  const room = new Map(state.players.map((p) => [p.id, p.tokenCap - looseTokens(state, p.id)]));
  const grown = new Map<PlayerId, number>();
  for (const s of [...state.stacks]) {
    const add = Math.min(s.count >= 2 ? 2 : 1, map.areas[s.area]!.limit - totals.get(s.area)!, room.get(s.player)!);
    if (add <= 0) continue;
    totals.set(s.area, totals.get(s.area)! + add);
    room.set(s.player, room.get(s.player)! - add);
    grown.set(s.player, (grown.get(s.player) ?? 0) + add);
    adjust(state, s.area, s.player, add);
  }
  for (const p of state.players) {
    const count = grown.get(p.id);
    if (count) emit(ctx, { type: 'tokensGrew', player: p.id, count });
  }
}

// Resolution step 9: tokens over an area's limit are removed. Areas shared by several
// civilizations are left to conflict (§11), which runs earlier in resolution.
export function resolveSurplus(ctx: Context): void {
  const { state, map } = ctx;
  const byArea = new Map<AreaId, Stack[]>();
  for (const s of state.stacks) byArea.set(s.area, [...(byArea.get(s.area) ?? []), s]);
  for (const [area, stacks] of byArea) {
    const [only] = stacks;
    if (stacks.length !== 1 || !only) continue;
    const over = only.count - map.areas[area]!.limit;
    if (over <= 0) continue;
    adjust(state, area, only.player, -over);
    emit(ctx, { type: 'surplusRemoved', player: only.player, area, count: over });
  }
}
