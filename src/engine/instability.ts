import type { Content } from './content';
import { emit } from './context';
import { calm, capitalReach, riverLeg, transportNeighbors } from './effects';
import type { AreaId, GameMap } from './map/types';
import { activeWork } from './resources';
import { dropTier, tierRules, TIERS } from './settlements';
import type { Context, GameEvent, GameState, PlayerId, Settlement } from './types';

// Instability and collapse, first version (design doc §10). Each settlement has a local meter and
// each civilization a civ-wide meter that adds to every local one. Meters never fall on their own;
// Bureaucracy manpower lowers them, and the capital has one free unit. Settlements far from the
// capital collapse sooner. Starting numbers; to be tuned.

// Settlements a civilization holds before overextension raises its civ-wide meter.
export const OVEREXTENSION_FREE = 6;
export const LOST_SUPPORT = 2;
// Local instability from fighting (design doc §10, v0.25): friendly tokens lost in or next to the
// settlement, or the settlement itself attacked (the larger, not both).
export const NEARBY_CONFLICT = 1;
export const ATTACKED = 3;
// Advance steps (Known, Developed, Mastered) a civilization reaches in one turn without unrest;
// each one beyond adds 1 civ-wide (design doc §10, Rapid change, v0.25).
export const RAPID_CHANGE_FREE = 2;
// The assignment that lowers instability: 1 per unit per turn (design doc §6, Manpower).
export const BUREAUCRACY = 'bureaucracy';

// Bureaucracy the capital gets for free, on top of its manpower.
export const CAPITAL_BUREAUCRACY = 1;
// Distance lowers the threshold by 1 for every 2 land moves beyond 2 from the capital, by at most
// 4 (the 9+ band, also used for settlements the capital cannot reach by land), and never below
// half the tier's base.
const DISTANCE_FREE = 2;
const DISTANCE_STEP = 2;
const DISTANCE_MAX_PENALTY = 4;

export type InstabilitySource = 'overextension' | 'losses' | 'lostSupport' | 'conflict' | 'bureaucracy' | 'calm' | 'luxury' | 'noSettlements' | 'calamity' | 'rapidChange';

export function capitalOf(state: GameState, player: PlayerId): AreaId | null {
  return state.players.find((p) => p.id === player)?.capital ?? null;
}

// Fewest land moves from an area to every land area it can reach. With `leg` above 1, a stretch of
// up to `leg` areas along a river counts as one move (Dugout Canoes, design doc §6, Transport).
export function landDistances(map: GameMap, from: AreaId, leg = 1): Map<AreaId, number> {
  const dist = new Map([[from, 0]]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: AreaId[] = [];
    for (const a of frontier) {
      for (const n of transportNeighbors(map, a, leg)) {
        if (dist.has(n)) continue;
        dist.set(n, dist.get(a)! + 1);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

// Transport distances from a player's capital, counting its river legs.
export function capitalDistances(state: GameState, map: GameMap, player: PlayerId): Map<AreaId, number> | undefined {
  const capital = capitalOf(state, player);
  return capital === null ? undefined : landDistances(map, capital, riverLeg(state, player));
}

// How far a settlement is from its capital, in moves; null without a capital or a route.
export function capitalDistance(state: GameState, map: GameMap, settlement: Settlement, distances?: Map<AreaId, number>): number | null {
  const all = distances ?? capitalDistances(state, map, settlement.player);
  return all?.get(settlement.area) ?? null;
}

// The settlement's collapse threshold: its tier's base, lowered by distance from the capital
// beyond the free moves (more with Tallies).
export function threshold(state: GameState, map: GameMap, settlement: Settlement, distances?: Map<AreaId, number>): number {
  const base = tierRules(settlement.tier).threshold;
  if (capitalOf(state, settlement.player) === null) return base;
  const d = capitalDistance(state, map, settlement, distances);
  const free = DISTANCE_FREE + capitalReach(state, settlement.player);
  const penalty = d === null ? DISTANCE_MAX_PENALTY : Math.min(DISTANCE_MAX_PENALTY, Math.max(0, Math.ceil((d - free) / DISTANCE_STEP)));
  return Math.max(Math.ceil(base / 2), base - penalty);
}

// Keeps every civilization's capital on one of its settlements (design doc §10, Capital): its
// first settlement; when the capital is lost, its largest remaining settlement, nearest the old
// capital first (lower area ids break ties); none without settlements.
export function updateCapitals(ctx: Context): void {
  const { state, map } = ctx;
  for (const p of state.players) {
    const old = p.capital ?? null;
    if (old !== null && state.settlements.some((s) => s.area === old && s.player === p.id)) continue;
    const own = state.settlements.filter((s) => s.player === p.id);
    const rank = (s: Settlement) => TIERS.indexOf(tierRules(s.tier));
    const dist = old === null ? new Map<AreaId, number>() : landDistances(map, old);
    const far = (s: Settlement) => dist.get(s.area) ?? Infinity;
    const next = own.sort((a, b) => rank(b) - rank(a) || far(a) - far(b) || a.area - b.area)[0]?.area ?? null;
    if (next === old) continue;
    p.capital = next;
    emit(ctx, { type: 'capitalMoved', player: p.id, area: next });
  }
}

export function localInstability(settlement: Settlement): number {
  return settlement.instability ?? 0;
}

export function civInstability(state: GameState, player: PlayerId): number {
  return state.players.find((p) => p.id === player)?.instability ?? 0;
}

// Local plus civ-wide: collapse comes when it reaches the settlement's threshold.
export function totalInstability(state: GameState, settlement: Settlement): number {
  return localInstability(settlement) + civInstability(state, settlement.player);
}

export function overextension(state: GameState, player: PlayerId): number {
  return Math.max(0, state.settlements.filter((s) => s.player === player).length - OVEREXTENSION_FREE);
}

export function addLocal(ctx: Context, settlement: Settlement, amount: number, source: InstabilitySource): void {
  if (amount === 0) return;
  settlement.instability = localInstability(settlement) + amount;
  emit(ctx, { type: 'instabilityChanged', player: settlement.player, area: settlement.area, amount, source });
}

export function addCiv(ctx: Context, player: PlayerId, amount: number, source: InstabilitySource): void {
  if (amount === 0) return;
  const p = ctx.state.players.find((x) => x.id === player)!;
  p.instability += amount;
  emit(ctx, { type: 'instabilityChanged', player, area: null, amount, source });
}

// Bureaucracy working in a settlement: its assigned units, plus the capital's free one.
export function bureaucracyAt(state: GameState, settlement: Settlement): number {
  const assigned = activeWork(state, settlement).find((w) => w.resource === BUREAUCRACY)?.count ?? 0;
  return assigned + (capitalOf(state, settlement.player) === settlement.area ? CAPITAL_BUREAUCRACY : 0);
}

// Lowers a settlement's meter by up to `units`, the rest off the civ-wide meter; meters never go
// below 0.
function calmAt(ctx: Context, s: Settlement, units: number, source: InstabilitySource): void {
  const local = Math.min(units, localInstability(s));
  addLocal(ctx, s, -local, source);
  addCiv(ctx, s.player, -Math.min(units - local, civInstability(ctx.state, s.player)), source);
}

// Resources phase: each Bureaucracy unit removes 1 from its own settlement's meter; what is not
// needed there comes off the civ-wide meter. Then advances that calm (Ritual) lower the civ-wide
// meter. Meters never go below 0.
export function runBureaucracy(ctx: Context): void {
  for (const s of ctx.state.settlements) {
    const units = bureaucracyAt(ctx.state, s);
    if (units > 0) calmAt(ctx, s, units, 'bureaucracy');
  }
  for (const p of ctx.state.players) {
    if (!ctx.state.settlements.some((s) => s.player === p.id)) continue;
    addCiv(ctx, p.id, -Math.min(calm(ctx.state, p.id), p.instability), 'calm');
  }
}

// Luxury goods left after the market calm the people (design doc §6, Luxury goods): each calms 1
// on the settlement nearest its collapse threshold (lower areas first on ties), at most 1 per
// settlement; the rest come off the civ-wide meter.
function useLuxuries(ctx: Context, content: Content, thresholds: Map<PlayerId, Map<AreaId, number>>): void {
  const { state } = ctx;
  for (const p of state.players) {
    let left = state.goods.reduce((sum, g) => (g.player === p.id && content.resources.some((r) => r.id === g.resource && r.luxury) ? sum + g.count : sum), 0);
    if (left === 0) continue;
    const margin = (s: Settlement) => thresholds.get(p.id)!.get(s.area)! - totalInstability(state, s);
    const own = state.settlements.filter((s) => s.player === p.id).sort((a, b) => margin(a) - margin(b) || a.area - b.area);
    for (const s of own) {
      if (left === 0) break;
      calmAt(ctx, s, 1, 'luxury');
      left -= 1;
    }
    if (left > 0) addCiv(ctx, p.id, -Math.min(left, p.instability), 'luxury');
    state.goods = state.goods.filter((g) => g.player !== p.id || !content.resources.some((r) => r.id === g.resource && r.luxury));
  }
}

// This resolution's events, each with the step it happened in.
function eventsBySteps(ctx: Context): { step: string; event: GameEvent }[] {
  let step = '';
  const out: { step: string; event: GameEvent }[] = [];
  for (const { event } of ctx.events) {
    if (event.type === 'resolutionStep') step = event.step;
    else out.push({ step, event });
  }
  return out;
}

// Players who lost tokens in a fight, by area.
function losses(events: GameEvent[]): { area: AreaId; players: PlayerId[] }[] {
  return events.flatMap((e) => (e.type === 'conflict' || e.type === 'settlementAttacked' ? [{ area: e.area, players: e.losses.filter((l) => l.count > 0).map((l) => l.player) }] : []));
}

// Resolution step 7: this turn's sources are added, then every settlement at or over its
// threshold collapses one tier and its local meter is halved. A collapse is not counted as a loss
// (it is already the result of instability), so losing the far edge lets the core settle. A
// civilization left with no settlements has no state to be unstable: its civ-wide meter returns to
// 0. Capitals then move off lost settlements.
export function resolveInstability(ctx: Context): void {
  const { state, map } = ctx;
  const events = eventsBySteps(ctx);
  const lost = new Map<PlayerId, number>();
  const lose = (player: PlayerId, tiers: number) => lost.set(player, (lost.get(player) ?? 0) + tiers);
  const dropped: { area: AreaId; player: PlayerId }[] = [];
  for (const { step, event } of events) {
    if (event.type === 'settlementAttacked' && event.capturedBy) lose(event.defender, TIERS.indexOf(tierRules(event.tier)) + 1);
    if (event.type === 'settlementDropped' && step === 'support') {
      lose(event.player, 1);
      if (event.tier) dropped.push({ area: event.area, player: event.player });
    }
  }
  for (const p of state.players) {
    addCiv(ctx, p.id, overextension(state, p.id), 'overextension');
    addCiv(ctx, p.id, lost.get(p.id) ?? 0, 'losses');
  }
  for (const d of dropped) {
    const s = state.settlements.find((x) => x.area === d.area && x.player === d.player);
    if (s) addLocal(ctx, s, LOST_SUPPORT, 'lostSupport');
  }
  const lostTokens = losses(events.map((e) => e.event));
  const attacked = events.flatMap(({ event: e }) => (e.type === 'settlementAttacked' ? [`${e.area}:${e.defender}`] : []));
  for (const s of state.settlements) {
    const near = (area: AreaId) => area === s.area || map.areas[s.area]!.neighbors.includes(area);
    if (attacked.includes(`${s.area}:${s.player}`)) addLocal(ctx, s, ATTACKED, 'conflict');
    else if (lostTokens.some((f) => f.players.includes(s.player) && near(f.area))) addLocal(ctx, s, NEARBY_CONFLICT, 'conflict');
  }

  // Thresholds are fixed from the capitals at the start of the check.
  const thresholds = new Map(state.players.map((p) => [p.id, new Map<AreaId, number>()]));
  for (const p of state.players) {
    const distances = capitalDistances(state, map, p.id);
    for (const s of state.settlements.filter((x) => x.player === p.id)) thresholds.get(p.id)!.set(s.area, threshold(state, map, s, distances));
  }
  useLuxuries(ctx, ctx.content, thresholds);
  for (const s of [...state.settlements]) {
    if (totalInstability(state, s) < thresholds.get(s.player)!.get(s.area)!) continue;
    emit(ctx, { type: 'settlementCollapsed', player: s.player, area: s.area, tier: s.tier });
    s.instability = Math.floor(localInstability(s) / 2);
    dropTier(ctx, s);
  }
  for (const p of state.players) {
    if (!state.settlements.some((s) => s.player === p.id)) addCiv(ctx, p.id, -p.instability, 'noSettlements');
  }
  updateCapitals(ctx);
}
