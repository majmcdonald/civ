import { useState } from 'react';
import type { AreaId, GameMap } from '../../engine';
import type { MapPieces, SettlementTier } from '../art/pieces';
import { sampleResources } from './samplePieces';

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
  support: number;
  resources: string[];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function summarize(map: GameMap, pieces: MapPieces, civ: number, cap: number) {
  const totals = new Map<AreaId, number>();
  for (const s of pieces.stacks) totals.set(s.area, (totals.get(s.area) ?? 0) + s.count);
  const own = pieces.stacks.filter((s) => s.civ === civ);
  const loose = own.reduce((sum, s) => sum + s.count, 0);

  // Area growth (§4): 1 loose token gains 1, 2 or more gain 2, within the area limit and the cap.
  let growth = 0;
  for (const s of own) {
    const room = map.areas[s.area]!.limit - totals.get(s.area)!;
    growth += Math.max(0, Math.min(s.count >= 2 ? 2 : 1, room));
  }
  growth = Math.min(growth, Math.max(0, cap - loose));

  // Support (§5): each adjacent loose token supports one settlement; larger tiers claim first.
  const spare = new Map(own.map((s) => [s.area, s.count]));
  const settlements = pieces.settlements
    .filter((s) => s.civ === civ)
    .sort((a, b) => TIER[b.tier].value - TIER[a.tier].value || a.area - b.area);
  const rows: SettlementRow[] = settlements.map((s) => {
    const area = map.areas[s.area]!;
    let support = 0;
    for (const n of area.neighbors) {
      const take = Math.min(spare.get(n) ?? 0, TIER[s.tier].support - support);
      if (take <= 0) continue;
      spare.set(n, spare.get(n)! - take);
      support += take;
    }
    const features = area.features.length > 0 ? `, ${area.features.join(', ')}` : '';
    return { area: s.area, tier: s.tier, place: `${capitalize(area.terrain!)}${features}`, support, resources: sampleResources(map, s.area) };
  });

  const settled = rows.reduce((sum, r) => sum + TIER[r.tier].value, 0);
  const manpower = rows.reduce((sum, r) => sum + TIER[r.tier].manpower, 0);
  const urban = rows.reduce((sum, r) => sum + TIER[r.tier].growth, 0);
  return { loose, growth, rows, settled, manpower, urban };
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
        if (e.key === 'Escape') setDraft(null);
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
  onRename: (area: AreaId, name: string) => void;
  onShow: (area: AreaId) => void;
}

export function CivilizationSheet({ map, pieces, civ, color, name, era, turn, cap, names, onRename, onShow }: CivilizationSheetProps) {
  const { loose, growth, rows, settled, manpower, urban } = summarize(map, pieces, civ, cap);
  const counts = (tier: TierId) => rows.filter((r) => r.tier === tier).length;
  const short = rows.filter((r) => r.support < TIER[r.tier].support).length;

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
            <dt title="Area growth: 1 token gains 1, 2 or more gain 2, within area limits and the cap (§4)">Growth next turn</dt>
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
          <p className={`civ-note ${short > 0 ? 'warn' : ''}`}>{short > 0 ? `${short} short of support` : 'All settlements supported'}</p>
        </section>

        <section className="civ-card">
          <h2>Manpower</h2>
          <div className="civ-big" title="Village 1, town 2, plus advance bonuses (§6)">{manpower}</div>
          <ul className="civ-assign">
            {ASSIGNMENTS.map((a, i) => {
              const units = i === 0 ? manpower : 0;
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
              <th title="Resources in the settlement's area; dark ones are being worked, one manpower each (§6). Sample resources until they are designed">Resources</th>
              <th title="Loose tokens in adjacent unsettled areas tied to this settlement, against the tier's need (§5)">Support</th>
              <th title="Units of labor each turn (§6)">Manpower</th>
              <th title="Tokens added to adjacent areas each turn (§5)">Urban growth</th>
              <th title="Local instability meter plus the civ-wide meter (§10)">Stability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = TIER[r.tier];
              const ok = r.support >= t.support;
              const worked = r.resources.slice(0, t.manpower);
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
                      {r.resources.map((res) => (
                        <span key={res} className={`civ-resource ${worked.includes(res) ? 'worked' : ''}`}>
                          {res}
                          {worked.includes(res) && <b>1</b>}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className={ok ? '' : 'warn'} title={ok ? undefined : 'Drops a tier if not supported at resolution'}>
                    {r.support} / {t.support}
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
