import type { Condition, DomainId, Effect, Input } from '../../content/types';
import type { AdvanceView, Content, ProgressPart } from '../../engine';

// Knowledge (design doc §8): the whole advance tree by domain, each advance's stage, progress, and
// the sources of its rate; the discovery focus. Every number shows where it comes from.

const DOMAIN_NAMES: Record<DomainId, string> = {
  land: 'Land and food',
  crafts: 'Crafts',
  beliefs: 'Beliefs and society',
  travel: 'Travel and trade',
  war: 'War',
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function number(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

interface Names {
  advance: (id: string) => string;
  resource: (id: string) => string;
}

function where(filter: { resource?: string; terrain?: string; feature?: string; full?: boolean } | undefined, names: Names): string {
  if (!filter) return '';
  const parts = [filter.full ? 'at its limit' : '', filter.terrain ?? '', filter.feature ? `with ${filter.feature}` : '', filter.resource ? `with ${names.resource(filter.resource).toLowerCase()}` : ''];
  return parts.filter(Boolean).join(', ');
}

function describeInput(input: Input, names: Names): string {
  switch (input.per) {
    case 'turn':
      return 'each turn';
    case 'area':
      return `per area you hold${input.where ? ` ${where(input.where, names)}` : ''}`;
    case 'settlement':
      return `per ${input.tier ?? 'settlement'}${input.where ? ` ${where(input.where, names)}` : ''}`;
    case 'worker':
      return `per manpower working ${names.resource(input.resource).toLowerCase()}`;
  }
}

function describePart(part: ProgressPart, names: Names): string {
  if (part.input === 'highLearning') return `+${number(part.value)} from High Learning`;
  if (part.input.per === 'turn') return `+${number(part.value)} each turn`;
  return `+${number(part.value)}: ${number(part.input.amount)} ${describeInput(part.input, names)} (${part.count})`;
}

function describeCondition(condition: Condition, names: Names): string {
  switch (condition.type) {
    case 'knows':
      return `${names.advance(condition.advance)} ${condition.stage}`;
    case 'presence':
      return `${condition.min && condition.min > 1 ? `${condition.min} areas` : 'An area'} held ${where(condition.where, names)}`.trim();
    case 'settlements':
      return `${plural(condition.min, condition.tier ?? 'settlement')}`;
  }
}

function describeEffect(effect: Effect): string {
  switch (effect.type) {
    case 'unlockTier':
      return `Unlocks ${effect.tier === 'city' ? 'cities' : `${effect.tier}s`}`;
    case 'raiseTokenCap':
      return `Token cap +${effect.amount}`;
    case 'raiseAreaLimit':
      return `Area limits +${effect.amount}`;
    case 'hook':
      return 'Special rule';
  }
}

function stageText(view: AdvanceView): string {
  if (view.stage === 'developed') return view.adoption >= 100 ? 'Mastered' : `Developed · ${number(view.adoption)}% adopted`;
  if (view.stage === 'known') return 'Known';
  return view.plausible ? 'In progress' : 'Not yet plausible';
}

function AdvanceCard({ view, content, names }: { view: AdvanceView; content: Content; names: Names }) {
  const { advance } = view;
  const reveals = content.resources.filter((r) => r.requires === advance.id);
  const effects = [
    ...reveals.map((r) => `Known: reveals ${r.name.toLowerCase()} · Developed: ${r.name.toLowerCase()} can be gathered`),
    ...advance.effects.map((e) => `Developed: ${describeEffect(e)}`),
  ];
  return (
    <li className={`kn-card kn-${view.stage} ${view.plausible || view.stage !== 'none' ? '' : 'kn-closed'} ${view.focused ? 'kn-focused' : ''}`}>
      <div className="kn-card-head">
        <strong>{advance.name}</strong>
        <span className="kn-stage">{stageText(view)}</span>
      </div>
      {view.next && (
        <>
          <div className="civ-meter" role="meter" aria-valuenow={view.progress} aria-valuemax={view.cost}>
            <div className="civ-meter-fill" style={{ width: `${Math.min(100, (view.progress / view.cost) * 100)}%` }} />
          </div>
          <div className="kn-rate">
            {number(view.progress)} / {view.cost} toward {view.next === 'known' ? 'Known' : 'Developed'}
            {view.turns !== null ? ` · ${plural(view.turns, 'turn')} at +${number(view.rate)} a turn` : view.plausible ? ' · nothing adds progress yet' : ''}
          </div>
          {view.parts.length > 0 && (
            <ul className="kn-parts">
              {view.parts.map((p, i) => (
                <li key={i}>{describePart(p, names)}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {view.stage === 'developed' && view.adoption < 100 && advance.adoption && (
        <div className="kn-rate">{view.adoptionRate > 0 ? `Adoption +${number(view.adoptionRate)} a turn` : `Adoption falling ${number(advance.adoption.fall)} a turn`}</div>
      )}
      {view.conditions.length > 0 && view.stage === 'none' && (
        <ul className="kn-conditions">
          {view.conditions.map((c, i) => (
            <li key={i} className={c.met ? 'met' : ''}>
              {c.met ? '✓' : '✗'} {describeCondition(c.condition, names)}
            </li>
          ))}
        </ul>
      )}
      {effects.length > 0 && (
        <ul className="kn-effects">
          {effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface KnowledgeSheetProps {
  views: AdvanceView[];
  content: Content;
  focus: DomainId | null;
  highLearning: number;
  // The focus is set in allocation.
  canFocus: boolean;
  onFocus: (domain: DomainId | null) => void;
}

export function KnowledgeSheet({ views, content, focus, highLearning, canFocus, onFocus }: KnowledgeSheetProps) {
  const names: Names = {
    advance: (id) => content.advances.find((a) => a.id === id)?.name ?? id,
    resource: (id) => content.resources.find((r) => r.id === id)?.name ?? id,
  };
  const domains = Object.keys(DOMAIN_NAMES) as DomainId[];
  return (
    <div className="civ-sheet kn-sheet">
      <header className="civ-head">
        <h1>Knowledge</h1>
        <p>
          High Learning: {plural(highLearning, 'unit')}, {focus ? `focused on ${DOMAIN_NAMES[focus]}` : 'split across every advance in progress'}
        </p>
      </header>
      <div className="kn-focus" role="group" aria-label="Discovery focus">
        <span title="High Learning goes to the focused domain's advances, split evenly; at half rate toward Developed (§8)">Focus</span>
        {[null, ...domains].map((d) => (
          <button key={d ?? 'none'} type="button" aria-pressed={focus === d} className={focus === d ? 'selected' : ''} disabled={!canFocus} onClick={() => onFocus(d)}>
            {d ? DOMAIN_NAMES[d] : 'None'}
          </button>
        ))}
        {!canFocus && <small>Set in the Allocation phase</small>}
      </div>
      <div className="kn-domains">
        {domains.map((d) => {
          const here = views.filter((v) => v.advance.domain === d);
          return (
            <section key={d} className={`kn-domain ${focus === d ? 'kn-focused' : ''}`}>
              <h2>{DOMAIN_NAMES[d]}</h2>
              {here.length === 0 ? (
                <p className="civ-note">No advances yet</p>
              ) : (
                <ul className="kn-list">
                  {here.map((v) => (
                    <AdvanceCard key={v.advance.id} view={v} content={content} names={names} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
