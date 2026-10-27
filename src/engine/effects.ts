import type { Effect, SettlementTier } from '../content/types';
import { reached } from './discovery';
import type { AreaId, GameMap } from './map/types';
import type { GameState, PlayerId, Settlement, WonderRecord } from './types';

// The effects in force from a civilization's advances (design doc §8), read from
// `PlayerState.effects`, and from the wonders whose settlements it holds (design doc §9); and the
// river transport they open (design doc §4, §6).

const TIER_ORDER: readonly SettlementTier[] = ['village', 'town', 'city', 'metropolis'];

// Completed wonders whose settlement the player holds now.
export function heldWonders(state: GameState, player: PlayerId): WonderRecord[] {
  return state.wonders.filter((w) => !w.ruined && state.settlements.some((s) => s.area === w.area && s.player === player));
}

function effectsOf(state: GameState, player: PlayerId): readonly Effect[] {
  const own = state.players.find((p) => p.id === player)?.effects ?? [];
  const wonders = heldWonders(state, player).flatMap((w) => w.effects);
  return wonders.length === 0 ? own : [...own, ...wonders];
}

function total<T extends Effect['type']>(state: GameState, player: PlayerId, type: T, keep: (e: Extract<Effect, { type: T }>) => boolean = () => true): number {
  return effectsOf(state, player)
    .filter((e): e is Extract<Effect, { type: T }> => e.type === type)
    .filter(keep)
    .reduce((sum, e) => sum + ('amount' in e ? e.amount : 0), 0);
}

// Each token's strength in conflict (design doc §11): 1 plus its bonuses. Attacking a settlement,
// bonuses its owner counters are cancelled.
export function strength(state: GameState, player: PlayerId, defender?: PlayerId): number {
  const countered = (counter?: string) => defender !== undefined && counter !== undefined && reached(state, defender, counter, 'developed');
  return 1 + total(state, player, 'strength', (e) => !countered(e.counteredBy));
}

// Added to a settlement's attack threshold and defense value (Palisades, Masonry).
export function settlementBonus(state: GameState, settlement: Settlement): number {
  const rank = TIER_ORDER.indexOf(settlement.tier);
  return total(state, settlement.player, 'settlementDefense', (e) => e.minTier === undefined || rank >= TIER_ORDER.indexOf(e.minTier));
}

// Manpower a settlement gains from wonders at it (Çatalhöyük), while it stands.
export function wonderManpower(state: GameState, settlement: Settlement): number {
  return state.wonders
    .filter((w) => !w.ruined && w.area === settlement.area)
    .flatMap((w) => w.effects)
    .reduce((sum, e) => sum + (e.type === 'manpower' ? e.amount : 0), 0);
}

// Artists progress and learning added each turn (Newgrange, Stonehenge).
export function cultureBonus(state: GameState, player: PlayerId): number {
  return total(state, player, 'culture');
}

export function learningBonus(state: GameState, player: PlayerId): number {
  return total(state, player, 'learning');
}

export function raidImmune(state: GameState, player: PlayerId): boolean {
  return effectsOf(state, player).some((e) => e.type === 'raidImmunity');
}

// Civ-wide instability removed each turn (Ritual, Göbekli Tepe).
export function calm(state: GameState, player: PlayerId): number {
  return total(state, player, 'calm');
}

// Areas one step along a river may cover; 1 without a river advance (Dugout Canoes).
export function riverLeg(state: GameState, player: PlayerId): number {
  return Math.max(1, ...effectsOf(state, player).map((e) => (e.type === 'riverLeg' ? e.areas : 1)));
}

// Units of a good each settlement keeps for the next support check (Pottery).
export function storeCap(state: GameState, player: PlayerId, resource: string): number {
  return total(state, player, 'store', (e) => e.resource === resource);
}

// Land moves the capital-distance penalty starts later (Tallies).
export function capitalReach(state: GameState, player: PlayerId): number {
  return total(state, player, 'capitalReach');
}

// Extra units of a good for each settlement gathering at least 1 (Mastered gathering advances).
export function gatherBonus(state: GameState, player: PlayerId, resource: string): number {
  return total(state, player, 'gatherBonus', (e) => e.resource === resource);
}

export function marketAccess(state: GameState, player: PlayerId): boolean {
  return effectsOf(state, player).some((e) => e.type === 'marketAccess');
}

export function marketReach(state: GameState, player: PlayerId): number {
  return total(state, player, 'marketReach');
}

// Areas reached from `area` by one step along a river covering up to `leg` areas: the next
// `leg - 1` areas up and down each river through it. Empty when `leg` is 1.
export function riverStretch(map: GameMap, area: AreaId, leg: number): AreaId[] {
  if (leg <= 1) return [];
  const out = new Set<AreaId>();
  for (const river of map.rivers) {
    const i = river.areas.indexOf(area);
    if (i < 0) continue;
    for (let k = 1; k < leg; k++) {
      const up = river.areas[i - k];
      const down = river.areas[i + k];
      if (up !== undefined) out.add(up);
      if (down !== undefined) out.add(down);
    }
  }
  return [...out].sort((a, b) => a - b);
}

// Land areas one transport step from `area`: its land neighbors, plus a river stretch.
export function transportNeighbors(map: GameMap, area: AreaId, leg: number): AreaId[] {
  const land = map.areas[area]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');
  return [...new Set([...land, ...riverStretch(map, area, leg)])].sort((a, b) => a - b);
}
