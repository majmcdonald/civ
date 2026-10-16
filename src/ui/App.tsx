import { MapScreen } from './screens/MapScreen';
import { StressScreen } from './screens/StressScreen';
import { TitleScreen } from './screens/TitleScreen';

// Phase 2 screens have no behavior yet; each is reviewed on its own (?screen=map).
export function App() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (screen === 'map') return <MapScreen />;
  if (screen === 'stress') return <StressScreen />;
  return <TitleScreen />;
}
