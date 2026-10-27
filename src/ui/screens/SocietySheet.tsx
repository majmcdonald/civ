import { Fragment, useState } from 'react';
import {
  ATTACKED,
  CAPITAL_BUREAUCRACY,
  CULTURE_PROGRESS,
  CURRENCY_PER_MANPOWER,
  DISTANCE_FREE,
  DISTANCE_MAX_PENALTY,
  DISTANCE_STEP,
  LOST_SUPPORT,
  NEARBY_CONFLICT,
  OVEREXTENSION_FREE,
  RAPID_CHANGE_FREE,
  TIERS,
  type AreaId,
  type Content,
  type InstabilityForecast,
  type WonderView,
} from '../../engine';

// The Society screen (design doc §3, Screens and information panels, v0.29): instability, culture,
// and the era's wonders. Wonders are started in allocation and first worked the next turn (§9).

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// What raises and lowers instability, from the engine's constants (also on the Rules screen).
export function instabilityRules(calmers: { name: string; amount: number }[]): { raises: [string, string][]; lowers: [string, string][] } {
  const raises: [string, string][] = [
    ['Overextension', `+1 civ-wide a turn for each settlement beyond ${OVEREXTENSION_FREE}`],
    ['A settlement lost', '+1 civ-wide for each tier lost, captured or short of support'],
    ['Lost support', `+${LOST_SUPPORT} local to a settlement that drops a tier`],
    ['Attacked', `+${ATTACKED} local to the settlement`],
    ['Tokens lost nearby', `+${NEARBY_CONFLICT} local, in or next to the settlement`],
    ['Rapid change', `+1 civ-wide for each advance step beyond ${RAPID_CHANGE_FREE} in one turn`],
    ['Calamities', 'Local instability; see the Civilization screen'],
  ];
  const lowers: [string, string][] = [
    ['Bureaucracy', `−1 a unit a turn, its own settlement first, then civ-wide; the capital has ${CAPITAL_BUREAUCRACY} free`],
    ...calmers.map((c): [string, string] => [c.name, `−${c.amount} civ-wide a turn`]),
    ['Luxury goods', '−1 on the settlement nearest collapse, at most 1 each'],
    ['Collapse', 'Halves the settlement’s local meter'],
  ];
  return { raises, lowers };
}

interface SocietySheetProps {
  instability: InstabilityForecast;
  capital: string | null;
  // Settlements within NEAR_COLLAPSE of their threshold (engine attention items).
  near: { area: AreaId; instability: number; threshold: number }[];
  // Durable luxuries in the stock, e.g. "copper 2".
  luxuries: string;
  // Advances and wonders that calm the civ-wide meter, with their amounts.
  calmers: { name: string; amount: number }[];
  culture: {
    points: number;
    progress: number;
    sources: { name: string; amount: number }[];
    perAward: { era: string; points: number }[];
  };
  developed: (advance: string) => boolean;
  turn: number;
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

export function SocietySheet(props: SocietySheetProps) {
  const { instability, capital, near, luxuries, calmers, culture, developed, turn, views, content, me, treasury, stock, last, place, who, canOrder, onStart, onRedirect, onShow } = props;
  const lost = views.filter((v) => v.mine?.outbuilt !== undefined);
  const change = instability.next - instability.civ;
  const parts = [
    instability.overextension > 0 ? `+${instability.overextension} overextension` : '',
    instability.bureaucracy > 0 ? `−${instability.bureaucracy} Bureaucracy` : '',
    instability.calm > 0 ? `−${instability.calm} calm` : '',
  ].filter(Boolean);
  const rate = culture.sources.reduce((sum, x) => sum + x.amount, 0);
  const turns = rate > 0 ? Math.ceil((CULTURE_PROGRESS - culture.progress) / rate) : null;
  const { raises, lowers } = instabilityRules(calmers);
  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Society</h1>
        <p>
          Instability {instability.civ} · Culture {culture.points}
        </p>
      </header>

      <div className="civ-cards">
        <section className="civ-card civ-card-wide">
          <h2>Instability</h2>
          <div className="civ-big" title="Civ-wide: adds to every settlement's own meter">
            {instability.civ}
            <span> civ-wide</span>
          </div>
          <dl className="civ-facts">
            <dt title="After this turn's check and next turn's Bureaucracy and calm; fights, losses, and calamities are not known in advance">Next turn</dt>
            <dd className={change > 0 ? 'ec-short' : ''}>
              {instability.next} ({change === 0 ? 'no change' : change > 0 ? `+${change}` : change}){parts.length > 0 && <small className="ec-where">{parts.join(', ')}</small>}
            </dd>
            <dt>Capital</dt>
            <dd>{capital ?? 'none'}</dd>
            <dt title="Durable luxuries calm only settlements with instability">Luxuries in stock</dt>
            <dd>{luxuries || 'none'}</dd>
          </dl>
          {near.length > 0 && (
            <ul className="civ-warnings">
              {near.map((n) => (
                <li key={n.area}>
                  {place(n.area)}: {n.instability} of {n.threshold}, close to collapse
                </li>
              ))}
            </ul>
          )}
          <div className="so-rules">
            <table className="civ-jobs">
              <thead>
                <tr>
                  <th colSpan={2}>Raises</th>
                </tr>
              </thead>
              <tbody>
                {raises.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="civ-jobs">
              <thead>
                <tr>
                  <th colSpan={2}>Lowers</th>
                </tr>
              </thead>
              <tbody>
                {lowers.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="civ-rule">
            A settlement collapses one tier when its own meter plus the civ-wide meter reaches its threshold ({TIERS.map((t) => `${t.name.toLowerCase()} ${t.threshold}`).join(', ')}). Thresholds fall 1 for every {DISTANCE_STEP} moves beyond {DISTANCE_FREE} from the capital, by at most {DISTANCE_MAX_PENALTY}, never below half.
          </p>
        </section>

        <section className="civ-card">
          <h2>Culture</h2>
          <div className="civ-big">
            {culture.points}
            <span> {culture.points === 1 ? 'point' : 'points'}</span>
          </div>
          <div className="civ-meter" role="meter" aria-valuenow={culture.progress} aria-valuemax={CULTURE_PROGRESS}>
            <div className="civ-meter-fill" style={{ width: `${(100 * culture.progress) / CULTURE_PROGRESS}%` }} />
          </div>
          <dl className="civ-facts">
            <dt>Progress</dt>
            <dd>
              {culture.progress} / {CULTURE_PROGRESS}
            </dd>
            <dt>Next award</dt>
            <dd>{turns === null ? 'nothing adds progress' : `${plural(turns, 'turn')} at +${rate}`}</dd>
            {rate > 0 && (
              <>
                <dt className="ec-part">Sources</dt>
                <dd>
                  {culture.sources
                    .filter((x) => x.amount > 0)
                    .map((x) => `${x.name} ${x.amount}`)
                    .join(', ')}
                </dd>
              </>
            )}
            {culture.perAward.map((a) => (
              <Fragment key={a.era}>
                <dt>Award in the {a.era}</dt>
                <dd>{plural(a.points, 'point')}</dd>
              </Fragment>
            ))}
          </dl>
          <p className="civ-rule">Each Artists unit adds 1 progress a turn; every {CULTURE_PROGRESS} is an award worth the current era's points. Progress from a lost wonder race can also become culture. Culture counts toward the score.</p>
        </section>
      </div>

      <h2 className="so-section">
        Wonders <span className="so-stock">Treasury {treasury} · Stock {stock || 'empty'}</span>
      </h2>
      {lost.map((v) => (
        <Redirect key={v.wonder.id} view={v} views={views} place={place} canOrder={canOrder} onRedirect={onRedirect} />
      ))}
      <div className="civ-cards wonder-cards">
        {views.map((v) => (
          <WonderCard key={v.wonder.id} view={v} content={content} developed={developed} turn={turn} me={me} last={last.get(v.wonder.id) ?? null} place={place} who={who} canOrder={canOrder} onStart={onStart} onShow={onShow} />
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
  developed: (advance: string) => boolean;
  turn: number;
  me: string;
  last: string | null;
  place: (area: AreaId) => string;
  who: (player: string) => string;
  canOrder: boolean;
  onStart: (wonder: string, area: AreaId) => void;
  onShow: (area: AreaId) => void;
}

function WonderCard({ view, content, developed, turn, me, last, place, who, canOrder, onStart, onShow }: WonderCardProps) {
  const { wonder, completed, mine } = view;
  const open = view.sites.filter((s) => s.problem === null);
  const [site, setSite] = useState<AreaId | null>(open[0]?.area ?? null);
  const chosen = view.sites.find((s) => s.area === site) ?? null;
  const rivals = view.builders.filter((p) => p !== me);
  const cost = [...wonder.goods.map((g) => goodText(content, g.resource, g.count)), `${wonder.manpower} manpower`].join(', ');
  const total = [...wonder.goods.map((g) => goodText(content, g.resource, g.count * wonder.turns)), `${wonder.manpower * wonder.turns} manpower`].join(', ');
  return (
    <section className={`civ-card wonder-card ${completed ? 'done' : ''}`}>
      <h2>
        {wonder.name} <span className="civ-planned">{view.points} points</span>
      </h2>
      <p className="wonder-effect">{wonder.summary}</p>
      <dl className="civ-facts">
        <dt title="Each advance Developed">Opened by</dt>
        <dd>
          {wonder.requires.map((a) => (
            <span key={a} className={`so-req ${developed(a) ? 'met' : ''}`}>
              {developed(a) ? '✓ ' : ''}
              {content.advances.find((x) => x.id === a)?.name ?? a}
            </span>
          ))}
        </dd>
        <dt title={`Manpower at its settlement, or ${CURRENCY_PER_MANPOWER} currency for each unit missing`}>A turn</dt>
        <dd>{cost}</dd>
        <dt>Turns of work</dt>
        <dd>{wonder.turns}</dd>
        <dt>In all</dt>
        <dd>{total}</dd>
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
          {view.forecast && (
            <p className={`civ-note ${view.forecast.reason ? 'warn' : ''}`}>
              This turn:{' '}
              {view.forecast.worked ? 'will be worked' : view.forecast.reason ? `will stall, ${view.forecast.reason}` : 'first worked next turn'}
            </p>
          )}
          {view.finish !== null && <p className="civ-note">{view.finish === turn ? 'Finishes this turn if it is paid.' : `Finishes turn ${view.finish} if every turn is paid.`}</p>}
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
