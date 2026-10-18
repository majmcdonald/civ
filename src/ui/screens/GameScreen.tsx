import { useEffect, useMemo, useRef, useState } from 'react';
import { content as contentBundle } from '../../content';
import {
  aiCommands,
  conversionCost,
  hooks,
  loadContent,
  mapFor,
  nextTier,
  previewConflicts,
  previewConversions,
  settlementAt,
  startSession,
  submit,
  supportSummary,
  tierRules,
  TIERS,
  tokensAt,
  tokensInReach,
  type AreaId,
  type ConflictEvent,
  type ConversionPreview,
  type GameEvent,
  type MapSetup,
  type Phase,
  type PlayerSetup,
  type SettlementTier as Tier,
} from '../../engine';
import { CIV_COLORS, IsoMap, type ClickButton, type IsoMapHandle, type PlannedSettlement } from '../art/IsoMap';
import type { MapPieces, SettlementTier } from '../art/pieces';
import { CivilizationSheet } from './CivilizationSheet';
import { RivalsSheet } from './RivalsSheet';
import './GameScreen.css';

// In-game frame (Phase 2): top bar with era, turn, and phase; navigation between the map and the
// status screens; headline numbers. Pieces on the map are the review sample until the engine
// tracks them.

const SCREENS = [
  { id: 'map', label: 'Map' },
  { id: 'civilization', label: 'Civilization' },
  { id: 'economy', label: 'Economy' },
  { id: 'market', label: 'Market' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'society', label: 'Society' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'chronicle', label: 'Chronicle' },
] as const;
type ScreenId = (typeof SCREENS)[number]['id'];

const PHASE_NAMES: Record<Phase, string> = {
  resources: 'Resources',
  trade: 'Trade',
  allocation: 'Allocation',
  resolution: 'Resolution',
};

// Design doc §4: the token cap starts at 55.
const STARTING_TOKEN_CAP = 55;
const HUMAN = 0;

// Choices from the New Game screen (design doc §2, Setup options).
export interface NewGameOptions {
  seed: number;
  opponents: number;
  map: MapSetup;
}

export const DEFAULT_GAME: NewGameOptions = { seed: 1, opponents: 4, map: { type: 'inlandSea', room: 'standard' } };

function newSession(options: NewGameOptions) {
  const loaded = loadContent(contentBundle, hooks);
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const players: PlayerSetup[] = Array.from({ length: options.opponents + 1 }, (_, i) =>
    i === HUMAN ? { id: 'p1', name: 'Your people', kind: 'human' } : { id: `ai${i}`, name: `Rival ${i}`, kind: 'ai' },
  );
  // Towns are open from the start until the advance that unlocks them exists (design doc §5).
  return startSession({ seed: options.seed, players, finalEra: 'modern', map: options.map, unlockedTiers: ['village', 'town'] }, loaded.content);
}

// The map has pieces for villages and towns only; larger tiers are not unlocked by anything yet.
function pieceTier(tier: Tier): SettlementTier {
  return tier === 'village' ? 'village' : 'town';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Warnings for a planned conversion, worst first; empty when it will go through cleanly.
function conversionWarnings(p: ConversionPreview): string[] {
  if (!p.built) return [p.reason ?? 'Will not be built'];
  const warnings: string[] = [];
  const name = tierRules(p.tier).name.toLowerCase();
  if (p.support < p.needed) {
    const fate = p.tier === 'village' ? 'the village will dissolve' : `the ${name} will drop a tier`;
    warnings.push(`Only ${p.support} of ${p.needed} support after ${p.tier === 'village' ? 'founding' : 'upgrading'} — ${fate}`);
  }
  if (p.leftover > 0) warnings.push(`${plural(p.leftover, 'token')} left in the area will be removed`);
  return warnings;
}

// A fight the player is in, from their side; used for the planning forecast and the turn report.
function conflictLine(e: ConflictEvent, me: string, who: (player: string) => string, place: string): string {
  const lost = (player: string) => e.losses.find((l) => l.player === player)?.count ?? 0;
  if (e.type === 'conflict') {
    const others = e.losses.filter((l) => l.player !== me).map((l) => `${who(l.player)} loses ${l.count}`);
    return `Fighting in ${place}: you lose ${lost(me)} · ${others.join(' · ')}`;
  }
  const rules = tierRules(e.tier);
  const name = `${place} (${rules.name.toLowerCase()})`;
  if (e.defender === me) {
    if (e.capturedBy) return `${name} falls to ${who(e.capturedBy)}`;
    return `${name} holds against ${e.attackers.map((a) => who(a.player)).join(' and ')}${lost(me) > 0 ? ` · you lose ${lost(me)}` : ''}`;
  }
  const sent = e.attackers.find((a) => a.player === me)!.count;
  if (e.repelled.includes(me)) return `Attack on ${name}: ${sent} of ${rules.attack} needed — all ${sent} lost`;
  if (e.capturedBy === me) {
    return e.tier === 'village' ? `${name} destroyed · ${plural(e.survivors, 'token')} remain` : `${name} captured as a ${TIERS[TIERS.indexOf(rules) - 1]!.name.toLowerCase()} · ${e.survivors} garrison it`;
  }
  if (e.capturedBy) return `Attack on ${name}: ${who(e.capturedBy)} takes it · all ${sent} lost`;
  return `Attack on ${name} fails against ${rules.defense} defense — all ${sent} lost`;
}

// One line per notable result of the turn for the player, for the notice after resolution.
function turnReport(events: GameEvent[], me: string, conflict: (e: ConflictEvent) => string | null): string[] {
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === 'conflict' || e.type === 'settlementAttacked') {
      const line = conflict(e);
      if (line) lines.push(line);
    }
    if (!('player' in e) || e.player !== me) continue;
    if (e.type === 'settlementBuilt') lines.push(`${tierRules(e.tier).name} ${e.tier === 'village' ? 'founded' : 'built'}`);
    if (e.type === 'conversionFailed') lines.push(`Not built: ${e.reason}`);
    if (e.type === 'settlementDropped') lines.push(e.tier ? `A settlement dropped to ${e.tier} for lack of support` : 'A village dissolved for lack of support');
  }
  return lines;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ConversionOption {
  tier: Tier;
  upgrade: boolean;
  cost: number;
  unlocked: boolean;
  ordered: ConversionPreview | null;
}

function usesText(p: ConversionPreview): string {
  const here = p.from.filter((f) => f.area === p.area).reduce((sum, f) => sum + f.count, 0);
  const near = p.from.reduce((sum, f) => sum + f.count, 0) - here;
  const parts = [here > 0 ? `${here} here` : '', near > 0 ? `${near} from neighbours` : ''].filter(Boolean);
  return `Uses ${parts.join(', ')} · support ${p.support} of ${p.needed}`;
}

interface PlanPanelProps {
  source: AreaId | null;
  state: { tokens: number; left: number };
  conversion: ConversionOption | null;
  previews: ConversionPreview[];
  conflicts: { area: AreaId; text: string }[];
  areaName: (area: AreaId) => string;
  onConvert: (area: AreaId, ordered: boolean) => void;
  onSelect: (area: AreaId) => void;
}

// Allocation planning for the selected area (moves, founding, upgrading) and the turn's planned
// settlements, each with what will happen if the turn resolved now.
function PlanPanel({ source, state, conversion, previews, conflicts, areaName, onConvert, onSelect }: PlanPanelProps) {
  const others = previews.filter((p) => p.area !== source);
  return (
    <div className="game-plan" aria-live="polite">
      {source !== null && (
        <>
          {state.tokens > 0 && (
            <>
              <strong>
                {state.left} of {plural(state.tokens, 'token')} left to move
              </strong>
              <span>Click a neighbour to send one · right-click to take one back · Esc when done</span>
            </>
          )}
          {conversion && <ConversionRow area={source} option={conversion} onConvert={onConvert} />}
        </>
      )}
      {others.length > 0 && (
        <ul className="game-plan-list">
          {others.map((p) => {
            const warnings = conversionWarnings(p);
            return (
              <li key={p.area} className={warnings.length > 0 ? 'warn' : ''} title={warnings.join('\n') || usesText(p)}>
                <button type="button" className="game-plan-link" onClick={() => onSelect(p.area)}>
                  {tierRules(p.tier).name} planned · {areaName(p.area)}
                  {warnings.length > 0 && ' ⚠'}
                </button>
                <button type="button" className="game-plan-cancel" title={p.tier === 'village' ? 'Unfound' : 'Cancel upgrade'} onClick={() => onConvert(p.area, false)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {conflicts.length > 0 && (
        <ul className="game-plan-list game-plan-conflicts">
          <li className="game-plan-head">Fights if the turn resolved now</li>
          {conflicts.map((c) => (
            <li key={c.area}>{c.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversionRow({ area, option, onConvert }: { area: AreaId; option: ConversionOption; onConvert: (area: AreaId, ordered: boolean) => void }) {
  const name = tierRules(option.tier).name;
  if (option.ordered) {
    const warnings = conversionWarnings(option.ordered);
    return (
      <div className="game-plan-convert">
        <strong>{name} planned</strong>
        {warnings.length > 0 ? warnings.map((w) => <em key={w}>{w}</em>) : <span>{usesText(option.ordered)}</span>}
        <button type="button" onClick={() => onConvert(area, false)}>
          {option.upgrade ? `Cancel ${name.toLowerCase()} upgrade` : `Unfound ${name.toLowerCase()}`}
        </button>
      </div>
    );
  }
  if (!option.unlocked) return <span className="game-plan-locked">{name}s are not unlocked yet</span>;
  return (
    <div className="game-plan-convert">
      <button type="button" onClick={() => onConvert(area, true)}>
        {option.upgrade ? `Upgrade to ${name.toLowerCase()}` : `Found ${name.toLowerCase()}`}
      </button>
      <span>
        {option.cost} tokens in or next to this area, plus {tierRules(option.tier).support} support
      </span>
    </div>
  );
}

export function GameScreen({ options, onExit }: { options: NewGameOptions; onExit: () => void }) {
  const [session] = useState(() => newSession(options));
  const [, setVersion] = useState(0);
  const [screen, setScreen] = useState<ScreenId>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return SCREENS.find((s) => s.id === tab)?.id ?? 'map';
  });
  const [hovered, setHovered] = useState<AreaId | null>(null);
  const [showCounts, setShowCounts] = useState(true);
  const mapHandle = useRef<IsoMapHandle>(null);
  // Movement planning: the area tokens are being sent from, and the last rejected order.
  const [selected, setSelected] = useState<AreaId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // What happened to the player's settlements in the last resolution.
  const [report, setReport] = useState<string[]>([]);

  // Open on the player's starting area.
  useEffect(() => {
    while (session.state.phase === 'trade') for (const player of session.state.players) submit(session, { type: 'endPhase', player: player.id });
    setVersion((v) => v + 1);
    mapHandle.current?.focus(mapFor(session.setup).starts[HUMAN]!);
  }, [session]);

  // Escape closes any status screen and returns to the map, and finishes movement planning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setScreen('map');
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { state } = session;
  const map = useMemo(() => mapFor(session.setup), [session]);
  // Roads arrive with transport advances.
  const pieces = useMemo<MapPieces>(() => {
    const civ = new Map(state.players.map((p, i) => [p.id, i]));
    return {
      stacks: state.stacks.map((s) => ({ area: s.area, civ: civ.get(s.player)!, count: s.count })),
      settlements: state.settlements.map((s) => ({ area: s.area, civ: civ.get(s.player)!, tier: pieceTier(s.tier), ...(s.name ? { name: s.name } : {}) })),
      roads: [],
    };
  }, [state]);
  const names = useMemo(() => new Map(state.settlements.flatMap((s) => (s.name ? [[s.area, s.name] as const] : []))), [state]);

  const era = [...session.content.eras].sort((a, b) => a.order - b.order)[0]!;
  const tokens = pieces.stacks.filter((s) => s.civ === HUMAN).reduce((sum, s) => sum + s.count, 0);
  const mine = pieces.settlements.filter((s) => s.civ === HUMAN);
  const towns = mine.filter((s) => s.tier === 'town').length;
  const villages = mine.length - towns;
  const hoveredArea = hovered === null ? null : map.areas[hovered];
  const hoveredSettlement = hovered === null ? undefined : pieces.settlements.find((s) => s.area === hovered);

  const rename = (area: AreaId, name: string) => {
    const result = submit(session, { type: 'nameSettlement', player: state.players[HUMAN]!.id, area, name });
    if (!result.ok) setNotice(result.reason);
    setVersion((v) => v + 1);
  };

  const showOnMap = (area: AreaId) => {
    setScreen('map');
    setHovered(area);
    mapHandle.current?.focus(area);
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (report.length === 0) return;
    const timer = window.setTimeout(() => setReport([]), 6000);
    return () => window.clearTimeout(timer);
  }, [report]);

  // The player ends the phase; AI players (minimal until Phase 7) give their orders and end it at
  // once. The trade phase is skipped while no one can trade (trade discovery, design doc §7).
  const endPhase = () => {
    const events: GameEvent[] = [];
    do {
      for (const player of session.state.players) {
        if (player.kind === 'ai') for (const command of aiCommands(session.state, session.content, player.id)) submit(session, command);
        const result = submit(session, { type: 'endPhase', player: player.id });
        if (result.ok) events.push(...result.events.map((e) => e.event));
      }
    } while (session.state.phase === 'trade');
    setReport(turnReport(events, me, describeConflict));
    setSelected(null);
    setVersion((v) => v + 1);
  };

  // Movement planning (design doc §4): click one of your areas, then click a neighbour once per
  // token to send; right-click takes one back. Each change is an order to the engine.
  const me = state.players[HUMAN]!.id;
  const planning = state.phase === 'allocation';
  const myOrders = state.orders.filter((o) => o.player === me);
  // Read from the live session so quick repeated clicks build on each other before a re-render.
  const planned = (from: AreaId, to: AreaId) =>
    session.state.orders.find((o) => o.player === me && o.from === from && o.to === to)?.count ?? 0;
  const left = (from: AreaId) => tokensAt(state, from, me) - myOrders.filter((o) => o.from === from).reduce((sum, o) => sum + o.count, 0);
  const source = planning ? selected : null;
  const targets = source === null || tokensAt(state, source, me) === 0 ? [] : map.areas[source]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');

  // Names from the state before resolution, so the report can name a settlement that was destroyed.
  const areaName = (area: AreaId) => names.get(area) ?? capitalize(map.areas[area]!.terrain!);
  const who = (player: string) => state.players.find((p) => p.id === player)!.name;
  const describeConflict = (e: ConflictEvent) => {
    const involved = e.type === 'conflict' ? e.losses.some((l) => l.player === me) : e.defender === me || e.attackers.some((a) => a.player === me);
    return involved ? conflictLine(e, me, who, areaName(e.area)) : null;
  };
  // Fights this turn's planned moves lead to, if the turn resolved now (design doc §11).
  const conflicts = useMemo(() => (planning ? previewConflicts(state, map, session.content, me) : []), [planning, state, map, session, me]);

  // Settlement conversions (design doc §5): previewed with this turn's planned moves.
  const previews = useMemo(() => (planning ? previewConversions(state, map, session.content, me) : []), [planning, state, map, session, me]);
  const plans: PlannedSettlement[] = previews.map((p) => ({ area: p.area, civ: HUMAN, tier: pieceTier(p.tier) }));
  // An area can be selected to move from, to upgrade its settlement, or to found one with tokens in reach.
  const selectable = (area: AreaId) => {
    if (map.areas[area]!.kind !== 'land') return false;
    const here = settlementAt(state, area);
    if (here) return here.player === me;
    return tokensInReach(state, map, me, area) > 0;
  };
  const convert = (area: AreaId, ordered: boolean) => {
    const result = submit(session, { type: 'orderConversion', player: me, area, ordered });
    if (!result.ok) setNotice(result.reason);
    setVersion((v) => v + 1);
  };

  const undoAll = () => {
    for (const o of myOrders) submit(session, { type: 'orderMove', player: me, from: o.from, to: o.to, count: 0 });
    for (const p of previews) submit(session, { type: 'orderConversion', player: me, area: p.area, ordered: false });
    setVersion((v) => v + 1);
  };

  const order = (from: AreaId, to: AreaId, count: number) => {
    const result = submit(session, { type: 'orderMove', player: me, from, to, count });
    if (!result.ok) setNotice(result.reason);
    setVersion((v) => v + 1);
  };

  // What the panel offers for the selected area: found, upgrade, a locked tier, or nothing.
  const conversionOption = (area: AreaId): ConversionOption | null => {
    const here = settlementAt(state, area);
    if (here && here.player !== me) return null;
    const tier = nextTier(state, area);
    if (!tier) return null;
    const ordered = previews.find((p) => p.area === area) ?? null;
    const unlocked = state.players[HUMAN]!.tiers.includes(tier.id);
    return { tier: tier.id, upgrade: Boolean(here), cost: conversionCost(tier.id), unlocked, ordered };
  };

  const onAreaClick = (area: AreaId, button: ClickButton) => {
    if (source !== null && targets.includes(area)) {
      const count = planned(source, area);
      if (button === 'primary') order(source, area, count + 1);
      else if (count > 0) order(source, area, count - 1);
      return;
    }
    if (button !== 'primary') return;
    if (area === source || !selectable(area)) {
      setSelected(null);
      return;
    }
    if (!planning) {
      setNotice('Moves and settlements are ordered in the Allocation phase');
      return;
    }
    setSelected(area);
  };

  // Clicking a planned move reopens planning from its source; right-click takes one token back.
  const onMoveClick = (from: AreaId, to: AreaId, button: ClickButton) => {
    if (!planning) return;
    if (button === 'primary') setSelected(from);
    else order(from, to, planned(from, to) - 1);
  };

  return (
    <main className="game-screen">
      <header className="game-bar">
        <div className="game-bar-time">
          <span className="game-civ" style={{ background: CIV_COLORS[HUMAN] }} aria-hidden="true" />
          <div>
            <div className="game-era">{era.name}</div>
            <div className="game-turn">Turn {state.turn}</div>
          </div>
        </div>

        <nav className="game-tabs" aria-label="Screens">
          {SCREENS.map((s) => (
            <button key={s.id} type="button" className={s.id === screen ? 'selected' : ''} aria-pressed={s.id === screen} onClick={() => setScreen(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>

        <dl className="game-stats">
          <div title="Loose tokens against the token cap (design doc §4)">
            <dt>Tokens</dt>
            <dd>
              {tokens} / {STARTING_TOKEN_CAP}
            </dd>
          </div>
          <div title="Settlements by tier">
            <dt>Settlements</dt>
            <dd>
              {towns} town{towns === 1 ? '' : 's'} · {villages} village{villages === 1 ? '' : 's'}
            </dd>
          </div>
          <button type="button" className="game-menu" onClick={onExit} title="Return to the title screen">
            Menu
          </button>
        </dl>
      </header>

      <section className="game-body">
        <IsoMap
          handle={mapHandle}
          map={map}
          pieces={pieces}
          showStarts={false}
          showCounts={showCounts}
          hovered={hovered}
          onHover={setHovered}
          onAreaClick={onAreaClick}
          moves={myOrders}
          onMoveClick={onMoveClick}
          selection={source === null ? null : { area: source, targets }}
          plans={plans}
        />

        {screen === 'map' ? (
          <>
            <label className="game-toggle">
              <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
              Tokens / limits
            </label>
            {planning && (source !== null || previews.length > 0 || conflicts.length > 0) && (
              <PlanPanel
                source={source}
                state={{ tokens: source === null ? 0 : tokensAt(state, source, me), left: source === null ? 0 : left(source) }}
                conversion={source === null ? null : conversionOption(source)}
                previews={previews}
                conflicts={conflicts.map((e) => ({ area: e.area, text: describeConflict(e)! }))}
                areaName={areaName}
                onConvert={convert}
                onSelect={(area) => {
                  setSelected(area);
                  mapHandle.current?.focus(area);
                }}
              />
            )}
            {notice && <div className="game-notice">{notice}</div>}
            {report.length > 0 && (
              <div className="game-report" aria-live="polite">
                {report.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}
            <div className="game-hover" aria-live="polite">
              {hoveredArea ? (
                hoveredArea.kind === 'sea' ? (
                  'Sea'
                ) : (
                  <>
                    {hoveredSettlement && `${names.get(hoveredSettlement.area) ?? 'Unnamed'} – ${hoveredSettlement.tier === 'town' ? 'Town' : 'Village'} · `}
                    {hoveredArea.terrain!.charAt(0).toUpperCase() + hoveredArea.terrain!.slice(1)}
                    {hoveredArea.features.length > 0 && ` · ${hoveredArea.features.join(', ')}`} · limit {hoveredArea.limit}
                    {tokensAt(state, hoveredArea.id, me) > 0 && ` · ${tokensAt(state, hoveredArea.id, me)} of your tokens`}
                  </>
                )
              ) : (
                <span className="game-hint">{planning ? 'Click one of your areas to plan moves or settlements' : 'Drag to pan · scroll to zoom'}</span>
              )}
            </div>
            <div className="game-turn-panel">
              <ol className="game-phases" aria-label="Phases">
                {(['resources', 'trade', 'allocation', 'resolution'] as const).map((p) => (
                  <li key={p} className={p === state.phase ? 'current' : ''}>
                    {PHASE_NAMES[p]}
                  </li>
                ))}
              </ol>
              {planning && (myOrders.length > 0 || previews.length > 0) && (
                <button type="button" className="game-undo-moves" onClick={undoAll} title="Clears every planned move, founding, and upgrade this turn">
                  Undo all moves and settlements
                </button>
              )}
              <button type="button" className="game-end-phase" onClick={endPhase}>
                End {PHASE_NAMES[state.phase]} phase
              </button>
            </div>
          </>
        ) : (
          <div className="game-sheet-backdrop" onClick={() => setScreen('map')}>
            <article className={`game-sheet ${screen === 'civilization' || screen === 'rivals' ? 'filled' : ''}`} onClick={(e) => e.stopPropagation()}>
              {screen === 'civilization' ? (
                <CivilizationSheet
                  map={map}
                  pieces={pieces}
                  civ={HUMAN}
                  color={CIV_COLORS[HUMAN]!}
                  name={state.players[HUMAN]!.name}
                  era={era.name}
                  turn={state.turn}
                  cap={STARTING_TOKEN_CAP}
                  names={names}
                  support={supportSummary(state, map, session.content, me)}
                  planned={myOrders.length > 0 || state.conversions.some((c) => c.player === me)}
                  onRename={rename}
                  onShow={showOnMap}
                />
              ) : screen === 'rivals' ? (
                <RivalsSheet
                  map={map}
                  pieces={pieces}
                  civs={state.players.map((p, i) => ({ name: p.name, color: CIV_COLORS[i]! }))}
                  human={HUMAN}
                  eras={session.content.eras}
                  finalEra={state.setup.finalEra}
                  turn={state.turn}
                />
              ) : (
                <p className="game-placeholder">Placeholder</p>
              )}
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
