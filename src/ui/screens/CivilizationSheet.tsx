import { useEffect, useRef, useState } from 'react';
import { GROWTH_PER_TOKEN, TIERS, type AreaId, type CalamityView, type Counter, type GameMap, type SupportSummary, type SettlementTier as Tier } from '../../engine';
import type { MapPieces, SettlementTier } from '../art/pieces';

// The Civilization screen (design doc §3, Screens and information panels, v0.29): population,
// settlements, support, manpower, calamity risks, and a row per settlement. Instability lives on
// the Society screen; each settlement's meter stays in its row.

const TIER = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<Tier, (typeof TIERS)[number]>;

interface SettlementRow {
  area: AreaId;
  tier: SettlementTier;
  place: string;
  work: { resource: string; count: number }[];
  instability: number;
  threshold: number;
  capital: boolean;
}

export interface WorkOption {
  total: number;
  free: number;
  rows: { resource: string; count: number; usable: boolean }[];
}

const JOB_NAMES: Record<string, string> = { bureaucracy: 'Bureaucracy', highLearning: 'High Learning', artists: 'Artists', wonder: 'Wonder' };
const SPECIALISTS = ['bureaucracy', 'highLearning', 'artists', 'wonder'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A settlement's jobs as chips; dark ones have manpower on them. In allocation each has − and +.
function WorkChips({ area, option, canAssign, rule, onWork }: { area: AreaId; option: WorkOption; canAssign: boolean; rule: (resource: string) => string; onWork: (area: AreaId, resource: string, count: number) => void }) {
  const rows = canAssign ? option.rows : option.rows.filter((r) => r.count > 0 || !SPECIALISTS.includes(r.resource));
  return (
    <span className="civ-resources">
      {rows.length === 0 && '—'}
      {rows.map((r) => {
        const name = JOB_NAMES[r.resource] ?? capitalize(r.resource);
        return (
          <span key={r.resource} className={`civ-resource ${r.count > 0 ? 'worked' : ''} ${r.usable ? '' : 'closed'}`} title={r.usable ? rule(r.resource) : 'Your civilization cannot gather this yet'}>
            {canAssign && (
              <button type="button" aria-label={`Less ${name}`} disabled={r.count === 0} onClick={() => onWork(area, r.resource, r.count - 1)}>
                −
              </button>
            )}
            {name}
            {(canAssign || r.count > 0) && <b>{r.count}</b>}
            {canAssign && (
              <button type="button" aria-label={`More ${name}`} disabled={!r.usable || option.free === 0} onClick={() => onWork(area, r.resource, r.count + 1)}>
                +
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

function summarize(map: GameMap, pieces: MapPieces, civ: number, cap: number) {
  const totals = new Map<AreaId, number>();
  for (const s of pieces.stacks) totals.set(s.area, (totals.get(s.area) ?? 0) + s.count);
  const own = pieces.stacks.filter((s) => s.civ === civ);
  const loose = own.reduce((sum, s) => sum + s.count, 0);

  // Area growth (§4): 0.5 per loose token added to each area's progress; whole tokens arrive within
  // the area limit and the cap.
  let growth = 0;
  for (const s of own) {
    const room = map.areas[s.area]!.limit - totals.get(s.area)!;
    if (room > 0) growth += Math.min(Math.floor((s.growth ?? 0) + s.count * GROWTH_PER_TOKEN), room);
  }
  growth = Math.min(growth, Math.max(0, cap - loose));

  const rows: SettlementRow[] = pieces.settlements
    .filter((s) => s.civ === civ)
    .sort((a, b) => TIER[b.tier].value - TIER[a.tier].value || a.area - b.area)
    .map((s) => {
      const area = map.areas[s.area]!;
      const features = area.features.length > 0 ? `, ${area.features.join(', ')}` : '';
      return { area: s.area, tier: s.tier, place: `${capitalize(area.terrain!)}${features}`, work: s.work ?? [], instability: s.instability ?? 0, threshold: s.threshold ?? 8, capital: Boolean(s.capital) };
    });
  const urban = rows.reduce((sum, r) => sum + TIER[r.tier].urbanGrowth, 0);
  return { loose, growth, rows, urban };
}

function Meter({ value, max, tone = 'ink' }: { value: number; max: number; tone?: 'ink' | 'warn' }) {
  return (
    <div className="civ-meter" role="meter" aria-valuenow={value} aria-valuemax={max}>
      <div className={`civ-meter-fill ${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function TierIcon({ tier, color }: { tier: SettlementTier; color: string }) {
  return (
    <svg className="civ-tier-icon" viewBox="-17 -24 34 32" style={{ color }} aria-hidden="true">
      <use href={`#piece-${tier}`} />
    </svg>
  );
}

// Click to name or rename; Enter or leaving the field saves, Escape cancels.
function SettlementName({ name, onRename }: { name: string | undefined; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null) {
    return (
      <button type="button" className={`civ-name ${name ? '' : 'unnamed'}`} title="Click to name this settlement" onClick={() => setDraft(name ?? '')}>
        {name ?? 'Unnamed'}
      </button>
    );
  }
  const save = () => {
    onRename(draft.trim());
    setDraft(null);
  };
  return (
    <input
      className="civ-name-input"
      autoFocus
      maxLength={32}
      value={draft}
      placeholder="Name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        // Escape cancels the edit without also closing the screen.
        if (e.key === 'Escape') {
          e.stopPropagation();
          setDraft(null);
        }
      }}
    />
  );
}

interface CivilizationSheetProps {
  map: GameMap;
  pieces: MapPieces;
  civ: number;
  color: string;
  name: string;
  era: string;
  turn: number;
  cap: number;
  names: ReadonlyMap<AreaId, string>;
  // Settlement tiers the civilization can build, and what unlocks each locked one.
  unlocked: readonly Tier[];
  // The advance that unlocks a tier, or null if a later era's does.
  unlockedBy: (tier: Tier) => string | null;
  // Support at this turn's check, with the player's planned moves and settlements (engine).
  support: SupportSummary;
  // Whether moves or settlements are planned this turn, so the numbers include them.
  planned: boolean;
  // The civ-wide instability meter, added to each settlement's own (design doc §10).
  civInstability: number;
  // A settlement's manpower jobs (design doc §6): its revealed goods and the specialist jobs.
  work: (area: AreaId) => WorkOption | null;
  // One line on what a unit of each job gives.
  jobRule: (resource: string) => string;
  goodName: (resource: string) => string;
  // Goods worked from a settlement's terrain, and its wonder, for its row.
  siteNotes: (area: AreaId) => string[];
  // Manpower is assigned in the allocation phase.
  canAssign: boolean;
  onWork: (area: AreaId, resource: string, count: number) => void;
  // A settlement to highlight and scroll to, e.g. one double-clicked on the map.
  focus?: AreaId | null;
  onRename: (area: AreaId, name: string) => void;
  onShow: (area: AreaId) => void;
  // Calamity chance, risks, and buy-off marks (engine, design doc §12), and each one's effect.
  calamities: CalamityView;
  calamityEffect: (calamity: string) => string;
  treasury: number;
  onBuyOff: (calamities: string[]) => void;
  onRules: () => void;
}

export function CivilizationSheet(props: CivilizationSheetProps) {
  const { map, pieces, civ, color, name, era, turn, cap, names, unlocked, unlockedBy, support, planned, civInstability, work, jobRule, goodName, siteNotes, canAssign, onWork, focus = null, onRename, onShow, calamities, calamityEffect, treasury, onBuyOff, onRules } = props;
  const focused = useRef<HTMLTableRowElement>(null);
  useEffect(() => focused.current?.scrollIntoView({ block: 'center' }), [focus]);
  const { loose, growth, rows, urban } = summarize(map, pieces, civ, cap);
  const gap = (r: SettlementRow) => r.threshold - r.instability - civInstability;
  const counts = (tier: Tier) => rows.filter((r) => r.tier === tier).length;
  const supportOf = (area: AreaId) => support.settlements.find((s) => s.area === area)?.support ?? 0;
  const foodOf = (area: AreaId) => support.settlements.find((s) => s.area === area)?.food ?? 0;
  const fed = support.settlements.reduce((sum, s) => sum + s.food, 0);
  const urbanNext = urban + support.settlements.filter((s) => s.ateOwn).length;
  const short = support.settlements.filter((s) => s.support < s.needed);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const risksOf = (area: AreaId) => calamities.settlements.find((s) => s.area === area)?.risks ?? [];
  const exposed = calamities.settlements.flatMap((s) => s.risks.filter((r) => r.level !== 'low').map((r) => ({ area: s.area, ...r })));
  const marked = calamities.buyOff.filter((b) => b.marked).map((b) => b.calamity);
  const label = (area: AreaId) => {
    const s = support.settlements.find((x) => x.area === area)!;
    return `${names.get(area) ?? 'Unnamed'} – ${TIER[s.tier].name}`;
  };

  // Manpower by job, from each settlement's work options (engine manpower, wonders included).
  const options = rows.map((r) => work(r.area)).filter((o): o is WorkOption => o !== null);
  const manpower = options.reduce((sum, o) => sum + o.total, 0);
  const on = (job: string) => rows.reduce((sum, r) => sum + r.work.reduce((n, w) => (w.resource === job ? n + w.count : n), 0), 0);
  const produced = new Map<string, number>();
  for (const r of rows) for (const w of r.work) if (!SPECIALISTS.includes(w.resource) && w.count > 0) produced.set(w.resource, (produced.get(w.resource) ?? 0) + w.count);
  const production = [...produced.values()].reduce((a, b) => a + b, 0);
  const unassigned = options.reduce((sum, o) => sum + o.free, 0);
  const jobs = [
    { job: 'production', name: 'Production', units: production, detail: [...produced].map(([g, n]) => `${goodName(g)} ${n}`).join(', ') },
    ...SPECIALISTS.map((job) => ({ job, name: JOB_NAMES[job]!, units: on(job), detail: '' })),
  ];

  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <span className="game-civ" style={{ background: color }} aria-hidden="true" />
        <h1>{name}</h1>
        <p>
          {era} · Turn {turn}
        </p>
      </header>

      <div className="civ-cards">
        <section className="civ-card">
          <h2>Population</h2>
          <div className="civ-big" title="Loose tokens count against the cap; tokens in settlements do not (§4)">
            {loose}
            <span> / {cap}</span>
          </div>
          <Meter value={loose} max={cap} tone={loose >= cap ? 'warn' : 'ink'} />
          <dl className="civ-facts">
            <dt>Next turn</dt>
            <dd>
              +{growth + urbanNext} ({growth} area, {urbanNext} urban)
            </dd>
            <dt>Below the cap</dt>
            <dd>{Math.max(0, cap - loose)}</dd>
          </dl>
          <p className="civ-rule">Each loose token adds ½ a token a turn, within its area's limit and the cap. Towns and larger add urban growth by tier, plus 1 for a settlement that eats its own food.</p>
        </section>

        <section className="civ-card civ-card-wide">
          <h2>Settlements</h2>
          <table className="civ-tiers">
            <thead>
              <tr>
                <th>Tier</th>
                <th title="Your settlements of this tier">Yours</th>
                <th title="Tokens to found a village, and tokens added to upgrade to each larger tier">Built from</th>
                <th title="Loose tokens (or food) it needs in adjacent unsettled areas">Support</th>
                <th>Manpower</th>
                <th title="Currency a turn">Tax</th>
                <th title="Instability (local plus civ-wide) at which it collapses one tier, before distance from the capital">Collapses</th>
                <th title="Settlement points toward the era gates and the score">Points</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t, i) => {
                const locked = !unlocked.includes(t.id);
                return (
                  <tr key={t.id} className={locked ? 'locked' : ''}>
                    <td>{t.name}</td>
                    <td className="civ-tier-count">
                      {!locked ? (
                        counts(t.id)
                      ) : unlockedBy(t.id) ? (
                        <>
                          Locked<small>{unlockedBy(t.id)}</small>
                        </>
                      ) : (
                        'Later era'
                      )}
                    </td>
                    <td>{i === 0 ? t.value : `+${t.value - TIERS[i - 1]!.value}`}</td>
                    <td>{t.support}</td>
                    <td>{t.manpower}</td>
                    <td>{t.tax}</td>
                    <td>{t.threshold}</td>
                    <td>{i + 1}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="civ-card">
          <h2 title={planned ? 'At the end of this turn, with your planned moves and settlements' : 'At the end of this turn'}>Support{planned && <span className="civ-planned"> · with plans</span>}</h2>
          <div className="civ-big">
            {support.supplied}
            <span> / {support.needed} needed</span>
          </div>
          <Meter value={support.supplied} max={Math.max(1, support.needed)} tone={short.length > 0 ? 'warn' : 'ink'} />
          <dl className="civ-facts">
            {fed > 0 && (
              <>
                <dt>From food</dt>
                <dd>{fed}</dd>
              </>
            )}
            <dt title="Loose tokens not supporting any settlement: free to found or upgrade settlements">Free tokens</dt>
            <dd>{support.free}</dd>
            <dt title="Unsettled areas with at least 8 free tokens in or next to them: 6 to found a village and 2 to support it">Village sites</dt>
            <dd>{support.villageSites.length}</dd>
          </dl>
          {short.length > 0 && (
            <ul className="civ-warnings">
              {short.map((s) => (
                <li key={s.area}>
                  {label(s.area)}: {s.support} of {s.needed} — will {s.tier === 'village' ? 'dissolve' : 'drop a tier'}
                </li>
              ))}
            </ul>
          )}
          <p className="civ-rule">Each settlement needs loose tokens in adjacent unsettled areas (village 2, town 3). Food stands in, 1 per missing token, from its own area or one step away, then food bought on the market.</p>
        </section>

        <section className="civ-card">
          <h2>Manpower</h2>
          <div className="civ-big" title="Village 1, town 2, plus wonders that add manpower (§6, §9)">{manpower}</div>
          <table className="civ-jobs">
            <tbody>
              {jobs.map((j) => (
                <tr key={j.job}>
                  <td>{j.name}</td>
                  <td className="civ-num">{j.units}</td>
                  <td>{j.job === 'production' ? j.detail || 'Gathers 1 of a good a turn' : jobRule(j.job)}</td>
                </tr>
              ))}
              <tr className={unassigned > 0 ? 'warn' : ''}>
                <td>Unassigned</td>
                <td className="civ-num">{unassigned}</td>
                <td>{unassigned > 0 ? 'Produces nothing' : ''}</td>
              </tr>
            </tbody>
          </table>
          <p className="civ-rule">Production gathers 1 of a good a turn. Changes made in allocation take effect next turn.</p>
        </section>

        <section className="civ-card">
          <h2>Calamities</h2>
          <div className="civ-big">
            {pct(calamities.chance)}
            <span> this turn</span>
          </div>
          <p className="civ-rule">1% per settlement tier point, +5% for each quiet turn in a row; it falls back when one strikes.</p>
          <ul className="civ-buyoff" title="When a marked calamity strikes and the treasury holds the cost, it is paid and the calamity averted; the chance still falls back (§12)">
            {calamities.buyOff.map((b) => (
              <li key={b.calamity}>
                <label title={b.available ? undefined : 'Needs Barter Developed: food bought in'}>
                  <input
                    type="checkbox"
                    checked={b.marked}
                    disabled={!canAssign}
                    onChange={(e) => onBuyOff(e.target.checked ? [...marked, b.calamity] : marked.filter((c) => c !== b.calamity))}
                  />
                  Buy off {b.name.toLowerCase()} ({b.cost}){!b.available && ' — needs Barter'}
                </label>
                <small>{calamityEffect(b.calamity)}</small>
              </li>
            ))}
          </ul>
          {calamities.buyOff.some((b) => b.marked && b.available && b.cost > treasury) && <p className="civ-note warn">Treasury {treasury}: too little to buy off a marked calamity</p>}
          {exposed.length > 0 ? (
            <ul className="civ-warnings">
              {exposed.map((r) => (
                <li key={`${r.area}-${r.calamity}`} title={`${r.reasons.join('; ')} · ${pct(r.share)} of strikes · ${countersText(r.counters)}`}>
                  {names.get(r.area) ?? 'Unnamed'}: {r.name.toLowerCase()} risk {r.level}
                </li>
              ))}
            </ul>
          ) : (
            <p className="civ-note">{rows.length > 0 ? 'No settlement at medium or high risk' : 'No settlements, no calamities'}</p>
          )}
          <button type="button" className="civ-link" onClick={onRules}>
            Every calamity: what it does, what makes it likely, what softens it
          </button>
        </section>
      </div>

      <section className="civ-table-wrap">
        <h2>Settlements</h2>
        <table className="civ-table">
          <thead>
            <tr>
              <th>Settlement</th>
              <th title="Jobs for the settlement's manpower: the goods in its area and the specialist jobs; dark ones have manpower on them (§6). Assigned in the Allocation phase; changes take effect next turn">Work</th>
              <th title="Loose tokens in adjacent unsettled areas, plus food standing in for missing tokens, at the end of this turn, against the tier's need (§5, §6)">Support</th>
              <th title="Manpower assigned to jobs, of the settlement's total; idle manpower produces nothing (§6)">Manpower</th>
              <th title="Local instability meter plus the civ-wide meter, against the threshold at which it collapses (§10)">Instability</th>
              <th title="The calamity it is most exposed to; hover for every risk and its reasons (§12)">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="civ-empty">
                  No settlements yet. Six tokens in or next to one area can found a village.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const t = TIER[r.tier];
              const ok = supportOf(r.area) >= t.support;
              const option = work(r.area);
              return (
                <tr key={r.area} ref={r.area === focus ? focused : undefined} className={r.area === focus ? 'civ-focused' : undefined}>
                  <td>
                    <span className="civ-place">
                      <button type="button" className="civ-show" title="Show on the map" onClick={() => onShow(r.area)}>
                        <TierIcon tier={r.tier} color={color} />
                      </button>
                      <span>
                        <span className="civ-title">
                          <SettlementName name={names.get(r.area)} onRename={(n) => onRename(r.area, n)} />
                          <span className="civ-tier">
                            {' '}
                            – {t.name}
                            {r.capital && ', capital'}
                          </span>
                        </span>
                        <small>{[r.place, ...siteNotes(r.area)].join(' · ')}</small>
                      </span>
                    </span>
                  </td>
                  <td>{option && <WorkChips area={r.area} option={option} canAssign={canAssign} rule={jobRule} onWork={onWork} />}</td>
                  <td className={ok ? '' : 'warn'} title={ok ? undefined : 'Drops a tier if not supported at resolution'}>
                    {supportOf(r.area)} / {t.support}
                    {foodOf(r.area) > 0 && <small title="Covered by food"> ({foodOf(r.area)} food)</small>}
                  </td>
                  <td className={option && option.free > 0 ? 'warn' : ''} title={option && option.free > 0 ? `${option.free} idle` : undefined}>
                    {option ? `${option.total - option.free} of ${option.total}` : t.manpower}
                  </td>
                  <td className={gap(r) <= 2 ? 'warn' : ''} title={`Local ${r.instability} + civ-wide ${civInstability}; collapses at ${r.threshold}, lower far from the capital`}>
                    {r.instability + civInstability} / {r.threshold}
                  </td>
                  <RiskCell risks={risksOf(r.area)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RiskCell({ risks }: { risks: CalamityView['settlements'][number]['risks'] }) {
  const top = [...risks].sort((a, b) => b.weight - a.weight)[0];
  if (!top) return <td>—</td>;
  const title = risks.map((r) => `${r.name}: ${r.level} (${r.reasons.join('; ')}) · ${countersText(r.counters)}`).join('\n');
  return (
    <td className={top.level === 'high' ? 'warn' : ''} title={title}>
      {top.name} · {top.level}
    </td>
  );
}

// Which advances soften a calamity here, those in force and those not yet reached (§12).
function countersText(counters: Counter[]): string {
  if (counters.length === 0) return 'nothing softens it yet';
  const label = (c: Counter) => `${c.name}${c.stage === 'mastered' ? ' Mastered' : ''} ${c.effect === 'halves' ? 'halves it' : 'keeps the tier'}`;
  const met = counters.filter((c) => c.met).map(label);
  const not = counters.filter((c) => !c.met).map((c) => `${label(c)} (not yet ${c.stage === 'mastered' ? 'Mastered' : 'Developed'})`);
  return [...met, ...not].join(', ');
}
