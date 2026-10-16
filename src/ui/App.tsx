import { useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { MapScreen } from './screens/MapScreen';
import { StressScreen } from './screens/StressScreen';
import { TitleScreen } from './screens/TitleScreen';

// Phase 2 screens. Title → New Game opens the in-game frame. Review tools: ?screen=map (map
// generator), ?screen=stress (rendering stress test); ?screen=game opens the frame directly.
export function App() {
  const query = new URLSearchParams(window.location.search).get('screen');
  const [screen, setScreen] = useState(query === 'game' ? 'game' : 'title');
  if (query === 'map') return <MapScreen />;
  if (query === 'stress') return <StressScreen />;
  if (screen === 'game') return <GameScreen onExit={() => setScreen('title')} />;
  return <TitleScreen onNewGame={() => setScreen('game')} />;
}
