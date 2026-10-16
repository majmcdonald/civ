import { content } from '../../content';
import { AtlasBackground } from '../art/AtlasBackground';
import { CompassRose } from '../art/CompassRose';
import './TitleScreen.css';

const MENU = [
  { label: 'New Game', enabled: true },
  { label: 'Continue', enabled: false },
  { label: 'Load Game', enabled: true },
  { label: 'Rules Reference', enabled: true },
  { label: 'Settings', enabled: true },
];

// No behavior yet (Phase 2): menu items are inert.
export function TitleScreen() {
  const eras = [...content.eras].sort((a, b) => a.order - b.order);
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

        <nav className="title-menu" aria-label="Main menu">
          {MENU.map((item) => (
            <button key={item.label} type="button" className="title-menu-item" disabled={!item.enabled}>
              {item.label}
            </button>
          ))}
        </nav>
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
