import { useEffect, useRef, type ReactNode } from 'react';
import type { Effect } from '../../content/types';
import {
  ADOPTION_COST,
  BASE_MOVEMENT,
  BASE_REACH,
  CALAMITY_EFFECTS,
  CALAMITY_LIKELY,
  CHANCE_PER_QUIET,
  CHANCE_PER_TIER,
  COUNTDOWN,
  CULTURE_PROGRESS,
  CURRENCY_PER_MANPOWER,
  DOMAINS,
  eraPoints,
  erasInOrder,
  FLOODPLAIN_LIMIT,
  GROWTH_PER_TOKEN,
  LEARNING_ADOPTION,
  LEARNING_PROGRESS,
  LIMITS,
  MAX_LIMIT,
  NEAR_COLLAPSE,
  ORDER_MAX,
  PRICE_CEILING,
  PRICE_FLOOR,
  PRICE_STEP,
  RESOLUTION_STEPS,
  RIVER_LIMIT,
  STARTING_TOKEN_CAP,
  TIERS,
  wonderPoints,
  type Content,
  type ResolutionStepId,
} from '../../engine';
import { advanceEffects, describeCondition, describeRule, DOMAIN_NAMES, type Names } from './KnowledgeSheet';
import { instabilityRules } from './SocietySheet';

// The rules reference (design doc §3, Rules, v0.29): one scrolling page with a contents list. Every
// number comes from the content data or the engine's constants; nothing is typed into the page.

export const RULES_SECTIONS = [
  { id: 'turn', title: 'The turn' },
  { id: 'map', title: 'Map and tokens' },
  { id: 'settlements', title: 'Settlements' },
  { id: 'goods', title: 'Goods' },
  { id: 'manpower', title: 'Manpower' },
  { id: 'market', title: 'Market' },
  { id: 'advances', title: 'Advances' },
  { id: 'wonders', title: 'Wonders' },
  { id: 'instability', title: 'Instability' },
  { id: 'calamities', title: 'Calamities' },
  { id: 'conflict', title: 'Conflict' },
  { id: 'eras', title: 'Eras and victory' },
] as const;

export type RulesSection = (typeof RULES_SECTIONS)[number]['id'];

const STEPS: Record<ResolutionStepId, { name: string; text: string }> = {
  movement: { name: 'Movement', text: 'Every civilization’s planned moves happen at once.' },
  conflict: { name: 'Conflict', text: 'Areas over their limit with two or more civilizations fight; settlements are attacked and captured.' },
  conversion: { name: 'Settlements', text: 'Ordered settlements are founded and upgraded from the tokens in their area.' },
  food: { name: 'Food', text: 'Food is eaten in the support check (step 6).' },
  calamities: { name: 'Calamities', text: 'Each civilization may be struck, unless the calamity is bought off.' },
  support: { name: 'Support', text: 'A settlement short of support drops a tier; food covers what tokens cannot.' },
  instability: { name: 'Instability', text: 'This turn’s sources are added, luxuries calm, and settlements at their threshold collapse.' },
  growth: { name: 'Growth', text: 'Loose tokens grow, and towns and larger add urban growth.' },
  surplus: { name: 'Surplus', text: 'Tokens over an area’s limit or the token cap are removed.' },
  discovery: { name: 'Discovery', text: 'Advances move by their inputs and learning, and reach Known, Developed, and Mastered.' },
  figures: { name: 'Historical figures', text: 'From the Bronze Age; none in the Stone Age.' },
  wonders: { name: 'Wonders', text: 'Each build is worked if its turn can be paid; the first to finish a wonder gets it.' },
  ast: { name: 'Eras and endgame', text: 'Civilizations enter every era whose gate they meet; the countdown starts or ends.' },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? 'none'));

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="civ-table rules-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface RulesSheetProps {
  content: Content;
  // The section to open at, e.g. from a link on another screen.
  section?: RulesSection | null;
}

export function RulesSheet({ content, section = null }: RulesSheetProps) {
  const refs = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (section) refs.current.get(section)?.scrollIntoView({ block: 'start' });
  }, [section]);
  const go = (id: string) => refs.current.get(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const names: Names = {
    advance: (id) => content.advances.find((a) => a.id === id)?.name ?? id,
    resource: (id) => (id === 'food' ? 'Food' : (content.resources.find((r) => r.id === id)?.name ?? id)),
  };
  const good = (id: string) => names.resource(id).toLowerCase();
  // Advances and wonders with an effect of a type, with the effect.
  const withEffect = <T extends Effect['type']>(type: T) =>
    [
      ...content.advances.map((a) => ({ name: a.name, effects: a.effects })),
      ...content.advances.map((a) => ({ name: `${a.name} Mastered`, effects: a.mastered ?? [] })),
      ...content.wonders.map((w) => ({ name: w.name, effects: w.effects })),
    ].flatMap((x) =>
      x.effects.filter((e): e is Extract<Effect, { type: T }> => e.type === type).map((e) => ({ name: x.name, effect: e })),
    );
  const unlockedBy = (tier: string) => content.advances.find((a) => a.effects.some((e) => e.type === 'unlockTier' && e.tier === tier))?.name;
  const calmers = withEffect('calm').map((x) => ({ name: x.name, amount: x.effect.amount }));
  const { raises, lowers } = instabilityRules(calmers);
  const eras = erasInOrder(content);
  const section_ = (id: RulesSection, children: ReactNode) => (
    <section
      key={id}
      className="rules-section"
      ref={(el) => {
        if (el) refs.current.set(id, el);
      }}
    >
      <h2>{RULES_SECTIONS.find((s) => s.id === id)!.title}</h2>
      {children}
    </section>
  );

  return (
    <div className="civ-sheet rules-sheet">
      <header className="civ-head">
        <h1>Rules</h1>
        <p>Every number here comes from the game’s data</p>
      </header>
      <div className="rules-columns">
        <nav className="rules-contents" aria-label="Contents">
          <ol>
            {RULES_SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id)}>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="rules-body">
          {section_(
            'turn',
            <>
              <p>Each turn has three phases. Only allocation takes your orders; the other two resolve on their own.</p>
              <Table
                head={['Phase', 'What happens']}
                rows={[
                  ['Resources', 'Goods are gathered (durable goods join the stock, the rest of last turn’s are gone), tax is collected, market orders fill, Bureaucracy and calm lower instability, Artists add culture, and manpower on wonders is counted.'],
                  ['Allocation', 'You move tokens, order settlements, assign manpower, set the study queue, market orders, and buy-off marks, and start wonders. Every civilization plans at once.'],
                  ['Resolution', 'The steps below, in order.'],
                ]}
              />
              <Table head={['Step', 'Resolution']} rows={RESOLUTION_STEPS.map((s, i) => [`${i + 1}. ${STEPS[s].name}`, STEPS[s].text])} />
            </>,
          )}

          {section_(
            'map',
            <>
              <p>
                Your people are tokens on the map. Each area holds up to its limit of loose tokens; a settled area holds none. Loose tokens count against your token cap, which starts at {STARTING_TOKEN_CAP}; tokens in settlements do not. Raised by:{' '}
                {list(withEffect('raiseTokenCap').map((x) => `${x.name} +${x.effect.amount}`))}.
              </p>
              <Table
                head={['Terrain', 'Area limit']}
                rows={Object.entries(LIMITS).map(([t, [min, max]]) => [capitalize(t), min === max ? String(min) : `${min}–${max}`])}
              />
              <p className="civ-rule">
                A river adds {RIVER_LIMIT}; a floodplain holds at least {FLOODPLAIN_LIMIT}; no area starts above {MAX_LIMIT}. Advances that raise every limit: {list(withEffect('raiseAreaLimit').map((x) => `${x.name} +${x.effect.amount}`))}.
              </p>
              <p>
                <b>Growth.</b> Each loose token adds {GROWTH_PER_TOKEN} of a token a turn to its area, within the area’s limit and the cap. <b>Movement.</b> Tokens move {BASE_MOVEMENT} area a turn; river travel lets one move cover more:{' '}
                {list(withEffect('riverLeg').map((x) => `${x.name}, up to ${x.effect.areas} areas`))}. Tokens over an area’s limit or the cap are removed at the end of the turn.
              </p>
            </>,
          )}

          {section_(
            'settlements',
            <>
              <p>A settlement is founded from tokens in one area, and upgraded by adding more. It needs support every turn: loose tokens in adjacent unsettled areas, one settlement per token; food stands in, 1 per missing token. A settlement short of support drops a tier; a village dissolves.</p>
              <Table
                head={['Tier', 'Tokens', 'Support', 'Manpower', 'Tax', 'Urban growth', 'Collapses at', 'Points', 'Unlocked by']}
                rows={TIERS.map((t, i) => [t.name, i === 0 ? t.value : `+${t.value - TIERS[i - 1]!.value}`, t.support, t.manpower, t.tax, t.urbanGrowth, t.threshold, i + 1, i === 0 ? 'From the start' : (unlockedBy(t.id) ?? 'A later era')])}
              />
              <p className="civ-rule">A settlement that eats food it gathered itself adds 1 more urban growth. The first settlement is the capital.</p>
            </>,
          )}

          {section_(
            'goods',
            <>
              <p>Manpower gathers goods: 1 a unit a turn from the settlement’s area. Goods last one turn, except durable goods, which are kept in your stock. Food covers support anywhere one transport step away, then food bought on the market. Luxuries calm instability.</p>
              <Table
                head={['Good', 'Kind', 'Gathered from', 'Opened by', 'Starting price']}
                rows={content.resources.map((r) => [
                  r.name,
                  [r.food ? 'food' : '', r.luxury ? 'luxury' : '', r.durable ? 'durable' : ''].filter(Boolean).join(', ') || 'good',
                  r.from ? `Areas with ${list(r.from.map(good))}` : r.terrain ? capitalize(list(r.terrain)) : 'Areas showing it on the map',
                  `${names.advance(r.requires)} Developed${r.revealedBy ? `; shown with ${names.advance(r.revealedBy)} Known` : ''}`,
                  r.price,
                ])}
              />
              <p className="civ-rule">Stores: {list(withEffect('store').map((x) => `${x.name} +${x.effect.amount} ${good(x.effect.resource)} a settlement`))}. Bonuses: {list(withEffect('gatherBonus').map((x) => `${x.name} +${x.effect.amount} ${good(x.effect.resource)}`))}.</p>
            </>,
          )}

          {section_(
            'manpower',
            <>
              <p>Each settlement has manpower by tier (see Settlements), plus wonders that add it. Assignments stand from turn to turn and work from the next resources phase. Unassigned manpower produces nothing.</p>
              <Table
                head={['Job', 'Each unit']}
                rows={[
                  ['Production', 'Gathers 1 of a good the area offers'],
                  ['Bureaucracy', '−1 instability a turn: its own settlement first, then civ-wide'],
                  ['High Learning', `+1 learning a turn, down the study queue (${LEARNING_PROGRESS} progress or ${LEARNING_ADOPTION} adoption a unit)`],
                  ['Artists', `+1 culture progress a turn; every ${CULTURE_PROGRESS} is an award`],
                  ['Wonder', `Works the settlement’s wonder; ${CURRENCY_PER_MANPOWER} currency covers each missing unit`],
                ]}
              />
              <p className="civ-rule">Manpower added by wonders: {list(withEffect('manpower').map((x) => `${x.name} +${x.effect.amount} at its settlement`))}.</p>
            </>,
          )}

          {section_(
            'market',
            <>
              <p>
                Market access comes with {list(withEffect('marketAccess').map((x) => x.name))}. Your market is every civilization with access whose settlements are within reach of yours ({BASE_REACH} steps, more with {list(withEffect('marketReach').map((x) => `${x.name} +${x.effect.amount}`))}), or yours of theirs.
              </p>
              <p>
                Standing orders, up to {ORDER_MAX} units a good, fill in the resources phase: sales first, then purchases as far as the treasury allows. Each unit bought minus sold in your market moves the price {pct(PRICE_STEP)} of its starting price, between {pct(PRICE_FLOOR)} and {pct(PRICE_CEILING)} of it. Bought goods reach every settlement. Towns and larger pay tax ({list(TIERS.filter((t) => t.tax > 0).map((t) => `${t.name.toLowerCase()} ${t.tax}`))}); the treasury keeps from turn to turn.
              </p>
            </>,
          )}

          {section_(
            'advances',
            <>
              <p>
                Each advance becomes plausible when its conditions hold, then climbs Known, Developed, and Mastered ({ADOPTION_COST} adoption) as its own inputs add progress each turn. Learning speeds it: a unit adds {LEARNING_PROGRESS} progress toward Known or Developed, or {LEARNING_ADOPTION} adoption. Nothing is lost; progress toward Known and Developed pauses while conditions lapse.
              </p>
              {eras
                .filter((e) => content.advances.some((a) => a.era === e.id))
                .map((e) => (
                  <div key={e.id}>
                    <h3>{e.name}</h3>
                    <Table
                      head={['Advance', 'Plausible when', 'Known', 'Developed', 'Mastered', 'Gives', 'Points (Developed / Mastered)']}
                      rows={DOMAINS.flatMap((d) =>
                        content.advances
                          .filter((a) => a.era === e.id && a.domain === d)
                          .map((a) => {
                            const p = eraPoints(content, a.era);
                            return [
                              <>
                                <b>{a.name}</b>
                                <small className="ec-where">{DOMAIN_NAMES[d]}</small>
                              </>,
                              a.baseline ? 'From the start' : (a.plausible ?? []).map((c) => describeCondition(c, names)).join('; ') || 'Always',
                              a.known ? `${a.known.cost}: ${a.known.inputs.map((i) => describeRule(i, names)).join(', ') || 'learning only'}` : '—',
                              a.developed ? `${a.developed.cost}: ${a.developed.inputs.map((i) => describeRule(i, names)).join(', ') || 'learning only'}` : '—',
                              a.adoption && !a.baseline ? a.adoption.inputs.map((i) => describeRule(i, names)).join(', ') : '—',
                              <ul className="rules-list">
                                {advanceEffects(a, content, names).map((x) => (
                                  <li key={x}>{x}</li>
                                ))}
                              </ul>,
                              a.baseline ? '—' : a.adoption ? `${p.developed} / ${p.mastered}` : p.developed,
                            ];
                          }),
                      )}
                    />
                  </div>
                ))}
            </>,
          )}

          {section_(
            'wonders',
            <>
              <p>
                Each wonder exists once in the world. It is started at one of your settlements once its advances are Developed, and only if its first turn could be paid; it is first worked the next turn. Every turn of work takes its goods from anywhere in your civilization, after support, and its manpower at its settlement; {CURRENCY_PER_MANPOWER}{' '}
                currency covers each missing unit. A turn that cannot be paid stalls and spends nothing. Its effect follows whoever holds the site; its points stay with the builder. If two finish it on the same turn, the build started last gets it; builds started the same turn are decided by a random draw. If a rival finishes it first, your turns move to another wonder at the same share, or become culture.
              </p>
              <Table
                head={['Wonder', 'Opened by', 'A turn', 'Turns', 'Effect', 'Points']}
                rows={content.wonders.map((w) => [
                  w.name,
                  list(w.requires.map(names.advance)),
                  [...w.goods.map((g) => `${g.count} ${good(g.resource)}`), `${w.manpower} manpower`].join(', '),
                  w.turns,
                  w.summary,
                  wonderPoints(content, w),
                ])}
              />
            </>,
          )}

          {section_(
            'instability',
            <>
              <p>
                Each settlement has its own meter, and the civilization a civ-wide meter that adds to every one. Meters never fall on their own. A settlement collapses one tier when the two together reach its threshold ({list(TIERS.map((t) => `${t.name.toLowerCase()} ${t.threshold}`))}), lower far from the capital; the
                collapse halves its own meter. Within {NEAR_COLLAPSE} of it, a settlement is close to collapse.
              </p>
              <div className="so-rules">
                <Table head={['Raises', '']} rows={raises} />
                <Table head={['Lowers', '']} rows={lowers} />
              </div>
            </>,
          )}

          {section_(
            'calamities',
            <>
              <p>
                Once a turn, each civilization with a settlement may be struck: {pct(CHANCE_PER_TIER)} for each settlement tier point ({list(TIERS.map((t, i) => `${t.name.toLowerCase()} ${i + 1}`))}) plus {pct(CHANCE_PER_QUIET)} for each turn in a row without one. A strike picks one calamity and one settlement, weighted by each settlement’s exposure. Softening advances halve the damage each.
                A marked calamity that can be bought off is averted for its cost from the treasury.
              </p>
              <Table
                head={['Calamity', 'Effect', 'Likelier', 'Softened by', 'Buy off']}
                rows={content.calamities.map((c) => [
                  c.name,
                  CALAMITY_EFFECTS[c.id as keyof typeof CALAMITY_EFFECTS] ?? '',
                  CALAMITY_LIKELY[c.id as keyof typeof CALAMITY_LIKELY] ?? '',
                  list([
                    ...(c.softenedBy ?? []).map((s) => `${names.advance(s.advance)}${s.stage === 'mastered' ? ' Mastered' : ''}${s.minTier ? ` (${s.minTier}s and larger)` : ''}`),
                    ...(c.shelter ?? []).map((a) => `${names.advance(a)}: towns and larger keep their tier`),
                  ]),
                  c.buyOff ? `${c.buyOff.cost}${c.buyOff.requires ? `, with ${names.advance(c.buyOff.requires)}` : ''}` : 'Cannot',
                ])}
              />
            </>,
          )}

          {section_(
            'conflict',
            <>
              <p>
                Tokens of two or more civilizations in an area over its limit fight. Each token has a strength of 1 plus its advances; a side’s power is the sum. Bonus power (power beyond the token count) first removes that many of the strongest opponent’s tokens; then, round by round, every side removes a token, least power first, until the area is
                within its limit or one side is left.
              </p>
              <p>Any enemy token entering a settled area attacks the settlement. Attackers whose power is below its attack threshold are destroyed. At or above it, the settlement fights as its defense in tokens, with its owner’s tokens there, until one side is gone; attackers left capture it and take a share of the owner’s treasury and durable stock.</p>
              <Table head={['Tier', 'Attack threshold', 'Defends as', 'Spoils']} rows={TIERS.map((t) => [t.name, t.attack, t.defense, pct(t.spoils)])} />
              <p className="civ-rule">Strength: {list(withEffect('strength').map((x) => `${x.name} +${x.effect.amount}${x.effect.counteredBy ? ` (not against ${names.advance(x.effect.counteredBy)} settlements)` : ''}`))}. Settlement defense: {list(withEffect('settlementDefense').map((x) => `${x.name} +${x.effect.amount}${x.effect.minTier ? ` (${x.effect.minTier}s and larger)` : ''}`))}.</p>
            </>,
          )}

          {section_(
            'eras',
            <>
              <p>
                A civilization enters the next era as soon as it meets that era’s gate of settlement and knowledge points; an era is never lost. Meeting the gate after the final era starts a {COUNTDOWN}-turn countdown; when it ends, the highest score wins, and equal highest scores share the victory. Score is knowledge + settlement +
                wonders + culture points. Culture: every {CULTURE_PROGRESS} Artists progress is an award worth the era’s culture points. Later eras’ gates are not set yet.
              </p>
              <Table
                head={['Era', 'Gate', 'Advance Developed', 'Mastered', 'Culture award', 'Wonder']}
                rows={eras
                  .filter((e, i) => i === 0 || e.gate)
                  .map((e, i) => {
                    const p = eraPoints(content, e.id);
                    return [e.name, e.gate ? `${e.gate.settlement} settlement, ${e.gate.knowledge} knowledge` : i === 0 ? 'From the start' : '', p.developed, p.mastered, p.culture, p.wonder ?? 0];
                  })}
              />
              <p className="civ-rule">Settlement points: {list(TIERS.map((t, i) => `${t.name.toLowerCase()} ${i + 1}`))}. Baseline advances score nothing; an advance with no adoption stage scores its Developed value only.</p>
            </>,
          )}
        </div>
      </div>
    </div>
  );
}
