import { useState } from 'react';
import { GROWTH_PER_TOKEN, type AreaId, type GameMap, type SupportSummary } from '../../engine';
import type { MapPieces, SettlementTier } from '../art/pieces';

// Civilization overview (design doc §4, §5, §6, §10). Values come from the pieces on the map; the
// tier numbers are the doc's starting values until the engine owns them.

const TIERS = [
  { id: 'village', name: 'Village', value: 6, support: 2, manpower: 1, growth: 0 },
  { id: 'town', name: 'Town', value: 12, support: 3, manpower: 2, growth: 1 },
  { id: 'city', name: 'City', value: 20, support: 4, manpower: 3, growth: 2 },
  { id: 'metropolis', name: 'Metropolis', value: 30, support: 6, manpower: 4, growth: 3 },
] as const;
type TierId = (typeof TIERS)[number]['id'];
const TIER = Object.fromEntries(TIERS.map((t) => [t.id, t])) as Record<TierId, (typeof TIERS)[number]>;
const UNLOCKED: readonly TierId[] = ['village', 'town'] satisfies SettlementTier[];

const ASSIGNMENTS = ['Production', 'Bureaucracy', 'High Learning', 'Artists', 'Wonders'] as const;

interface SettlementRow {
  area: AreaId;
  tier: SettlementTier;
  place: string;
  resources: string[];
  work: { resource: string; count: number }[];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  const settlements = pieces.settlements
    .filter((s) => s.civ === civ)
    .sort((a, b) => TIER[b.tier].value - TIER[a.tier].value || a.area - b.area);
  const rows: SettlementRow[] = settlements.map((s) => {
    const area = map.areas[s.area]!;
    const features = area.features.length > 0 ? `, ${area.features.join(', ')}` : '';
    return { area: s.area, tier: s.tier, place: `${capitalize(area.terrain!)}${features}`, resources: area.resources, work: s.work ?? [] };
  });

  const settled = rows.reduce((sum, r) => sum + TIER[r.tier].value, 0);
  const manpower = rows.reduce((sum, r) => sum + TIER[r.tier].manpower, 0);
  const working = rows.reduce((sum, r) => sum + r.work.reduce((n, w) => n + w.count, 0), 0);
  const urban = rows.reduce((sum, r) => sum + TIER[r.tier].growth, 0);
  return { loose, growth, rows, settled, manpower, working, urban };
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
  // Support at this turn's check, with the player's planned moves and settlements (engine).
  support: SupportSummary;
  // Whether moves or settlements are planned this turn, so the numbers include them.
  planned: boolean;
  onRename: (area: AreaId, name: string) => void;
  onShow: (area: AreaId) => void;
}

export function CivilizationSheet({ map, pieces, civ, color, name, era, turn, cap, names, support, planned, onRename, onShow }: CivilizationSheetProps) {
  const { loose, growth, rows, settled, manpower, working, urban } = summarize(map, pieces, civ, cap);
  const counts = (tier: TierId) => rows.filter((r) => r.tier === tier).length;
  const supportOf = (area: AreaId) => support.settlements.find((s) => s.area === area)?.support ?? 0;
  const foodOf = (area: AreaId) => support.settlements.find((s) => s.area === area)?.food ?? 0;
  const fed = support.settlements.reduce((sum, s) => sum + s.food, 0);
  const short = support.settlements.filter((s) => s.support < s.needed);
  const label = (area: AreaId) => {
    const s = support.settlements.find((x) => x.area === area)!;
    return `${names.get(area) ?? 'Unnamed'} – ${TIER[s.tier as TierId].name}`;
  };

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
            <dt title="Area growth: 0.5 per token, carried over until it makes a whole token, within area limits and the cap (§4)">Growth next turn</dt>
            <dd>+{growth}</dd>
            <dt title="Urban growth from towns and larger (§5)">Urban growth</dt>
            <dd>+{urban}</dd>
            <dt title="Token value of all settlements; outside the cap (§5)">In settlements</dt>
            <dd>{settled}</dd>
          </dl>
        </section>

        <section className="civ-card">
          <h2>Settlements</h2>
          <ul className="civ-pyramid">
            {[...TIERS].reverse().map((t) => {
              const locked = !UNLOCKED.includes(t.id);
              return (
                <li key={t.id} className={locked ? 'locked' : ''} title={locked ? 'Unlocked by a later advance (§5)' : `Built from ${t.id === 'village' ? '6 tokens' : `the tier below + ${t.value - TIERS[TIERS.indexOf(t) - 1]!.value} tokens`}`}>
                  <span className="civ-pyramid-name">{t.name}</span>
                  <span className="civ-pyramid-count">{locked ? 'Locked' : counts(t.id)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="civ-card">
          <h2 title={planned ? 'At the end of this turn, with your planned moves and settlements' : 'At the end of this turn'}>Support{planned && <span className="civ-planned"> · with plans</span>}</h2>
          <div className="civ-big" title="Support your settlements get from tokens and food, against what they need: village 2, town 3 (§5, §6)">
            {support.supplied}
            <span> / {support.needed} needed</span>
          </div>
          <Meter value={support.supplied} max={Math.max(1, support.needed)} tone={short.length > 0 ? 'warn' : 'ink'} />
          <dl className="civ-facts">
            {fed > 0 && (
              <>
                <dt title="Support covered by food gathered this turn, 1 food per missing token (§6)">From food</dt>
                <dd>{fed}</dd>
              </>
            )}
            <dt title="Loose tokens not supporting any settlement: free to found or upgrade settlements">Free tokens</dt>
            <dd>{support.free}</dd>
            <dt title="Unsettled areas with at least 8 free tokens in or next to them: 6 to found a village and 2 to support it">Village sites</dt>
            <dd>{support.villageSites.length}</dd>
          </dl>
          {short.length > 0 ? (
            <ul className="civ-warnings">
              {short.map((s) => (
                <li key={s.area}>
                  {label(s.area)}: {s.support} of {s.needed} — will {s.tier === 'village' ? 'dissolve' : 'drop a tier'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="civ-note">
              {support.settlements.length > 0 ? 'All settlements supported' : support.villageSites.length > 0 ? 'Enough free tokens to found a village' : 'A village needs 8 tokens in or next to one area'}
            </p>
          )}
        </section>

        <section className="civ-card">
          <h2>Manpower</h2>
          <div className="civ-big" title="Village 1, town 2, plus advance bonuses (§6)">{manpower}</div>
          <ul className="civ-assign">
            {[...ASSIGNMENTS, 'Unassigned'].map((a, i) => {
              const units = i === 0 ? working : a === 'Unassigned' ? manpower - working : 0;
              return (
                <li key={a}>
                  <span>{a}</span>
                  <Meter value={units} max={Math.max(1, manpower)} />
                  <span className="civ-num">{units}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="civ-card">
          <h2>Stability</h2>
          <dl className="civ-facts">
            <dt title="Adds to every settlement's local meter (§10)">Civ-wide meter</dt>
            <dd>0</dd>
            <dt title="The settlement closest to collapse">Highest local</dt>
            <dd>0</dd>
          </dl>
          <Meter value={0} max={10} />
          <p className="civ-note">No unrest</p>
        </section>
      </div>

      <section className="civ-table-wrap">
        <h2>Settlements</h2>
        <table className="civ-table">
          <thead>
            <tr>
              <th>Settlement</th>
              <th title="Resources in the settlement's area; dark ones are being worked, with the manpower on each (§6). Assign manpower by selecting the settlement on the map">Resources</th>
              <th title="Loose tokens in adjacent unsettled areas, plus food standing in for missing tokens, at the end of this turn, against the tier's need (§5, §6)">Support</th>
              <th title="Units of labor each turn (§6)">Manpower</th>
              <th title="Tokens added to adjacent areas each turn (§5)">Urban growth</th>
              <th title="Local instability meter plus the civ-wide meter (§10)">Stability</th>
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
              const workedOn = (res: string) => r.work.find((w) => w.resource === res)?.count ?? 0;
              return (
                <tr key={r.area}>
                  <td>
                    <span className="civ-place">
                      <button type="button" className="civ-show" title="Show on the map" onClick={() => onShow(r.area)}>
                        <TierIcon tier={r.tier} color={color} />
                      </button>
                      <span>
                        <span className="civ-title">
                          <SettlementName name={names.get(r.area)} onRename={(n) => onRename(r.area, n)} />
                          <span className="civ-tier"> – {t.name}</span>
                        </span>
                        <small>{r.place}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="civ-resources">
                      {r.resources.length === 0 && '—'}
                      {r.resources.map((res) => (
                        <span key={res} className={`civ-resource ${workedOn(res) > 0 ? 'worked' : ''}`}>
                          {res}
                          {workedOn(res) > 0 && <b>{workedOn(res)}</b>}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className={ok ? '' : 'warn'} title={ok ? undefined : 'Drops a tier if not supported at resolution'}>
                    {supportOf(r.area)} / {t.support}
                    {foodOf(r.area) > 0 && <small title="Covered by food"> ({foodOf(r.area)} food)</small>}
                  </td>
                  <td>{t.manpower}</td>
                  <td>{t.growth > 0 ? `+${t.growth}` : '—'}</td>
                  <td>
                    <Meter value={0} max={10} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
