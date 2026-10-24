import { emit } from './context';
import { riverLeg, transportNeighbors } from './effects';
import type { AreaId, GameMap } from './map/types';
import type { Context, GameState, MoveOrder, PlayerId, Stack } from './types';

// Loose tokens: movement, growth, and surplus removal (design doc §4).

export const STARTING_TOKEN_CAP = 55;
// Growth per loose token per turn (design doc §4); resources and discoveries will boost it.
export const GROWTH_PER_TOKEN = 0.5;
// Areas a token moves per turn before transport advances (design doc §4).
export const BASE_MOVEMENT = 1;

export function tokensAt(state: GameState, area: AreaId, player: PlayerId): number {
  return state.stacks.find((s) => s.area === area && s.player === player)?.count ?? 0;
}

// A settled area holds no loose tokens (design doc §5), so its limit for them is 0.
export function looseLimit(state: GameState, map: GameMap, area: AreaId): number {
  return state.settlements.some((s) => s.area === area) ? 0 : map.areas[area]!.limit;
}

export function looseTokens(state: GameState, player: PlayerId): number {
  return state.stacks.reduce((sum, s) => (s.player === player ? sum + s.count : sum), 0);
}

// Tokens already ordered out of an area, leaving out one order (the one being changed).
function orderedOut(state: GameState, player: PlayerId, from: AreaId, except: AreaId): number {
  return state.orders.reduce((sum, o) => (o.player === player && o.from === from && o.to !== except ? sum + o.count : sum), 0);
}

// Land areas a player's tokens can reach from an area this turn (design doc §4, Movement). Each
// step costs 1 movement, except that stepping out of one of the player's own settlements entered
// on the way is free, once per move: plains → own village → hills is one step. With Dugout Canoes,
// one step along a river covers a stretch of up to 3 areas. Settlements count as they stand now
// (planned conversions do not).
export function reachable(state: GameState, map: GameMap, player: PlayerId, from: AreaId): AreaId[] {
  const range = state.players.find((p) => p.id === player)?.movement ?? BASE_MOVEMENT;
  const leg = riverLeg(state, player);
  const own = new Set(state.settlements.filter((s) => s.player === player).map((s) => s.area));
  // Best movement left on reaching each area, with and without the free step used.
  const best = new Map<string, number>();
  const reached = new Set<AreaId>();
  const queue: { area: AreaId; left: number; passed: boolean }[] = [{ area: from, left: range, passed: false }];
  while (queue.length > 0) {
    const { area, left, passed } = queue.shift()!;
    const free = !passed && area !== from && own.has(area);
    const cost = free ? 0 : 1;
    if (left < cost) continue;
    for (const n of transportNeighbors(map, area, leg)) {
      if (n === from) continue;
      const next = { area: n, left: left - cost, passed: passed || free };
      const key = `${n}:${next.passed}`;
      if ((best.get(key) ?? -1) >= next.left) continue;
      best.set(key, next.left);
      reached.add(n);
      queue.push(next);
    }
  }
  return [...reached].sort((a, b) => a - b);
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
  // Rivers and seas need ships (§4), which no one has yet.
  if (to.kind !== 'land') return 'Moving by sea requires ships';
  if (!reachable(state, map, order.player, order.from).includes(order.to)) return 'That area is out of reach this turn';
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
export function adjust(state: GameState, area: AreaId, player: PlayerId, delta: number): void {
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

export function areaTotals(state: GameState): Map<AreaId, number> {
  const totals = new Map<AreaId, number>();
  for (const s of state.stacks) totals.set(s.area, (totals.get(s.area) ?? 0) + s.count);
  return totals;
}

// Resolution step 8: each stack gains 0.5 per token, added to the progress it carries; each whole
// token of progress becomes a token, never past the area's limit or the civilization's cap. A
// stack with no room gains no progress but keeps what it has; whole tokens beyond the room are
// lost and the fraction is kept. Progress lives on the stack, so it is lost with the last token.
// Growth is counted from the tokens present before any of it is added. When the limit or cap runs
// out, lower area ids, then earlier players, grow first.
export function resolveGrowth(ctx: Context): void {
  const { state, map } = ctx;
  const totals = areaTotals(state);
  const room = new Map(state.players.map((p) => [p.id, p.tokenCap - looseTokens(state, p.id)]));
  const grown = new Map<PlayerId, number>();
  for (const s of [...state.stacks]) {
    const space = Math.min(looseLimit(state, map, s.area) - totals.get(s.area)!, room.get(s.player)!);
    if (space <= 0) continue;
    const progress = (s.growth ?? 0) + s.count * GROWTH_PER_TOKEN;
    const whole = Math.floor(progress);
    const fraction = progress - whole;
    if (fraction > 0) s.growth = fraction;
    else delete s.growth;
    const add = Math.min(whole, space);
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

function refugeesAt(ctx: Context, area: AreaId, player: PlayerId): number {
  return ctx.refugees.find((r) => r.area === area && r.player === player)?.count ?? 0;
}

// Resolution step 9: tokens over an area's limit are removed. Areas shared by several
// civilizations are left to conflict (§11), which runs earlier in resolution. Then a civilization
// over its token cap loses the excess from its fullest areas. Refugees placed this turn are exempt
// from both until the next turn (§5).
export function resolveSurplus(ctx: Context): void {
  const { state, map } = ctx;
  const byArea = new Map<AreaId, Stack[]>();
  for (const s of state.stacks) byArea.set(s.area, [...(byArea.get(s.area) ?? []), s]);
  for (const [area, stacks] of byArea) {
    const [only] = stacks;
    if (stacks.length !== 1 || !only) continue;
    const over = only.count - refugeesAt(ctx, area, only.player) - looseLimit(state, map, area);
    if (over <= 0) continue;
    adjust(state, area, only.player, -over);
    emit(ctx, { type: 'surplusRemoved', player: only.player, area, count: over });
  }
  for (const p of state.players) {
    const exempt = ctx.refugees.reduce((sum, r) => (r.player === p.id ? sum + r.count : sum), 0);
    let over = looseTokens(state, p.id) - exempt - p.tokenCap;
    if (over <= 0) continue;
    emit(ctx, { type: 'overCapRemoved', player: p.id, count: over });
    while (over > 0) {
      const removable = (s: Stack) => s.count - refugeesAt(ctx, s.area, p.id);
      const fullest = state.stacks
        .filter((s) => s.player === p.id && removable(s) > 0)
        .sort((a, b) => removable(b) - removable(a) || a.area - b.area)[0]!;
      adjust(state, fullest.area, p.id, -1);
      over -= 1;
    }
  }
}
