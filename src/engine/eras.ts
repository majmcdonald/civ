import type { Era, EraId, Gate } from '../content/types';
import { tierPoints } from './calamities';
import type { Content } from './content';
import { emit } from './context';
import { activeWork } from './resources';
import type { Context, GameState, PlayerId, PlayerState, Score, Settlement } from './types';

// Eras, culture, and victory (design doc §6, §14, §15, v0.26). No track and no turn clock: a
// civilization enters the next era once it meets that era's gate of settlement points and knowledge
// points, checked only on entry, and never loses an era. Meeting the gate of the era after the final
// era (or the last era's closing gate) starts a 5-turn endgame countdown; the highest score then
// wins. Artists earn culture points.

export const ARTISTS = 'artists';
// Artists progress per culture award; the era sets how many points the award is.
export const CULTURE_PROGRESS = 5;
export const COUNTDOWN = 5;

function player(state: GameState, id: PlayerId): PlayerState {
  return state.players.find((p) => p.id === id)!;
}

export function erasInOrder(content: Content): Era[] {
  return [...content.eras].sort((a, b) => a.order - b.order);
}

export function eraOf(content: Content, id: EraId): Era {
  return content.eras.find((e) => e.id === id)!;
}

// Points rules for an era: its own, or the latest earlier era's.
function pointsOf(content: Content, id: EraId): NonNullable<Era['points']> {
  const order = eraOf(content, id).order;
  return erasInOrder(content).filter((e) => e.order <= order && e.points).pop()!.points!;
}

// Settlement points: village 1, town 2, city 3, metropolis 4 (the calamity exposure scale).
export function settlementPoints(state: GameState, id: PlayerId): number {
  return tierPoints(state, id);
}

export interface KnowledgePart {
  era: EraId;
  developed: number;
  mastered: number;
  points: number;
}

// Knowledge points by era: each Developed advance scores its era's Developed value, or its Mastered
// value once adoption is 100. Baseline advances and advances with no adoption stage never score as
// Mastered.
export function knowledgeParts(state: GameState, content: Content, id: PlayerId): KnowledgePart[] {
  const parts = new Map<EraId, KnowledgePart>();
  for (const e of player(state, id).advances) {
    const advance = content.advances.find((a) => a.id === e.advance);
    if (!advance || advance.baseline || e.stage !== 'developed') continue;
    const values = eraOf(content, advance.era).points!;
    const part = parts.get(advance.era) ?? { era: advance.era, developed: 0, mastered: 0, points: 0 };
    const mastered = Boolean(advance.adoption) && e.adoption >= 100;
    if (mastered) part.mastered += 1;
    else part.developed += 1;
    part.points += mastered ? values.mastered : values.developed;
    parts.set(advance.era, part);
  }
  return erasInOrder(content).flatMap((e) => (parts.has(e.id) ? [parts.get(e.id)!] : []));
}

export function knowledgePoints(state: GameState, content: Content, id: PlayerId): number {
  return knowledgeParts(state, content, id).reduce((sum, x) => sum + x.points, 0);
}

export function scoreOf(state: GameState, content: Content, id: PlayerId): Score {
  const knowledge = knowledgePoints(state, content, id);
  const settlement = settlementPoints(state, id);
  const culture = player(state, id).culture;
  return { player: id, knowledge, settlement, wonders: 0, culture, total: knowledge + settlement + culture };
}

// Every civilization's score, highest first (player order on ties).
export function scores(state: GameState, content: Content): Score[] {
  return state.players.map((p) => scoreOf(state, content, p.id)).sort((a, b) => b.total - a.total);
}

export function meetsGate(state: GameState, content: Content, id: PlayerId, gate: Gate): boolean {
  return settlementPoints(state, id) >= gate.settlement && knowledgePoints(state, content, id) >= gate.knowledge;
}

// The next gate a civilization faces: the next era's, or the last era's closing gate. Null when
// there is none yet (the next era has no gate, or the last era has no closing gate).
export function nextGate(content: Content, era: EraId): { era: Era | null; gate: Gate } | null {
  const order = erasInOrder(content);
  const next = order[order.findIndex((e) => e.id === era) + 1];
  if (next) return next.gate ? { era: next, gate: next.gate } : null;
  const closing = eraOf(content, era).closing;
  return closing ? { era: null, gate: closing } : null;
}

// The civilization has completed the game's final era: it has entered a later era, or, in the last
// era, met its closing gate.
export function completedFinal(state: GameState, content: Content, id: PlayerId): boolean {
  const final = eraOf(content, state.setup.finalEra);
  const era = eraOf(content, player(state, id).era);
  if (era.order > final.order) return true;
  return era.id === final.id && final.closing !== undefined && meetsGate(state, content, id, final.closing);
}

export function artistsAt(state: GameState, s: Settlement): number {
  return activeWork(state, s).find((w) => w.resource === ARTISTS)?.count ?? 0;
}

export function artists(state: GameState, id: PlayerId): number {
  return state.settlements.reduce((sum, s) => (s.player === id ? sum + artistsAt(state, s) : sum), 0);
}

// Culture points for every CULTURE_PROGRESS Artists progress in the civilization's current era.
export function culturePerAward(state: GameState, content: Content, id: PlayerId): number {
  return pointsOf(content, player(state, id).era).culture;
}

// Resources phase: each Artists unit adds 1 progress; every CULTURE_PROGRESS is a culture award.
export function runArtists(ctx: Context): void {
  const { state, content } = ctx;
  for (const p of state.players) {
    const units = artists(state, p.id);
    if (units === 0) continue;
    p.cultureProgress += units;
    const awards = Math.floor(p.cultureProgress / CULTURE_PROGRESS);
    if (awards === 0) continue;
    p.cultureProgress -= awards * CULTURE_PROGRESS;
    const points = awards * culturePerAward(state, content, p.id);
    p.culture += points;
    emit(ctx, { type: 'cultureGained', player: p.id, points });
  }
}

// Resolution step 13: civilizations enter every era whose gate they meet; the countdown starts
// when one completes the final era, and the game ends with the countdown's last turn.
export function resolveEras(ctx: Context): void {
  const { state, content } = ctx;
  if (state.endgame && state.turn >= state.endgame.ends) {
    state.over = true;
    const final = scores(state, content);
    const top = final[0]?.total ?? 0;
    emit(ctx, { type: 'gameEnded', scores: final, winners: final.filter((s) => s.total === top).map((s) => s.player) });
    return;
  }
  for (const p of state.players) {
    for (;;) {
      const next = nextGate(content, p.era);
      if (!next?.era || !meetsGate(state, content, p.id, next.gate)) break;
      p.era = next.era.id;
      emit(ctx, { type: 'eraEntered', player: p.id, era: p.era });
    }
  }
  if (state.endgame) return;
  const by = state.players.filter((p) => completedFinal(state, content, p.id)).map((p) => p.id);
  if (by.length === 0) return;
  state.endgame = { began: state.turn, ends: state.turn + COUNTDOWN, by };
  emit(ctx, { type: 'endgameBegan', by, ends: state.endgame.ends });
}

// A civilization's standing for the Rivals screen and the top bar.
export interface EraView {
  era: Era;
  score: Score;
  knowledge: KnowledgePart[];
  // The next gate, or null if none is set yet.
  next: { era: Era | null; gate: Gate } | null;
  artists: number;
  cultureProgress: number;
  culturePerAward: number;
}

export function eraView(state: GameState, content: Content, id: PlayerId): EraView {
  const p = player(state, id);
  return {
    era: eraOf(content, p.era),
    score: scoreOf(state, content, id),
    knowledge: knowledgeParts(state, content, id),
    next: nextGate(content, p.era),
    artists: artists(state, id),
    cultureProgress: p.cultureProgress,
    culturePerAward: culturePerAward(state, content, id),
  };
}
