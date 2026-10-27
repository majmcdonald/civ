import { useRef, useState } from 'react';
import { content } from '../../content';
import { AI_APPROACHES, LAND_AREAS_PER_CIVILIZATION, MAP_TYPES, MAX_CIVILIZATIONS, ROOM_FACTOR, ROOM_TO_EXPAND, openSave, type AiApproach, type EraId, type MapType, type RoomToExpand, type Session } from '../../engine';
import { AtlasBackground } from '../art/AtlasBackground';
import { CompassRose } from '../art/CompassRose';
import { deleteSave, downloadSave, listSaves, nameFromFile, readSave, writeSave, type SaveSlot } from '../saves';
import { DEFAULT_GAME, gameContent, type NewGameOptions } from './GameScreen';
import { RulesSheet } from './RulesSheet';
import { ROOM_NAMES, TYPE_NAMES } from './MapScreen';
import './TitleScreen.css';

const MENU = ['New Game', 'Continue', 'Load Game', 'Rules Reference', 'Settings'] as const;

const ERAS = [...content.eras].sort((a, b) => a.order - b.order);
const APPROACH_NAMES: Record<AiApproach, string> = { balanced: 'Balanced', expansion: 'Expansion', building: 'Building', study: 'Study', culture: 'Culture', aggression: 'Aggression' };
const OPPONENT_COUNTS = Array.from({ length: MAX_CIVILIZATIONS - 1 }, (_, i) => i + 1);

// The seed is the player's choice, not engine randomness: the engine only sees the number.
const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

// Opens a saved game; returns an error message on failure.
function open(json: string, onOpen: (session: Session, message: string | null) => void): string | null {
  try {
    const { session, warning } = openSave(json, gameContent());
    onOpen(session, warning);
    return null;
  } catch (error) {
    return `Unable to load: ${error instanceof Error ? error.message : 'unreadable save'}`;
  }
}

function openSlot(slot: SaveSlot, onOpen: (session: Session, message: string | null) => void): string | null {
  const json = readSave(slot.id);
  return json ? open(json, onOpen) : 'Unable to load: the save is missing';
}

interface TitleScreenProps {
  onStart: (options: NewGameOptions) => void;
  onOpen: (session: Session, message: string | null) => void;
}

// New Game opens the game setup, Continue the most recent save, Load Game the list of saves, and
// Rules Reference the rules page. Settings is inert.
export function TitleScreen({ onStart, onOpen }: TitleScreenProps) {
  const eras = [...content.eras].sort((a, b) => a.order - b.order);
  const [setup, setSetup] = useState<NewGameOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = listSaves()[0];
  const actions: Partial<Record<(typeof MENU)[number], () => void>> = {
    'New Game': () => setSetup({ ...DEFAULT_GAME, seed: randomSeed() }),
    Continue: () => latest && setError(openSlot(latest, onOpen)),
    'Load Game': () => setLoading(true),
    'Rules Reference': () => setRules(true),
  };
  return (
    <main className="title-screen">
      <AtlasBackground />

      <div className="title-frame">
        <header className="title-block">
          <p className="title-kicker">A game of peoples and ages</p>
          <h1 className="title-name">Succession</h1>
          <div className="title-rule" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p className="title-subtitle">From the Stone Age to the Modern era</p>
        </header>

        {setup ? (
          <NewGameSetup options={setup} onChange={setSetup} onStart={() => onStart(setup)} onBack={() => setSetup(null)} />
        ) : loading ? (
          <LoadGame onOpen={onOpen} onBack={() => setLoading(false)} />
        ) : (
          <nav className="title-menu" aria-label="Main menu">
            {MENU.map((item) => (
              <button
                key={item}
                type="button"
                className="title-menu-item"
                disabled={item === 'Continue' && !latest}
                title={item === 'Continue' && latest ? `${latest.name} · turn ${latest.turn}` : undefined}
                onClick={actions[item]}
              >
                {item}
              </button>
            ))}
            {error && <p className="title-error">{error}</p>}
          </nav>
        )}
      </div>

      <ol className="era-band" aria-label="Eras">
        {eras.map((era) => (
          <li key={era.id}>
            <span className="era-mark" aria-hidden="true" />
            <span className="era-name">{era.name}</span>
          </li>
        ))}
      </ol>

      <CompassRose className="title-compass" />

      {rules && (
        <div className="game-sheet-backdrop title-rules" onClick={() => setRules(false)}>
          <article className="game-sheet filled" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="title-rules-close" onClick={() => setRules(false)}>
              Close
            </button>
            <RulesSheet content={gameContent()} />
          </article>
        </div>
      )}
    </main>
  );
}

interface NewGameSetupProps {
  options: NewGameOptions;
  onChange: (options: NewGameOptions) => void;
  onStart: () => void;
  onBack: () => void;
}

// Game setup (design doc §2): opponents, map type, and room to expand, which with the number of
// civilizations sets the map's size, and the final era.
function NewGameSetup({ options, onChange, onStart, onBack }: NewGameSetupProps) {
  const [showApproaches, setShowApproaches] = useState(false);
  const civilizations = options.opponents + 1;
  const land = (room: RoomToExpand) => Math.round(LAND_AREAS_PER_CIVILIZATION * ROOM_FACTOR[room] * civilizations);
  return (
    <form
      className="title-setup"
      aria-label="New game"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <h2>New Game</h2>
      <label>
        <span>Game name</span>
        <input value={options.name} maxLength={60} placeholder="e.g. Matt's game" onChange={(e) => onChange({ ...options, name: e.target.value })} autoFocus />
      </label>
      <label>
        <span>Opponents</span>
        <select value={options.opponents} onChange={(e) => onChange({ ...options, opponents: Number(e.target.value) })}>
          {OPPONENT_COUNTS.map((n) => (
            <option key={n} value={n}>
              {n} AI {n === 1 ? 'rival' : 'rivals'}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Map</span>
        <select value={options.map.type} onChange={(e) => onChange({ ...options, map: { ...options.map, type: e.target.value as MapType } })}>
          {MAP_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_NAMES[t]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Map size</span>
        <select value={options.map.room} onChange={(e) => onChange({ ...options, map: { ...options.map, room: e.target.value as RoomToExpand } })}>
          {ROOM_TO_EXPAND.map((r) => (
            <option key={r} value={r}>
              {ROOM_NAMES[r]} — {LAND_AREAS_PER_CIVILIZATION * ROOM_FACTOR[r]} land areas each
            </option>
          ))}
        </select>
      </label>
      <label title="The game ends 5 turns after a civilization completes this era by meeting the next era's gate; the highest score wins (design doc §15)">
        <span>Final era</span>
        <select value={options.finalEra} onChange={(e) => onChange({ ...options, finalEra: e.target.value as EraId })}>
          {ERAS.map((era, i) => {
            const next = ERAS[i + 1];
            const open = next ? Boolean(next.gate) : Boolean(era.closing);
            return (
              <option key={era.id} value={era.id}>
                {era.name}
                {open ? '' : ' (cannot end yet)'}
              </option>
            );
          })}
        </select>
      </label>
      <label>
        <span>Seed</span>
        <span className="title-setup-seed">
          <input type="number" min={1} value={options.seed} onChange={(e) => onChange({ ...options, seed: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })} />
          <button type="button" onClick={() => onChange({ ...options, seed: randomSeed() })}>
            New
          </button>
        </span>
      </label>
      <label title="How each rival plays (design doc §2). Random draws a different approach for each rival until all have been used; the game does not show which a rival has">
        <span>Rival approaches</span>
        <button type="button" className="title-setup-toggle" aria-expanded={showApproaches} onClick={() => setShowApproaches(!showApproaches)}>
          {options.approaches.slice(0, options.opponents).some((a) => a && a !== 'random') ? 'Set' : 'Random'} {showApproaches ? '▾' : '▸'}
        </button>
      </label>
      {showApproaches &&
        Array.from({ length: options.opponents }, (_, i) => (
          <label key={i}>
            <span>Rival {i + 1}</span>
            <select
              value={options.approaches[i] ?? 'random'}
              onChange={(e) => {
                const approaches = Array.from({ length: options.opponents }, (_, j) => options.approaches[j] ?? 'random');
                approaches[i] = e.target.value as AiApproach | 'random';
                onChange({ ...options, approaches });
              }}
            >
              <option value="random">Random</option>
              {AI_APPROACHES.map((a) => (
                <option key={a} value={a}>
                  {APPROACH_NAMES[a]}
                </option>
              ))}
            </select>
          </label>
        ))}
      <label>
        <span>Advanced start</span>
        <span className="title-setup-check">
          <input type="checkbox" checked={options.advancedStart} onChange={(e) => onChange({ ...options, advancedStart: e.target.checked })} />
          Each civilization begins with 2 random advances
        </span>
      </label>
      <p className="title-setup-summary">
        {civilizations} civilizations on about {land(options.map.room)} land areas
      </p>
      <div className="title-setup-actions">
        <button type="button" className="title-menu-item" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="title-menu-item title-setup-start">
          Start
        </button>
      </div>
    </form>
  );
}

// Saved games in browser storage, newest first: open, export to a file, or delete; and import a
// file as a new save.
function LoadGame({ onOpen, onBack }: { onOpen: TitleScreenProps['onOpen']; onBack: () => void }) {
  const [saves, setSaves] = useState(listSaves);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const exportSlot = (slot: SaveSlot) => {
    const json = readSave(slot.id);
    if (json) downloadSave(json, slot.name, slot.turn);
    else setError('Unable to export: the save is missing');
  };
  const remove = (slot: SaveSlot) => {
    deleteSave(slot.id);
    setSaves(listSaves());
  };
  const importFile = async (file: File) => {
    try {
      const { session } = openSave(await file.text(), gameContent());
      setError(writeSave(session, nameFromFile(file)));
      setSaves(listSaves());
    } catch (e) {
      setError(`Unable to import: ${e instanceof Error ? e.message : 'unreadable file'}`);
    }
  };
  return (
    <section className="title-load" aria-label="Load game">
      <h2>Load Game</h2>
      {saves.length === 0 ? (
        <p className="title-setup-summary">No saved games yet</p>
      ) : (
        <table>
          <tbody>
            {saves.map((slot) => (
              <tr key={slot.id}>
                <td>
                  <button type="button" className="title-load-open" onClick={() => setError(openSlot(slot, onOpen))}>
                    {slot.name}
                  </button>
                </td>
                <td>Turn {slot.turn}</td>
                <td>{new Date(slot.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="title-load-actions">
                  <button type="button" onClick={() => exportSlot(slot)} title="Download as a file">
                    Export
                  </button>
                  <button type="button" onClick={() => remove(slot)} title="Delete this save">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && <p className="title-error">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = '';
        }}
      />
      <div className="title-setup-actions">
        <button type="button" className="title-menu-item" onClick={onBack}>
          Back
        </button>
        <button type="button" className="title-menu-item" onClick={() => fileInput.current?.click()}>
          Import file
        </button>
      </div>
    </section>
  );
}
