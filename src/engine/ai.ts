import type { Content } from './content';
import { discoveryView, HIGH_LEARNING, highLearning, LEARNING_ADOPTION, LEARNING_PROGRESS } from './discovery';
import { strength } from './effects';
import { ARTISTS, artists } from './eras';
import { applyCommand } from './engine';
import { BUREAUCRACY, CAPITAL_BUREAUCRACY, overextension, threshold, totalInstability } from './instability';
import { canTrade, priceOf } from './market';
import type { AreaId, GameMap, ResourceId } from './map/types';
import { looseTokens, tokensAt } from './population';
import { FOOD } from './content';
import { assigned, goodsHeld, isFood, manpower, usable, workable } from './resources';
import { isCompleted, WONDER, wonderRule } from './wonders';
import { allocateSupport, nextTier, previewConversions, settlementAt, supportSummary, tierRules } from './settlements';
import type { AiApproach, Command, GameState, PlayerId } from './types';
import { mapFor } from './world';

// Minimal AI (development plan: minimal until Phase 7). A fixed pattern, not a strategy, and
// deterministic: the same state always gives the same orders. Each AI civilization plays an
// approach (design doc §2, v0.32): the Balanced pattern below with its own settings (SETTINGS).
//
// Each allocation phase (Balanced settings in the text):
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
// 4. Wonders (design doc §9, v0.28; interim until the era's AI approaches): with no wonder in
//    progress, it starts the first wonder it can build that no rival is building, at its largest
//    settlement, if the engine accepts the order (a turn can be paid). On its build it puts manpower
//    up to the wonder's need: idle first, then from High Learning and Artists, then from goods the
//    wonder does not need, food last; currency covers the rest. Idle
//    manpower works a good the build is short of before food, and it buys the shortfall when it can
//    trade. Progress from a race it lost becomes culture points.
// 5. Artists, then study: while Artists or High Learning are below their share of the
//    civilization's manpower (rounded down; Balanced: no Artists, a third on High Learning), idle
//    manpower goes to them, largest settlements first. The study queue is the approach's (Balanced:
//    empty, so learning splits evenly; design doc §8, v0.17).
// 6. Put idle manpower to work: on a good its wonder is short of, else the area's first food the
//    civilization can gather, else the first good it can (copper, cloth, stone).
//
// It marks every calamity that can be bought off (design doc §12), so its treasury pays 10 to avert
// one whenever it can.
//
// Each allocation phase, once it can trade (design doc §7, v0.21), it buys only what it needs, as
// standing market orders that fill from next turn's resources phase: the cheapest food (earlier goods on ties) for this turn's forecast support
// shortfall, and the cheapest luxury for each settlement within 2 of collapse. It cancels any other
// order and never sells. Purchases fill only as far as its treasury allows.
//
// Aggression (design doc §2, v0.32) also raids: it picks the rival settlement easiest to take
// (lowest attack threshold, then the most of its own tokens already beside it, then fewest of its
// owner's tokens in and next to it, lower areas first)
// among those it can reach within RAID_REACH moves through areas no one else but the owner holds. Its spare tokens
// (not needed for support) step toward it each turn and mass in the unsettled areas next to it, up
// to their limits, fighting
// the owner's support tokens there when it outnumbers them, and when their power reaches the attack
// threshold they all move in. It also moves spare tokens into a
// rival's unsettled area next to them when their power beats the rival's there.

const CALM_CLEAR = 6;
const FOUND_MIN_REACH = 8;
const BUY_CALM_WITHIN = 2;
// Moves from a raid target's staging areas that Aggression gathers tokens from.
const RAID_REACH = 6;

// Each approach's settings (design doc §2, v0.32; placeholders until the tuning pass). `queue` is
// the study queue: none, the cheapest steps first ('gate'), or advances in order. `wonders` lists
// wonders to start first; `onlyListed` starts no others.
interface Settings {
  foundMin: number;
  upgradeFirst: boolean;
  studyShare: number;
  queue: 'none' | 'gate' | readonly string[];
  artistsShare: number;
  calmWithin: number;
  wonders: readonly string[];
  noWonders?: boolean;
  onlyListed?: boolean;
  raids?: boolean;
}

export const SETTINGS: Record<AiApproach, Settings> = {
  balanced: { foundMin: 12, upgradeFirst: false, studyShare: 1 / 3, queue: 'none', artistsShare: 0, calmWithin: 3, wonders: [] },
  expansion: { foundMin: 8, upgradeFirst: false, studyShare: 0, queue: 'none', artistsShare: 0, calmWithin: 2, wonders: [], noWonders: true },
  building: { foundMin: 12, upgradeFirst: true, studyShare: 1 / 6, queue: 'none', artistsShare: 0, calmWithin: 5, wonders: ['gobekliTepe', 'catalhoyuk'] },
  study: { foundMin: 12, upgradeFirst: false, studyShare: 1 / 2, queue: 'gate', artistsShare: 0, calmWithin: 3, wonders: ['stonehenge'] },
  culture: { foundMin: 12, upgradeFirst: true, studyShare: 1 / 6, queue: ['ritual', 'masonry'], artistsShare: 1 / 3, calmWithin: 3, wonders: ['newgrange'] },
  aggression: { foundMin: 12, upgradeFirst: false, studyShare: 1 / 6, queue: ['archery', 'palisades'], artistsShare: 0, calmWithin: 3, wonders: ['wallsOfJericho'], onlyListed: true, raids: true },
};

export function approachOf(state: GameState, player: PlayerId): AiApproach {
  return state.players.find((p) => p.id === player)?.approach ?? 'balanced';
}

function landNeighbors(map: GameMap, area: AreaId): AreaId[] {
  return map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
}

// Which work a wonder takes manpower from first: High Learning and Artists, then other goods, food
// last.
function rankJob(content: Content, resource: string): number {
  if (resource === HIGH_LEARNING || resource === ARTISTS) return 0;
  return isFood(content, resource) ? 2 : 1;
}

// Goods (not food) the player's wonder needs a turn beyond what it holds.
function wonderShort(state: GameState, content: Content, player: PlayerId): Map<ResourceId, number> {
  const short = new Map<ResourceId, number>();
  const build = state.builds.find((b) => b.player === player && b.outbuilt === undefined);
  const rule = build && wonderRule(content, build.wonder);
  for (const g of rule?.goods ?? []) {
    if (g.resource === FOOD) continue;
    const gap = g.count - goodsHeld(state, player, g.resource);
    if (gap > 0) short.set(g.resource, gap);
  }
  return short;
}

function tradeCommands(state: GameState, map: GameMap, content: Content, player: PlayerId): Command[] {
  if (!canTrade(state, player)) return [];
  const cheapest = (goods: ResourceId[]) => [...goods].sort((a, b) => priceOf(state, content, player, a) - priceOf(state, content, player, b))[0];
  const shortfall = supportSummary(state, map, content, player).settlements.reduce((sum, s) => sum + Math.max(0, s.needed - s.support), 0);
  const unrest = state.settlements.filter((s) => s.player === player && threshold(state, map, s) - totalInstability(state, s) <= BUY_CALM_WITHIN).length;
  const want = new Map<ResourceId, number>();
  const food = cheapest(content.resources.filter((r) => r.food).map((r) => r.id));
  const luxury = cheapest(content.resources.filter((r) => r.luxury).map((r) => r.id));
  if (food && shortfall > 0) want.set(food, shortfall);
  if (luxury && unrest > 0) want.set(luxury, unrest);
  for (const [resource, count] of wonderShort(state, content, player)) want.set(resource, (want.get(resource) ?? 0) + count);
  const orders = state.players.find((p) => p.id === player)!.orders;
  const commands: Command[] = [];
  for (const o of orders) if (!want.has(o.resource)) commands.push({ type: 'setOrder', player, resource: o.resource, side: o.side, count: 0 });
  for (const [resource, count] of want) {
    const o = orders.find((x) => x.resource === resource);
    if (o?.side === 'buy' && o.count === count && o.limit === undefined) continue;
    commands.push({ type: 'setOrder', player, resource, side: 'buy', count });
  }
  return commands;
}

export function aiCommands(state: GameState, content: Content, player: PlayerId): Command[] {
  if (state.phase !== 'allocation') return [];
  const map = mapFor(state.setup);
  const settings = SETTINGS[approachOf(state, player)];
  const commands: Command[] = [];
  let current = state;
  const issue = (command: Command): boolean => {
    const result = applyCommand(current, command, content);
    if (!result.ok) return false;
    current = result.state;
    commands.push(command);
    return true;
  };

  const buyable = content.calamities.filter((c) => c.buyOff).map((c) => c.id);
  if (current.players.find((p) => p.id === player)!.buyOff.length !== buyable.length) issue({ type: 'setBuyOff', player, calamities: buyable });

  const reserved = new Set<AreaId>();
  const site = settings.upgradeFirst
    ? (upgradeSite(current, map, player, settings.foundMin) ?? villageSite(current, map, player, settings.foundMin))
    : (villageSite(current, map, player, settings.foundMin) ?? upgradeSite(current, map, player, settings.foundMin));
  if (site !== undefined) {
    issue({ type: 'orderConversion', player, area: site, ordered: true });
    const preview = previewConversions(current, map, content, player).find((p) => p.area === site);
    const supported = supportSummary(current, map, content, player).settlements.every((s) => s.support >= s.needed);
    if (preview?.built && supported) for (const a of [site, ...landNeighbors(map, site)]) reserved.add(a);
    else issue({ type: 'orderConversion', player, area: site, ordered: false });
  }

  const { spare } = allocateSupport(current, map, content);
  if (settings.raids) raid(current, map, player, spare, reserved, issue);
  const incoming = new Map<AreaId, number>();
  const occupied = (a: AreaId) => current.stacks.filter((s) => s.area === a).reduce((sum, s) => sum + s.count, 0) + (incoming.get(a) ?? 0);
  const open = (a: AreaId) =>
    !reserved.has(a) && !settlementAt(current, a) && !current.stacks.some((s) => s.area === a && s.player !== player) && map.areas[a]!.limit - occupied(a) > 0;
  for (const stack of state.stacks.filter((s) => s.player === player && !reserved.has(s.area))) {
    const free = Math.min(spare.get(`${stack.area}:${player}`) ?? 0, tokensAt(current, stack.area, player) - movedOut(current, player, stack.area));
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
    if (gap <= settings.calmWithin && calm < manpower(current, s)) {
      const from = [...work].reverse().find((w) => w.resource !== BUREAUCRACY);
      if (assigned(s) >= manpower(current, s) && from) issue({ type: 'assignWork', player, area: s.area, resource: from.resource, count: from.count - 1 });
      issue({ type: 'assignWork', player, area: s.area, resource: BUREAUCRACY, count: calm + 1 });
    } else if (gap >= CALM_CLEAR && calm > 0) {
      issue({ type: 'assignWork', player, area: s.area, resource: BUREAUCRACY, count: calm - 1 });
    }
  }

  const own = () => current.settlements.filter((x) => x.player === player);
  for (const b of current.builds.filter((x) => x.player === player && x.outbuilt !== undefined)) issue({ type: 'redirectWonder', player, wonder: b.wonder });
  if (!settings.noWonders && !current.builds.some((b) => b.player === player)) {
    const largest = [...own()].sort((a, b) => manpower(current, b) - manpower(current, a) || a.area - b.area)[0];
    const listed = (id: string) => settings.wonders.indexOf(id) >= 0;
    const rank = (id: string) => (listed(id) ? settings.wonders.indexOf(id) : settings.wonders.length);
    const open = content.wonders
      .filter((w) => !isCompleted(current, w.id) && !current.builds.some((b) => b.wonder === w.id && b.player !== player && b.outbuilt === undefined))
      .filter((w) => !settings.onlyListed || listed(w.id))
      .sort((a, b) => rank(a.id) - rank(b.id));
    for (const w of largest ? open : []) {
      if (issue({ type: 'startWonder', player, wonder: w.id, area: largest!.area })) break;
    }
  }
  const build = current.builds.find((b) => b.player === player && b.outbuilt === undefined);
  if (build) {
    const s = settlementAt(current, build.area)!;
    const on = (resource: string) => (s.work ?? []).find((w) => w.resource === resource)?.count ?? 0;
    const need = wonderRule(content, build.wonder)!.manpower - on(WONDER);
    let free = Math.min(need, manpower(current, s) - assigned(s));
    // Then from other work at the site: High Learning and Artists, then goods the wonder does not
    // need, food last.
    const short = wonderShort(current, content, player);
    const takeFrom = (s.work ?? [])
      .filter((w) => w.resource !== WONDER && w.count > 0 && !short.has(w.resource))
      .sort((x, y) => rankJob(content, x.resource) - rankJob(content, y.resource));
    for (const w of takeFrom) {
      if (free >= need) break;
      const take = Math.min(need - free, w.count);
      if (issue({ type: 'assignWork', player, area: s.area, resource: w.resource, count: w.count - take })) free += take;
    }
    if (free > 0) issue({ type: 'assignWork', player, area: s.area, resource: WONDER, count: on(WONDER) + free });
  }

  const total = own().reduce((sum, s) => sum + manpower(current, s), 0);
  const fill = (job: string, share: number, count: () => number) => {
    const target = Math.floor(total * share);
    for (const area of [...own()].sort((a, b) => manpower(current, b) - manpower(current, a) || a.area - b.area).map((s) => s.area)) {
      const s = settlementAt(current, area)!;
      const idle = manpower(current, s) - assigned(s);
      const now = count();
      if (idle <= 0 || now >= target) continue;
      const on = (s.work ?? []).find((w) => w.resource === job)?.count ?? 0;
      issue({ type: 'assignWork', player, area, resource: job, count: on + Math.min(idle, target - now) });
    }
  };
  fill(ARTISTS, settings.artistsShare, () => artists(current, player));
  fill(HIGH_LEARNING, settings.studyShare, () => highLearning(current, player));
  const queue = studyQueue(current, map, content, player, settings);
  const p = current.players.find((x) => x.id === player)!;
  if (queue.join() !== p.study.join()) issue({ type: 'setStudy', player, queue });

  for (const area of own().map((x) => x.area)) {
    const s = settlementAt(current, area)!;
    const idle = manpower(current, s) - assigned(s);
    if (idle <= 0) continue;
    const options = workable(map, content, area).filter((r) => usable(current, content, player, r));
    const short = wonderShort(current, content, player);
    const resource = options.find((r) => short.has(r)) ?? options.find((r) => isFood(content, r)) ?? options[0];
    if (!resource) continue;
    const on = (s.work ?? []).find((w) => w.resource === resource)?.count ?? 0;
    issue({ type: 'assignWork', player, area, resource, count: on + idle });
  }
  for (const command of tradeCommands(current, map, content, player)) issue(command);
  return commands;
}

const reachOf = (state: GameState, map: GameMap, player: PlayerId, area: AreaId) =>
  [area, ...landNeighbors(map, area)].reduce((sum, n) => sum + tokensAt(state, n, player), 0);

// The player's settlement with the most tokens in reach whose next tier is unlocked.
function upgradeSite(state: GameState, map: GameMap, player: PlayerId, foundMin: number): AreaId | undefined {
  if (looseTokens(state, player) < foundMin) return undefined;
  const tiers = state.players.find((p) => p.id === player)!.tiers;
  return state.settlements
    .filter((s) => s.player === player && tiers.includes(nextTier(state, s.area)?.id ?? 'metropolis') && s.tier !== 'metropolis')
    .map((s) => s.area)
    .sort((a, b) => reachOf(state, map, player, b) - reachOf(state, map, player, a) || a - b)[0];
}

// The unsettled area with the most of the player's tokens in reach, if at least FOUND_MIN_REACH,
// with no other civilization's tokens and no settlement next to it (lower ids break ties).
function villageSite(state: GameState, map: GameMap, player: PlayerId, foundMin: number): AreaId | undefined {
  if (looseTokens(state, player) < foundMin) return undefined;
  const reach = (a: AreaId) => reachOf(state, map, player, a);
  return map.areas
    .filter((a) => a.kind === 'land' && !settlementAt(state, a.id) && reach(a.id) >= FOUND_MIN_REACH)
    .filter((a) => !state.stacks.some((s) => s.area === a.id && s.player !== player))
    .filter((a) => !landNeighbors(map, a.id).some((n) => settlementAt(state, n)))
    .map((a) => a.id)
    .sort((a, b) => reach(b) - reach(a) || a - b)[0];
}

// Tokens already ordered out of an area this allocation.
function movedOut(state: GameState, player: PlayerId, area: AreaId): number {
  return state.orders.filter((o) => o.player === player && o.from === area).reduce((sum, o) => sum + o.count, 0);
}

// The approach's study queue: none; the advances it names that can still take learning; or every
// advance that can, cheapest next step first in learning (design doc §2, Study approach).
function studyQueue(state: GameState, map: GameMap, content: Content, player: PlayerId, settings: Settings): string[] {
  if (settings.queue === 'none') return [];
  const open = discoveryView(state, map, content, player).filter((v) => !v.advance.baseline && v.next !== null && (v.stage === 'developed' || v.plausible));
  if (settings.queue !== 'gate') return settings.queue.filter((id) => open.some((v) => v.advance.id === id));
  const left = (v: (typeof open)[number]) => (v.cost - v.progress) / (v.next === 'mastered' ? LEARNING_ADOPTION : LEARNING_PROGRESS);
  return [...open].sort((a, b) => left(a) - left(b) || content.advances.indexOf(a.advance) - content.advances.indexOf(b.advance)).map((v) => v.advance.id);
}

// Aggression's raid and push (header). Areas it masses in are reserved from the overflow.
function raid(state: GameState, map: GameMap, player: PlayerId, spare: Map<string, number>, reserved: Set<AreaId>, issue: (command: Command) => boolean): void {
  const mine = (a: AreaId) => tokensAt(state, a, player);
  const used = new Map<AreaId, number>();
  const free = (a: AreaId) => Math.max(0, Math.min(spare.get(`${a}:${player}`) ?? 0, mine(a) - movedOut(state, player, a)) - (used.get(a) ?? 0));
  const move = (from: AreaId, to: AreaId, count: number): boolean => {
    if (!issue({ type: 'orderMove', player, from, to, count })) return false;
    used.set(from, (used.get(from) ?? 0) + count);
    return true;
  };
  // Areas beside a settlement it can stage in: unsettled, holding no one's tokens but its own and
  // the settlement owner's (its support, which staging fights and cuts).
  const ring = (area: AreaId, owner: PlayerId) => landNeighbors(map, area).filter((n) => !settlementAt(state, n) && !state.stacks.some((s) => s.area === n && s.player !== player && s.player !== owner));
  const defenders = (area: AreaId, owner: PlayerId) => [area, ...landNeighbors(map, area)].reduce((sum, n) => sum + tokensAt(state, n, owner), 0);
  // Moves from each area toward a settlement's staging areas, through unsettled areas holding no
  // one's tokens but its own and the settlement owner's, up to RAID_REACH.
  const distances = (area: AreaId, owner: PlayerId) => {
    const dist = new Map(ring(area, owner).map((a) => [a, 0]));
    let frontier = [...dist.keys()];
    for (let d = 1; d <= RAID_REACH && frontier.length > 0; d++) {
      const next: AreaId[] = [];
      for (const a of frontier) {
        for (const n of landNeighbors(map, a)) {
          if (dist.has(n) || n === area || settlementAt(state, n) || state.stacks.some((s) => s.area === n && s.player !== player && s.player !== owner)) continue;
          dist.set(n, d);
          next.push(n);
        }
      }
      frontier = next;
    }
    return dist;
  };
  // Tokens already massed beside it, so a raid under way keeps its target.
  const staged = (s: (typeof state.settlements)[number]) => ring(s.area, s.player).reduce((sum, a) => sum + mine(a), 0);
  const reachable = (s: (typeof state.settlements)[number]) => [...distances(s.area, s.player).keys()].some((a) => mine(a) > 0);
  const target = state.settlements
    .filter((s) => s.player !== player && reachable(s))
    .sort((a, b) => tierRules(a.tier).attack - tierRules(b.tier).attack || staged(b) - staged(a) || defenders(a.area, a.player) - defenders(b.area, b.player) || a.area - b.area)[0];

  if (target) {
    const around = ring(target.area, target.player);
    const dist = distances(target.area, target.player);
    for (const a of dist.keys()) reserved.add(a);
    const power = around.reduce((sum, a) => sum + free(a), 0) * strength(state, player, target.player);
    if (power >= tierRules(target.tier).attack) {
      for (const a of around) if (free(a) > 0) move(a, target.area, free(a));
      return;
    }
    // Mass: spare tokens step one area closer, filling the staging areas up to their limits and
    // the areas on the way up to theirs.
    const room = new Map([...dist.keys()].map((a) => [a, map.areas[a]!.limit - mine(a)]));
    const sources = [...dist].filter(([a, d]) => d > 0 && free(a) > 0).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
    for (const [from, d] of sources) {
      for (const to of landNeighbors(map, from).filter((n) => dist.get(n) === d - 1).sort((a, b) => a - b)) {
        const count = Math.min(free(from), room.get(to)!);
        if (count <= 0) continue;
        // Into the owner's tokens only when it would outnumber them there.
        if (mine(to) + count <= tokensAt(state, to, target.player)) continue;
        if (move(from, to, count)) room.set(to, room.get(to)! - count);
      }
    }
  }

  // Push into a rival's unsettled area next to its tokens when its power beats theirs there.
  for (const stack of state.stacks.filter((s) => s.player === player && !reserved.has(s.area)).sort((a, b) => a.area - b.area)) {
    for (const to of landNeighbors(map, stack.area).filter((n) => !settlementAt(state, n)).sort((a, b) => a - b)) {
      const rivals = state.stacks.filter((s) => s.area === to && s.player !== player);
      if (rivals.length !== 1) continue;
      const send = free(stack.area);
      if (send > 0 && send * strength(state, player) > rivals[0]!.count * strength(state, rivals[0]!.player)) move(stack.area, to, send);
    }
  }
}
