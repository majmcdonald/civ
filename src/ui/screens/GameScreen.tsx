import { useEffect, useMemo, useRef, useState } from 'react';
import { content as contentBundle } from '../../content';
import {
  aiCommands,
  canTrade,
  marketView,
  assigned,
  BUREAUCRACY,
  bureaucracyAt,
  discoveryView,
  HIGH_LEARNING,
  learningPlan,
  revealed,
  capitalDistance,
  capitalOf,
  civInstability,
  localInstability,
  overextension,
  OVEREXTENSION_FREE,
  threshold,
  totalInstability,
  type InstabilitySource,
  conversionCost,
  hooks,
  loadContent,
  manpower,
  mapFor,
  NAME_MAX_LENGTH,
  nextTier,
  previewConflicts,
  previewConversions,
  reachable,
  saveGame,
  settlementAt,
  startSession,
  submit,
  supportSummary,
  taxIncome,
  toJsonLines,
  tierRules,
  TIERS,
  tokensAt,
  tokensInReach,
  usable,
  workable,
  calm,
  type AreaId,
  type ConflictEvent,
  type Content,
  type ConversionPreview,
  type GameState,
  type GameEvent,
  type MapSetup,
  type Phase,
  type PlayerSetup,
  type Session,
  type Settlement,
  type SettlementTier as Tier,
} from '../../engine';
import { CIV_COLORS, IsoMap, type ClickButton, type IsoMapHandle, type PlannedSettlement } from '../art/IsoMap';
import type { MapPieces, SettlementTier } from '../art/pieces';
import { CivilizationSheet, type WorkOption } from './CivilizationSheet';
import { KnowledgeSheet } from './KnowledgeSheet';
import { MarketSheet } from './MarketSheet';
import { RivalsSheet } from './RivalsSheet';
import { CITY_NAMES } from '../cityNames';
import { AUTOSAVE_ID, downloadLog, downloadSave, writeSave } from '../saves';
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
  name: string;
  seed: number;
  opponents: number;
  map: MapSetup;
  // Each civilization draws 2 first-ring advances (design doc §2, Setup options).
  advancedStart: boolean;
}

export const DEFAULT_GAME: NewGameOptions = { name: '', seed: 1, opponents: 4, map: { type: 'inlandSea', room: 'standard' }, advancedStart: false };

export function gameContent(): Content {
  const loaded = loadContent(contentBundle, hooks);
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return loaded.content;
}

export function newSession(options: NewGameOptions): Session {
  const players: PlayerSetup[] = Array.from({ length: options.opponents + 1 }, (_, i) =>
    i === HUMAN ? { id: 'p1', name: 'Your people', kind: 'human' } : { id: `ai${i}`, name: `Rival ${i}`, kind: 'ai' },
  );
  // Towns are open from the start until the advance that unlocks them exists (design doc §5).
  const name = options.name.trim() || 'Untitled game';
  return startSession(
    { name, seed: options.seed, players, finalEra: 'modern', map: options.map, ...(options.advancedStart ? { advancedStart: true } : {}) },
    gameContent(),
  );
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
    if (e.capturedBy) return `${name} falls to ${who(e.capturedBy)}${e.spoils > 0 ? ` · ${e.spoils} currency taken` : ''}`;
    return `${name} holds against ${e.attackers.map((a) => who(a.player)).join(' and ')}${lost(me) > 0 ? ` · you lose ${lost(me)}` : ''}`;
  }
  const sent = e.attackers.find((a) => a.player === me)!.count;
  if (e.repelled.includes(me)) return `Attack on ${name}: ${sent} of ${rules.attack} needed — all ${sent} lost`;
  if (e.capturedBy === me) {
    const spoils = e.spoils > 0 ? ` · ${e.spoils} currency taken` : '';
    return e.tier === 'village' ? `${name} destroyed · ${plural(e.survivors, 'token')} remain${spoils}` : `${name} captured as a ${TIERS[TIERS.indexOf(rules) - 1]!.name.toLowerCase()} · ${e.survivors} garrison it${spoils}`;
  }
  if (e.capturedBy) return `Attack on ${name}: ${who(e.capturedBy)} takes it · all ${sent} lost`;
  return `Attack on ${name} fails against ${rules.defense} defense — all ${sent} lost`;
}

// One line per notable result of the turn for the player, for the notice after resolution.
function turnReport(events: GameEvent[], me: string, conflict: (e: ConflictEvent) => string | null, place: (area: AreaId) => string, advanceName: (id: string) => string): string[] {
  const lines: string[] = [];
  // A collapse is reported as such, not as the tier drop it causes.
  const collapsed = new Set(events.flatMap((e) => (e.type === 'settlementCollapsed' ? [e.area] : [])));
  for (const e of events) {
    if (e.type === 'conflict' || e.type === 'settlementAttacked') {
      const line = conflict(e);
      if (line) lines.push(line);
    }
    if (!('player' in e) || e.player !== me) continue;
    if (e.type === 'settlementBuilt') lines.push(`${tierRules(e.tier).name} ${e.tier === 'village' ? 'founded' : 'built'}`);
    if (e.type === 'conversionFailed') lines.push(`Not built: ${e.reason}`);
    if (e.type === 'settlementCollapsed') lines.push(`A ${e.tier} collapsed in unrest`);
    if (e.type === 'capitalMoved' && e.area !== null) lines.push(`Capital: ${place(e.area)}`);
    if (e.type === 'studyQueueEmpty') lines.push(`Study queue empty: ${Math.round(e.learning * 10) / 10} learning split evenly`);
    if (e.type === 'advanceReached') lines.push(`${advanceName(e.advance)} is ${e.stage === 'known' ? 'Known' : e.stage === 'developed' ? 'Developed' : 'Mastered'}`);
    if (e.type === 'settlementDropped' && !collapsed.has(e.area)) lines.push(e.tier ? `A settlement dropped to ${e.tier} for lack of support` : 'A village dissolved for lack of support');
    if (e.type === 'foodSupport') lines.push(`Food stood in for ${plural(e.count, 'support token')}`);
    if (e.type === 'marketTrade') lines.push(`${e.side === 'buy' ? 'Bought' : 'Sold'} ${e.count} ${e.resource} at ${e.price}`);
  }
  return lines;
}

// A settlement's shown name; an unnamed capital is called "Capital".
function settlementName(state: GameState, s: Settlement): string | undefined {
  return s.name ?? (capitalOf(state, s.player) === s.area ? 'Capital' : undefined);
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

const SOURCE_NAMES: Record<InstabilitySource, string> = {
  overextension: 'overextension',
  losses: 'settlements lost',
  lostSupport: 'lost support',
  conflict: 'nearby fight',
  bureaucracy: 'Bureaucracy',
  calm: 'advances (Ritual)',
  luxury: 'luxuries',
  noSettlements: 'no settlements left',
};

function thresholdReason(distance: number | null, capital: boolean): string {
  if (capital) return 'capital, 1 free Bureaucracy';
  if (distance === null) return 'no land route to the capital';
  return `${plural(distance, 'area')} from the capital`;
}

// A settlement's instability (design doc §10): local plus civ-wide against its threshold, and what
// changed them last turn.
interface InstabilityOption {
  local: number;
  civ: number;
  threshold: number;
  // Why the threshold is what it is: the capital, or the distance from it.
  reason: string;
  changes: string[];
}

function InstabilityRow({ option }: { option: InstabilityOption }) {
  const risk = option.threshold - option.local - option.civ <= 2;
  return (
    <div className={`game-plan-instability ${risk ? 'warn' : ''}`} title="Local meter plus the civ-wide meter; at the threshold the settlement collapses one tier (§10)">
      <strong>
        Instability {option.local} + {option.civ} of {option.threshold}
      </strong>
      <span>Collapses at {option.threshold} · {option.reason}</span>
      {option.changes.length > 0 && <span>Last turn: {option.changes.join(' · ')}</span>}
    </div>
  );
}

// A settlement's manpower and what its area offers (design doc §6, Manpower).
// What the panel shows about any selected land area.
interface AreaDetails {
  title: string;
  facts: string;
  stacks: { name: string; count: number; mine: boolean }[];
}

interface PlanPanelProps {
  source: AreaId | null;
  details: AreaDetails | null;
  planning: boolean;
  state: { tokens: number; left: number };
  conversion: ConversionOption | null;
  work: WorkOption | null;
  instability: InstabilityOption | null;
  previews: ConversionPreview[];
  conflicts: { area: AreaId; text: string }[];
  // Overextension the civilization's Bureaucracy does not cover, if any (design doc §10).
  unrest: string | null;
  // Settlements with manpower free and a resource it could gather.
  idle: { area: AreaId; count: number }[];
  areaName: (area: AreaId) => string;
  onConvert: (area: AreaId, ordered: boolean) => void;
  onWork: (area: AreaId, resource: string, count: number) => void;
  onSelect: (area: AreaId) => void;
}

// The selected area's details, and in allocation its actions (moves, founding, upgrading,
// manpower) and the turn's planned settlements, each with what will happen if the turn resolved now.
function PlanPanel({ source, details, planning, state, conversion, work, instability, previews, conflicts, unrest, idle, areaName, onConvert, onWork, onSelect }: PlanPanelProps) {
  const others = planning ? previews.filter((p) => p.area !== source) : [];
  const idleElsewhere = planning ? idle.filter((i) => i.area !== source) : [];
  return (
    <div className="game-plan" aria-live="polite">
      {details && (
        <div className="game-plan-area">
          <strong>{details.title}</strong>
          <span>{details.facts}</span>
          {details.stacks.length > 0 && <span>{details.stacks.map((s) => `${s.mine ? 'Your tokens' : s.name}: ${s.count}`).join(' · ')}</span>}
        </div>
      )}
      {instability && <InstabilityRow option={instability} />}
      {source !== null && planning && (
        <>
          {work && <WorkRow area={source} work={work} onWork={onWork} />}
          {state.tokens > 0 && (
            <>
              <strong>
                {state.left} of {plural(state.tokens, 'token')} left to move
              </strong>
              <span>Drag to a highlighted area to send one · Shift-drag sends all · right-click an arrow to take one back</span>
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
      {idleElsewhere.length > 0 && (
        <ul className="game-plan-list">
          <li className="game-plan-head">Manpower with nothing to do</li>
          {idleElsewhere.map((i) => (
            <li key={i.area} className="warn">
              <button type="button" className="game-plan-link" onClick={() => onSelect(i.area)}>
                {areaName(i.area)} · {i.count} unassigned
              </button>
            </li>
          ))}
        </ul>
      )}
      {planning && unrest && <div className="game-plan-unrest">{unrest}</div>}
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

function WorkRow({ area, work, onWork }: { area: AreaId; work: WorkOption; onWork: (area: AreaId, resource: string, count: number) => void }) {
  return (
    <div className="game-plan-work">
      <strong>
        Manpower: {work.total - work.free} of {work.total} working
      </strong>
      {work.rows.map((r) => (
        <span key={r.resource} className="game-plan-work-row" title={r.resource === BUREAUCRACY ? 'Each unit lowers this settlement’s instability by 1 a turn, then the civ-wide meter' : r.resource === HIGH_LEARNING ? 'Each unit adds 1 learning a turn, sent down the study queue; it speeds advances up (see Knowledge)' : r.usable ? '1 per manpower, gathered at the start of next turn' : 'Your civilization cannot gather this yet'}>
          <span>{r.resource === HIGH_LEARNING ? 'High Learning' : capitalize(r.resource)}</span>
          <button type="button" aria-label={`Less ${r.resource}`} disabled={r.count === 0} onClick={() => onWork(area, r.resource, r.count - 1)}>
            −
          </button>
          <b>{r.count}</b>
          <button type="button" aria-label={`More ${r.resource}`} disabled={!r.usable || work.free === 0} onClick={() => onWork(area, r.resource, r.count + 1)}>
            +
          </button>
        </span>
      ))}
      <small>Changes take effect next turn</small>
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
  if (!option.unlocked) return <span className="game-plan-locked">{name === 'City' ? 'Cities' : `${name}s`} are not unlocked yet</span>;
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

interface GameScreenProps {
  session: Session;
  // Shown when the game opens, e.g. a warning from loading a save.
  message: string | null;
  onExit: () => void;
}

export function GameScreen({ session, message, onExit }: GameScreenProps) {
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
  // What happened to the player's settlements in the last resolution, and the instability changes.
  const [report, setReport] = useState<string[]>(message ? [message] : []);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // The player's settlements founded in the last resolution, waiting for a name.
  const [toName, setToName] = useState<AreaId[]>([]);
  // The settlement to highlight in the Civilization screen, when opened from the map.
  const [listed, setListed] = useState<AreaId | null>(null);

  // Open on the player's starting area.
  useEffect(() => {
    // The trade phase is skipped while the player cannot trade (design doc §7); AI players still place their orders.
    while (session.state.phase === 'trade' && !canTrade(session.state, session.state.players[HUMAN]!.id)) {
      for (const player of session.state.players) {
        if (player.kind === 'ai') for (const command of aiCommands(session.state, session.content, player.id)) submit(session, command);
        submit(session, { type: 'endPhase', player: player.id });
      }
    }
    setVersion((v) => v + 1);
    mapHandle.current?.focus(mapFor(session.setup).starts[HUMAN]!);
  }, [session]);

  // Escape closes any status screen and returns to the map, and clears the selection.
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
      stacks: state.stacks.map((s) => ({ area: s.area, civ: civ.get(s.player)!, count: s.count, ...(s.growth ? { growth: s.growth } : {}) })),
      settlements: state.settlements.map((s) => ({
        area: s.area,
        civ: civ.get(s.player)!,
        tier: pieceTier(s.tier),
        ...(settlementName(state, s) ? { name: settlementName(state, s)! } : {}),
        work: s.work ?? [],
        instability: localInstability(s),
        threshold: threshold(state, map, s),
        risk: civ.get(s.player) === HUMAN && threshold(state, map, s) - totalInstability(state, s) <= 2,
        capital: capitalOf(state, s.player) === s.area,
      })),
      roads: [],
    };
  }, [state]);
  const names = useMemo(() => new Map(state.settlements.flatMap((s) => (settlementName(state, s) ? [[s.area, settlementName(state, s)!] as const] : []))), [state]);
  const shownResources = useMemo(
    () => new Set(session.content.resources.filter((r) => revealed(state, session.content, state.players[HUMAN]!.id, r.id)).map((r) => r.id)),
    [state, session],
  );

  const era = [...session.content.eras].sort((a, b) => a.order - b.order)[0]!;
  const tokens = pieces.stacks.filter((s) => s.civ === HUMAN).reduce((sum, s) => sum + s.count, 0);
  const mine = pieces.settlements.filter((s) => s.civ === HUMAN);
  const towns = mine.filter((s) => s.tier === 'town').length;
  const villages = mine.length - towns;
  const treasury = state.players[HUMAN]!.treasury;
  const income = taxIncome(state, state.players[HUMAN]!.id);
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
  // once. The trade phase is skipped while the player cannot trade (Barter, design doc §7).
  const endPhase = () => {
    const events: GameEvent[] = [];
    const turn = session.state.turn;
    do {
      for (const player of session.state.players) {
        if (player.kind === 'ai') for (const command of aiCommands(session.state, session.content, player.id)) submit(session, command);
        const result = submit(session, { type: 'endPhase', player: player.id });
        if (result.ok) events.push(...result.events.map((e) => e.event));
      }
    } while (session.state.phase === 'trade' && !canTrade(session.state, me));
    // An advance with no adoption is Mastered when Developed; only Developed is reported.
    const reported = events.filter((e) => !(e.type === 'advanceReached' && e.stage === 'mastered' && !session.content.advances.find((a) => a.id === e.advance)?.adoption));
    setReport(turnReport(reported, me, describeConflict, (area) => areaName(area), (id) => session.content.advances.find((a) => a.id === id)?.name ?? id));
    setLastEvents(events);
    const founded = events.filter((e) => e.type === 'settlementBuilt' && e.player === me && e.tier === 'village').map((e) => (e as Extract<GameEvent, { type: 'settlementBuilt' }>).area);
    setToName((queue) => [...queue, ...founded.filter((area) => settlementAt(session.state, area)?.player === me && !settlementAt(session.state, area)!.name)]);
    if (session.state.turn > turn) {
      const failed = writeSave(session, `${gameName(session)} - autosave`, AUTOSAVE_ID);
      if (failed) setNotice(failed);
    }
    setSelected(null);
    setVersion((v) => v + 1);
  };

  // Movement planning (design doc §4): drag tokens from one of your areas to an area in reach to
  // send one, Shift-drag for all; right-click an arrow to take one back, Shift-right-click to cancel
  // it. Each change is an order to the engine.
  const me = state.players[HUMAN]!.id;
  const planning = state.phase === 'allocation';
  const myOrders = state.orders.filter((o) => o.player === me);
  // Read from the live session so quick repeated changes build on each other before a re-render.
  const planned = (from: AreaId, to: AreaId) =>
    session.state.orders.find((o) => o.player === me && o.from === from && o.to === to)?.count ?? 0;
  const left = (from: AreaId) =>
    tokensAt(session.state, from, me) - session.state.orders.filter((o) => o.player === me && o.from === from).reduce((sum, o) => sum + o.count, 0);
  const source = selected;
  const moveTargets = (area: AreaId) => (planning && left(area) > 0 ? reachable(session.state, map, me, area) : []);
  // A move beyond the neighbours passes through one of the player's settlements (design doc §4,
  // Settlement step); the first such settlement next to both ends, by area id.
  const moveVia = (from: AreaId, to: AreaId): AreaId | null => {
    if (map.areas[from]!.neighbors.includes(to)) return null;
    const via = map.areas[from]!.neighbors.filter((n) => map.areas[n]!.neighbors.includes(to) && settlementAt(state, n)?.player === me).sort((a, b) => a - b)[0];
    return via ?? null;
  };

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
  const details = (area: AreaId): AreaDetails => {
    const a = map.areas[area]!;
    const here = settlementAt(state, area);
    const capital = here && capitalOf(state, here.player) === area ? ', capital' : '';
    const title = here ? `${names.get(area) ?? 'Unnamed'} – ${tierRules(here.tier).name} of ${who(here.player)}${capital}` : capitalize(a.terrain!);
    const facts = [here ? capitalize(a.terrain!) : '', ...a.features, `limit ${a.limit}`, ...a.resources.filter((r) => revealed(state, session.content, me, r))].filter(Boolean).join(' · ');
    const stacks = state.stacks.filter((st) => st.area === area).map((st) => ({ name: who(st.player), count: st.count, mine: st.player === me }));
    return { title, facts, stacks };
  };
  const convert = (area: AreaId, ordered: boolean) => {
    const result = submit(session, { type: 'orderConversion', player: me, area, ordered });
    if (!result.ok) setNotice(result.reason);
    setVersion((v) => v + 1);
  };

  // Manpower (design doc §6): standing assignments, changed in allocation.
  const workOption = (area: AreaId): WorkOption | null => {
    const here = settlementAt(state, area);
    if (!here || here.player !== me) return null;
    const work = here.work ?? [];
    const count = (resource: string) => work.find((w) => w.resource === resource)?.count ?? 0;
    const rows = workable(map, session.content, area)
      .filter((resource) => revealed(state, session.content, me, resource))
      .map((resource) => ({ resource, count: count(resource), usable: usable(state, session.content, me, resource) }));
    rows.push({ resource: BUREAUCRACY, count: count(BUREAUCRACY), usable: true }, { resource: HIGH_LEARNING, count: count(HIGH_LEARNING), usable: true });
    return { total: manpower(here), free: manpower(here) - assigned(here), rows };
  };
  const instabilityOption = (area: AreaId): InstabilityOption | null => {
    const here = settlementAt(state, area);
    if (!here || here.player !== me) return null;
    const changes = lastEvents.flatMap((e) => {
      if (e.type !== 'instabilityChanged' || e.player !== me || (e.area !== null && e.area !== area)) return [];
      return [`${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} ${SOURCE_NAMES[e.source]}${e.area === null ? ' (civ-wide)' : ''}`];
    });
    const reason = thresholdReason(capitalDistance(state, map, here), capitalOf(state, me) === area);
    return { local: localInstability(here), civ: civInstability(state, me), threshold: threshold(state, map, here), reason, changes };
  };
  // Overextension Bureaucracy does not cover: the civ-wide meter will keep rising.
  const calming = state.settlements.filter((s) => s.player === me).reduce((sum, s) => sum + bureaucracyAt(state, s), 0) + calm(state, me);
  const rising = overextension(state, me) - calming;
  const unrest = rising > 0 ? `Unrest rising: overextension +${overextension(state, me)} a turn, Bureaucracy −${calming}. Assign Bureaucracy or the farthest settlements will collapse first` : null;
  // Unassigned manpower produces nothing; Bureaucracy is open to every settlement.
  const idle = state.settlements
    .filter((s) => s.player === me && assigned(s) < manpower(s))
    .map((s) => ({ area: s.area, count: manpower(s) - assigned(s) }));
  const assignWork = (area: AreaId, resource: string, count: number) => {
    const result = submit(session, { type: 'assignWork', player: me, area, resource, count });
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
    if (!here && tokensInReach(state, map, me, area) === 0) return null;
    const tier = nextTier(state, area);
    if (!tier) return null;
    const ordered = previews.find((p) => p.area === area) ?? null;
    const unlocked = state.players[HUMAN]!.tiers.includes(tier.id);
    return { tier: tier.id, upgrade: Boolean(here), cost: conversionCost(tier.id), unlocked, ordered };
  };

  // A click selects any land area; clicking it again, or the sea, clears the selection.
  const onAreaClick = (area: AreaId, button: ClickButton) => {
    if (button !== 'primary') return;
    setSelected(area === selected || map.areas[area]!.kind !== 'land' ? null : area);
  };

  // Double-clicking one of the player's settlements opens its row in the Civilization screen.
  const onAreaDoubleClick = (area: AreaId) => {
    if (settlementAt(state, area)?.player !== me) return;
    setSelected(null);
    setListed(area);
    setScreen('civilization');
  };

  const onMoveDrop = (from: AreaId, to: AreaId, all: boolean) => {
    if (left(from) === 0) return;
    order(from, to, planned(from, to) + (all ? left(from) : 1));
  };

  // Clicking a planned move selects its source; right-click takes one token back, Shift-right-click
  // cancels the move.
  const onMoveClick = (from: AreaId, to: AreaId, button: ClickButton, shift: boolean) => {
    if (!planning) return;
    if (button === 'primary') setSelected(from);
    else order(from, to, shift ? 0 : planned(from, to) - 1);
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
            <button
              key={s.id}
              type="button"
              className={s.id === screen ? 'selected' : ''}
              aria-pressed={s.id === screen}
              onClick={() => {
                setListed(null);
                setScreen(s.id);
              }}
            >
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
          <div title={`Currency, kept from turn to turn; spent on the market and on wonders. Tax: ${income > 0 ? `+${income} a turn from towns (town 2, city 3, metropolis 4)` : 'none — villages pay no tax; towns pay 2 a turn'} (design doc §6)`}>
            <dt>Treasury</dt>
            <dd>
              {treasury}
              {income > 0 && ` (+${income})`}
            </dd>
          </div>
          <button type="button" className="game-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            Menu
          </button>
          {menuOpen && <GameMenu session={session} onClose={() => setMenuOpen(false)} onExit={onExit} />}
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
          onAreaDoubleClick={onAreaDoubleClick}
          keyboardPan={screen === 'map' && !menuOpen}
          moves={myOrders}
          onMoveClick={onMoveClick}
          moveTargets={moveTargets}
          onMoveDrop={onMoveDrop}
          moveVia={moveVia}
          revealedResources={shownResources}
          selection={source}
          plans={plans}
        />

        {screen === 'map' ? (
          <>
            <label className="game-toggle">
              <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
              Tokens / limits
            </label>
            {(source !== null || (planning && (previews.length > 0 || conflicts.length > 0 || idle.length > 0 || unrest !== null))) && (
              <PlanPanel
                source={source}
                details={source === null ? null : details(source)}
                planning={planning}
                state={{ tokens: source === null ? 0 : tokensAt(state, source, me), left: source === null ? 0 : left(source) }}
                conversion={source === null ? null : conversionOption(source)}
                work={source === null ? null : workOption(source)}
                instability={source === null ? null : instabilityOption(source)}
                previews={previews}
                conflicts={conflicts.map((e) => ({ area: e.area, text: describeConflict(e)! }))}
                unrest={unrest}
                idle={idle}
                areaName={areaName}
                onConvert={convert}
                onWork={assignWork}
                onSelect={(area) => {
                  setSelected(area);
                  mapHandle.current?.focus(area);
                }}
              />
            )}
            {toName.length > 0 && (
              <NameDialog
                key={toName[0]}
                capital={capitalOf(state, me) === toName[0]}
                taken={state.settlements.flatMap((s) => (s.name ? [s.name] : []))}
                onDone={(name) => {
                  if (name) rename(toName[0]!, name);
                  setToName((queue) => queue.slice(1));
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
                    {hoveredArea.resources.some((r) => revealed(state, session.content, me, r)) && ` · ${hoveredArea.resources.filter((r) => revealed(state, session.content, me, r)).join(', ')}`}
                    {tokensAt(state, hoveredArea.id, me) > 0 && ` · ${tokensAt(state, hoveredArea.id, me)} of your tokens`}
                  </>
                )
              ) : (
                <span className="game-hint">{state.phase === 'trade' ? 'Trade phase: place or change orders on the Market screen, then end the phase' : planning ? 'Drag your tokens to move them (Shift-drag for all) · click an area for details and actions · double-click a settlement to see it in your list · arrow keys scroll' : 'Drag or use the arrow keys to pan · scroll to zoom · click an area for details'}</span>
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
            <article className={`game-sheet ${screen === 'civilization' || screen === 'rivals' || screen === 'knowledge' || screen === 'market' ? 'filled' : ''}`} onClick={(e) => e.stopPropagation()}>
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
                  instability={{ civ: civInstability(state, me), overextension: overextension(state, me), free: OVEREXTENSION_FREE, capital: capitalOf(state, me) }}
                  planned={myOrders.length > 0 || state.conversions.some((c) => c.player === me)}
                  work={workOption}
                  canAssign={planning && !state.players[HUMAN]!.endedPhase}
                  onWork={assignWork}
                  focus={listed}
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
              ) : screen === 'knowledge' ? (
                <KnowledgeSheet
                  views={discoveryView(state, map, session.content, me)}
                  content={session.content}
                  queue={state.players[HUMAN]!.study}
                  plan={learningPlan(state, map, session.content, me)}
                  canStudy={planning && !state.players[HUMAN]!.endedPhase}
                  onStudy={(queue) => {
                    const result = submit(session, { type: 'setStudy', player: me, queue });
                    if (!result.ok) setNotice(result.reason);
                    setVersion((v) => v + 1);
                  }}
                />
              ) : screen === 'market' ? (
                <MarketSheet
                  view={marketView(state, map, session.content, me)}
                  treasury={treasury}
                  members={marketView(state, map, session.content, me).members.map((id) => state.players.find((p) => p.id === id)!.name)}
                  canOrder={state.phase === 'trade' && !state.players[HUMAN]!.endedPhase}
                  trades={lastEvents.filter((e): e is Extract<GameEvent, { type: 'marketTrade' }> => e.type === 'marketTrade' && e.player === me && session.state.phase !== 'trade')}
                  onOrder={(resource, side, count, limit) => {
                    const result = submit(session, { type: 'setOrder', player: me, resource, side, count, ...(limit !== undefined ? { limit } : {}) });
                    if (!result.ok) setNotice(result.reason);
                    setVersion((v) => v + 1);
                  }}
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

function gameName(session: Session): string {
  return session.setup.name ?? 'Untitled game';
}

// Asks the player to name a settlement they just founded, offering a famous city not yet in use.
function NameDialog({ capital, taken, onDone }: { capital: boolean; taken: string[]; onDone: (name: string) => void }) {
  const offer = () => {
    const free = CITY_NAMES.filter((n) => !taken.includes(n));
    const pool = free.length > 0 ? free : CITY_NAMES;
    return pool[Math.floor(Math.random() * pool.length)]!;
  };
  const [name, setName] = useState(offer);
  return (
    <form
      className="game-name-dialog"
      role="dialog"
      aria-label="Name your settlement"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(name.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone('');
      }}
    >
      <h2>{capital ? 'Name your capital' : 'Name your new village'}</h2>
      <div className="game-name-row">
        <input value={name} maxLength={NAME_MAX_LENGTH} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} autoFocus />
        <button type="button" onClick={() => setName(offer())} title="Offer another famous city">
          Another
        </button>
      </div>
      <div className="game-name-actions">
        <button type="submit" disabled={!name.trim()}>
          Found
        </button>
        <button type="button" onClick={() => onDone('')} title={capital ? 'It will be called "Capital"' : 'You can name it later from the Civilization screen'}>
          Skip
        </button>
      </div>
    </form>
  );
}

// In-game menu: save to a browser slot, export to a file, or return to the title screen.
function GameMenu({ session, onClose, onExit }: { session: Session; onClose: () => void; onExit: () => void }) {
  const fallback = `${gameName(session)} - turn ${session.state.turn}`;
  const [name, setName] = useState(fallback);
  const [status, setStatus] = useState<string | null>(null);
  const saveName = name.trim() || fallback;
  return (
    <div className="game-menu-panel" role="dialog" aria-label="Game menu">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStatus(writeSave(session, saveName) ?? `Saved as "${saveName}"`);
        }}
      >
        <label>
          <span>Save as</span>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <button type="submit">Save</button>
      </form>
      <button type="button" onClick={() => downloadSave(saveGame(session), saveName, session.state.turn)}>
        Export to file
      </button>
      <button
        type="button"
        onClick={() => downloadLog(toJsonLines(session.log), saveName, session.state.turn)}
        title="Every command, event, and random draw since the game started or was last loaded, as JSON lines"
      >
        Download game log
      </button>
      <button type="button" onClick={onExit} title="Progress since the last save or autosave is lost">
        Exit to title
      </button>
      <button type="button" onClick={onClose}>
        Close
      </button>
      {status && <p className="game-menu-status">{status}</p>}
    </div>
  );
}
