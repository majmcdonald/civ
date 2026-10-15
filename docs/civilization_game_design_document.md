# Civilization-Inspired Strategy Game — Design Document

**Version:** 0.2.1  
**Date:** October 15, 2026  
**Status:** Working draft — core systems designed; numbers untuned

> This is a living design document. Sections marked **Decided** are current design commitments (still subject to playtesting). Items under **Open** and **Tuning** are unresolved. Ideas documented here do not become rules until they are moved into a Decided section.

## 1. Project vision

The game takes inspiration from Francis Tresham's original *Civilization* board game (1980), particularly its emphasis on population, expansion, settlement, trade, civilizational development, and collapse.

The goal is not simply to reproduce the board game digitally. It is to use its underlying ideas as a foundation for a strategy game in which **societies evolve through the interaction of people, geography, resources, knowledge, and historical circumstances.**

The most distinctive design ambition is scientific and technological advancement: rather than choosing items from a conventional technology tree, players influence the conditions under which discoveries emerge, become practical, and spread through society.

Where a system has a clear equivalent in the original game, the default is to **follow the original's pattern and expand it**, rather than invent from scratch.

### Core design principles

- **Systems should interact.** Population, resources, trade, settlement, knowledge, and collapse influence one another rather than operate as disconnected subsystems.
- **Civilizational development should emerge from circumstances.** Different societies have different opportunities and histories, rather than all following the same prescribed sequence.
- **The player influences society primarily indirectly.** The player shapes conditions and priorities rather than acting as an omnipotent researcher who simply selects the next invention.
- **Knowledge and capability are not the same thing.** A society might know an idea without possessing the resources, specialists, institutions, or infrastructure needed to use it widely.
- **Collapse is consequential without being a total reset.** Cities may fall while surviving people carry knowledge into new societies. Civilizations themselves persist as long as people remain.
- **Historical figures emerge from events and circumstances**, rather than functioning as collectible characters with arbitrary bonuses.
- **The game preserves meaningful uncertainty.** Favorable circumstances make discoveries more plausible, not guaranteed.
- **Discoveries change the rules.** Many base rules (movement, conflict triggers, conflict state, population limits) are defaults that specific technologies modify.

## 2. Game frame — Decided

| Element | Decision |
|---|---|
| Players | Single-player against AI and multiplayer, with equal weight |
| Turn mode | Simultaneous turns |
| Scope | Long arc: Stone Age to the Modern era; multi-session campaigns (save/resume required) |
| Map | Irregular areas (regions). Either a procedurally generated map or a fixed historical map |
| Player role | The ruling power: direct control over state decisions; discovery, adoption, and figures are indirect |
| Diplomacy | None for now. Conflict state is derived from events (see §11) |

### Setup options

| Option | Choices |
|---|---|
| Map | Procedural or historical |
| AST track length | Same for everyone / derived from starting conditions / authored per civilization (historical maps only) |
| Final era | Any era; e.g., end of the Iron Age for a single evening, end of the Modern era for a full campaign |

## 3. Turn structure — Decided

Four phases. All players act simultaneously within each phase.

| Phase | What happens |
|---|---|
| **1. Resources** | Settlements produce from manpower assigned to production. Taxes are collected as currency |
| **2. Trade** | Players with the trade discovery place market orders; prices are set and orders filled. Goods are usable this turn |
| **3. Allocation** | Players assign manpower (production, Bureaucracy, High Learning, Artists, wonders), spend currency (discovery focus, stabilization), order movement and migration, and order settlement conversions |
| **4. Resolution** | The game resolves all consequences in a fixed order (below) |

### Resolution order (starting point; adjust in playtesting)

| Step | Resolves | Rationale |
|---|---|---|
| 1 | Movement | Positions settle before anything else |
| 2 | Conflict: attrition, sieges, capture, spoils | Depends on final positions |
| 3 | Settlement conversion (tier-ups ordered in allocation) | After conflict, as in the original |
| 4 | Food consumption and shortages | Uses post-conflict population |
| 5 | Calamities | Before wonders complete, so a disaster can destroy one in progress |
| 6 | Support check and cascades | After losses from conflict and calamities |
| 7 | Instability update and collapse | Uses all of this turn's sources |
| 8 | Growth: tokens, and settlement output into adjacent areas | After losses |
| 9 | Surplus removal (areas over their limit) | After growth |
| 10 | Discovery: accumulators, Known, Developed, adoption | Uses the turn's final conditions |
| 11 | Historical figures emerge | Conditions include this turn's discoveries |
| 12 | Wonders complete | After calamities |
| 13 | AST movement and endgame check | Uses final state |

## 4. Map, population, and movement — Decided

### Areas

- The board is divided into irregular areas.
- **No printed city sites.** Every area can host settlements.
- Each area has a **population limit**. Limits are not fixed; discoveries raise them.
- Each area has **resources** (see §6).

### Population tokens

- Population is represented by **tokens** in areas.
- **No fixed supply.** A civilization's maximum token count is a cap that discoveries raise.
- **Growth is automatic**, following the original's pattern (rates to be tuned).
- **Loose tokens produce nothing and need no support.** They have no manpower. They matter as growth, as support for villages, as a source of new settlements, as armies, and as discoverers (occupying a resource area contributes to related discoveries).

### Movement

- By default a token moves **one adjacent land area** per turn.
- Transport discoveries (roads, railroads, flight, and similar) extend range.
- **River and sea travel require discovering ships.**

## 5. Settlements — Decided

### The settlement pyramid

Settlements are built by converting lower units, extending the original's "6 tokens → city" rule into tiers.

| Tier | Built from | Token value |
|---|---|---|
| Village | 6 tokens | 6 |
| Town | 2 villages | 12 |
| City | 2 towns | 24 |
| Metropolis | 2 cities | 48 |

- **No skipping tiers.** A player with 100 tokens cannot convert straight to a metropolis.
- The units merged may be in the **same or adjacent areas**. If adjacent, the player chooses where the result sits.
- Conversion is ordered in allocation and resolves after conflict.
- Starting numbers; to be tuned.

### Area limits

- **Per area:** at most 2 villages, 2 towns, 2 cities, and 1 metropolis.
- **Settlements count against the area's population limit** at their token value. Loose tokens fill the remaining capacity.
- Consequence: a fully urbanized area has no room for loose growth; discoveries that raise limits are critical.

### Support

Follows the original's pattern: units consumed in a conversion are gone, and support comes from **separate, additional** units.

| Tier | Requires |
|---|---|
| Village | 2 tokens |
| Town | 2 villages |
| City | 2 towns |
| Metropolis | 2 cities |

- Supporting units must be **adjacent or within movement range**.
- **Cascades:** if support fails, the settlement drops a tier, which can break support for the tier above it.

### Urban growth

Settlements **generate tokens into adjacent areas** with spare capacity: cities feed their hinterland.

### Tier abilities (starting ladder)

Each tier keeps the abilities of the tiers below it. Higher tiers justify their cost through **exclusive abilities** (raw output alone does not justify them; see §16).

| Tier | Base manpower | Abilities |
|---|---|---|
| Village | 1 | Produce resources; host specialists; support towns; market endpoint |
| Town | 2 | Generic institutions auto-build here |
| City | 3 | Build named wonders; counts toward AST settlement points |
| Metropolis | 4 | Build great wonders; extends market range; raises the civilization's administrative capacity (reduces overextension) |

- Base manpower is raised by advance bonuses (§6).
- Tax per settlement climbs with tier.
- **Historical figures can emerge in any settlement**, with odds that scale with tier.

## 6. Resources, labor, and currency — Decided

### Resources

- Each area has resources that are farmed, mined, or built.
- A settlement produces through **manpower assigned to production**: each unit works one of the area's resources (see Manpower below). Example: a town with 2 manpower can produce food *and* iron; a village with 1 must choose food *or* iron.
- **Resources are revealed before they are usable,** and use has requirements. Example: iron is revealed by stone tools but cannot yet be used.
- **Occupation drives discovery.** Any presence (loose tokens or settlements) in an area with a revealed resource contributes progress toward the related discovery. Example: occupying an iron area leads toward mining.

Candidate resource categories (from v0.1, not yet finalized): renewable production, extracted materials, manufactured goods, stored resources.

### Transport

- Produced goods must be transported to where they are used.
- **Adjacent areas share goods freely**, with no discovery required.
- Moving goods farther requires transport discoveries.

### Food

- Food surplus drives **growth**; deficits cause starvation and migration.
- Food stores **buffer** shortages and calamities.
- Food shortage raises **instability**; surplus and stores lower it.

### Manpower

Manpower is a settlement's labor. Every unit is spent each turn on exactly one assignment, so labor sent to a wonder or to learning is output not produced.

- Each settlement has **whole units of manpower**: a tier base (village 1, town 2, city 3, metropolis 4) plus **advance bonuses**.
- **Advance bonuses apply only when the related work is being done.** Example: the plow gives nothing to a town whose manpower is all mining. The bonus type (per-unit multiplier, task-tied extra unit, or other) **varies by advance** and is designed one technology at a time.
- Loose tokens have no manpower.

| Assignment | Work | Effect | Favors figures |
|---|---|---|---|
| **Production** | Farming, mining, building | One of the area's resources per unit | — |
| **Bureaucracy** | Works for the state | Adds stability | Leader, Reformer, Diplomat |
| **High Learning** | Schools, R&D | Adds discovery progress | Scholar, Innovator, Thinker |
| **Artists** | Arts | Slight stability; larger gain in culture points (victory points) | Artist, Prophet |
| **Wonders** | Construction | Progress toward a wonder | — |

- **Specialists** are manpower in Bureaucracy, High Learning, or Artists. Any settlement can assign them. Currency cannot fund specialists.
- All three specialist assignments raise figure odds, favoring the categories listed.
- Manpower can work on a wonder in **another settlement within range** (adjacent or movement range, as with support).
- **No projects.** Ordinary construction (roads, irrigation, granaries) is built automatically once the enabling advance applies, like institutions.

### Currency

- A single generic currency, collected as tax from settlements.
- **Uses:** setting discovery focus, buying on the market, stabilizing settlements.

## 7. Trade and the market — Decided

Trade is **market listings only**. There is no negotiation, proposal round, or treaty system.

| Element | Decision |
|---|---|
| Access | Requires a trade discovery. Before it, a civilization has no market access at all |
| Phase | Phase 2; orders placed and filled; goods usable the same turn |
| Counterparty | The game supplies and absorbs any quantity |
| Order types | **Limit** (maximum buy / minimum sell price) or **market** (accept the resulting price) |
| Market scope | **Per player:** a player's market includes their own orders plus those of every player directly in reach who has discovered trade |
| Reach | Each player's transport range, measured **settlement to settlement** (village or higher at both ends) |
| Reach symmetry | **Mutual:** if either player reaches the other, both include each other |
| Chaining | **Direct only:** A–B–C does not connect A and C |
| Pricing | Per player, recalculated each turn from the buy/sell imbalance in that player's market; orders then fill at the new price. Limit orders the new price misses go unfilled |
| Conflict | Civilizations in a conflict state are **excluded** from each other's markets |

Consequences:
- **Prices diverge by location**, since each player's market includes a different set of players.
- **Geographic middlemen** see the largest markets (Phoenicia, Venice).

## 8. Discovery and technology — Decided

### Lifecycle

| Stage | Meaning | Mechanic |
|---|---|---|
| **Plausible** | Conditions make the advance possible | Environment, needs, existing knowledge, contact, occupation |
| **Known** | The idea exists in the society | Accumulator plus historical-figure spikes |
| **Developed** | The technique is usable; applies **civ-wide** automatically | Same accumulator mechanic as Known, with different inputs |
| **Adopted → Mastered** | The society uses it, then gets full benefit | Civ-wide adoption %; benefit grows until mastered. How benefit scales varies by technology |

### Accumulators

- Each plausible advance has an accumulator. Conditions add progress each turn; breakthrough chance rises with progress.
- Historical figures spike or redirect accumulators.
- **Accumulators are fully visible** to the player.

### Discovery inputs

- **Environment:** local climate, geography, plants, animals, materials.
- **Practical problems:** food shortages, population pressure, transport difficulties.
- **Existing knowledge:** discoveries build on known advances.
- **Occupation:** any presence in an area with a revealed resource.
- **Contact:** market reach (same rules as pricing; see below), migration, conquest.
- **Social complexity:** specialists (especially High Learning) and organized labor.
- **Individuals:** historical figures.

### Ruler levers

The ruler holds two direct levers. Everything else is indirect.
1. **Assign manpower to High Learning** (any settlement).
2. **Set discovery focus** on a domain (costs currency).

### Knowledge spread between civilizations

- Uses the **same reach rules as market pricing** (settlement to settlement, mutual, direct only).
- Political conditions modify it: **conflict slows idea spread** between the two civilizations.
- **Conquest** grants discovery progress toward the defender's advances.
- **Scattered populations** carry knowledge into the areas and civilizations they migrate to.

### Military advances and counters

- Military advances modify conflict (strength multipliers, attack thresholds).
- **Each advance has a counter** (walls → siege weapons). Counters cancel the matching modifier.
- Counter relationships are designed **one technology at a time**.

### Knowledge and collapse (from v0.1, still the direction)

- Knowledge survives political collapse more readily than the material capacity to use it.
- Practical skills, infrastructure, and specialization may be lost when populations disperse.
- A later society may inherit an idea without immediately being able to exploit it.

## 9. Institutions and wonders — Decided

- **Generic institutions** (temples, archives, workshops) **auto-build** in every eligible settlement (towns and higher) once the enabling advance is **Known**. The player does not build them.
- **Ordinary construction** (roads, irrigation, granaries) is also automatic. There are no player-built projects.
- **Named wonders** (e.g., Angkor Wat when temples are unlocked) are the player's direct construction choice, buildable once the enabling advance is **Developed**.
- Named wonders require a **city**; great wonders require a **metropolis**.
- Wonders cost **manpower plus resources** (not currency). Manpower can come from settlements within range.
- Institutions and wonders **reduce instability**. Wonders score victory points.

## 10. Instability and collapse — Decided

### Meters

- Each settlement has a **local meter**. The civilization has a **civ-wide meter** that adds to every local meter.
- Collapse is checked **per settlement**.

| Raises local | Raises civ-wide | Lowers either |
|---|---|---|
| Food shortage | Overextension | Food surplus and stores |
| Lost support | War | Institutions and wonders |
| Nearby conflict | Settlement losses anywhere | Currency spending |
| Harsh figures (e.g., a tyrannical governor) | Rapid change (fast adoption) | Calming figures |
| Disasters (pending calamity tuning) | | Manpower in Bureaucracy (and, slightly, Artists) |

- **No natural decay.** A meter falls only when a stabilizer is active.

### Collapse

- When a settlement crosses its threshold, it **drops one tier** and its freed tokens **scatter** into adjacent areas, possibly into other civilizations' territory, carrying knowledge.
- The local meter is **partially reset** (e.g., halved).
- **Civilizations cannot collapse** as long as they have people left. Settlements can.

## 11. Conflict — Decided

| Element | Decision |
|---|---|
| Trigger | Combined tokens of two or more civilizations exceed the area's limit. Coexistence below the limit is allowed. Technologies may change this |
| Attrition | Deterministic. Each token has a **strength** (base 1); losses scale with enemy strength. Discoveries raise strength; counters cancel matching modifiers |
| Commander figures | Temporary conflict modifiers |

### Attacking settlements

| Tier | Tokens needed to attack | Defends as |
|---|---|---|
| Village | 7 | 6 |
| Town | 10 | 9 |
| City | 15 | 14 |
| Metropolis | 22 | 21 |

- Walls and similar advances raise these values; siege advances counter them.
- The settlement fights at its defense value using the defender's strength multiplier.
- **Capture:** the attacker takes the settlement **one tier lower**. Figure marks on it transfer to the new owner.
- **Spoils:** a share of the defender's currency (scaled by tier) plus discovery progress toward the defender's advances.

### Conflict state

- Two civilizations are **in conflict** for a set number of turns after any fighting between them. Technologies may change this.
- While in conflict: idea spread between them slows, they are excluded from each other's markets, and both take civ-wide war instability.

## 12. Calamities — Decided

### Trigger

- **Exposure-based:** frequency scales with a civilization's settlements and tiers (the original's equivalent: more cities drew more cards).
- Once a calamity occurs, **local conditions choose both the type and the target settlement**.
- **Risk levels are visible:** each settlement shows low/medium/high risk per calamity type, with reasons.
- **Specific advances mitigate specific calamities**, as in the original.
- Calamities that **spread** (the original's tradable calamities) travel along market reach or contact.

### Starting list

| Calamity | Kind | Favored by | Effect | Mitigated by (example) | Spreads |
|---|---|---|---|---|---|
| Flood | Environmental | Floodplains, rivers | Tokens lost; possible tier drop | Irrigation, flood control | No |
| Earthquake / volcano | Environmental | Fault or volcanic areas | Tier drop | Engineering, building codes | No |
| Drought | Environmental | Arid areas, climate | Food output drops for N turns | Irrigation, storage | No |
| Famine | Economic | Food deficit, low stores | Tokens lost; local instability | Pottery/storage, agriculture | No |
| Epidemic | Social | Dense settlements, trade contact | Tokens lost across settlements | Medicine, sanitation | Yes (market reach) |
| Civil disorder | Social | High instability | Instability spike; output lost | Law, institutions | No |
| Civil war | Social | Very high instability, large civilization | Settlements break away as independents | Unifying leaders, governance | No |
| Heresy / schism | Social | Institutions, religious advances | Institution effects suspended | Philosophy, tolerance | Yes (contact) |
| Barbarian raid | External | Frontier settlements near unsettled areas | Tokens lost; possible tier drop | Military advances, walls | No |
| Piracy | External | Coastal settlements, sea trade | Market access disrupted; currency lost | Navies | Yes (sea routes) |
| Market crash | Economic (later eras) | Market dependence, banking | Price shock; currency lost | Banking regulation | Yes (market reach) |

### Related rules

- **Independent settlements** (from civil war) can be absorbed by any civilization through conquest or by meeting conditions (e.g., market contact, stability).
- **Barbarians** spawn abstractly from unsettled areas; no barbarian civilization is simulated.

## 13. Historical figures — Decided

| Element | Decision |
|---|---|
| Form | **Named, short-lived:** a name and flavor text; acts once; recorded in the civilization's history |
| Effects | An immediate effect, a **lasting mark** (timed modifier on a settlement or domain), or both |
| Governors | A governor is a figure whose lasting mark sits on a settlement |
| Emergence | Each settlement rolls each turn; **conditions set the odds and the type** |
| Where | Any settlement; odds scale with tier |
| Visibility | **Hidden:** figures are surprises |
| Valence | Positive, negative, or mixed, depending on variant and conditions |
| Marks after capture | Stay with the settlement; the new owner gains them |
| Ruler control | None directly; the ruler shapes conditions only |

### Categories

Each category has **era-gated variants** chosen by conditions (e.g., psychologists and civil rights leaders do not appear in the Bronze Age).

| Category | Variants | Primary system |
|---|---|---|
| Leader | Tyrant, calming leader, unifier | Instability |
| Commander | Military commander | Conflict |
| Diplomat | Diplomat | Market reach, knowledge spread |
| Pathfinder | Explorer, pioneer | Map reveal, migration, settlement |
| Scholar | Mathematician, astronomer, archaeologist | Discovery (Plausible → Known); archaeologists recover knowledge lost in collapsed settlements |
| Innovator | Inventor, engineer | Discovery (Known → Developed), wonders and infrastructure |
| Thinker | Philosopher, psychologist | Adoption, social advances |
| Reformer | Reformer, activist, civil rights leader | Instability, institutions |
| Prophet | Prophet, mystic, cult leader | Institutions; stability or unrest that spreads |
| Artist | Artist | Wonders, stability, victory points |
| Merchant | Entrepreneur, banker | Market prices, currency income |

**Culture figures** (Artist, Prophet, Thinker) score victory points.

## 14. AST and civilizational progression — Decided

Follows the original Archaeological Succession Table, extended to the Modern era.

| Element | Decision |
|---|---|
| Eras | Stone → Bronze → Iron → Classical → Medieval → Renaissance → Industrial → Modern |
| Track | One row of spaces per civilization. The marker moves **1 space per turn**. The first space of each era is a **gate** |
| Gate requirements | A number of **Developed** advances plus a number of **settlement points** |
| Settlement points | Cities and metropolises only (starting values: city 1, metropolis 3) |
| Sprinting | While a civilization meets the requirements of an era **2 or more eras ahead** of its marker, it moves 2 spaces per turn |
| Regression | A civilization that no longer meets its current era's requirements drops to that era's **gate** and waits until it qualifies. It does not lose the era |
| Track length | Setup option (§2) |

## 15. Victory — Decided

| Element | Decision |
|---|---|
| Final era | Setup option |
| Trigger | When any civilization reaches the final AST space, an **endgame countdown** begins |
| Winner | Highest points when the countdown ends |
| Scoring | AST position, Developed advances, settlement points, wonders, culture figures, culture points |

## 16. Deliberate trade-offs and known tensions

These are choices made knowingly, or risks to watch in playtesting.

| Item | Tension |
|---|---|
| Civ-wide adoption % | Conflicts with the v0.1 idea that adoption spreads unevenly by region. Chosen for simplicity |
| Institutions auto-build at Known | Conflicts with "knowledge is not capability." Wonders still require Developed |
| Higher-tier value | Raw output per token falls sharply with tier (a metropolis ties up ~208 token-equivalents for 4 base manpower). Higher tiers rely entirely on exclusive abilities, which must be strong |
| Weak town tier | With specialists available at any tier, the town's only exclusive ability is auto-built institutions |
| Development ratio replaced | v0.2 initially derived manpower from a population ratio that rose with development. Replaced by tier base plus advance bonuses, which keeps manpower in small, readable whole units |
| No instability decay | Meters accumulate over a long game unless the ruler actively stabilizes |
| Collapse cascades | Settlement losses raise the civ-wide meter, which raises every local meter; combined with support cascades, one collapse can trigger others. Must not become routine |
| Unlimited game counterparty | A currency-rich civilization can buy its way out of any shortage. Price-change rate is the main brake |
| Mild AST regression | Regression costs position within an era, never the era itself |
| Derived track lengths | Poor starts are already penalized by requirements; shorter rows for good starts penalize them twice. Offered as a setup option only |
| Deterministic combat | Uncertainty comes from figures, discovery timing, and calamities instead |
| No diplomacy | Diplomats act only on market reach and knowledge spread |
| Long-arc content | The emergent discovery model needs a large authored set of advances, each with conditions, counters, and adoption effects |

## 17. Open questions

### Design

- [ ] Token growth rates, and how the original's growth rule extends.
- [ ] What specific transport discoveries do to movement range and goods range.
- [ ] Conditions for absorbing independent settlements peacefully.
- [ ] Barbarian spawn rules.
- [ ] Technology-by-technology design: plausibility conditions, counters, adoption benefits, mitigated calamities.
- [ ] Final resource category list.

### Tuning (playtesting)

- [ ] Settlement conversion costs and support requirements
- [ ] Tier exclusive abilities and tax per tier (the town tier especially)
- [ ] Base manpower per tier; stability, discovery, and culture yields per specialist
- [ ] Market starting prices and price-change rate
- [ ] Conflict state duration
- [ ] Settlement attack thresholds and defense values
- [ ] Instability thresholds, source and stabilizer magnitudes, partial-reset amount
- [ ] Calamity exposure rate and condition weights
- [ ] Figure emergence odds
- [ ] AST track lengths, gate requirements, settlement point values
- [ ] Endgame countdown length and scoring weights

## 18. Recommended next steps

1. **Author a vertical slice of content:** the Stone and Bronze eras, with roughly 20 advances (conditions, counters, adoption effects), a handful of resources, and the first calamities.
2. **Paper or spreadsheet prototype** of the core loop (population, settlements, manpower, support, instability) to test the settlement pyramid's economics before building software.
3. **Tune the pyramid.** The tier ROI tension (§16) is the most likely early balance problem.
4. **Prototype the market** with several civilizations at different ranges, to confirm per-player pricing is readable to players.

---

## Change log

- **0.2.1 (October 15, 2026):** Manpower designed: replaces resource slots; tier base plus advance bonuses; assignments to production, Bureaucracy, High Learning, Artists, and wonders. Currency-funded specialists and player-built projects removed. Culture points added to scoring.
- **0.2 (October 14, 2026):** Design interview. Decided game frame, setup options, turn structure and resolution order, map and population, settlement pyramid, resources and currency, market trade, discovery lifecycle mechanics, institutions and wonders, instability and collapse, conflict, calamities, historical figures, AST extension, and victory. Recorded trade-offs and remaining open items.
- **0.1 (October 4, 2026):** Initial draft of vision, principles, candidate systems, and open questions.
