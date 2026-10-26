import type { Advance, AreaFilter, Condition, DomainId, Effect, Gathering, Input, SettlementTier } from '../content/types';
import type { Content } from './content';
import { emit } from './context';
import { capitalDistance } from './instability';
import type { AreaId, GameMap } from './map/types';
import { STARTING_TOKEN_CAP } from './population';
import { activeWork } from './resources';
import { randomInt } from './rng';
import type { AdvanceProgress, Command, Context, GameState, PlayerId, PlayerState, Settlement } from './types';

// Discovery (design doc §8). Each advance climbs Plausible → Known → Developed → Adopted →
// Mastered, each step reached exactly when its progress reaches its cost; nothing is random. Usage
// (the advance's own inputs) moves every step; learning (High Learning, sent down the study queue)
// speeds it up but is never required. Nothing is ever lost;
// partial progress toward Known and Developed pauses while conditions lapse.

export const HIGH_LEARNING = 'highLearning';
export const DOMAINS: readonly DomainId[] = ['land', 'crafts', 'beliefs', 'travel', 'war'];
// What one unit of learning adds: progress toward Known and Developed, adoption points toward
// Mastered (design doc §8, v0.17; starting values).
export const LEARNING_PROGRESS = 2;
export const LEARNING_ADOPTION = 10;
// Adoption points to Mastered (100% adopted).
export const ADOPTION_COST = 200;
// Shares of learning are fractions; sums within this of a cost count as reaching it.
const EPSILON = 1e-9;

const fill = (value: number, cost: number) => (cost - value < EPSILON ? cost : value);
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
    case 'fought': {
      const fought = player(state, id).fought;
      return fought?.turn === state.turn ? fought.count : 0;
    }
    case 'traded': {
      const traded = player(state, id).traded;
      return traded?.turn === state.turn ? traded.resources.length : 0;
    }
    case 'struck':
      return own.filter((s) => s.struck?.turn === state.turn && s.struck.calamity === input.calamity).length;
  }
}

export function plausible(state: GameState, map: GameMap, content: Content, id: PlayerId, advance: Advance): boolean {
  return (advance.plausible ?? []).every((c) => conditionMet(state, map, content, id, c));
}

export function highLearning(state: GameState, id: PlayerId): number {
  return state.settlements.filter((s) => s.player === id).reduce((sum, s) => sum + (activeWork(state, s).find((w) => w.resource === HIGH_LEARNING)?.count ?? 0), 0);
}

// Free learning toward an advance's next step, Known or Developed, while it is plausible
// (Superstition's gift to Ritual, design doc §12). Resolved with the turn's discovery.
export function grantLearning(ctx: Context, id: PlayerId, advanceId: string, units: number): void {
  const { state, map, content } = ctx;
  const advance = content.advances.find((a) => a.id === advanceId);
  if (!advance) return;
  const stage = stageOf(state, id, advanceId);
  if (stage === 'developed' || !plausible(state, map, content, id, advance)) return;
  const cost = stepCost(state, id, advance, stage);
  if (cost === null) return;
  const e = entry(player(state, id), advanceId, content);
  e.progress = Math.min(cost, e.progress + units * LEARNING_PROGRESS);
}

// Learning a turn: one per High Learning unit.
export function learningPool(state: GameState, id: PlayerId): number {
  return highLearning(state, id);
}

// What an advance's next step costs, in its own units: progress toward Known or Developed, or
// adoption points toward Mastered (ADOPTION_COST is 100%). Null when there is no next step.
function stepCost(state: GameState, id: PlayerId, advance: Advance, stage: Stage): number | null {
  if (stage === 'none') return advance.known?.cost ?? null;
  if (stage === 'known') return advance.developed?.cost ?? null;
  if (!advance.adoption || advance.baseline || adoptionOf(state, id, advance.id) >= 100) return null;
  return ADOPTION_COST;
}

// Progress so far toward the next step, in the step's units.
function stepProgress(state: GameState, id: PlayerId, advance: Advance, stage: Stage): number {
  if (stage === 'developed') return (adoptionOf(state, id, advance.id) * ADOPTION_COST) / 100;
  return progressOf(state, id, advance.id)?.progress ?? 0;
}

// What one unit of learning adds toward the step.
const perLearning = (stage: Stage) => (stage === 'developed' ? LEARNING_ADOPTION : LEARNING_PROGRESS);

function usageInputs(advance: Advance, stage: Stage): Input[] {
  if (stage === 'none') return advance.known?.inputs ?? [];
  if (stage === 'known') return advance.developed?.inputs ?? [];
  return advance.adoption?.inputs ?? [];
}

// Where an advance's next step stands and what usage adds to it this turn. Toward Known and
// Developed nothing moves while the plausibility conditions lapse; adoption does not need them.
interface Step {
  cost: number;
  progress: number;
  moving: boolean;
  usage: ProgressPart[];
  usageRate: number;
}

function step(state: GameState, map: GameMap, content: Content, id: PlayerId, advance: Advance): Step | null {
  const stage = stageOf(state, id, advance.id);
  const cost = stepCost(state, id, advance, stage);
  if (cost === null) return null;
  const progress = stepProgress(state, id, advance, stage);
  const moving = stage === 'developed' || plausible(state, map, content, id, advance);
  const usage: ProgressPart[] = [];
  if (moving && progress < cost) {
    for (const input of usageInputs(advance, stage)) {
      const count = inputCount(state, map, content, id, input);
      if (count > 0) usage.push({ input, count, value: count * input.amount });
    }
  }
  return { cost, progress, moving, usage, usageRate: usage.reduce((sum, x) => sum + x.value, 0) };
}

// Where this turn's learning goes: the study queue in order, then an even split of what is left
// among every advance still short of its next step after usage; anything beyond every need is
// unused. Learning only speeds advances up; usage alone also gets there.
export interface LearningPlan {
  shares: Map<string, number>;
  pool: number;
  queued: number;
  split: number;
  unused: number;
}

export function learningPlan(state: GameState, map: GameMap, content: Content, id: PlayerId): LearningPlan {
  const p = player(state, id);
  const need = new Map<string, number>();
  for (const advance of content.advances) {
    const s = step(state, map, content, id, advance);
    if (!s || !s.moving) continue;
    const left = (s.cost - s.progress - s.usageRate) / perLearning(stageOf(state, id, advance.id));
    if (left > EPSILON) need.set(advance.id, left);
  }
  const shares = new Map<string, number>();
  const give = (advance: string, amount: number) => {
    shares.set(advance, (shares.get(advance) ?? 0) + amount);
    need.set(advance, need.get(advance)! - amount);
  };
  const pool = learningPool(state, id);
  let left = pool;
  for (const advance of p.study) {
    if (left <= 0) break;
    const n = need.get(advance) ?? 0;
    if (n <= EPSILON) continue;
    const amount = Math.min(n, left);
    give(advance, amount);
    left -= amount;
  }
  const queued = pool - left;
  // Even split, refilled while some advances need less than their share.
  for (;;) {
    const waiting = content.advances.map((a) => a.id).filter((a) => (need.get(a) ?? 0) > EPSILON);
    if (left <= EPSILON || waiting.length === 0) break;
    const share = left / waiting.length;
    for (const a of waiting) {
      const amount = Math.min(need.get(a)!, share);
      give(a, amount);
      left -= amount;
    }
  }
  return { shares, pool, queued, split: pool - queued - left, unused: left };
}

// One source of an advance's progress this turn, for the Knowledge screen's breakdown. For
// learning, `count` is the learning sent and `value` what it adds.
export interface ProgressPart {
  input: Input | 'learning';
  count: number;
  value: number;
}

// Where an advance stands for a player, and what moves it this turn.
export interface AdvanceView {
  advance: Advance;
  stage: Stage;
  plausible: boolean;
  conditions: { condition: Condition; met: boolean }[];
  // The next step and its progress, in progress toward Known and Developed and in adoption points
  // (ADOPTION_COST is Mastered) after; null when there is none.
  next: 'known' | 'developed' | 'mastered' | null;
  progress: number;
  cost: number;
  parts: ProgressPart[];
  usageRate: number;
  // Learning sent to the advance this turn, and what it adds.
  learning: number;
  learningRate: number;
  rate: number;
  // Turns to the next step at the current rate; null when nothing moves it.
  turns: number | null;
  adoption: number;
  // Place in the study queue (1 first), or null.
  queued: number | null;
}

// Every advance's standing and rates for a player; resolution applies exactly these rates.
export function discoveryView(state: GameState, map: GameMap, content: Content, id: PlayerId): AdvanceView[] {
  const p = player(state, id);
  const plan = learningPlan(state, map, content, id);
  return content.advances.map((advance) => {
    const stage = stageOf(state, id, advance.id);
    const s = step(state, map, content, id, advance);
    const learning = plan.shares.get(advance.id) ?? 0;
    const learningRate = learning * perLearning(stage);
    const parts = [...(s?.usage ?? [])];
    if (learning > 0) parts.push({ input: 'learning', count: learning, value: learningRate });
    const usageRate = s?.usageRate ?? 0;
    const rate = usageRate + learningRate;
    const index = p.study.indexOf(advance.id);
    return {
      advance,
      stage,
      plausible: plausible(state, map, content, id, advance),
      conditions: (advance.plausible ?? []).map((condition) => ({ condition, met: conditionMet(state, map, content, id, condition) })),
      next: s ? (stage === 'none' ? 'known' : stage === 'known' ? 'developed' : 'mastered') : null,
      progress: s?.progress ?? 0,
      cost: s?.cost ?? 0,
      parts,
      usageRate,
      learning,
      learningRate,
      rate,
      turns: !s ? null : s.progress >= s.cost ? 0 : rate > 0 ? Math.max(1, Math.ceil((s.cost - s.progress - EPSILON) / rate)) : null,
      adoption: adoptionOf(state, id, advance.id),
      queued: index >= 0 ? index + 1 : null,
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
// Mastered effects once adoption is 100. The token cap and the unlocked tiers follow from them.
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

// Resolution step 10: every advance gains this turn's usage and learning toward its next step and
// reaches it when progress reaches the cost (any excess is dropped). Nothing falls. Finished
// advances leave the study queue.
export function resolveDiscovery(ctx: Context): void {
  const { state, map, content } = ctx;
  for (const p of state.players) {
    const views = discoveryView(state, map, content, p.id);
    const plan = learningPlan(state, map, content, p.id);
    if (plan.pool > 0 && plan.queued === 0 && plan.split > 0) emit(ctx, { type: 'studyQueueEmpty', player: p.id, learning: plan.split });
    for (const view of views) {
      const { advance } = view;
      if (!view.next || (view.rate <= 0 && view.progress < view.cost)) continue;
      const e = entry(p, advance.id, content);
      const progress = fill(view.progress + view.rate, view.cost);
      if (view.next === 'mastered') {
        e.adoption = Math.min(100, (progress * 100) / ADOPTION_COST);
        if (e.adoption >= 100) emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: 'mastered' });
        continue;
      }
      e.progress = Math.min(progress, view.cost);
      if (e.progress < view.cost) continue;
      e.stage = view.next;
      e.progress = 0;
      if (view.next === 'developed') {
        if (!advance.adoption) e.adoption = 100;
        runHooks(ctx, advance);
      }
      emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: view.next });
      if (e.adoption === 100) emit(ctx, { type: 'advanceReached', player: p.id, advance: advance.id, stage: 'mastered' });
    }
    p.study = p.study.filter((a) => stepCost(state, p.id, content.advances.find((x) => x.id === a)!, stageOf(state, p.id, a)) !== null);
    refreshEffects(state, content, p);
  }
}

export function validateStudy(ctx: Pick<Context, 'state' | 'map' | 'content'>, command: Extract<Command, { type: 'setStudy' }>): string | null {
  const p = ctx.state.players.find((x) => x.id === command.player);
  if (!p) return `Unknown player "${command.player}"`;
  if (ctx.state.phase !== 'allocation') return 'The study queue is set in the allocation phase';
  if (p.endedPhase) return `Player "${command.player}" already ended phase "allocation"`;
  if (new Set(command.queue).size !== command.queue.length) return 'An advance is in the queue twice';
  for (const id of command.queue) {
    const advance = ctx.content.advances.find((a) => a.id === id);
    if (!advance) return `Unknown advance "${id}"`;
    const stage = stageOf(ctx.state, p.id, id);
    if (advance.baseline || (stage === 'developed' && adoptionOf(ctx.state, p.id, id) >= 100)) return `${advance.name} needs no more learning`;
    // Entries already queued stay when they stop being plausible; they are skipped until they are again.
    if (stage !== 'developed' && !p.study.includes(id) && !plausible(ctx.state, ctx.map, ctx.content, p.id, advance)) return `${advance.name} is not plausible yet`;
  }
  return null;
}

export function setStudy(ctx: Context, command: Extract<Command, { type: 'setStudy' }>): void {
  player(ctx.state, command.player).study = [...command.queue];
}
