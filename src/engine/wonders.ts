import type { Wonder } from '../content/types';
import { FOOD, type Content } from './content';
import { emit } from './context';
import { reached } from './discovery';
import { heldWonders } from './effects';
import { eraOf } from './eras';
import type { AreaId, GameMap, ResourceId } from './map/types';
import { activeWork, goodsHeld, isFood, manpower } from './resources';
import { allocateSupport, settlementAt } from './settlements';
import type { Build, Command, Context, GameState, PlayerId, Settlement } from './types';

// Wonders (design doc §9, v0.28). Each exists once in the world. A builder picks a settlement;
// each turn of work, in resolution step 12, takes the wonder's goods from anywhere in the
// civilization, after support, and its manpower at the site, with CURRENCY_PER_MANPOWER covering
// each unit missing. A turn that cannot be paid stalls and spends nothing. Manpower on a wonder is
// counted in the resources phase, like every assignment, so a wonder is first worked the turn
// after it is started. The first to complete it gets it; other builders choose in their next
// allocation phase to move their progress (the same share of completion) or turn it into culture
// points (the same share of the wonder's points), both rounded down. A build whose settlement is
// captured or lost loses its progress. A completed wonder's points stay with its builder; its
// effects work for whoever holds its settlement until that settlement is gone.

export const WONDER = 'wonder';
export const CURRENCY_PER_MANPOWER = 10;

function playerOf(state: GameState, id: PlayerId) {
  return state.players.find((p) => p.id === id)!;
}

export function wonderRule(content: Content, id: string): Wonder | undefined {
  return content.wonders.find((w) => w.id === id);
}

export function isCompleted(state: GameState, wonder: string): boolean {
  return state.wonders.some((w) => w.wonder === wonder);
}

// The player's wonder under construction at a settlement, if any (not one it lost the race for).
export function buildAt(state: GameState, player: PlayerId, area: AreaId): Build | undefined {
  return state.builds.find((b) => b.player === player && b.area === area && b.outbuilt === undefined);
}

function buildOf(state: GameState, player: PlayerId, wonder: string): Build | undefined {
  return state.builds.find((b) => b.player === player && b.wonder === wonder);
}

export function wonderPoints(content: Content, wonder: Wonder): number {
  return eraOf(content, wonder.era).points?.wonder ?? 0;
}

// Victory points from the wonders a player completed (design doc §15).
export function wondersScore(state: GameState, content: Content, player: PlayerId): number {
  return state.wonders.filter((w) => w.builder === player).reduce((sum, w) => sum + wonderPoints(content, wonderRule(content, w.wonder)!), 0);
}

// Units of a goods entry the player holds: any food good for 'food'.
function holding(state: GameState, content: Content, player: PlayerId, resource: string): number {
  if (resource !== FOOD) return goodsHeld(state, player, resource);
  return state.goods.reduce((sum, g) => (g.player === player && isFood(content, g.resource) ? sum + g.count : sum), 0);
}

// Food the player holds now, less what this turn's support check is expected to eat; other goods
// as held. Used to check a wonder can be paid before it starts.
function spare(state: GameState, map: GameMap, content: Content, player: PlayerId, resource: string): number {
  if (resource !== FOOD) return goodsHeld(state, player, resource);
  const { fed } = allocateSupport(state, map, content);
  const eaten = state.settlements.reduce((sum, s) => (s.player === player ? sum + (fed.get(s.area) ?? 0) : sum), 0);
  const stored = state.settlements.reduce((sum, s) => (s.player === player ? sum + (s.stored ?? 0) : sum), 0);
  return Math.max(0, holding(state, content, player, FOOD) + stored - eaten);
}

// Why the player cannot pay a turn of the wonder at this settlement now, or null.
function unpayable(state: GameState, map: GameMap, content: Content, wonder: Wonder, site: Settlement): string | null {
  for (const g of wonder.goods) {
    const have = spare(state, map, content, site.player, g.resource);
    if (have < g.count) return `Needs ${g.count} ${goodName(content, g.resource)} a turn (${have} to spare)`;
  }
  const cover = manpower(state, site) + Math.floor(playerOf(state, site.player).treasury / CURRENCY_PER_MANPOWER);
  if (cover < wonder.manpower) return `Needs ${wonder.manpower} manpower a turn here, or ${CURRENCY_PER_MANPOWER} currency for each unit missing`;
  return null;
}

export function goodName(content: Content, resource: string): string {
  if (resource === FOOD) return 'food';
  return content.resources.find((r) => r.id === resource)?.name.toLowerCase() ?? resource;
}

// Why the player cannot build this wonder at all yet, or null.
function closed(state: GameState, content: Content, player: PlayerId, wonder: Wonder): string | null {
  if (isCompleted(state, wonder.id)) return 'Already completed';
  const missing = wonder.requires.filter((a) => !reached(state, player, a, 'developed'));
  if (missing.length > 0) return `Needs ${missing.map((a) => content.advances.find((x) => x.id === a)?.name ?? a).join(' and ')} Developed`;
  if (buildOf(state, player, wonder.id)) return 'Already building it';
  return null;
}

// Why the player cannot put a wonder at this area, or null.
function badSite(state: GameState, player: PlayerId, area: AreaId): string | null {
  const site = settlementAt(state, area);
  if (!site || site.player !== player) return 'You have no settlement there';
  if (buildAt(state, player, area)) return 'A wonder is already being built there';
  return null;
}

function allocating(state: GameState, player: PlayerId): string | null {
  const p = state.players.find((x) => x.id === player);
  if (!p) return `Unknown player "${player}"`;
  if (state.phase !== 'allocation') return 'Wonders are ordered in the allocation phase';
  if (p.endedPhase) return 'You have already ended the allocation phase';
  return null;
}

export function validateStart(ctx: Pick<Context, 'state' | 'map' | 'content'>, command: Extract<Command, { type: 'startWonder' }>): string | null {
  const { state, map, content } = ctx;
  const wonder = wonderRule(content, command.wonder);
  if (!wonder) return `Unknown wonder "${command.wonder}"`;
  return allocating(state, command.player) ?? closed(state, content, command.player, wonder) ?? badSite(state, command.player, command.area) ?? unpayable(state, map, content, wonder, settlementAt(state, command.area)!);
}

export function startWonder(ctx: Context, command: Extract<Command, { type: 'startWonder' }>): void {
  ctx.state.builds.push({ wonder: command.wonder, player: command.player, area: command.area, worked: 0, started: ctx.state.turn });
  emit(ctx, { type: 'wonderStarted', player: command.player, wonder: command.wonder, area: command.area, worked: 0 });
}

export function validateRedirect(ctx: Pick<Context, 'state' | 'content'>, command: Extract<Command, { type: 'redirectWonder' }>): string | null {
  const { state, content } = ctx;
  const problem = allocating(state, command.player);
  if (problem) return problem;
  const lost = buildOf(state, command.player, command.wonder);
  if (lost?.outbuilt === undefined) return 'You have no progress on that wonder to move';
  if (!command.to) return null;
  const wonder = wonderRule(content, command.to.wonder);
  if (!wonder) return `Unknown wonder "${command.to.wonder}"`;
  return closed(state, content, command.player, wonder) ?? badSite(state, command.player, command.to.area);
}

// Turns of work on `to` worth the same share as `worked` of `from`, rounded down.
export function movedTurns(from: Wonder, worked: number, to: Wonder): number {
  return Math.floor((worked * to.turns) / from.turns);
}

// Culture points for `worked` turns of a wonder lost to a rival: the same share of its points.
export function consolation(content: Content, wonder: Wonder, worked: number): number {
  return Math.floor((wonderPoints(content, wonder) * worked) / wonder.turns);
}

function convert(ctx: Context, build: Build): void {
  const wonder = wonderRule(ctx.content, build.wonder)!;
  const points = consolation(ctx.content, wonder, build.worked);
  ctx.state.builds = ctx.state.builds.filter((b) => b !== build);
  playerOf(ctx.state, build.player).culture += points;
  emit(ctx, { type: 'wonderConverted', player: build.player, wonder: build.wonder, points });
}

export function redirectWonder(ctx: Context, command: Extract<Command, { type: 'redirectWonder' }>): void {
  const build = buildOf(ctx.state, command.player, command.wonder)!;
  if (!command.to) {
    convert(ctx, build);
    return;
  }
  const from = wonderRule(ctx.content, build.wonder)!;
  const to = wonderRule(ctx.content, command.to.wonder)!;
  const worked = movedTurns(from, build.worked, to);
  ctx.state.builds = ctx.state.builds.filter((b) => b !== build);
  ctx.state.builds.push({ wonder: to.id, player: command.player, area: command.to.area, worked, started: ctx.state.turn });
  emit(ctx, { type: 'wonderStarted', player: command.player, wonder: to.id, area: command.to.area, worked });
}

// Manpower on a wonder stops when its build ends.
function release(state: GameState, build: Build): void {
  const site = settlementAt(state, build.area);
  if (!site || site.player !== build.player) return;
  site.work = (site.work ?? []).filter((w) => w.resource !== WONDER);
}

// Resources phase: the manpower on each wonder this turn.
export function recordLabour(ctx: Context): void {
  const { state } = ctx;
  for (const b of state.builds) {
    if (b.outbuilt !== undefined) continue;
    const site = settlementAt(state, b.area);
    const units = site && site.player === b.player ? (activeWork(state, site).find((w) => w.resource === WONDER)?.count ?? 0) : 0;
    b.labour = { turn: state.turn, units };
  }
}

// After every resolution step: a build whose settlement is captured or gone loses its progress; a
// completed wonder whose settlement is gone is ruined and its effects end.
export function checkSites(ctx: Context): void {
  const { state } = ctx;
  for (const b of [...state.builds]) {
    if (b.outbuilt !== undefined) continue;
    const site = settlementAt(state, b.area);
    if (site && site.player === b.player) continue;
    state.builds = state.builds.filter((x) => x !== b);
    emit(ctx, { type: 'wonderLost', player: b.player, wonder: b.wonder, area: b.area, worked: b.worked });
  }
  for (const w of state.wonders) {
    if (w.ruined || settlementAt(state, w.area)) continue;
    w.ruined = true;
    emit(ctx, { type: 'wonderRuined', wonder: w.wonder, area: w.area });
  }
}

// Takes `count` of a goods entry from the player's goods: by area, the stock and purchases last.
function take(state: GameState, content: Content, player: PlayerId, resource: string, count: number): void {
  const matches = (r: ResourceId) => (resource === FOOD ? isFood(content, r) : r === resource);
  let left = count;
  for (const g of state.goods.filter((x) => x.player === player && matches(x.resource)).sort((x, y) => (x.area ?? Infinity) - (y.area ?? Infinity))) {
    const n = Math.min(left, g.count);
    g.count -= n;
    left -= n;
  }
  state.goods = state.goods.filter((g) => g.count > 0);
}

// One turn of work, or a stall that spends nothing.
function work(ctx: Context, build: Build, wonder: Wonder): boolean {
  const { state, content } = ctx;
  const p = playerOf(state, build.player);
  const labour = build.labour?.turn === state.turn ? Math.min(build.labour.units, wonder.manpower) : 0;
  const currency = (wonder.manpower - labour) * CURRENCY_PER_MANPOWER;
  const stall = (reason: string) => {
    emit(ctx, { type: 'wonderStalled', player: build.player, wonder: wonder.id, reason });
    return false;
  };
  const need = new Map<string, number>();
  for (const g of wonder.goods) need.set(g.resource, (need.get(g.resource) ?? 0) + g.count);
  for (const [resource, count] of need) {
    const have = holding(state, content, build.player, resource);
    if (have < count) return stall(`short of ${goodName(content, resource)}: ${have} of ${count}`);
  }
  if (p.treasury < currency) return stall(`short of manpower: ${labour} of ${wonder.manpower}, and ${p.treasury} of ${currency} currency to cover it`);
  // Specific goods first, so 'food' does not take a good another entry needs.
  for (const [resource, count] of [...need].sort((a, b) => Number(a[0] === FOOD) - Number(b[0] === FOOD))) take(state, content, build.player, resource, count);
  p.treasury -= currency;
  build.worked += 1;
  emit(ctx, { type: 'wonderWorked', player: build.player, wonder: wonder.id, worked: build.worked, currency });
  return build.worked >= wonder.turns;
}

// What this turn's resolution will do with the build, from the goods, manpower, and treasury now
// (calamities are not predicted): null if it will be worked, else why it will stall. A build
// started this turn is not worked yet.
export function forecastWork(state: GameState, map: GameMap, content: Content, build: Build): { worked: boolean; reason: string | null } {
  if (build.outbuilt !== undefined || build.started === state.turn) return { worked: false, reason: null };
  const wonder = wonderRule(content, build.wonder)!;
  for (const g of wonder.goods) {
    const have = spare(state, map, content, build.player, g.resource);
    if (have < g.count) return { worked: false, reason: `short of ${goodName(content, g.resource)} (${have} of ${g.count})` };
  }
  const labour = build.labour?.turn === state.turn ? Math.min(build.labour.units, wonder.manpower) : 0;
  const currency = (wonder.manpower - labour) * CURRENCY_PER_MANPOWER;
  const treasury = playerOf(state, build.player).treasury;
  if (treasury < currency) return { worked: false, reason: `short of manpower (${labour} of ${wonder.manpower}) and currency to cover it (${treasury} of ${currency})` };
  return { worked: true, reason: null };
}

// Currency the player's builds will take this turn for missing manpower, if they are worked.
export function wonderCurrency(state: GameState, map: GameMap, content: Content, player: PlayerId): number {
  return state.builds
    .filter((b) => b.player === player && forecastWork(state, map, content, b).worked)
    .reduce((sum, b) => {
      const wonder = wonderRule(content, b.wonder)!;
      const labour = b.labour?.turn === state.turn ? Math.min(b.labour.units, wonder.manpower) : 0;
      return sum + (wonder.manpower - labour) * CURRENCY_PER_MANPOWER;
    }, 0);
}

// Resolution step 12. Progress left from a race lost last turn and not moved becomes culture.
// Builds are worked in player order, each player's in content order; the first to finish a wonder
// gets it, and its other builders are outbuilt.
export function resolveWonders(ctx: Context): void {
  const { state, content } = ctx;
  for (const b of state.builds.filter((x) => x.outbuilt !== undefined && x.outbuilt < state.turn)) convert(ctx, b);
  const players = state.players.map((p) => p.id);
  const rank = (b: Build) => players.indexOf(b.player) * content.wonders.length + content.wonders.findIndex((w) => w.id === b.wonder);
  for (const build of [...state.builds].sort((a, b) => rank(a) - rank(b))) {
    if (build.outbuilt !== undefined || build.started === state.turn || !state.builds.includes(build)) continue;
    const wonder = wonderRule(content, build.wonder)!;
    if (!work(ctx, build, wonder)) continue;
    release(state, build);
    state.builds = state.builds.filter((b) => b !== build);
    state.wonders.push({ wonder: wonder.id, builder: build.player, area: build.area, turn: state.turn, effects: [...wonder.effects] });
    emit(ctx, { type: 'wonderCompleted', player: build.player, wonder: wonder.id, area: build.area });
    for (const rival of state.builds.filter((b) => b.wonder === wonder.id)) {
      release(state, rival);
      rival.outbuilt = state.turn;
      delete rival.labour;
      emit(ctx, { type: 'wonderOutbuilt', player: rival.player, wonder: wonder.id, worked: rival.worked, by: build.player });
    }
  }
}

export interface WonderView {
  wonder: Wonder;
  points: number;
  // Completed: who built it, where, and who holds it now (null once ruined).
  completed: { builder: PlayerId; area: AreaId; turn: number; holder: PlayerId | null } | null;
  // Who is building it (design doc §9, Visibility: who, not how far).
  builders: PlayerId[];
  // The player's own build.
  mine: Build | null;
  // Why the player cannot start it anywhere, or null.
  closed: string | null;
  // The player's settlements and why each cannot take it now (null: it can).
  sites: { area: AreaId; problem: string | null }[];
  // For the player's build in progress: whether this turn's work will be paid, and the turn it
  // finishes if every turn from now is paid (a build started this turn is first worked next turn).
  forecast: { worked: boolean; reason: string | null } | null;
  finish: number | null;
}

// Everything the Wonders screen shows, for one player.
export function wonderViews(state: GameState, map: GameMap, content: Content, player: PlayerId): WonderView[] {
  return content.wonders.map((wonder) => {
    const record = state.wonders.find((w) => w.wonder === wonder.id);
    const holder = record && !record.ruined ? (settlementAt(state, record.area)?.player ?? null) : null;
    const shut = closed(state, content, player, wonder);
    const own = state.settlements.filter((s) => s.player === player);
    const build = buildOf(state, player, wonder.id);
    const mine = build && build.outbuilt === undefined ? build : undefined;
    return {
      wonder,
      points: wonderPoints(content, wonder),
      completed: record ? { builder: record.builder, area: record.area, turn: record.turn, holder } : null,
      builders: state.builds.filter((b) => b.wonder === wonder.id && b.outbuilt === undefined).map((b) => b.player),
      mine: build ?? null,
      closed: shut,
      sites: shut ? [] : own.map((s) => ({ area: s.area, problem: badSite(state, player, s.area) ?? unpayable(state, map, content, wonder, s) })),
      forecast: mine ? forecastWork(state, map, content, mine) : null,
      finish: mine ? state.turn + wonder.turns - mine.worked - (mine.started === state.turn ? 0 : 1) : null,
    };
  });
}

// Wonders the player holds now and their effects, for summaries.
export function heldWonderNames(state: GameState, content: Content, player: PlayerId): string[] {
  return heldWonders(state, player).map((w) => wonderRule(content, w.wonder)?.name ?? w.wonder);
}
