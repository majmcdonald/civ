import type { Content } from './content';
import { emit } from './context';
import { settlementBonus, strength } from './effects';
import type { AreaId, GameMap } from './map/types';
import { adjust, tokensAt } from './population';
import { resetWork } from './resources';
import { projectTurn, settlementAt, TIERS, tierRules, type TierRules } from './settlements';
import type { Context, GameEvent, GameState, PlayerId, Settlement, TokenCount } from './types';

// Conflict (design doc §11). Each token has a strength (1 plus advance bonuses); a side's power is
// its tokens times their strength. Bonus power becomes a volley before the first round, then the
// original's removal rule runs.

interface Side {
  player: PlayerId;
  count: number;
  strength: number;
}

// Powers are compared in thousandths, so fractional strengths group exactly.
const power = (s: Side) => Math.round(s.count * s.strength * 1000);

// Volley: before the first round, each side's whole bonus power (power minus tokens) removes that
// many tokens from the opponent with the most power (earlier sides first on ties). All volleys are
// counted before any is removed.
function volley(sides: Side[]): void {
  const hits = sides.map((s) => {
    const bonus = Math.floor(power(s) / 1000 - s.count + 1e-9);
    const target = sides.filter((o) => o !== s && o.count > 0).sort((a, b) => power(b) - power(a))[0];
    return { target, bonus };
  });
  for (const { target, bonus } of hits) if (target && bonus > 0) target.count = Math.max(0, target.count - bonus);
}

// The original's removal rule: each round every side removes one token, least power first, with
// equal powers removing together. The order is recomputed at the start of each round, and the fight
// stops as soon as `done` holds.
function fight(sides: Side[], done: () => boolean): void {
  if (done()) return;
  volley(sides);
  while (!done()) {
    const alive = sides.filter((s) => s.count > 0);
    const powers = [...new Set(alive.map(power))].sort((a, b) => a - b);
    for (const group of powers.map((p) => alive.filter((s) => power(s) === p))) {
      for (const s of group) s.count -= 1;
      if (done()) return;
    }
  }
}

const aliveCount = (sides: Side[]) => sides.filter((s) => s.count > 0).length;

// Counts one conflict this turn for each civilization taking part (Archery adoption, design doc §8).
function noteFight(state: GameState, players: PlayerId[]): void {
  for (const id of new Set(players)) {
    const p = state.players.find((x) => x.id === id)!;
    p.fought = { turn: state.turn, count: p.fought?.turn === state.turn ? p.fought.count + 1 : 1 };
  }
}

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
  const sides: Side[] = state.stacks.filter((s) => s.area === area).map((s) => ({ player: s.player, count: s.count, strength: strength(state, s.player) }));
  const limit = map.areas[area]!.limit;
  const total = () => sides.reduce((sum, s) => sum + s.count, 0);
  if (sides.length < 2 || total() <= limit) return;
  noteFight(state, sides.map((s) => s.player));
  const before = sides.map((s) => s.count);
  fight(sides, () => total() <= limit || aliveCount(sides) <= 1);
  const losses = sides.map((s, i) => ({ player: s.player, count: before[i]! - s.count }));
  for (const l of losses) if (l.count > 0) adjust(state, area, l.player, -l.count);
  emit(ctx, { type: 'conflict', area, losses });
}

// Any rival token in a settled area attacks it. Attackers whose power is below the threshold are
// destroyed. The rest fight the settlement, which counts as one side with its defense value plus
// the owner's tokens in the area, at the owner's strength, until one side is left. Attackers lose
// bonuses the owner counters (Palisades against Archery). A surviving attacker captures it one tier
// lower: survivors garrison a captured town or larger; a captured village is destroyed and they
// stay.
function attackSettlement(ctx: Context, settlement: Settlement): void {
  const { state } = ctx;
  const { area } = settlement;
  const rules = tierRules(settlement.tier);
  const bonus = settlementBonus(state, settlement);
  const attackers: TokenCount[] = state.stacks.filter((s) => s.area === area && s.player !== settlement.player).map((s) => ({ player: s.player, count: s.count }));
  if (attackers.length === 0) return;
  settlement.attacked = state.turn;
  noteFight(state, [settlement.player, ...attackers.map((a) => a.player)]);
  const losses: TokenCount[] = [];
  const attackStrength = (player: PlayerId) => strength(state, player, settlement.player);
  const repelled = attackers.filter((a) => a.count * attackStrength(a.player) < rules.attack + bonus);
  for (const a of repelled) {
    adjust(state, area, a.player, -a.count);
    losses.push({ ...a });
  }
  const fighters: Side[] = attackers.filter((a) => !repelled.includes(a)).map((a) => ({ ...a, strength: attackStrength(a.player) }));
  const event = { type: 'settlementAttacked' as const, area, defender: settlement.player, tier: settlement.tier, attackers, repelled: repelled.map((a) => a.player), losses, capturedBy: null as PlayerId | null, survivors: 0, spoils: 0 };
  if (fighters.length === 0) {
    emit(ctx, event);
    return;
  }
  const reinforcements = tokensAt(state, area, settlement.player);
  const defense: Side = { player: settlement.player, count: rules.defense + bonus + reinforcements, strength: strength(state, settlement.player) };
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
    event.spoils = takeSpoils(state, settlement.player, winner.player, rules);
    const below = TIERS[TIERS.indexOf(rules) - 1];
    if (below) {
      settlement.tier = below.id;
      settlement.player = winner.player;
      resetWork(ctx, settlement);
      delete settlement.instability;
      delete settlement.stored;
      delete settlement.attacked;
      adjust(state, area, winner.player, -winner.count);
    } else {
      state.settlements = state.settlements.filter((s) => s !== settlement);
    }
  }
  emit(ctx, event);
}

// The capturer takes a share of the defender's treasury by the tier lost, rounded down (design doc
// §11, Spoils).
function takeSpoils(state: GameState, from: PlayerId, to: PlayerId, rules: TierRules): number {
  const loser = state.players.find((p) => p.id === from)!;
  const amount = Math.floor(loser.treasury * rules.spoils);
  loser.treasury -= amount;
  state.players.find((p) => p.id === to)!.treasury += amount;
  return amount;
}

export type ConflictEvent = Extract<GameEvent, { type: 'conflict' | 'settlementAttacked' }>;

// The fights a player would be in if the turn resolved now, from the orders given so far (the
// interface shows them while planning).
export function previewConflicts(state: GameState, map: GameMap, content: Content, player: PlayerId): ConflictEvent[] {
  return projectTurn(state, map, content)
    .events.map((e) => e.event)
    .filter((e): e is ConflictEvent => (e.type === 'conflict' && e.losses.some((l) => l.player === player)) || (e.type === 'settlementAttacked' && (e.defender === player || e.attackers.some((a) => a.player === player))));
}
