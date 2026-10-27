import { calamityView } from './calamities';
import { previewConflicts } from './conflict';
import type { Content } from './content';
import { gatherBonus, storeCap } from './effects';
import { threshold, totalInstability } from './instability';
import { held, priceOf } from './market';
import type { AreaId, GameMap, ResourceId } from './map/types';
import { looseLimit, looseTokens } from './population';
import { assigned, isDurable, isFood, manpower, taxIncome, usable } from './resources';
import { previewConversions, projectTurn, supportSummary, type ConversionPreview } from './settlements';
import type { GameState, PlayerId, SettlementTier } from './types';
import { forecastWork, wonderCurrency } from './wonders';

// What needs the player before ending the turn (design doc §3, Attention items, v0.29): what will
// be lost, wasted, or risked if the turn resolved now. Opportunities are not attention items.
// Each item carries the facts the interface words and links to.

// Instability this close to a settlement's threshold counts as near collapse.
export const NEAR_COLLAPSE = 2;

export type AttentionItem =
  | { type: 'idle'; area: AreaId; units: number }
  | { type: 'support'; area: AreaId; tier: SettlementTier; support: number; needed: number }
  | { type: 'collapse'; area: AreaId; instability: number; threshold: number }
  | { type: 'wonderStall'; wonder: string; area: AreaId; reason: string }
  | { type: 'raceLost'; wonder: string; worked: number }
  | { type: 'conversion'; area: AreaId; preview: ConversionPreview }
  | { type: 'overLimit'; area: AreaId; count: number }
  | { type: 'overCap'; count: number }
  | { type: 'order'; resource: ResourceId; count: number; affordable: number }
  | { type: 'fight'; area: AreaId }
  | { type: 'buyOff'; calamity: string; cost: number; treasury: number };

// A planned conversion that will not be built, will be short of support, or leaves tokens behind.
function failing(p: ConversionPreview): boolean {
  return !p.built || p.support < p.needed || p.leftover > 0;
}

// The treasury next turn, before calamities (design doc §3, Economy · Treasury): this turn's wonder
// currency comes off in resolution, then next turn's tax and sales come in and buy orders fill.
export interface TreasuryForecast {
  treasury: number;
  tax: number;
  sales: number;
  orders: number;
  wonders: number;
  expected: number;
}

export function treasuryForecast(state: GameState, map: GameMap, content: Content, player: PlayerId): TreasuryForecast {
  const p = state.players.find((x) => x.id === player)!;
  const tax = taxIncome(state, player);
  const sales = p.orders.filter((o) => o.side === 'sell').reduce((sum, o) => sum + Math.min(o.count, held(state, player, o.resource)) * priceOf(state, content, player, o.resource), 0);
  const orders = p.orders.filter((o) => o.side === 'buy').reduce((sum, o) => sum + o.count * priceOf(state, content, player, o.resource), 0);
  const wonders = wonderCurrency(state, map, content, player);
  return { treasury: p.treasury, tax, sales, orders, wonders, expected: p.treasury - wonders + tax + sales - orders };
}

// Goods by kind for the Economy screen (design doc §3, Economy · Goods and market): gathered a turn by
// the standing assignments, held now and the part kept from earlier turns, and needed this turn.
// Food and luxuries are interchangeable within their kind, so their need is given for the kind:
// food for support tokens cannot cover and for wonders, luxuries for settlements with instability.
export interface GoodLine {
  resource: ResourceId;
  gathered: number;
  where: { area: AreaId; count: number }[];
  held: number;
  kept: number;
  // Needed of this good itself (wonder goods named by it); food and luxury needs are in `kinds`.
  needed: number;
}

export interface KindLine {
  gathered: number;
  held: number;
  needed: number;
  // Food: for support and for wonders. Luxuries: settlements with instability.
  support?: number;
  wonders?: number;
}

export interface GoodsLedger {
  goods: GoodLine[];
  food: KindLine;
  luxury: KindLine;
}

export function goodsLedger(state: GameState, map: GameMap, content: Content, player: PlayerId): GoodsLedger {
  const own = state.settlements.filter((s) => s.player === player);
  const wonderNeed = new Map<string, number>();
  for (const b of state.builds.filter((x) => x.player === player && x.outbuilt === undefined && x.started !== state.turn)) {
    for (const g of content.wonders.find((w) => w.id === b.wonder)!.goods) wonderNeed.set(g.resource, (wonderNeed.get(g.resource) ?? 0) + g.count);
  }
  const goods = content.resources.map((r): GoodLine => {
    const where: GoodLine['where'] = [];
    if (usable(state, content, player, r.id)) {
      for (const s of own) {
        if (r.food && s.drought !== undefined && state.turn + 1 <= s.drought) continue;
        const units = (s.work ?? []).filter((w) => w.resource === r.id).reduce((sum, w) => sum + w.count, 0);
        if (units > 0) where.push({ area: s.area, count: units + gatherBonus(state, player, r.id) });
      }
    }
    const stored = r.food && storeCap(state, player, r.id) > 0 ? own.reduce((sum, s) => sum + (s.stored ?? 0), 0) : 0;
    const kept = (isDurable(content, r.id) ? state.goods.filter((g) => g.player === player && g.resource === r.id && g.area === null).reduce((sum, g) => sum + g.count, 0) : 0) + stored;
    return { resource: r.id, gathered: where.reduce((sum, w) => sum + w.count, 0), where, held: held(state, player, r.id), kept, needed: wonderNeed.get(r.id) ?? 0 };
  });
  const sum = (lines: GoodLine[], key: 'gathered' | 'held') => lines.reduce((n, g) => n + g[key], 0);
  const foods = goods.filter((g) => isFood(content, g.resource));
  const luxuries = goods.filter((g) => content.resources.some((r) => r.id === g.resource && r.luxury));
  const support = supportSummary(state, map, content, player).settlements.reduce((n, s) => n + s.needed - (s.support - s.food), 0);
  const wonders = wonderNeed.get('food') ?? 0;
  const restless = own.filter((s) => totalInstability(state, s) > 0).length;
  return {
    goods,
    food: { gathered: sum(foods, 'gathered'), held: sum(foods, 'held'), needed: support + wonders, support, wonders },
    luxury: { gathered: sum(luxuries, 'gathered'), held: sum(luxuries, 'held'), needed: restless },
  };
}

export function attentionItems(state: GameState, map: GameMap, content: Content, player: PlayerId): AttentionItem[] {
  const items: AttentionItem[] = [];
  const own = state.settlements.filter((s) => s.player === player);
  const p = state.players.find((x) => x.id === player)!;

  for (const s of own) {
    const idle = manpower(state, s) - assigned(s);
    if (idle > 0) items.push({ type: 'idle', area: s.area, units: idle });
  }

  const conversions = state.phase === 'allocation' ? previewConversions(state, map, content, player) : [];
  const planned = new Set(conversions.map((c) => c.area));
  for (const s of supportSummary(state, map, content, player).settlements) {
    if (s.support < s.needed && !planned.has(s.area)) items.push({ type: 'support', area: s.area, tier: s.tier, support: s.support, needed: s.needed });
  }

  for (const s of own) {
    const limit = threshold(state, map, s);
    const now = totalInstability(state, s);
    if (limit - now <= NEAR_COLLAPSE) items.push({ type: 'collapse', area: s.area, instability: now, threshold: limit });
  }

  for (const b of state.builds.filter((x) => x.player === player)) {
    if (b.outbuilt !== undefined) {
      items.push({ type: 'raceLost', wonder: b.wonder, worked: b.worked });
      continue;
    }
    const { reason } = forecastWork(state, map, content, b);
    if (reason) items.push({ type: 'wonderStall', wonder: b.wonder, area: b.area, reason });
  }

  for (const c of conversions) if (failing(c)) items.push({ type: 'conversion', area: c.area, preview: c });

  const projected = projectTurn(state, map, content).state;
  for (const stack of projected.stacks.filter((s) => s.player === player && !planned.has(s.area))) {
    const others = projected.stacks.some((x) => x.area === stack.area && x.player !== player);
    const over = stack.count - looseLimit(projected, map, stack.area);
    if (!others && over > 0) items.push({ type: 'overLimit', area: stack.area, count: over });
  }
  const overCap = looseTokens(projected, player) - p.tokenCap;
  if (overCap > 0) items.push({ type: 'overCap', count: overCap });

  const forecast = treasuryForecast(state, map, content, player);
  let money = forecast.treasury - forecast.wonders + forecast.tax + forecast.sales;
  for (const o of p.orders.filter((x) => x.side === 'buy')) {
    const price = priceOf(state, content, player, o.resource);
    const affordable = Math.max(0, Math.min(o.count, Math.floor(money / price)));
    money -= affordable * price;
    if (affordable < o.count) items.push({ type: 'order', resource: o.resource, count: o.count, affordable });
  }

  if (state.phase === 'allocation') {
    const fights = new Set(previewConflicts(state, map, content, player).map((e) => e.area));
    for (const area of [...fights].sort((a, b) => a - b)) items.push({ type: 'fight', area });
  }

  for (const b of calamityView(state, map, content, player).buyOff) {
    if (b.marked && b.available && b.cost > p.treasury) items.push({ type: 'buyOff', calamity: b.calamity, cost: b.cost, treasury: p.treasury });
  }
  return items;
}
