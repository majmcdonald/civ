import type { Era } from '../../content/types';
import type { GameMap } from '../../engine';
import type { MapPieces } from '../art/pieces';

// Rivals and standings (design doc §11, §14, §15). AST positions follow the movement rule until the
// engine tracks them (Phase 4); track lengths are untuned (§17).

const SPACES_PER_ERA = 4;

interface Civ {
  name: string;
  color: string;
}

interface Standing {
  civ: number;
  space: number;
  towns: number;
  villages: number;
  tokens: number;
  advances: number;
  settlementPoints: number;
  score: number;
}

// One space per turn, waiting before the Bronze gate, since no one has the advances to pass it yet.
function trackSpace(turn: number): number {
  return Math.min(SPACES_PER_ERA - 1, turn - 1);
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

interface RivalsSheetProps {
  map: GameMap;
  pieces: MapPieces;
  civs: Civ[];
  human: number;
  eras: readonly Era[];
  finalEra: string;
  turn: number;
}

export function RivalsSheet({ map, pieces, civs, human, eras, finalEra, turn }: RivalsSheetProps) {
  const ordered = [...eras].sort((a, b) => a.order - b.order);
  const track = ordered.slice(0, ordered.findIndex((e) => e.id === finalEra) + 1);
  const finalSpace = track.length * SPACES_PER_ERA - 1;
  const fighting = conflicts(map, pieces);

  const standings: Standing[] = civs
    .map((_, civ) => {
      const mine = pieces.settlements.filter((s) => s.civ === civ);
      const towns = mine.filter((s) => s.tier === 'town').length;
      const space = trackSpace(turn);
      // Settlement points come from cities and metropolises only (§14); scoring weights are untuned.
      const settlementPoints = 0;
      const advances = 0;
      return {
        civ,
        space,
        towns,
        villages: mine.length - towns,
        tokens: pieces.stacks.filter((s) => s.civ === civ).reduce((sum, s) => sum + s.count, 0),
        advances,
        settlementPoints,
        score: space + 1 + advances + settlementPoints,
      };
    })
    .sort((a, b) => b.score - a.score || b.tokens - a.tokens || a.civ - b.civ);

  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Rivals and standings</h1>
        <p>Turn {turn}</p>
      </header>

      <section className="rivals-track-wrap">
        <h2 title="Archaeological Succession Table: markers move 1 space per turn; the first space of each era is a gate (§14)">Succession track</h2>
        <div className="rivals-track" style={{ gridTemplateColumns: `9rem repeat(${track.length * SPACES_PER_ERA}, minmax(1.4rem, 1fr))` }}>
          <div />
          {track.map((era) => (
            <div key={era.id} className="rivals-era" style={{ gridColumn: `span ${SPACES_PER_ERA}` }}>
              {era.name}
            </div>
          ))}
          {civs.map((civ, i) => {
            const space = trackSpace(turn);
            const waiting = space === SPACES_PER_ERA - 1;
            return (
              <div key={i} className={`rivals-row ${i === human ? 'you' : ''}`} style={{ display: 'contents' }}>
                <div className="rivals-name">
                  <Diamond color={civ.color} />
                  {civ.name}
                </div>
                {Array.from({ length: track.length * SPACES_PER_ERA }, (_, s) => {
                  const gate = s % SPACES_PER_ERA === 0;
                  const title =
                    s === space
                      ? `${civ.name}: ${track[Math.floor(s / SPACES_PER_ERA)]!.name}, space ${s + 1}${waiting ? ` — waiting at the ${track[1]?.name ?? 'next'} gate` : ''}`
                      : gate
                        ? `${track[s / SPACES_PER_ERA]!.name} gate: needs Developed advances and settlement points`
                        : undefined;
                  return (
                    <div key={s} className={`rivals-space ${gate ? 'gate' : ''} ${s === finalSpace ? 'final' : ''}`} title={title}>
                      {s === space && <span className="rivals-marker" style={{ background: civ.color }} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="rivals-legend">
          <span className="rivals-key gate" /> Era gate <span className="rivals-key final" /> Final space: reaching it starts the endgame countdown
        </p>
      </section>

      <div className="rivals-columns">
        <section>
          <h2>Standings</h2>
          <table className="civ-table rivals-table">
            <thead>
              <tr>
                <th title="By score">#</th>
                <th>Civilization</th>
                <th title="Era and space on the succession track (§14)">Track</th>
                <th title="Towns and villages (§5)">Settlements</th>
                <th title="Loose tokens on the map (§4)">Tokens</th>
                <th title="Developed advances (§8)">Advances</th>
                <th title="AST position + Developed advances + settlement points + wonders + culture figures + culture points (§15); weights untuned">Score</th>
                <th title="Fighting in the last few turns puts two civilizations in conflict (§11)">Toward you</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, rank) => {
                const civ = civs[s.civ]!;
                const atWar = fighting.some(([a, b]) => (a === human && b === s.civ) || (b === human && a === s.civ));
                return (
                  <tr key={s.civ} className={s.civ === human ? 'you' : ''}>
                    <td>{rank + 1}</td>
                    <td>
                      <span className="rivals-civ">
                        <Diamond color={civ.color} />
                        {civ.name}
                      </span>
                    </td>
                    <td>
                      {track[Math.floor(s.space / SPACES_PER_ERA)]!.name} · {s.space + 1}
                    </td>
                    <td>
                      {s.towns} / {s.villages}
                    </td>
                    <td>{s.tokens}</td>
                    <td>{s.advances}</td>
                    <td title={`AST ${s.space + 1} · advances ${s.advances} · settlement points ${s.settlementPoints}`}>
                      <strong>{s.score}</strong>
                    </td>
                    <td className={atWar ? 'warn' : ''}>{s.civ === human ? '—' : atWar ? 'In conflict' : 'Peace'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside className="rivals-side">
          <section className="civ-card">
            <h2>Conflicts</h2>
            {fighting.length === 0 ? (
              <p className="civ-note">No fighting anywhere</p>
            ) : (
              <ul className="rivals-conflicts">
                {fighting.map(([a, b]) => (
                  <li key={`${a}-${b}`} title="Ideas spread slower between them, they are shut out of each other's markets, and both take war instability (§11)">
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
              <dd>{track[track.length - 1]!.name}</dd>
              <dt title="Spaces left for the civilization furthest along">Leader's distance</dt>
              <dd>{finalSpace - Math.max(...standings.map((s) => s.space))} spaces</dd>
              <dt title="Starts when any civilization reaches the final space (§15)">Countdown</dt>
              <dd>Not started</dd>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
