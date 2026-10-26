import { useState } from 'react';
import { CURRENCY_PER_MANPOWER, type AreaId, type Content, type WonderView } from '../../engine';

// The Wonders screen (design doc §9, v0.28): each wonder of the era, what opens it, its cost a turn,
// who is building it (not how far), and the player's own builds. Wonders are started in allocation
// and first worked the next turn.

interface WondersSheetProps {
  views: WonderView[];
  content: Content;
  me: string;
  treasury: number;
  // Durable goods in the player's stock, e.g. "stone 4, copper 2".
  stock: string;
  // Last resolution's outcome for each of the player's builds, by wonder id.
  last: Map<string, string>;
  place: (area: AreaId) => string;
  who: (player: string) => string;
  canOrder: boolean;
  onStart: (wonder: string, area: AreaId) => void;
  onRedirect: (wonder: string, to?: { wonder: string; area: AreaId }) => void;
  onShow: (area: AreaId) => void;
}

const goodText = (content: Content, resource: string, count: number) => `${count} ${resource === 'food' ? 'food' : (content.resources.find((r) => r.id === resource)?.name.toLowerCase() ?? resource)}`;

export function WondersSheet({ views, content, me, treasury, stock, last, place, who, canOrder, onStart, onRedirect, onShow }: WondersSheetProps) {
  const lost = views.filter((v) => v.mine?.outbuilt !== undefined);
  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Wonders</h1>
        <p>
          Treasury {treasury} · Stock {stock || 'empty'}
        </p>
      </header>
      {lost.map((v) => (
        <Redirect key={v.wonder.id} view={v} views={views} place={place} canOrder={canOrder} onRedirect={onRedirect} />
      ))}
      <div className="civ-cards wonder-cards">
        {views.map((v) => (
          <WonderCard key={v.wonder.id} view={v} content={content} me={me} last={last.get(v.wonder.id) ?? null} place={place} who={who} canOrder={canOrder} onStart={onStart} onShow={onShow} />
        ))}
      </div>
      <p className="civ-note">
        Each wonder exists once in the world. Every turn of work takes its goods from anywhere in your civilization, after support, and its manpower at its settlement; {CURRENCY_PER_MANPOWER} currency covers each unit of manpower missing. Goods cannot be replaced with currency: buy them on the market. A turn that cannot be paid stalls and spends nothing. A wonder started now is first worked next turn.
      </p>
    </div>
  );
}

interface WonderCardProps {
  view: WonderView;
  content: Content;
  me: string;
  last: string | null;
  place: (area: AreaId) => string;
  who: (player: string) => string;
  canOrder: boolean;
  onStart: (wonder: string, area: AreaId) => void;
  onShow: (area: AreaId) => void;
}

function WonderCard({ view, content, me, last, place, who, canOrder, onStart, onShow }: WonderCardProps) {
  const { wonder, completed, mine } = view;
  const open = view.sites.filter((s) => s.problem === null);
  const [site, setSite] = useState<AreaId | null>(open[0]?.area ?? null);
  const chosen = view.sites.find((s) => s.area === site) ?? null;
  const rivals = view.builders.filter((p) => p !== me);
  const opened = wonder.requires.map((a) => content.advances.find((x) => x.id === a)?.name ?? a).join(' and ');
  const cost = [...wonder.goods.map((g) => goodText(content, g.resource, g.count)), `${wonder.manpower} manpower`].join(', ');
  return (
    <section className={`civ-card wonder-card ${completed ? 'done' : ''}`}>
      <h2>
        {wonder.name} <span className="civ-planned">{view.points} points</span>
      </h2>
      <p className="wonder-effect">{wonder.summary}</p>
      <dl className="civ-facts">
        <dt>Opened by</dt>
        <dd>{opened} Developed</dd>
        <dt title={`Manpower at its settlement, or ${CURRENCY_PER_MANPOWER} currency for each unit missing`}>A turn</dt>
        <dd>{cost}</dd>
        <dt>Turns of work</dt>
        <dd>{wonder.turns}</dd>
        {rivals.length > 0 && !completed && (
          <>
            <dt title="Who is building it; not how far they are (§9)">Also building</dt>
            <dd>{rivals.map(who).join(', ')}</dd>
          </>
        )}
      </dl>
      {completed ? (
        <p className="civ-note">
          Completed turn {completed.turn} by {completed.builder === me ? 'you' : who(completed.builder)} at{' '}
          <button type="button" className="wonder-place" onClick={() => onShow(completed.area)}>
            {place(completed.area)}
          </button>
          {completed.holder === null ? '; in ruins, its effect has ended' : completed.holder !== completed.builder ? `; held by ${completed.holder === me ? 'you' : who(completed.holder)}, who has its effect` : ''}
        </p>
      ) : mine && mine.outbuilt === undefined ? (
        <>
          <div className="civ-meter" title={`${mine.worked} of ${wonder.turns} turns`}>
            <div className="civ-meter-fill" style={{ width: `${(100 * mine.worked) / wonder.turns}%` }} />
          </div>
          <p className="civ-note">
            Building at{' '}
            <button type="button" className="wonder-place" onClick={() => onShow(mine.area)}>
              {place(mine.area)}
            </button>
            : {mine.worked} of {wonder.turns} turns. Assign manpower to it on the Civilization screen.
          </p>
          {last && <p className={`civ-note ${last.startsWith('Stalled') ? 'warn' : ''}`}>Last turn: {last}</p>}
        </>
      ) : view.closed ? (
        <p className="civ-note">{view.closed}</p>
      ) : canOrder ? (
        <div className="mk-edit wonder-start">
          <select value={site ?? ''} onChange={(e) => setSite(Number(e.target.value))} aria-label={`${wonder.name}: settlement`}>
            {view.sites.map((s) => (
              <option key={s.area} value={s.area} disabled={s.problem !== null} title={s.problem ?? undefined}>
                {place(s.area)}
                {s.problem ? ` (${s.problem})` : ''}
              </option>
            ))}
          </select>
          <button type="button" disabled={!chosen || chosen.problem !== null} onClick={() => site !== null && onStart(wonder.id, site)}>
            Start
          </button>
        </div>
      ) : (
        <p className="civ-note">Wonders are started in the allocation phase.</p>
      )}
      {!completed && !mine && !view.closed && open.length === 0 && view.sites.length > 0 && <p className="civ-note warn">{view.sites[0]!.problem}</p>}
    </section>
  );
}

interface RedirectProps {
  view: WonderView;
  views: WonderView[];
  place: (area: AreaId) => string;
  canOrder: boolean;
  onRedirect: (wonder: string, to?: { wonder: string; area: AreaId }) => void;
}

// A race lost: move the progress at the same share to another wonder, or turn it into culture.
function Redirect({ view, views, place, canOrder, onRedirect }: RedirectProps) {
  const lost = view.mine!;
  const targets = views.filter((v) => v.wonder.id !== view.wonder.id && !v.closed && v.sites.some((s) => s.problem === null || s.problem.startsWith('Needs')));
  const [target, setTarget] = useState(targets[0]?.wonder.id ?? '');
  const chosen = targets.find((v) => v.wonder.id === target);
  const sites = chosen?.sites.filter((s) => !s.problem?.includes('already being built')) ?? [];
  const [site, setSite] = useState<AreaId | null>(sites[0]?.area ?? null);
  const moved = chosen ? Math.floor((lost.worked * chosen.wonder.turns) / view.wonder.turns) : 0;
  const culture = Math.floor((view.points * lost.worked) / view.wonder.turns);
  return (
    <section className="civ-card wonder-lost">
      <h2>{view.wonder.name}: race lost</h2>
      <p>
        Another civilization completed it first. Your {lost.worked} of {view.wonder.turns} turns can move to another wonder at the same share, or become {culture} culture {culture === 1 ? 'point' : 'points'}. Choose this allocation; otherwise they become culture.
      </p>
      {canOrder && (
        <div className="mk-edit wonder-start">
          {targets.length > 0 && (
            <>
              <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Move to wonder">
                {targets.map((v) => (
                  <option key={v.wonder.id} value={v.wonder.id}>
                    {v.wonder.name}
                  </option>
                ))}
              </select>
              <select value={site ?? ''} onChange={(e) => setSite(Number(e.target.value))} aria-label="At settlement">
                {sites.map((s) => (
                  <option key={s.area} value={s.area}>
                    {place(s.area)}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!chosen || site === null} onClick={() => chosen && site !== null && onRedirect(view.wonder.id, { wonder: chosen.wonder.id, area: site })}>
                Move ({moved} of {chosen?.wonder.turns ?? 0} turns)
              </button>
            </>
          )}
          <button type="button" onClick={() => onRedirect(view.wonder.id)}>
            Take {culture} culture
          </button>
        </div>
      )}
    </section>
  );
}
