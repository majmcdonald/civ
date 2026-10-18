import { useState } from 'react';
import type { Session } from '../engine';
import { DEFAULT_GAME, GameScreen, newSession } from './screens/GameScreen';
import { MapScreen } from './screens/MapScreen';
import { StressScreen } from './screens/StressScreen';
import { TitleScreen } from './screens/TitleScreen';

// Each opened game gets a new id, which remounts the game screen.
interface OpenGame {
  id: number;
  session: Session;
  message: string | null;
}

let opened = 0;
const open = (session: Session, message: string | null = null): OpenGame => ({ id: ++opened, session, message });

// Title → New Game (setup) → Start, or Continue / Load Game, opens the in-game frame. Review tools:
// ?screen=map (map generator), ?screen=stress (rendering stress test); ?screen=game opens a default
// game directly.
export function App() {
  const query = new URLSearchParams(window.location.search).get('screen');
  const [game, setGame] = useState<OpenGame | null>(() => (query === 'game' ? open(newSession(DEFAULT_GAME)) : null));
  if (query === 'map') return <MapScreen />;
  if (query === 'stress') return <StressScreen />;
  if (game) return <GameScreen key={game.id} session={game.session} message={game.message} onExit={() => setGame(null)} />;
  return <TitleScreen onStart={(options) => setGame(open(newSession(options)))} onOpen={(session, message) => setGame(open(session, message))} />;
}
