import { tierRules, type AreaId, type ConflictEvent, type Content, type GameEvent, type InstabilitySource, type Phase } from '../../engine';

// Turn reports (design doc §3, Resolution reports): what happened to the player, as lines that can
// point at a place on the map. Notable lines are what Brief flashes and Normal lists; Detailed and
// the Chronicle list routine events too.

export type ReportMode = 'brief' | 'normal' | 'detailed';
export const REPORT_MODES: readonly ReportMode[] = ['brief', 'normal', 'detailed'];
export const REPORT_MODE_NAMES: Record<ReportMode, string> = { brief: 'Brief', normal: 'Normal', detailed: 'Detailed' };

const MODE_KEY = 'succession.reportMode';

export function loadReportMode(): ReportMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return REPORT_MODES.includes(saved as ReportMode) ? (saved as ReportMode) : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveReportMode(mode: ReportMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // The choice simply is not remembered.
  }
}

export const SOURCE_NAMES: Record<InstabilitySource, string> = {
  overextension: 'overextension',
  losses: 'settlements lost',
  lostSupport: 'lost support',
  conflict: 'nearby fight',
  bureaucracy: 'Bureaucracy',
  calm: 'advances (Ritual)',
  luxury: 'luxuries',
  noSettlements: 'no settlements left',
  calamity: 'calamity',
};

const PHASE_NAMES: Record<Phase, string> = { resources: 'Resources', trade: 'Trade', allocation: 'Allocation', resolution: 'Resolution' };

export interface ReportEvent {
  turn: number;
  phase: Phase;
  event: GameEvent;
}

export interface ReportLine {
  text: string;
  area: AreaId | null;
  notable: boolean;
  turn: number;
  phase: Phase;
}

export interface ReportNames {
  me: string;
  content: Content;
  place: (area: AreaId) => string;
  // The player's view of a fight, or null if not involved.
  conflict: (e: ConflictEvent) => string | null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function calamityText(e: Extract<GameEvent, { type: 'calamity' }>, place: (area: AreaId) => string, name: string): string {
  if (e.averted) return `${name} at ${place(e.area)} bought off for ${e.paid}`;
  const parts = [e.from ? `${name} spreads to ${place(e.area)}` : `${name} at ${place(e.area)}`];
  if (e.tokens > 0) parts.push(`${plural(e.tokens, 'token')} lost`);
  if (e.dropped) parts.push('the settlement drops a tier');
  return parts.join(' · ');
}

// Every line for the player from these events, in order.
export function buildReport(events: readonly ReportEvent[], names: ReportNames): ReportLine[] {
  const { me, content, place } = names;
  const advance = (id: string) => content.advances.find((a) => a.id === id);
  const resource = (id: string) => (content.resources.find((r) => r.id === id)?.name ?? id).toLowerCase();
  // A collapse or calamity is reported as such, not as the tier drop it causes.
  const explained = new Set(events.flatMap(({ event: e }) => (e.type === 'settlementCollapsed' || (e.type === 'calamity' && e.dropped) ? [`${e.area}`] : [])));
  const lines: ReportLine[] = [];
  for (const { turn, phase, event: e } of events) {
    const add = (text: string, area: AreaId | null, notable: boolean) => lines.push({ text, area, notable, turn, phase });
    if (e.type === 'conflict' || e.type === 'settlementAttacked') {
      const text = names.conflict(e);
      if (text) add(text, e.area, true);
      continue;
    }
    if (!('player' in e) || e.player !== me) continue;
    switch (e.type) {
      case 'settlementBuilt':
        add(`${tierRules(e.tier).name} ${e.tier === 'village' ? 'founded' : 'built'} at ${place(e.area)}`, e.area, true);
        break;
      case 'conversionFailed':
        add(`Not built at ${place(e.area)}: ${e.reason}`, e.area, true);
        break;
      case 'settlementCollapsed':
        add(`${place(e.area)}: a ${e.tier} collapsed in unrest`, e.area, true);
        break;
      case 'settlementDropped':
        if (explained.has(`${e.area}`)) break;
        add(e.tier ? `${place(e.area)} dropped to a ${e.tier} for lack of support` : `${place(e.area)}: a village dissolved for lack of support`, e.area, true);
        break;
      case 'capitalMoved':
        if (e.area !== null) add(`Capital: ${place(e.area)}`, e.area, true);
        break;
      case 'studyQueueEmpty':
        add(`Study queue empty: ${Math.round(e.learning * 10) / 10} learning split evenly`, null, true);
        break;
      case 'advanceReached': {
        // An advance with no adoption is Mastered when Developed; only Developed is reported.
        if (e.stage === 'mastered' && !advance(e.advance)?.adoption) break;
        add(`${advance(e.advance)?.name ?? e.advance} is ${e.stage === 'known' ? 'Known' : e.stage === 'developed' ? 'Developed' : 'Mastered'}`, null, true);
        break;
      }
      case 'foodSupport':
        add(`Food stood in for ${plural(e.count, 'support token')} at ${place(e.area)}`, e.area, true);
        break;
      case 'calamity':
        add(calamityText(e, place, content.calamities.find((c) => c.id === e.calamity)?.name ?? e.calamity), e.area, true);
        break;
      case 'marketTrade':
        add(`${e.side === 'buy' ? 'Bought' : 'Sold'} ${e.count} ${resource(e.resource)} at ${e.price}`, null, true);
        break;
      case 'tokensMoved':
        add(`Moved ${plural(e.count, 'token')}: ${place(e.from)} → ${place(e.to)}`, e.to, false);
        break;
      case 'tokensGrew':
        add(`Area growth: +${plural(e.count, 'token')}`, null, false);
        break;
      case 'urbanGrowth':
        add(`Urban growth: +${plural(e.count, 'token')} from ${place(e.from)} to ${place(e.to)}`, e.to, false);
        break;
      case 'surplusRemoved':
        add(`${plural(e.count, 'token')} over the limit removed at ${place(e.area)}`, e.area, false);
        break;
      case 'overCapRemoved':
        add(`${plural(e.count, 'token')} over the token cap removed`, null, false);
        break;
      case 'goodsProduced':
        add(`Gathered ${e.count} ${resource(e.resource)} at ${place(e.area)}`, e.area, false);
        break;
      case 'taxCollected':
        add(`Tax: +${e.amount} currency`, null, false);
        break;
      case 'priceChanged':
        add(`${resource(e.resource).replace(/^./, (c) => c.toUpperCase())} price ${Math.round(e.from)} → ${Math.round(e.to)} (${e.imbalance > 0 ? `${e.imbalance} more bought than sold` : `${-e.imbalance} more sold than bought`})`, null, false);
        break;
      case 'instabilityChanged':
        add(`${e.amount > 0 ? '+' : '−'}${Math.abs(e.amount)} instability ${e.area === null ? 'civ-wide' : `at ${place(e.area)}`} (${SOURCE_NAMES[e.source]})`, e.area, false);
        break;
    }
  }
  return lines;
}

interface ReportPageProps {
  title: string;
  lines: ReportLine[];
  detailed: boolean;
  onJump: (area: AreaId) => void;
  onClose: () => void;
  closeLabel?: string;
}

// The report as a page: lines grouped by turn and phase; a line with a place jumps to it on the map.
export function ReportPage({ title, lines, detailed, onJump, onClose, closeLabel = 'Continue' }: ReportPageProps) {
  const shown = detailed ? lines : lines.filter((l) => l.notable);
  const groups: { key: string; label: string; lines: ReportLine[] }[] = [];
  for (const line of shown) {
    const key = `${line.turn}-${line.phase}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.lines.push(line);
    else groups.push({ key, label: `Turn ${line.turn} · ${PHASE_NAMES[line.phase]}`, lines: [line] });
  }
  return (
    <div className="civ-sheet report-page">
      <header className="civ-head">
        <h1>{title}</h1>
        <p>{detailed ? 'Every event' : 'What happened'}</p>
      </header>
      {groups.length === 0 && <p className="civ-note">Nothing happened to your civilization.</p>}
      {groups.map((g) => (
        <section key={g.key} className="report-group">
          <h2>{g.label}</h2>
          <ul>
            {g.lines.map((l, i) => (
              <li key={i} className={l.notable ? 'notable' : ''}>
                {l.area === null ? (
                  l.text
                ) : (
                  <button type="button" onClick={() => onJump(l.area!)} title="Show on the map">
                    {l.text}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" className="report-close" onClick={onClose} autoFocus>
        {closeLabel}
      </button>
    </div>
  );
}

interface ChronicleProps {
  events: readonly ReportEvent[];
  names: ReportNames;
  currentTurn: number;
  onOpen: (turn: number) => void;
}

// The Chronicle (design doc §3): every past turn, newest first; a turn opens its detailed report.
export function Chronicle({ events, names, currentTurn, onOpen }: ChronicleProps) {
  const lines = buildReport(events, names);
  const turns = [...new Set(events.map((e) => e.turn))].filter((t) => t < currentTurn || lines.some((l) => l.turn === t)).sort((a, b) => b - a);
  return (
    <div className="civ-sheet">
      <header className="civ-head">
        <h1>Chronicle</h1>
        <p>Turn {currentTurn}</p>
      </header>
      {turns.length === 0 ? (
        <p className="civ-note">No turns recorded yet.</p>
      ) : (
        <ul className="chronicle-turns">
          {turns.map((t) => {
            const mine = lines.filter((l) => l.turn === t);
            const notable = mine.filter((l) => l.notable);
            return (
              <li key={t}>
                <button type="button" onClick={() => onOpen(t)}>
                  <strong>Turn {t}</strong>
                  <span>{notable.length > 0 ? notable.slice(0, 3).map((l) => l.text).join(' · ') + (notable.length > 3 ? ` · +${notable.length - 3} more` : '') : 'Nothing notable'}</span>
                  <small>{plural(mine.length, 'event')}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
