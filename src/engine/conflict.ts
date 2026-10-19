import type { Content } from './content';
import { emit } from './context';
import type { AreaId, GameMap } from './map/types';
import { adjust, tokensAt } from './population';
import { resetWork } from './resources';
import { projectTurn, settlementAt, TIERS, tierRules } from './settlements';
import type { Context, GameEvent, GameState, PlayerId, Settlement, TokenCount } from './types';

// Conflict (design doc §11). Every token has strength 1 until discoveries change it, so a side's
// power is its token count.

interface Side {
  player: PlayerId;
  count: number;
}

// The original's removal rule: each round every side removes one token, least power first, with
// equal powers removing together. The order is recomputed at the start of each round, and the fight
// stops as soon as `done` holds.
function fight(sides: Side[], done: () => boolean): void {
  while (!done()) {
    const alive = sides.filter((s) => s.count > 0);
    const powers = [...new Set(alive.map((s) => s.count))].sort((a, b) => a - b);
    for (const group of powers.map((p) => alive.filter((s) => s.count === p))) {
      for (const s of group) s.count -= 1;
      if (done()) return;
    }
  }
}

const aliveCount = (sides: Side[]) => sides.filter((s) => s.count > 0).length;

// Resolution step 2, in area order, from positions after movement.
export function resolveConflict(ctx: Context): void {
  const areas = [...new Set(ctx.state.stacks.map((s) => s.area))].sort((a, b) => a - b);
  for (const area of areas) {
    const here = settlementAt(ctx.state, area);
    if (here) attackSettlement(ctx, here);
    else fightOverLimit(ctx, area);
  }
}

// Civilizations sharing an unsettled area over its limit fight until it is within the limit or
// one is left.
function fightOverLimit(ctx: Context, area: AreaId): void {
  const { state, map } = ctx;
  const sides: Side[] = state.stacks.filter((s) => s.area === area).map((s) => ({ player: s.player, count: s.count }));
  const limit = map.areas[area]!.limit;
  const total = () => sides.reduce((sum, s) => sum + s.count, 0);
  if (sides.length < 2 || total() <= limit) return;
  const before = sides.map((s) => s.count);
  fight(sides, () => total() <= limit || aliveCount(sides) <= 1);
  const losses = sides.map((s, i) => ({ player: s.player, count: before[i]! - s.count }));
  for (const l of losses) if (l.count > 0) adjust(state, area, l.player, -l.count);
  emit(ctx, { type: 'conflict', area, losses });
}

// Any rival token in a settled area attacks it. Attackers below the threshold are destroyed. The
// rest fight the settlement, which counts as one side with its defense value plus the owner's
// tokens in the area, until one side is left. A surviving attacker captures it one tier lower:
// survivors garrison a captured town or larger; a captured village is destroyed and they stay.
function attackSettlement(ctx: Context, settlement: Settlement): void {
  const { state } = ctx;
  const { area } = settlement;
  const rules = tierRules(settlement.tier);
  const attackers: TokenCount[] = state.stacks.filter((s) => s.area === area && s.player !== settlement.player).map((s) => ({ player: s.player, count: s.count }));
  if (attackers.length === 0) return;
  const losses: TokenCount[] = [];
  const repelled = attackers.filter((a) => a.count < rules.attack);
  for (const a of repelled) {
    adjust(state, area, a.player, -a.count);
    losses.push({ ...a });
  }
  const fighters: Side[] = attackers.filter((a) => a.count >= rules.attack).map((a) => ({ ...a }));
  const event = { type: 'settlementAttacked' as const, area, defender: settlement.player, tier: settlement.tier, attackers, repelled: repelled.map((a) => a.player), losses, capturedBy: null as PlayerId | null, survivors: 0 };
  if (fighters.length === 0) {
    emit(ctx, event);
    return;
  }
  const reinforcements = tokensAt(state, area, settlement.player);
  const defense: Side = { player: settlement.player, count: rules.defense + reinforcements };
  const sides = [defense, ...fighters];
  const before = sides.map((s) => s.count);
  fight(sides, () => aliveCount(sides) <= 1);
  // Reinforcements are the defense's only real tokens; they fall first.
  const reinforcementsLost = Math.min(reinforcements, before[0]! - defense.count);
  if (reinforcementsLost > 0) {
    adjust(state, area, settlement.player, -reinforcementsLost);
    losses.push({ player: settlement.player, count: reinforcementsLost });
  }
  fighters.forEach((f, i) => {
    const lost = before[i + 1]! - f.count;
    if (lost <= 0) return;
    adjust(state, area, f.player, -lost);
    losses.push({ player: f.player, count: lost });
  });
  const winner = fighters.find((f) => f.count > 0);
  // If the last tokens on both sides fall together, no one is left to capture and the settlement holds.
  if (winner && defense.count === 0) {
    event.capturedBy = winner.player;
    event.survivors = winner.count;
    const below = TIERS[TIERS.indexOf(rules) - 1];
    if (below) {
      settlement.tier = below.id;
      settlement.player = winner.player;
      resetWork(ctx, settlement);
      delete settlement.instability;
      adjust(state, area, winner.player, -winner.count);
    } else {
      state.settlements = state.settlements.filter((s) => s !== settlement);
    }
  }
  emit(ctx, event);
}

export type ConflictEvent = Extract<GameEvent, { type: 'conflict' | 'settlementAttacked' }>;

// The fights a player would be in if the turn resolved now, from the orders given so far (the
// interface shows them while planning).
export function previewConflicts(state: GameState, map: GameMap, content: Content, player: PlayerId): ConflictEvent[] {
  return projectTurn(state, map, content)
    .events.map((e) => e.event)
    .filter((e): e is ConflictEvent => (e.type === 'conflict' && e.losses.some((l) => l.player === player)) || (e.type === 'settlementAttacked' && (e.defender === player || e.attackers.some((a) => a.player === player))));
}
