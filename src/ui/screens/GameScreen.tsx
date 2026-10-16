import { useEffect, useMemo, useRef, useState } from 'react';
import { content as contentBundle } from '../../content';
import { hooks, mapFor, tokensAt, loadContent, startSession, submit, type AreaId, type Phase, type PlayerSetup } from '../../engine';
import { CIV_COLORS, IsoMap, type ClickButton, type IsoMapHandle } from '../art/IsoMap';
import type { MapPieces } from '../art/pieces';
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
const CIVILIZATIONS = 5;
const HUMAN = 0;

function newSession() {
  const loaded = loadContent(contentBundle, hooks);
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const players: PlayerSetup[] = Array.from({ length: CIVILIZATIONS }, (_, i) =>
    i === HUMAN ? { id: 'p1', name: 'Your people', kind: 'human' } : { id: `ai${i}`, name: `Rival ${i}`, kind: 'ai' },
  );
  return startSession({ seed: 1, players, finalEra: 'modern', map: { type: 'inlandSea', room: 'standard' } }, loaded.content);
}

export function GameScreen({ onExit }: { onExit: () => void }) {
  const [session] = useState(newSession);
  const [, setVersion] = useState(0);
  const [screen, setScreen] = useState<ScreenId>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return SCREENS.find((s) => s.id === tab)?.id ?? 'map';
  });
  const [hovered, setHovered] = useState<AreaId | null>(null);
  const [showCounts, setShowCounts] = useState(true);
  // Settlement names by area. Held here until the engine tracks settlements (design doc §5).
  const [names, setNames] = useState<ReadonlyMap<AreaId, string>>(new Map());
  const mapHandle = useRef<IsoMapHandle>(null);
  // Movement planning: the area tokens are being sent from, and the last rejected order.
  const [selected, setSelected] = useState<AreaId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Open on the player's starting area.
  useEffect(() => {
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
  // Settlements and roads arrive with later Phase 3 steps.
  const pieces = useMemo<MapPieces>(() => {
    const civ = new Map(state.players.map((p, i) => [p.id, i]));
    return { stacks: state.stacks.map((s) => ({ area: s.area, civ: civ.get(s.player)!, count: s.count })), settlements: [], roads: [] };
  }, [state]);

  const era = [...session.content.eras].sort((a, b) => a.order - b.order)[0]!;
  const tokens = pieces.stacks.filter((s) => s.civ === HUMAN).reduce((sum, s) => sum + s.count, 0);
  const mine = pieces.settlements.filter((s) => s.civ === HUMAN);
  const towns = mine.filter((s) => s.tier === 'town').length;
  const villages = mine.length - towns;
  const namedPieces = useMemo(
    () => ({ ...pieces, settlements: pieces.settlements.map((s) => (names.has(s.area) ? { ...s, name: names.get(s.area)! } : s)) }),
    [pieces, names],
  );
  const hoveredArea = hovered === null ? null : map.areas[hovered];
  const hoveredSettlement = hovered === null ? undefined : pieces.settlements.find((s) => s.area === hovered);

  const rename = (area: AreaId, name: string) =>
    setNames((current) => {
      const next = new Map(current);
      if (name) next.set(area, name);
      else next.delete(area);
      return next;
    });

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

  // The player ends the phase; AI players (minimal until Phase 7) end it at once.
  const endPhase = () => {
    for (const player of state.players) submit(session, { type: 'endPhase', player: player.id });
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
  const targets = source === null ? [] : map.areas[source]!.neighbors.filter((n) => map.areas[n]!.kind === 'land');

  const order = (from: AreaId, to: AreaId, count: number) => {
    const result = submit(session, { type: 'orderMove', player: me, from, to, count });
    if (!result.ok) setNotice(result.reason);
    setVersion((v) => v + 1);
  };

  const onAreaClick = (area: AreaId, button: ClickButton) => {
    if (source !== null && targets.includes(area)) {
      const count = planned(source, area);
      if (button === 'primary') order(source, area, count + 1);
      else if (count > 0) order(source, area, count - 1);
      return;
    }
    if (button !== 'primary') return;
    if (tokensAt(state, area, me) === 0 || area === source) {
      setSelected(null);
      return;
    }
    if (!planning) {
      setNotice('Moves are ordered in the Allocation phase');
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
          pieces={namedPieces}
          showStarts={false}
          showCounts={showCounts}
          hovered={hovered}
          onHover={setHovered}
          onAreaClick={onAreaClick}
          moves={myOrders}
          onMoveClick={onMoveClick}
          selection={source === null ? null : { area: source, targets }}
        />

        {screen === 'map' ? (
          <>
            <label className="game-toggle">
              <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
              Tokens / limits
            </label>
            {source !== null && (
              <div className="game-plan" aria-live="polite">
                <strong>
                  {left(source)} of {tokensAt(state, source, me)} token{tokensAt(state, source, me) === 1 ? '' : 's'} left to move
                </strong>
                <span>Click a neighbour to send one · right-click to take one back · Esc when done</span>
              </div>
            )}
            {notice && <div className="game-notice">{notice}</div>}
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
                <span className="game-hint">{planning ? 'Click one of your areas to plan moves' : 'Drag to pan · scroll to zoom'}</span>
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
