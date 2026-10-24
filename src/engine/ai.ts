import type { Content } from './content';
import { applyCommand } from './engine';
import { BUREAUCRACY, CAPITAL_BUREAUCRACY, overextension, threshold, totalInstability } from './instability';
import type { AreaId, GameMap } from './map/types';
import { looseTokens, tokensAt } from './population';
import { assigned, isFood, manpower, usable, workable } from './resources';
import { allocateSupport, nextTier, previewConversions, settlementAt, supportSummary, tierRules } from './settlements';
import type { Command, GameState, PlayerId } from './types';
import { mapFor } from './world';

// Minimal AI (development plan: minimal until Phase 7). A fixed pattern, not a strategy, and
// deterministic: the same state always gives the same orders.
//
// Each allocation phase:
// 1. Found at most one village, once the civilization has 12 loose tokens: at the unsettled area
//    with the most of its tokens in reach (8 or more), not next to any settlement, so villages keep
//    room around them for support. The order is kept only if the engine's preview says the village
//    is built and every settlement keeps its support. With no site, and towns unlocked, it
//    upgrades instead: the settlement with the most of its tokens in reach, checked the same way.
// 2. Expand by overflow: an area at its limit sends half its tokens not needed for support
//    (rounded up; a settled area sends all of them) one at a time to adjacent land that is empty or
//    its own and has room, most room first. Areas fill before tokens move on, which keeps them
//    dense enough for villages. It never moves into another civilization's area, and leaves the
//    village site and its neighbors alone.
// 3. Calm unrest: Bureaucracy assigned now works from next turn, after this turn's resolution
//    adds overextension again, so the AI looks two turns of overextension ahead. A settlement
//    within 3 of its collapse threshold by then moves 1 manpower to Bureaucracy (unassigned first,
//    else from its most recent assignment); one 6 or more below it moves 1 back to work.
// 4. Put idle manpower to work: on the area's first food the civilization can gather, else the
//    first good it can (copper, cloth).

const FOUND_MIN_LOOSE = 12;
const CALM_WITHIN = 3;
const CALM_CLEAR = 6;
const FOUND_MIN_REACH = 8;

function landNeighbors(map: GameMap, area: AreaId): AreaId[] {
  return map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
}

export function aiCommands(state: GameState, content: Content, player: PlayerId): Command[] {
  if (state.phase !== 'allocation') return [];
  const map = mapFor(state.setup);
  const commands: Command[] = [];
  let current = state;
  const issue = (command: Command) => {
    const result = applyCommand(current, command, content);
    if (!result.ok) return;
    current = result.state;
    commands.push(command);
  };

  const reserved = new Set<AreaId>();
  const site = villageSite(current, map, player) ?? upgradeSite(current, map, player);
  if (site !== undefined) {
    issue({ type: 'orderConversion', player, area: site, ordered: true });
    const preview = previewConversions(current, map, content, player).find((p) => p.area === site);
    const supported = supportSummary(current, map, content, player).settlements.every((s) => s.support >= s.needed);
    if (preview?.built && supported) for (const a of [site, ...landNeighbors(map, site)]) reserved.add(a);
    else issue({ type: 'orderConversion', player, area: site, ordered: false });
  }

  const { spare } = allocateSupport(current, map, content);
  const incoming = new Map<AreaId, number>();
  const occupied = (a: AreaId) => current.stacks.filter((s) => s.area === a).reduce((sum, s) => sum + s.count, 0) + (incoming.get(a) ?? 0);
  const open = (a: AreaId) =>
    !reserved.has(a) && !settlementAt(current, a) && !current.stacks.some((s) => s.area === a && s.player !== player) && map.areas[a]!.limit - occupied(a) > 0;
  for (const stack of state.stacks.filter((s) => s.player === player && !reserved.has(s.area))) {
    const free = spare.get(`${stack.area}:${player}`) ?? 0;
    const settled = Boolean(settlementAt(current, stack.area));
    if (!settled && stack.count < map.areas[stack.area]!.limit) continue;
    let send = settled ? free : Math.ceil(free / 2);
    const sent = new Map<AreaId, number>();
    while (send > 0) {
      const to = landNeighbors(map, stack.area)
        .filter(open)
        .sort((a, b) => map.areas[b]!.limit - occupied(b) - (map.areas[a]!.limit - occupied(a)) || a - b)[0];
      if (to === undefined) break;
      sent.set(to, (sent.get(to) ?? 0) + 1);
      incoming.set(to, (incoming.get(to) ?? 0) + 1);
      send -= 1;
    }
    for (const [to, count] of [...sent].sort((a, b) => a[0] - b[0])) issue({ type: 'orderMove', player, from: stack.area, to, count });
  }

  for (const s of current.settlements.filter((x) => x.player === player)) {
    const work = s.work ?? [];
    const calm = work.find((w) => w.resource === BUREAUCRACY)?.count ?? 0;
    const rising = Math.max(0, overextension(current, player) - CAPITAL_BUREAUCRACY);
    const gap = threshold(current, map, s) - totalInstability(current, s) - 2 * rising;
    if (gap <= CALM_WITHIN && calm < manpower(s)) {
      const from = [...work].reverse().find((w) => w.resource !== BUREAUCRACY);
      if (assigned(s) >= manpower(s) && from) issue({ type: 'assignWork', player, area: s.area, resource: from.resource, count: from.count - 1 });
      issue({ type: 'assignWork', player, area: s.area, resource: BUREAUCRACY, count: calm + 1 });
    } else if (gap >= CALM_CLEAR && calm > 0) {
      issue({ type: 'assignWork', player, area: s.area, resource: BUREAUCRACY, count: calm - 1 });
    }
  }

  for (const area of current.settlements.filter((x) => x.player === player).map((x) => x.area)) {
    const s = settlementAt(current, area)!;
    const idle = manpower(s) - assigned(s);
    if (idle <= 0) continue;
    const options = workable(map, content, area).filter((r) => usable(current, content, player, r));
    const resource = options.find((r) => isFood(content, r)) ?? options[0];
    if (!resource) continue;
    const on = (s.work ?? []).find((w) => w.resource === resource)?.count ?? 0;
    issue({ type: 'assignWork', player, area, resource, count: on + idle });
  }
  return commands;
}

const reachOf = (state: GameState, map: GameMap, player: PlayerId, area: AreaId) =>
  [area, ...landNeighbors(map, area)].reduce((sum, n) => sum + tokensAt(state, n, player), 0);

// The player's settlement with the most tokens in reach whose next tier is unlocked.
function upgradeSite(state: GameState, map: GameMap, player: PlayerId): AreaId | undefined {
  if (looseTokens(state, player) < FOUND_MIN_LOOSE) return undefined;
  const tiers = state.players.find((p) => p.id === player)!.tiers;
  return state.settlements
    .filter((s) => s.player === player && tiers.includes(nextTier(state, s.area)?.id ?? 'metropolis') && s.tier !== 'metropolis')
    .map((s) => s.area)
    .sort((a, b) => reachOf(state, map, player, b) - reachOf(state, map, player, a) || a - b)[0];
}

// The unsettled area with the most of the player's tokens in reach, if at least FOUND_MIN_REACH,
// with no other civilization's tokens and no settlement next to it (lower ids break ties).
function villageSite(state: GameState, map: GameMap, player: PlayerId): AreaId | undefined {
  if (looseTokens(state, player) < FOUND_MIN_LOOSE) return undefined;
  const reach = (a: AreaId) => reachOf(state, map, player, a);
  return map.areas
    .filter((a) => a.kind === 'land' && !settlementAt(state, a.id) && reach(a.id) >= FOUND_MIN_REACH)
    .filter((a) => !state.stacks.some((s) => s.area === a.id && s.player !== player))
    .filter((a) => !landNeighbors(map, a.id).some((n) => settlementAt(state, n)))
    .map((a) => a.id)
    .sort((a, b) => reach(b) - reach(a) || a - b)[0];
}
