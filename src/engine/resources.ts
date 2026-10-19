import type { Content } from './content';
import { emit } from './context';
import { BUREAUCRACY } from './instability';
import type { AreaId, GameMap, ResourceId } from './map/types';
import { settlementAt, tierRules } from './settlements';
import type { Command, Context, GameState, PlayerId, Settlement } from './types';

// Manpower and goods (design doc §6). Each settlement has whole units of manpower by tier; standing
// assignments gather one of the area's resources per unit in the resources phase. Goods last one
// turn.

export function manpower(settlement: Settlement): number {
  return tierRules(settlement.tier).manpower;
}

export function assigned(settlement: Settlement): number {
  return (settlement.work ?? []).reduce((sum, w) => sum + w.count, 0);
}

export function usable(state: GameState, content: Content, player: PlayerId, resource: ResourceId): boolean {
  const rule = content.resources.find((r) => r.id === resource);
  return Boolean(rule && state.players.find((p) => p.id === player)?.known.includes(rule.requires));
}

export function isFood(content: Content, resource: ResourceId): boolean {
  return content.resources.some((r) => r.id === resource && r.food);
}

// The area's first food its civilization can gather, if any: where new manpower starts.
function areaFood(state: GameState, map: GameMap, content: Content, player: PlayerId, area: AreaId): ResourceId | undefined {
  return map.areas[area]!.resources.find((r) => isFood(content, r) && usable(state, content, player, r));
}

// A new or captured settlement starts with all its manpower on its area's food, if any.
export function resetWork(ctx: Context, settlement: Settlement): void {
  const food = areaFood(ctx.state, ctx.map, ctx.content, settlement.player, settlement.area);
  settlement.work = food ? [{ resource: food, count: manpower(settlement) }] : [];
}

// After an upgrade: the new units start on the area's food, if any.
export function addManpower(ctx: Context, settlement: Settlement, units: number): void {
  const food = areaFood(ctx.state, ctx.map, ctx.content, settlement.player, settlement.area);
  if (!food) return;
  const work = settlement.work ?? [];
  const count = (work.find((w) => w.resource === food)?.count ?? 0) + units;
  settlement.work = [...work.filter((w) => w.resource !== food), { resource: food, count }];
}

// After a tier drop: unassigned manpower goes first, then the most recently changed assignment.
export function trimWork(settlement: Settlement): void {
  let over = assigned(settlement) - manpower(settlement);
  const work = [...(settlement.work ?? [])];
  while (over > 0) {
    const last = work[work.length - 1]!;
    const cut = Math.min(over, last.count);
    last.count -= cut;
    over -= cut;
    if (last.count === 0) work.pop();
  }
  settlement.work = work;
}

export function validateWork(ctx: Pick<Context, 'state' | 'map' | 'content'>, command: Extract<Command, { type: 'assignWork' }>): string | null {
  const { state, map, content } = ctx;
  const player = state.players.find((p) => p.id === command.player);
  if (!player) return `Unknown player "${command.player}"`;
  if (state.phase !== 'allocation') return 'Manpower is assigned in the allocation phase';
  if (player.endedPhase) return `Player "${command.player}" already ended phase "allocation"`;
  const here = settlementAt(state, command.area);
  if (!here || here.player !== command.player) return 'You have no settlement there';
  if (!Number.isInteger(command.count) || command.count < 0) return 'Manpower must be a whole number, 0 or more';
  if (command.resource !== BUREAUCRACY) {
    if (!map.areas[command.area]!.resources.includes(command.resource)) return 'That resource is not in this area';
    if (!usable(state, content, command.player, command.resource)) return 'Your civilization cannot gather that resource yet';
  }
  const others = (here.work ?? []).filter((w) => w.resource !== command.resource).reduce((sum, w) => sum + w.count, 0);
  if (others + command.count > manpower(here)) return `Only ${manpower(here) - others} manpower free in this settlement`;
  return null;
}

export function setWork(ctx: Context, command: Extract<Command, { type: 'assignWork' }>): void {
  const here = settlementAt(ctx.state, command.area)!;
  const work = (here.work ?? []).filter((w) => w.resource !== command.resource);
  if (command.count > 0) work.push({ resource: command.resource, count: command.count });
  here.work = work;
}

// Resources phase: last turn's goods are gone; each settlement gathers 1 of a resource per unit
// working it, if its civilization can use it.
export function runResources(ctx: Context): void {
  const { state, content } = ctx;
  state.goods = [];
  for (const s of state.settlements) {
    for (const w of s.work ?? []) {
      if (w.count <= 0 || !usable(state, content, s.player, w.resource)) continue;
      state.goods.push({ area: s.area, player: s.player, resource: w.resource, count: w.count });
      emit(ctx, { type: 'goodsProduced', player: s.player, area: s.area, resource: w.resource, count: w.count });
    }
  }
}

// Food held by one player in one area.
export function foodAt(state: GameState, content: Content, area: AreaId, player: PlayerId): number {
  return state.goods.reduce((sum, g) => (g.area === area && g.player === player && isFood(content, g.resource) ? sum + g.count : sum), 0);
}
