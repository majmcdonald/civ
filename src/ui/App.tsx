import { useState } from 'react';
import { DEFAULT_GAME, GameScreen, type NewGameOptions } from './screens/GameScreen';
import { MapScreen } from './screens/MapScreen';
import { StressScreen } from './screens/StressScreen';
import { TitleScreen } from './screens/TitleScreen';

// Title → New Game (setup) → Start opens the in-game frame. Review tools: ?screen=map (map
// generator), ?screen=stress (rendering stress test); ?screen=game opens a default game directly.
export function App() {
  const query = new URLSearchParams(window.location.search).get('screen');
  const [game, setGame] = useState<NewGameOptions | null>(query === 'game' ? DEFAULT_GAME : null);
  if (query === 'map') return <MapScreen />;
  if (query === 'stress') return <StressScreen />;
  if (game) return <GameScreen options={game} onExit={() => setGame(null)} />;
  return <TitleScreen onStart={setGame} />;
}
