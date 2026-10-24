import type { Advance, AreaFilter, Condition, DomainId, Effect, Gathering, Input, SettlementTier } from '../content/types';
import type { Content } from './content';
import { emit } from './context';
import { capitalDistance } from './instability';
import type { AreaId, GameMap } from './map/types';
import { STARTING_TOKEN_CAP } from './population';
import { randomInt } from './rng';
import type { AdvanceProgress, Command, Context, GameState, PlayerId, PlayerState, Settlement } from './types';

// Discovery (design doc §8). Each advance climbs Plausible → Known → Developed → Adopted →
// Mastered. Known and Developed each have an accumulator reached exactly when progress reaches its
// cost; nothing is random. High Learning manpower is a pool sent to the focused domain's advances,
// at half rate toward Developed. Known and Developed are never lost; adoption falls without its
// drivers; partial progress pauses while conditions lapse.

export const HIGH_LEARNING = 'highLearning';
export const DOMAINS: readonly DomainId[] = ['land', 'crafts', 'beliefs', 'travel', 'war'];
// High Learning counts in full toward Known and at this share toward Developed (starting value).
export const HIGH_LEARNING_DEVELOPED = 0.5;
// Advances each civilization draws with Advanced start (design doc §2, Setup options).
export const ADVANCED_START_DRAWS = 2;

export type Stage = 'none' | 'known' | 'developed';

function player(state: GameState, id: PlayerId): PlayerState {
  return state.players.find((p) => p.id === id)!;
}

function progressOf(state: GameState, id: PlayerId, advance: string): AdvanceProgress | undefined {
  return player(state, id).advances.find((a) => a.advance === advance);
}

export function stageOf(state: GameState, id: PlayerId, advance: string): Stage {
  return progressOf(state, id, advance)?.stage ?? 'none';
}

export function adoptionOf(state: GameState, id: PlayerId, advance: string): number {
  return progressOf(state, id, advance)?.adoption ?? 0;
}

const RANK: Record<Stage, number> = { none: 0, known: 1, developed: 2 };

export function reached(state: GameState, id: PlayerId, advance: string, stage: 'known' | 'developed'): boolean {
  return RANK[stageOf(state, id, advance)] >= RANK[stage];
}

// Areas where the player has loose tokens or a settlement.
function presence(state: GameState, id: PlayerId): Set<AreaId> {
  return new Set([...state.stacks.filter((s) => s.player === id).map((s) => s.area), ...state.settlements.filter((s) => s.player === id).map((s) => s.area)]);
}

// Areas next to the player's (or holding them) where another civilization has tokens or a
// settlement: the civilizations in contact (design doc §8, Barter).
function contactOf(state: GameState, map: GameMap, id: PlayerId, areas: Iterable<AreaId>): Set<PlayerId> {
  const near = new Set<AreaId>();
  for (const a of areas) for (const n of [a, ...map.areas[a]!.neighbors]) near.add(n);
  const rivals = new Set<PlayerId>();
  for (const s of state.stacks) if (s.player !== id && near.has(s.area)) rivals.add(s.player);
  for (const s of state.settlements) if (s.player !== id && near.has(s.area)) rivals.add(s.player);
  return rivals;
}

// Whether a settlement's manpower works the goods: any food, any good, or one of a list.
function gathers(content: Content, settlement: Settlement, what: Gathering): boolean {
  return (settlement.work ?? []).some((w) => {
    if (w.count <= 0) return false;
    const resource = content.resources.find((r) => r.id === w.resource);
    if (!resource) return false;
    if (what === 'any') return true;
    if (what === 'food') return resource.food;
    return what.includes(resource.id);
  });
}

function matches(state: GameState, map: GameMap, id: PlayerId, area: AreaId, where: AreaFilter | undefined): boolean {
  if (!where) return true;
  const a = map.areas[area]!;
  if (where.resource !== undefined && ![where.resource].flat().some((r) => a.resources.includes(r))) return false;
  if (where.terrain !== undefined && (a.terrain === null || ![where.terrain].flat().includes(a.terrain))) return false;
  if (where.feature !== undefined && !a.features.includes(where.feature)) return false;
  if (where.full) {
    const settled = state.settlements.some((s) => s.area === area);
    const tokens = state.stacks.find((s) => s.area === area && s.player === id)?.count ?? 0;
    if (!settled && tokens < a.limit) return false;
  }
  return true;
}

export function conditionMet(state: GameState, map: GameMap, content: Content, id: PlayerId, condition: Condition): boolean {
  switch (condition.type) {
    case 'knows':
      return reached(state, id, condition.advance, condition.stage);
    case 'presence':
      return [...presence(state, id)].filter((a) => matches(state, map, id, a, condition.where)).length >= (condition.min ?? 1);
    case 'settlements':
      return state.settlements.filter((s) => s.player === id && (condition.tier === undefined || s.tier === condition.tier)).length >= condition.min;
    case 'contact':
      return contactOf(state, map, id, presence(state, id)).size > 0;
    case 'gathering':
      return state.settlements.some((s) => s.player === id && gathers(content, s, condition.what));
  }
}

function settlementCounts(state: GameState, map: GameMap, content: Content, id: PlayerId, s: Settlement, input: Extract<Input, { per: 'settlement' }>): boolean {
  if (s.player !== id) return false;
  if (input.tier !== undefined && s.tier !== input.tier) return false;
  if (!matches(state, map, id, s.area, input.where)) return false;
  if (input.gathering !== undefined && !gathers(content, s, input.gathering)) return false;
  if (input.contact && contactOf(state, map, id, [s.area]).size === 0) return false;
  if (input.beyond !== undefined) {
    const d = capitalDistance(state, map, s);
    if (d !== null && d <= input.beyond) return false;
  }
  return true;
}

// How many things an input counts for the player this turn.
export function inputCount(state: GameState, map: GameMap, content: Content, id: PlayerId, input: Input): number {
  const own = state.settlements.filter((s) => s.player === id);
  switch (input.per) {
    case 'turn':
      return 1;
    case 'area':
      return [...presence(state, id)].filter((a) => matches(state, map, id, a, input.where)).length;
    case 'settlement':
      return own.filter((s) => settlementCounts(state, map, content, id, s, input)).length;
    case 'worker':
      return own.reduce((sum, s) => sum + ((s.work ?? []).find((w) => w.resource === input.resource)?.count ?? 0), 0);
    case 'instability':
      return player(state, id).instability;
    case 'rival':
      return contactOf(state, map, id, presence(state, id)).size;
    case 'goodKind':
      return new Set(own.flatMap((s) => (s.work ?? []).filter((w) => w.count > 0 && content.resources.some((r) => r.id === w.resource)).map((w) => w.resource))).size;
    case 'attacked':
      return own.filter((s) => s.attacked === state.turn).length;
    // Calamities arrive in Phase 4 step 5 and the market in step 4; until then nothing counts.
    case 'struck':
    case 'traded':
      return 0;
  }
}

export function plausible(state: GameState, map: GameMap, content: Content, id: PlayerId, advance: Advance): boolean {
  return (advance.plausible ?? []).every((c) => conditionMet(state, map, content, id, c));
}

export function highLearning(state: GameState, id: PlayerId): number {
  return state.settlements.filter((s) => s.player === id).reduce((sum, s) => sum + ((s.work ?? []).find((w) => w.resource === HIGH_LEARNING)?.count ?? 0), 0);
}

// One source of an advance's progress this turn, for the Knowledge screen's breakdown.
export interface ProgressPart {
  input: Input | 'highLearning';
  count: number;
  value: number;
}

// Where an advance stands for a player, and what moves it this turn.
export interface AdvanceView {
  advance: Advance;
  stage: Stage;
  plausible: boolean;
  conditions: { condition: Condition; met: boolean }[];
  // Toward the next stage (Known, then Developed); null once Developed.
  next: 'known' | 'developed' | null;
  progress: number;
  cost: number;
  parts: ProgressPart[];
  rate: number;
  // Turns to the next stage at the current rate; null when nothing is moving it.
  turns: number | null;
  adoption: number;
  adoptionRate: number;
  focused: boolean;
}

function stageRules(advance: Advance, stage: Stage) {
  if (stage === 'none') return advance.known ?? null;
  if (stage === 'known') return advance.developed ?? null;
  return null;
}

// Every advance's standing and rates for a player; resolution applies exactly these rates.
export function discoveryView(state: GameState, map: GameMap, content: Content, id: PlayerId): AdvanceView[] {
  const p = player(state, id);
  const open = content.advances.filter((a) => {
    const stage = stageOf(state, id, a.id);
    return stageRules(a, stage) !== null && plausible(state, map, content, id, a);
  });
  const focused = p.focus !== null && open.some((a) => a.domain === p.focus) ? open.filter((a) => a.domain === p.focus) : open;
  const share = focused.length > 0 ? highLearning(state, id) / focused.length : 0;
  return content.advances.map((advance) => {
    const stage = stageOf(state, id, advance.id);
    const rules = stageRules(advance, stage);
    const isOpen = open.includes(advance);
    const parts: ProgressPart[] = [];
    if (rules && isOpen) {
      for (const input of rules.inputs) {
        const count = inputCount(state, map, content, id, input);
        if (count > 0) parts.push({ input, count, value: count * input.amount });
      }
      if (focused.includes(advance) && share > 0) parts.push({ input: 'highLearning', count: share, value: share * (stage === 'none' ? 1 : HIGH_LEARNING_DEVELOPED) });
    }
    const rate = parts.reduce((sum, x) => sum + x.value, 0);
    const progress = progressOf(state, id, advance.id)?.progress ?? 0;
    const cost = rules?.cost ?? 0;
    const adoptionRate =
      stage === 'developed' && advance.adoption
        ? advance.adoption.inputs.reduce((sum, input) => sum + inputCount(state, map, content, id, input) * input.amount, 0)
        : 0;
    return {
      advance,
      stage,
      plausible: plausible(state, map, content, id, advance),
      conditions: (advance.plausible ?? []).map((condition) => ({ condition, met: conditionMet(state, map, content, id, condition) })),
      next: rules ? (stage === 'none' ? 'known' : 'developed') : null,
      progress,
      cost,
      parts,
      rate,
      turns: rules && rate > 0 ? Math.max(1, Math.ceil((cost - progress) / rate)) : null,
      adoption: adoptionOf(state, id, advance.id),
      adoptionRate,
      focused: focused.includes(advance) && p.focus !== null,
    };
  });
}

function entry(p: PlayerState, advance: string, content: Content): AdvanceProgress {
  let e = p.advances.find((a) => a.advance === advance);
  if (!e) {
    e = { advance, stage: 'none', progress: 0, adoption: 0 };
    p.advances.push(e);
    const order = new Map(content.advances.map((a, i) => [a.id, i]));
    p.advances.sort((a, b) => order.get(a.advance)! - order.get(b.advance)!);
  }
  return e;
}

const TIER_ORDER: readonly SettlementTier[] = ['village', 'town', 'city', 'metropolis'];

// What advances do (design doc §8): a Developed advance's effects are in force civ-wide, and its
// Mastered effects while adoption is 100, so they lapse if adoption falls. The token cap and the
// unlocked tiers follow from them.
export function refreshEffects(state: GameState, content: Content, p: PlayerState): void {
  const effects: Effect[] = [];
  for (const advance of content.advances) {
    const e = p.advances.find((a) => a.advance === advance.id);
    if (e?.stage !== 'developed') continue;
    effects.push(...advance.effects.filter((x) => x.type !== 'hook'));
    if (e.adoption >= 100) effects.push(...(advance.mastered ?? []).filter((x) => x.type !== 'hook'));
  }
  p.effects = effects;
  p.tokenCap = STARTING_TOKEN_CAP + effects.reduce((sum, x) => sum + (x.type === 'raiseTokenCap' ? x.amount : 0), 0);
  const tiers = new Set<SettlementTier>([...(state.setup.unlockedTiers ?? []), ...effects.flatMap((x) => (x.type === 'unlockTier' ? [x.tier] : []))]);
  p.tiers = TIER_ORDER.filter((t) => tiers.has(t));
}

// Scripted hooks run once, when the advance is Developed.
function runHooks(ctx: Context, advance: Advance): void {
  for (const effect of advance.effects) if (effect.type === 'hook') ctx.content.hooks[effect.hook]!(ctx, effect.params ?? {});
}

// Developed and Mastered at once: the starting baseline and Advanced start draws.
function grant(ctx: Context, p: PlayerState, advance: Advance): void {
  const e = entry(p, advance.id, ctx.content);
  e.stage = 'developed';
  e.progress = 0;
  e.adoption = 100;
  runHooks(ctx, advance);
}

// Advances that build only on the baseline (design doc §2, Advanced start).
export function firstRing(content: Content): Advance[] {
  const baseline = new Set(content.advances.filter((a) => a.baseline).map((a) => a.id));
  return content.advances.filter((a) => !a.baseline && (a.plausible ?? []).every((c) => c.type !== 'knows' || baseline.has(c.advance)));
}

// Game start: every civilization gets the baseline; with Advanced start, each also draws its own
// first-ring advances from the seeded generator.
export function grantStartingKnowledge(ctx: Context): void {
  const ring = firstRing(ctx.content);
  for (const p of ctx.state.players) {
    for (const advance of ctx.content.advances.filter((a) => a.baseline)) grant(ctx, p, advance);
    if (!ctx.state.setup.advancedStart) continue;
    const pool = [...ring];
    for (let k = 0; k < ADVANCED_START_DRAWS && pool.length > 0; k++) {
      const [advance] = pool.splice(randomInt(ctx, `advanced start ${p.id}`, 0, pool.length - 1), 1);
      grant(ctx, p, advance!);
      emit(ctx, { type: 'advanceReached', player: p.id, advance: advance!.id, stage: 'developed' });
    }
  }
  for (const p of ctx.state.players) refreshEffects(ctx.state, ctx.content, p);
}

// Resolution step 10: every open advance gains this turn's progress, reaching its next stage
// exactly at its cost (any excess is dropped); Developed advances gain or lose adoption.
export function resolveDiscovery(ctx: Context): void {
  const { state, map, content } = ctx;
  for (const p of state.players) {
    const views = discoveryView(state, map, content, p.id);
    for (const view of views) {
      const { advance } = view;
      if (view.next && view.rate > 0) {
        const e = entry(p, advance.id, content);
        e.progress += view.rate;
        if (e.progress >= view.cost) {
          e.stage = view.next;
          e.progress = 0;
          if (view.next === 'developed') {
            if (!advance.adoption) e.adoption = 100;
            runHooks(ctx, advance);
          }
          emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: view.next });
          if (e.adoption === 100) emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: 'mastered' });
        }
        continue;
      }
      if (view.stage !== 'developed' || !advance.adoption) continue;
      const e = entry(p, advance.id, content);
      const before = e.adoption;
      e.adoption = view.adoptionRate > 0 ? Math.min(100, before + view.adoptionRate) : Math.max(0, before - advance.adoption.fall);
      if (e.adoption === 100 && before < 100) emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: 'mastered' });
    }
    refreshEffects(state, content, p);
  }
}

export function validateFocus(ctx: Pick<Context, 'state'>, command: Extract<Command, { type: 'setFocus' }>): string | null {
  const p = ctx.state.players.find((x) => x.id === command.player);
  if (!p) return `Unknown player "${command.player}"`;
  if (ctx.state.phase !== 'allocation') return 'Discovery focus is set in the allocation phase';
  if (p.endedPhase) return `Player "${command.player}" already ended phase "allocation"`;
  if (command.domain !== null && !DOMAINS.includes(command.domain)) return `Unknown domain "${command.domain}"`;
  return null;
}

export function setFocus(ctx: Context, command: Extract<Command, { type: 'setFocus' }>): void {
  player(ctx.state, command.player).focus = command.domain;
}
