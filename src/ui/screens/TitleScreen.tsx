import { useState } from 'react';
import { content } from '../../content';
import { LAND_AREAS_PER_CIVILIZATION, MAP_TYPES, MAX_CIVILIZATIONS, ROOM_FACTOR, ROOM_TO_EXPAND, type MapType, type RoomToExpand } from '../../engine';
import { AtlasBackground } from '../art/AtlasBackground';
import { CompassRose } from '../art/CompassRose';
import { DEFAULT_GAME, type NewGameOptions } from './GameScreen';
import { ROOM_NAMES, TYPE_NAMES } from './MapScreen';
import './TitleScreen.css';

const MENU = [
  { label: 'New Game', enabled: true },
  { label: 'Continue', enabled: false },
  { label: 'Load Game', enabled: true },
  { label: 'Rules Reference', enabled: true },
  { label: 'Settings', enabled: true },
];

const OPPONENT_COUNTS = Array.from({ length: MAX_CIVILIZATIONS - 1 }, (_, i) => i + 1);

// The seed is the player's choice, not engine randomness: the engine only sees the number.
const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

// Only New Game does anything; it opens the game setup. The other items are inert.
export function TitleScreen({ onStart }: { onStart: (options: NewGameOptions) => void }) {
  const eras = [...content.eras].sort((a, b) => a.order - b.order);
  const [setup, setSetup] = useState<NewGameOptions | null>(null);
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
        ) : (
          <nav className="title-menu" aria-label="Main menu">
            {MENU.map((item) => (
              <button
                key={item.label}
                type="button"
                className="title-menu-item"
                disabled={!item.enabled}
                onClick={item.label === 'New Game' ? () => setSetup({ ...DEFAULT_GAME, seed: randomSeed() }) : undefined}
              >
                {item.label}
              </button>
            ))}
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
// civilizations sets the map's size.
function NewGameSetup({ options, onChange, onStart, onBack }: NewGameSetupProps) {
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
      <label>
        <span>Seed</span>
        <span className="title-setup-seed">
          <input type="number" min={1} value={options.seed} onChange={(e) => onChange({ ...options, seed: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })} />
          <button type="button" onClick={() => onChange({ ...options, seed: randomSeed() })}>
            New
          </button>
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
