import type { AreaFilter, Condition, DomainId, Effect, Gathering, Input } from '../../content/types';
import type { AdvanceView, Content, LearningPlan, ProgressPart } from '../../engine';

// Knowledge (design doc §8): the whole advance tree by domain, each advance's stage, its progress
// and the sources of its rate (usage and learning), and the study queue. Every number shows where it
// comes from.

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

const either = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : (items[0] ?? ''));

function where(filter: AreaFilter | undefined, names: Names): string {
  if (!filter) return '';
  const resources = filter.resource === undefined ? [] : [filter.resource].flat().map((r) => names.resource(r).toLowerCase());
  const parts = [
    filter.full ? 'at its limit' : '',
    filter.terrain === undefined ? '' : either([filter.terrain].flat()),
    filter.feature ? `with a ${filter.feature}` : '',
    resources.length > 0 ? `with ${either(resources)}` : '',
  ];
  return parts.filter(Boolean).join(', ');
}

function gathering(what: Gathering, names: Names): string {
  if (what === 'food') return 'gathering food';
  if (what === 'any') return 'gathering any good';
  return `gathering ${either(what.map((r) => names.resource(r).toLowerCase()))}`;
}

function describeInput(input: Input, names: Names): string {
  switch (input.per) {
    case 'turn':
      return 'each turn';
    case 'area':
      return `per area you hold${input.where ? ` ${where(input.where, names)}` : ''}`;
    case 'settlement': {
      const parts = [
        input.where ? where(input.where, names) : '',
        input.gathering ? gathering(input.gathering, names) : '',
        input.contact ? 'next to another civilization' : '',
        input.beyond !== undefined ? `more than ${plural(input.beyond, 'move')} from the capital` : '',
      ].filter(Boolean);
      return `per ${input.tier ?? 'settlement'}${parts.length > 0 ? ` ${parts.join(', ')}` : ''}`;
    }
    case 'worker':
      return input.resource === 'bureaucracy' ? 'per Bureaucracy unit' : `per manpower working ${names.resource(input.resource).toLowerCase()}`;
    case 'instability':
      return 'per point of civ-wide instability';
    case 'rival':
      return 'per civilization in contact';
    case 'goodKind':
      return 'per kind of good gathered';
    case 'attacked':
      return 'per settlement attacked this turn';
    case 'fought':
      return 'per conflict fought this turn';
    case 'struck':
      return `per settlement struck by ${input.calamity} this turn`;
    case 'traded':
      return 'per kind of good bought or sold on the market';
  }
}

function describePart(part: ProgressPart, names: Names): string {
  if (part.input === 'learning') return `+${number(part.value)}: ${number(part.count)} learning`;
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
    case 'contact':
      return 'In contact with another civilization';
    case 'gathering':
      return `A settlement ${gathering(condition.what, names)}`;
  }
}

function describeEffect(effect: Effect, names: Names): string {
  switch (effect.type) {
    case 'unlockTier':
      return `Unlocks ${effect.tier === 'city' ? 'cities' : `${effect.tier}s`}`;
    case 'raiseTokenCap':
      return `Token cap +${effect.amount}`;
    case 'raiseAreaLimit':
      return `Area limits +${effect.amount}`;
    case 'strength':
      return `Token strength +${effect.amount}${effect.counteredBy ? ` (countered by ${names.advance(effect.counteredBy)} when attacking a settlement)` : ''}`;
    case 'settlementDefense':
      return `${effect.minTier ? `${effect.minTier === 'city' ? 'Cities' : `${capital(effect.minTier)}s`} and larger` : 'Every settlement'}: attack threshold and defense +${effect.amount}`;
    case 'calm':
      return `Civ-wide instability −${effect.amount} a turn`;
    case 'riverLeg':
      return `River travel: one move covers up to ${effect.areas} areas along a river, for tokens and transport`;
    case 'store':
      return `Each settlement stores up to ${effect.amount} unused ${names.resource(effect.resource).toLowerCase()} for next turn`;
    case 'capitalReach':
      return `Distance from the capital lowers thresholds ${plural(effect.amount, 'move')} later`;
    case 'gatherBonus':
      return `+${effect.amount} ${names.resource(effect.resource).toLowerCase()} to each settlement gathering it`;
    case 'marketAccess':
      return 'Market access';
    case 'marketReach':
      return `Market reach +${effect.amount}`;
    case 'hook':
      return 'Special rule';
  }
}

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// An advance with no adoption shows as Developed only; it has nothing more to reach.
function stageText(view: AdvanceView): string {
  if (view.stage === 'developed' && (!view.advance.adoption || view.advance.baseline)) return 'Developed';
  if (view.stage === 'developed') return view.adoption >= 100 ? 'Mastered' : `Developed · ${number(view.adoption)}% adopted`;
  if (view.stage === 'known') return 'Known';
  return view.plausible ? 'In progress' : 'Not yet plausible';
}

// Whether learning can go to the advance: anything plausible short of Mastered.
export function studiable(view: AdvanceView): boolean {
  if (view.advance.baseline) return false;
  if (view.stage === 'developed') return view.next === 'mastered';
  return view.plausible && view.next !== null;
}

const STEP_NAMES = { known: 'Known', developed: 'Developed', mastered: 'Mastered' } as const;

// The next step's progress in one bar: what usage has filled, and this turn's usage and learning
// ahead of it.
function StepMeter({ view }: { view: AdvanceView }) {
  const share = (n: number) => (view.cost > 0 ? Math.max(0, Math.min(100, (n / view.cost) * 100)) : 100);
  const usage = Math.min(view.usageRate, view.cost - view.progress);
  const learning = Math.min(view.learningRate, view.cost - view.progress - usage);
  return (
    <div className="civ-meter kn-meter" role="meter" aria-valuenow={view.progress} aria-valuemax={view.cost}>
      <div className="kn-done" style={{ width: `${share(view.progress)}%` }} />
      <div className="kn-usage" style={{ width: `${share(usage)}%` }} />
      <div className="kn-learning" style={{ width: `${share(learning)}%` }} />
    </div>
  );
}

function StepText({ view }: { view: AdvanceView }) {
  const step = STEP_NAMES[view.next!];
  const unit = view.next === 'mastered' ? ' adoption' : '';
  const turns = view.turns !== null ? ` · ${plural(view.turns, 'turn')} at +${number(view.rate)} a turn` : view.plausible || view.stage === 'developed' ? ' · nothing adds progress yet' : '';
  return (
    <div className="kn-rate">
      {number(view.progress)} / {number(view.cost)}
      {unit} toward {step}
      {turns}
    </div>
  );
}

// What the advance does against calamities (design doc §12): halving damage, sheltering towns from
// a tier drop, opening a buy-off, or gaining learning from a strike.
function calamityEffects(content: Content, id: string): string[] {
  return content.calamities.flatMap((c) => {
    const name = c.name.toLowerCase();
    return [
      ...(c.softenedBy ?? []).filter((x) => x.advance === id).map((x) => `${x.stage === 'mastered' ? 'Mastered' : 'Developed'}: halves ${name} damage${x.stage === 'mastered' ? ' again' : ''}${x.minTier ? ` (${x.minTier}s and larger)` : ''}`),
      ...((c.shelter ?? []).includes(id) ? [`Developed: towns and larger keep their tier in ${name === 'earthquake' ? 'an' : 'a'} ${name}`] : []),
      ...(c.buyOff?.requires === id ? [`Developed: ${name} can be bought off (${c.buyOff.cost})`] : []),
      ...(c.grants?.advance === id ? [`Each ${name} strike gives ${c.grants.learning} free learning toward it`] : []),
    ];
  });
}

function AdvanceCard({ view, content, names, canStudy, onAdd }: { view: AdvanceView; content: Content; names: Names; canStudy: boolean; onAdd: () => void }) {
  const { advance } = view;
  const effects = [
    ...content.resources.filter((r) => (r.revealedBy ?? r.requires) === advance.id && !r.from).map((r) => `Known: reveals ${r.name.toLowerCase()}`),
    ...content.resources.filter((r) => r.requires === advance.id).map((r) => `Developed: ${r.name.toLowerCase()} can be ${r.from ? `made from ${either(r.from.map((f) => names.resource(f).toLowerCase()))} areas` : 'gathered'}${r.luxury ? ' (luxury: calms instability)' : ''}`),
    ...advance.effects.map((e) => `Developed: ${describeEffect(e, names)}`),
    ...(advance.mastered ?? []).map((e) => `Mastered: ${describeEffect(e, names)}`),
    ...calamityEffects(content, advance.id),
  ];
  return (
    <li className={`kn-card kn-${view.stage} ${view.plausible || view.stage !== 'none' ? '' : 'kn-closed'} ${view.queued ? 'kn-queued' : ''}`}>
      <div className="kn-card-head">
        <strong>{advance.name}</strong>
        <span className="kn-stage">{stageText(view)}</span>
      </div>
      {view.next && (
        <>
          <StepMeter view={view} />
          <StepText view={view} />
          {view.parts.length > 0 && (
            <ul className="kn-parts">
              {view.parts.map((p, i) => (
                <li key={i}>{describePart(p, names)}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {studiable(view) && (
        <div className="kn-study">
          {view.queued ? (
            <span>#{view.queued} in the study queue</span>
          ) : (
            <button type="button" disabled={!canStudy} onClick={onAdd} title={canStudy ? 'Add to the end of the study queue' : 'Set in the Allocation phase'}>
              Study
            </button>
          )}
        </div>
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
  queue: string[];
  plan: LearningPlan;
  // The queue is set in allocation.
  canStudy: boolean;
  onStudy: (queue: string[]) => void;
}

export function KnowledgeSheet({ views, content, queue, plan, canStudy, onStudy }: KnowledgeSheetProps) {
  const names: Names = {
    advance: (id) => content.advances.find((a) => a.id === id)?.name ?? id,
    resource: (id) => content.resources.find((r) => r.id === id)?.name ?? id,
  };
  const domains = Object.keys(DOMAIN_NAMES) as DomainId[];
  const waiting = views.filter((v) => v.next !== null && v.progress + v.usageRate < v.cost && (v.stage === 'developed' || v.plausible)).length;
  const move = (i: number, by: number) => {
    const next = [...queue];
    const [id] = next.splice(i, 1);
    next.splice(i + by, 0, id!);
    onStudy(next);
  };
  return (
    <div className="civ-sheet kn-sheet">
      <header className="civ-head">
        <h1>Knowledge</h1>
        <p title="Each High Learning unit adds 1 learning a turn. A unit of learning adds 2 progress toward Known or Developed, or 10 adoption toward Mastered; it speeds advances up but is never required (§8)">
          Learning: {number(plan.pool)} a turn from High Learning
        </p>
      </header>
      <section className="kn-queue" aria-label="Study queue">
        <h2>Study queue</h2>
        {queue.length === 0 ? (
          <p className="civ-note">Empty: learning splits evenly among {plural(waiting, 'advance')} waiting for it. Press Study on an advance to queue it.</p>
        ) : (
          <ol>
            {queue.map((id, i) => {
              const view = views.find((v) => v.advance.id === id)!;
              return (
                <li key={id}>
                  <span>
                    {names.advance(id)} <small>{view.learning > 0 ? `${number(view.learning)} learning, +${number(view.learningRate)}` : view.stage !== 'developed' && !view.plausible ? 'not plausible now' : view.progress + view.usageRate >= view.cost ? 'usage finishes it this turn' : 'no learning left this turn'}</small>
                  </span>
                  <button type="button" aria-label={`Move ${names.advance(id)} up`} disabled={!canStudy || i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label={`Move ${names.advance(id)} down`} disabled={!canStudy || i === queue.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label={`Remove ${names.advance(id)}`} disabled={!canStudy} onClick={() => onStudy(queue.filter((q) => q !== id))}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {plan.split > 0 && queue.length > 0 && <p className="civ-note">{number(plan.split)} learning the queue cannot use splits evenly among the advances waiting for it.</p>}
        {plan.unused > 0 && <p className="civ-note">{number(plan.unused)} learning unused: nothing is waiting for it.</p>}
        {!canStudy && <small>Set in the Allocation phase</small>}
      </section>
      <div className="kn-domains">
        {domains.map((d) => {
          const here = views.filter((v) => v.advance.domain === d);
          return (
            <section key={d} className="kn-domain">
              <h2>{DOMAIN_NAMES[d]}</h2>
              {here.length === 0 ? (
                <p className="civ-note">No advances yet</p>
              ) : (
                <ul className="kn-list">
                  {here.map((v) => (
                    <AdvanceCard key={v.advance.id} view={v} content={content} names={names} canStudy={canStudy} onAdd={() => onStudy([...queue, v.advance.id])} />
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
