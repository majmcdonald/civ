import type { Endgame, EraView, GameMap, Score } from '../../engine';
import type { MapPieces } from '../art/pieces';

// Rivals and standings (design doc §11, §14, §15): each civilization's era and progress to its next
// gate, its points, and the endgame countdown.

interface Civ {
  name: string;
  color: string;
}

// Pairs of civilizations whose tokens share an area over its limit (§11).
function conflicts(map: GameMap, pieces: MapPieces): [number, number][] {
  const byArea = new Map<number, MapPieces['stacks']>();
  for (const s of pieces.stacks) byArea.set(s.area, [...(byArea.get(s.area) ?? []), s]);
  const pairs = new Map<string, [number, number]>();
  for (const [area, stacks] of byArea) {
    if (stacks.length < 2 || stacks.reduce((sum, s) => sum + s.count, 0) <= map.areas[area]!.limit) continue;
    const [a, b] = stacks.map((s) => s.civ).sort((x, y) => x - y) as [number, number];
    pairs.set(`${a}-${b}`, [a, b]);
  }
  return [...pairs.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

function Diamond({ color }: { color: string }) {
  return <span className="rivals-diamond" style={{ background: color }} aria-hidden="true" />;
}

export function scoreText(s: Score): string {
  return `Knowledge ${s.knowledge} + settlement ${s.settlement} + culture ${s.culture}${s.wonders > 0 ? ` + wonders ${s.wonders}` : ''} = ${s.total}`;
}

// Progress to the next gate, e.g. "Bronze Age: 4/5 settlement · 9/12 knowledge".
function gateText(view: EraView): string {
  if (!view.next) return 'No further gate yet';
  const { era, gate } = view.next;
  return `${era ? era.name : 'Closing'}: ${Math.min(view.score.settlement, gate.settlement)}/${gate.settlement} settlement · ${Math.min(view.score.knowledge, gate.knowledge)}/${gate.knowledge} knowledge`;
}

export function countdownText(endgame: Endgame | null, over: boolean, turn: number, name: (player: string) => string): string {
  if (over) return 'Over';
  if (!endgame) return 'Not started';
  const left = endgame.ends - turn + 1;
  return `${left} turn${left === 1 ? '' : 's'} left (began turn ${endgame.began}, ${endgame.by.map(name).join(', ')}); the game ends after turn ${endgame.ends}`;
}

interface RivalsSheetProps {
  map: GameMap;
  pieces: MapPieces;
  civs: Civ[];
  human: number;
  // Each civilization's era and points, in player order.
  views: EraView[];
  ids: string[];
  finalEra: string;
  // What completes the final era: the next era's gate, or the last era's closing gate.
  finalGate: string;
  endgame: Endgame | null;
  over: boolean;
  turn: number;
}

export function RivalsSheet({ map, pieces, civs, human, views, ids, finalEra, finalGate, endgame, over, turn }: RivalsSheetProps) {
  const fighting = conflicts(map, pieces);
  const name = (player: string) => civs[ids.indexOf(player)]?.name ?? player;

  const standings = views
    .map((view, civ) => {
      const mine = pieces.settlements.filter((s) => s.civ === civ);
      const towns = mine.filter((s) => s.tier === 'town').length;
      return { civ, view, towns, villages: mine.length - towns, tokens: pieces.stacks.filter((s) => s.civ === civ).reduce((sum, s) => sum + s.count, 0) };
    })
    .sort((a, b) => b.view.score.total - a.view.score.total || b.tokens - a.tokens || a.civ - b.civ);

  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Rivals and standings</h1>
        <p>Turn {turn}</p>
      </header>

      <div className="rivals-columns">
        <aside className="rivals-side">
          <section className="civ-card">
            <h2>Conflicts</h2>
            {fighting.length === 0 ? (
              <p className="civ-note">No fighting anywhere</p>
            ) : (
              <ul className="rivals-conflicts">
                {fighting.map(([a, b]) => (
                  <li key={`${a}-${b}`} title="Their tokens share an area over its limit (§11)">
                    <Diamond color={civs[a]!.color} />
                    {civs[a]!.name}
                    <span className="rivals-vs">vs</span>
                    <Diamond color={civs[b]!.color} />
                    {civs[b]!.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="civ-card">
            <h2>Endgame</h2>
            <dl className="civ-facts">
              <dt>Final era</dt>
              <dd>{finalEra}</dd>
              <dt title="Meeting this gate completes the final era and starts the countdown (§15)">Completed by</dt>
              <dd>{finalGate}</dd>
              <dt title="5 turns from the turn a civilization completes the final era; the highest score then wins (§15)">Countdown</dt>
              <dd>{countdownText(endgame, over, turn, name)}</dd>
            </dl>
          </section>
        </aside>
        <section>
          <h2>Standings</h2>
          <table className="civ-table rivals-table">
            <thead>
              <tr>
                <th title="By score">#</th>
                <th>Civilization</th>
                <th title="A civilization enters the next era as soon as it meets that era's gate of settlement and knowledge points; an era is never lost (§14)">Era</th>
                <th title="Settlement and knowledge points toward the next era's gate (§14)">Next gate</th>
                <th title="Towns and villages (§5)">Settlements</th>
                <th title="Loose tokens on the map (§4)">Tokens</th>
                <th title="Knowledge points: Stone Age advances score 1 Developed, 3 Mastered (§14)">Knowledge</th>
                <th title="Settlement points: village 1, town 2, city 3, metropolis 4 (§14)">Settlement</th>
                <th title="Culture points from Artists (§6)">Culture</th>
                <th title="Knowledge + settlement + wonders + culture points (§15)">Score</th>
                <th title="Fighting in an area puts two civilizations in conflict; all civilizations start neutral (§11)">Toward you</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(({ civ: c, view, towns, villages, tokens }, rank) => {
                const civ = civs[c]!;
                const atWar = fighting.some(([a, b]) => (a === human && b === c) || (b === human && a === c));
                return (
                  <tr key={c} className={c === human ? 'you' : ''}>
                    <td>{rank + 1}</td>
                    <td>
                      <span className="rivals-civ">
                        <Diamond color={civ.color} />
                        {civ.name}
                      </span>
                    </td>
                    <td className="rivals-era">{view.era.name}</td>
                    <td className="rivals-gate">{gateText(view)}</td>
                    <td>
                      {towns} / {villages}
                    </td>
                    <td>{tokens}</td>
                    <td title={view.knowledge.map((k) => `${k.developed} Developed, ${k.mastered} Mastered`).join('; ') || 'No advances yet'}>{view.score.knowledge}</td>
                    <td>{view.score.settlement}</td>
                    <td>{view.score.culture}</td>
                    <td title={scoreText(view.score)}>
                      <strong>{view.score.total}</strong>
                    </td>
                    <td className={atWar ? 'warn' : ''}>{c === human ? '—' : atWar ? 'In conflict' : 'Neutral'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}

interface FinalStandingsProps {
  civs: Civ[];
  ids: string[];
  scores: Score[];
  winners: string[];
  human: string;
  onClose: () => void;
  onExit: () => void;
}

// The end of the game (design doc §15): final scores, highest first.
export function FinalStandings({ civs, ids, scores, winners, human, onClose, onExit }: FinalStandingsProps) {
  const civ = (player: string) => civs[ids.indexOf(player)]!;
  const won = winners.includes(human);
  return (
    <div className="civ-sheet report-page">
      <header className="civ-head">
        <h1>{won ? (winners.length > 1 ? 'A shared victory' : 'Victory') : 'The game is over'}</h1>
        <p>{winners.map((w) => civ(w).name).join(' and ')} {winners.length > 1 ? 'share the highest score' : 'has the highest score'}</p>
      </header>
      <table className="civ-table rivals-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Civilization</th>
            <th>Knowledge</th>
            <th>Settlement</th>
            <th>Culture</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, rank) => (
            <tr key={s.player} className={s.player === human ? 'you' : ''}>
              <td>{rank + 1}</td>
              <td>
                <span className="rivals-civ">
                  <Diamond color={civ(s.player).color} />
                  {civ(s.player).name}
                </span>
              </td>
              <td>{s.knowledge}</td>
              <td>{s.settlement}</td>
              <td>{s.culture}</td>
              <td title={scoreText(s)}>
                <strong>{s.total}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="final-actions">
        <button type="button" onClick={onClose} autoFocus>
          View the map
        </button>
        <button type="button" onClick={onExit}>
          Exit to title
        </button>
      </div>
    </div>
  );
}
