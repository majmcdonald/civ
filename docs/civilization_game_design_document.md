# Civilization-Inspired Strategy Game — Design Document

**Version:** 0.12  
**Date:** October 18, 2026  
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
| Players | Version 1: single-player against AI. Multiplayer is a future enhancement |
| Turn mode | Simultaneous turns (the AI acts at the same time as the player) |
| Scope | Long arc: Stone Age to the Modern era; multi-session campaigns (save/resume required) |
| Map | Irregular areas (regions). Either a procedurally generated map or a fixed historical map |
| Player role | The ruling power: direct control over state decisions; discovery, adoption, and figures are indirect |
| Diplomacy | None for now. Conflict state is derived from events (see §11) |

### Setup options

| Option | Choices |
|---|---|
| Map | Procedural or historical |
| Map type (procedural) | **Inland sea** (default; like the original: one mainland around a central sea, a few islands), **continents** (landmasses separated by ocean; some civilizations isolated until ships), **single landmass** (little sea). Seas are divided into sea areas in every type |
| Civilizations | 2–15; default 5 (the player plus four AI). The original allowed 2–7. A procedural map scales with the count |
| AST track length | Same for everyone / derived from starting conditions / authored per civilization (historical maps only) |
| Final era | Any era; e.g., end of the Iron Age for a single evening, end of the Modern era for a full campaign |
| Room to expand | Land per civilization: **crowded** (half of standard, 32 land areas), **standard** (default, 64), **spacious** (2×, 128). Standard targets about 30–40 turns of expansion before a civilization's land meets a neighbor's (roughly the Stone Age); crowded makes neighbors meet early, spacious keeps the early game peaceful longer |

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
- Each area has a **population limit**. Limits are not fixed; discoveries raise them. Starting limits are **1–5**, as in the original.
- Each area has **resources** (see §6).
- Each land area has one **terrain** and any number of **features**:
  - Terrain: plains, forest, hills, mountains, desert, marsh. Terrain sets the starting limit range (e.g., plains 3–5, mountains 1–2) and which resources can appear.
  - Features: river, floodplain, coastal, volcanic/fault. Features drive calamity risk (§12) and travel (rivers and coasts need ships).
  - Example: "Hills, river, coastal; limit 3; copper, timber."
  - **Rivers** run through a chain of areas, ordered from source to sea; each area on the chain has the river feature. With ships, tokens travel several areas along the chain in one move (e.g., Highland → Valley → Delta in one turn). Rivers are not borders between areas and do not block movement.
  - The original had no terrain, only printed limits and markings (floodplains, volcanoes, coasts); terrain is added so drought and resources have something to key on and the map reads clearly.
  - A procedural generator may use hidden elevation and rainfall to place terrain sensibly; those values are not rules. Exact limit ranges per terrain are tuning.
- **Expansion window:** by default, a civilization can expand for about 30–40 turns before its land meets a neighbor's, so the early game allows peace. Map size, area limits, and growth pace are tuned to this target.

### Procedural maps

- Size scales with the civilization count and room to expand (§2): about **64 land areas per civilization** on a standard map (Phase 0), plus sea areas. The map type (§2) sets the land and sea layout. Rivers and fault chains scale with the land.
- **Starting positions use fair spacing.** Starts are placed as far apart as possible by travel distance, and each must pass a quality check: enough total area limit within about 3 moves and no more than a set share of mountains or desert. Among passing layouts, the generator prefers balanced nearby land (each start's share of the land closer to it than to any other start). If no layout passes, the generator re-rolls. On the continents type, the check applies per landmass. The original used hand-tuned printed starting regions instead.
- **Food resources** are placed by chance per area, from terrain and features (starting odds; tuning):

  | Area | Chance of food |
  |---|---|
  | Floodplain | Always (grain) |
  | Plains with a river | 50% (grain) |
  | Plains | 20% (grain) |
  | Coastal | 25% (fish) |
  | Marsh, forest, hills | 10% |
  | Mountains, desert without a floodplain | 0% |

  Grain and fish are rolled separately; when both succeed, the likelier one is placed (one food per area). Every start gets food within reach (3 moves): if none was rolled, grain goes on the likeliest area in reach, nearest first. Food is rolled on its own random stream, so placing it changes nothing else on the map.
- Other resources are not placed until their categories are decided (§6, §17).

### Population tokens

- Population is represented by **tokens** in areas.
- **No fixed supply.** A civilization's maximum token count is a **cap** that discoveries raise.
  - The cap counts **loose tokens only**. Tokens absorbed into settlements leave the count, as in the original, where building a city returned its tokens to the stock.
  - The cap starts at **55**, the original's token stock.
  - Advances raise the cap **1–2 times per era**. Rise sizes are set when those advances are designed.
  - Support tokens are loose and count against the cap, so the cap also bounds the number of settlements (roughly cap ÷ 4–5 in Phase 0). Each era's expansion is paced by its cap rises.
- **Each civilization starts with one token in its starting area**, as in the original. The Phase 0 simulation and the 30–40 turn expansion window assume this start.
- **Growth is automatic and proportional**: each turn, an area gains **0.5 per loose token** of each civilization in it. Growth never exceeds the area's population limit or the civilization's token cap. Resources and discoveries boost the rate (e.g., +0.25 per token); boost sizes are set when those are designed.
  - **Each area keeps its own growth progress** per civilization: fractions carry over until they make a whole token. Example: an area with 1 token shows "1 +½" after one turn and holds 2 tokens the next. The map badge shows the progress.
  - Progress survives moves and losses while at least one of the civilization's tokens stays in the area; when its last token leaves or dies, the progress is lost. Progress is never shared between civilizations.
  - **A full area gains no progress but keeps what it has**; growth resumes from it when room opens. When only part of a turn's growth fits (under the area limit or the token cap), whole tokens beyond the room are lost and the leftover fraction is kept. Example: hills, limit 3, holding 3 with ½ progress stays at ½; after 1 token leaves, the next turn adds 2 × 0.5 + ½ = 1.5, so 1 token and ½ carried over. As in the original, a full area simply does not grow.
  - Compared with the original's rule (+1 for 1 token, +2 for 2 or more), this is never faster at starting limits (1–5) and about half as fast at low counts; it overtakes the original only in areas holding more than 4 tokens, so boosts gain value as limits rise.
  - The 30–40 turn expansion window and token-cap pacing were tuned to the original's rule and must be re-simulated.
- **Loose tokens produce nothing and need no support.** They have no manpower. They matter as growth, as support for settlements, as a source of new settlements, as armies, and as discoverers (occupying a resource area contributes to related discoveries).

### Movement

- By default a token moves **one adjacent land area** per turn. Each civilization has a **movement range** (areas per turn), starting at 1.
- Transport discoveries (roads, railroads, flight, and similar) extend range.
- **Settlement step.** Stepping out of one of the civilization's own settlements (village or larger) entered during the move costs nothing, **once per move**. Example: plains → own village → hills is a single move at range 1; plains → own village → own village ends in the second village. Rival settlements give no step (entering one is an attack, §11). Settlements count as they stand at the end of allocation; planned conversions do not. An order names only its origin and destination; the engine checks the destination is in reach.
- **River and sea travel require discovering ships.**
- **Orders and resolution.** Moves are ordered in allocation and all resolve at once in resolution step 1, from where tokens stood at the end of allocation, so a token moves at most once per turn. Tokens may move into an area held by another civilization; whether that leads to conflict is decided in step 2 (§11).
- **Ordering moves (interface).** **Drag** from one of your areas with tokens left to move: the area gets a double-width blue border and every area in reach a normal blue outline (the one under the pointer shaded, with a faint arrow). Dropping on an area in reach sends **one token**; **Shift-drag sends all** tokens left to move. Dropping anywhere else cancels. A drag that starts elsewhere, or outside allocation, pans the map. Every planned move shows on the map as a **green arrow** carrying its token count ("+2"), and the source area's badge subtracts the tokens leaving (e.g., "4−3/4": 4 tokens, 3 leaving, limit 4). **Right-click an arrow** to take one token back, **Shift-right-click** to cancel the move; clicking an arrow selects its source area. **Undo all moves and settlements** clears every planned move, founding, and upgrade for the turn.
- **Selecting an area (interface).** A single click selects **any land area** (clicking it again, or the sea, clears the selection; so does Esc). The panel shows the area's details (name or terrain, holder, features, limit, food, everyone's tokens there) in any phase, and in allocation the actions it offers: tokens left to move, founding or upgrading, manpower. The hover box stays as a quick summary.

### Growth and surplus details

- Growth is counted from the tokens present before any growth is added. When an area's limit or a civilization's cap runs out partway, areas are filled in a fixed order (lower area numbers first, then player order). This only matters at the margins and keeps the game deterministic.
- Surplus removal applies to areas held by one civilization. Areas shared by several civilizations over the limit are resolved by conflict (§11), which runs before surplus removal.

## 5. Settlements — Decided

### The settlement pyramid

Settlements grow by absorbing tokens, extending the original's "6 tokens → city" rule into tiers. A village is founded from tokens; each later tier merges the settlement with additional tokens.

| Tier | Built from | Token value |
|---|---|---|
| Village | 6 tokens | 6 |
| Town | Village + 6 tokens | 12 |
| City | Town + 8 tokens | 20 |
| Metropolis | City + 10 tokens | 30 |

- **No skipping tiers.** A player with 100 tokens cannot convert straight to a metropolis.
- **Tiers are unlocked by advances.** A game starts with villages only. A Stone Age advance unlocks towns. Cities and metropolises are unlocked by later advances, following history: towns like Jericho and Çatalhöyük appeared late in the Stone Age, cities like Uruk at the Bronze Age transition, and metropolises like Babylon and Rome in the Iron and Classical ages.
- The tokens merged may be in the **same or adjacent areas**; the settlement stays where it is.
- **The area limit does not block construction**, as in the original: tokens gathered for a conversion may exceed the limit, because conversion resolves before surplus removal.
- Conversion is ordered in allocation and resolves after conflict.
- **Which tokens are used.** The player picks only the settlement's area; the engine picks the tokens at resolution, from positions after this turn's movement. It takes the area's own tokens first, then tokens from adjacent areas holding the most of the civilization's tokens (lower area numbers break ties). If too few are in reach, the order fails and the player is told why. The original needed all 6 tokens in the city's own area.
- **Ordering conversions (interface).** Click one of your areas and choose "Found village" (or "Upgrade" on a settlement). A planned conversion shows on the map as a ghost (translucent) settlement piece, and is listed in the planning panel, which also shows any warning. The ghost does not react to clicks, so clicking its area always plans moves as usual. The planning panel's "Unfound village" (or "Cancel upgrade") button, or the × in its list, undoes the order at any time before resolution.
- Starting numbers; to be tuned.

### Names

- The player can **name a settlement** when it is founded or later, from the Civilization overview. A settlement without a name shows as "Unnamed" (e.g., "Unnamed – Town"); naming is optional.
- Names follow the settlement through tier changes and capture; the new owner can rename it. Naming is a command, so it is saved and replayed like any other action.

### Area limits

- **One settlement per area.**
- **A settled area is fully populated**, as in the original: it holds no loose tokens. Loose tokens left there after a conversion are removed as surplus. Upgrades draw their tokens from adjacent areas.
- Area limits therefore govern loose tokens only and stay small, on roughly the original's scale (1–5 or 2–10; to be tuned).
- Consequence: settlements need **unsettled hinterland**. Their support tokens live in adjacent unsettled areas, so settling an area can starve a neighbor's support. In the Phase 0 simulation, about 40–60% of areas could be settled.

### Support

Follows the original's pattern (a city needed 2 tokens of support): tokens consumed in a conversion are gone, and support comes from **separate, additional** loose tokens.

| Tier | Support tokens | Total tokens tied up |
|---|---|---|
| Village | 2 | 8 |
| Town | 3 | 15 |
| City | 4 | 24 |
| Metropolis | 6 | 36 |

- Supporting tokens must be **adjacent or within movement range**, in unsettled areas (settled areas hold no loose tokens). Each token supports one settlement.
- **New settlements get no grace turn**, as in the original: support is checked in step 6 of the turn a settlement is founded or upgraded. When the player plans a conversion, the planning panel shows the support left after the engine takes its tokens (counting this turn's planned moves) and warns when the settlement will drop, e.g., "Only 1 of 2 support after founding — the village will dissolve."
- Support tokens are assigned by the engine: larger tiers claim first, then lower area numbers.
- If support fails, the settlement **drops a tier** (see Tier drop). Support is checked every turn and a settlement drops at most one tier per check, so one still short next turn drops again. Settlements do not support each other, so there is no cascade between tiers; collapse spreads through the civ-wide meter (§10).
- A variant (tokens plus one lower-tier settlement within range) will be compared in the Phase 0 simulation.

### Tier drop

One procedure applies whenever a settlement drops a tier: instability collapse (§10), support failure, calamities (§12), and capture (§11). **Capture releases no refugees**: the settlement's defense value already stands for its people, who died fighting (§11).

- The settlement loses **one tier**. A village **dissolves**, and its area becomes unsettled.
- The freed tokens equal the difference in token value: town → village 6, city → town 8, metropolis → city 10, village dissolved 6.
- Freed tokens become **refugees** and **ignore area limits for one turn**.
- **Where refugees go.** Refugees fill the settlement's own area (now unsettled) up to its limit first, as in the original, where a reduced city was replaced by tokens in its area. The rest are dealt one at a time to adjacent areas that are the civilization's own or empty, those with the most room first (lower area numbers break ties). They enter other civilizations' areas only when no own or empty adjacent area exists.
- **Refugees and the token cap.** Like area limits, the cap ignores refugees for their grace turn. At the end of the following turn, a civilization still over its cap loses the excess, taken from its fullest areas first (lower area numbers break ties). During that turn they can move on, or be used for conversions or support. Surplus removal applies to them at the end of the following turn.
- Refugees carry knowledge into the areas and civilizations they reach (§8).
- **Refugees in foreign territory join the host civilization** and become its tokens, adding discovery progress toward the origin civilization's advances. The host may **reject** them. Rejected refugees stay the origin's tokens, do not trigger conflict during their refugee turn, and must move on, be used by their own civilization, or be removed as surplus.

### Urban growth

Settlements **generate tokens into adjacent areas** with spare capacity: cities feed their hinterland.

| Tier | Tokens per turn |
|---|---|
| Village | 0 |
| Town | 1 |
| City | 2 |
| Metropolis | 3 |

- Urban growth goes to adjacent unsettled areas with room that are the civilization's own or empty, most room first (lower area numbers break ties), within the token cap. If none has room, it is lost. It follows area growth in resolution step 8.
- Its main role is **recovery**: area growth (§4) fills open land faster, so urban growth matters most after losses (conflict, calamities, collapse) or when discoveries raise area limits. The Phase 0 simulation showed it has little effect while land is open.

### Tier abilities (starting ladder)

Each tier keeps the abilities of the tiers below it. Higher tiers justify their cost through **exclusive abilities** (raw output alone does not justify them; see §16).

| Tier | Base manpower | Abilities |
|---|---|---|
| Village | 1 | Produce resources; host specialists; market endpoint |
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

- **Goods last one turn.** Goods are produced in phase 1, can be traded in phase 2, and are used in resolution; anything unused is lost at the end of the turn. Example: wheat gathered in turn 10 and not used cannot cover a support shortfall in turn 14. Storage comes later through advances (e.g., granaries for food), which may let some goods carry over or spoil slowly. The original kept commodity cards in hand between turns; this design does not.

Candidate resource categories (from v0.1, not yet finalized): renewable production, extracted materials, manufactured goods, stored resources.

### Transport

- Produced goods must be transported to where they are used.
- **Adjacent areas share goods freely**, with no discovery required.
- Moving goods farther requires transport discoveries.

### Food

- **Food is a special resource**, not a base need. It appears only in some areas (e.g., wheat on a floodplain), and nothing consumes food by default: loose tokens live off the land (area limits stand for carrying capacity, as in the original) and settlements are fed by their support tokens.
- **Any settlement can produce food**, with production manpower, once its civilization has discovered the technology that farms that resource. Example: a village on a wheat floodplain farms nothing until irrigation (or similar) is discovered, then can assign its 1 manpower to wheat.
- **Food is a category of named goods**, each with its own market price: grain and fish to start, more later (cattle, rice). Any food good counts as food for support. As in the original, where each commodity (grain, cloth, salt) had its own cards and value.
- **Food is a good like any other resource**: production manpower gathers it in phase 1, and it can be traded on the market in phase 2 (§7). Further uses may be added later.
- **Food substitutes for support tokens: 1 food replaces 1 support token**, and 1 production manpower gathers 1 food. Example: a town (2 manpower, 3 support) left with 1 support token can farm with both manpower and stay a town, but does no other work that turn. A village (1 manpower, 2 support) can cover only half its own support, so settlements still need hinterland.
- **Food in reach.** A settlement can be supported by its own food or food gathered by one of its civilization's settlements in an adjacent area (§6, Transport); farther food needs transport discoveries or the market. The engine assigns food in the support check (resolution step 6), after support tokens, larger tiers first, then lower area numbers. Example: a town 1 support short is covered by a neighbouring village's grain; fish gathered three areas away cannot help.
- **Food goods differ through advances and storage, not base yield or conversion.** Every food good starts at 1 food per manpower and 1 support per food. Grain gains from the plough and irrigation and later keeps in granaries; fish gains from boats and nets, scales less, and spoils without salt. Historically, fishing matched or beat early farming (Jōmon, Pacific Northwest, Baltic), but grain scaled with technology and stored for years, which made it the base of early states.
- Earlier direction, not decided now that food is a special resource (§17): food surplus drives growth; stores buffer shortages and calamities; shortage raises instability, surplus and stores lower it.

### Manpower

Manpower is a settlement's labor. Every unit is spent each turn on exactly one assignment, so labor sent to a wonder or to learning is output not produced.

- Each settlement has **whole units of manpower**: a tier base (village 1, town 2, city 3, metropolis 4) plus **advance bonuses**.
- **Advance bonuses apply only when the related work is being done.** Example: the plow gives nothing to a town whose manpower is all mining. The bonus type (per-unit multiplier, task-tied extra unit, or other) **varies by advance** and is designed one technology at a time.
- Loose tokens have no manpower.
- **Assignments are standing orders.** Manpower keeps its assignment every turn until the player changes it in allocation. Assignments made in allocation produce in the next turn's resources phase (§3), so food for a support check is gathered at the start of that turn, from the previous turn's assignments. A new settlement starts on its area's food if it has any, otherwise unassigned; unassigned manpower produces nothing, and the planning panel flags it where the area has something to gather. An upgrade puts its new manpower on the area's food; a tier drop removes unassigned manpower first, then the most recently changed assignment; a captured settlement starts over as if new.

| Assignment | Work | Effect | Favors figures |
|---|---|---|---|
| **Production** | Farming, mining, building | One of the area's resources per unit | — |
| **Bureaucracy** | Works for the state | Lowers instability, 1 per unit per turn: its own settlement first, then the civ-wide meter (§10) | Leader, Reformer, Diplomat |
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

### First version (Phase 3)

Built before most sources and stabilizers exist; the rest arrive in Phase 4. Starting numbers, to be tuned.

| Item | Meter | Value |
|---|---|---|
| Overextension | Civ-wide | +1 per turn for each settlement beyond 6 |
| Settlement losses | Civ-wide | +1 per tier lost to support failure (a drop or dissolve) or capture (the loser loses the whole settlement: village 1, town 2, city 3, metropolis 4). **Collapse does not count**: it is already the result of instability, and counting it would turn a collapse at the edge into a cascade |
| Lost support | Local, on the settlement that dropped | +2 (none if it dissolved) |
| Nearby conflict | Local | +1 for each settlement in or adjacent to an area where its civilization's tokens or settlement fought |
| Bureaucracy | Local first, the rest civ-wide | −1 per unit per turn; the capital has 1 free unit |
| Threshold | Local + civ-wide | Village 8, town 10, city 12, metropolis 14, lowered by distance from the capital (below) |
| Collapse | — | One tier (§5, Tier drop, with refugees); the local meter is halved, rounded down; at most one drop per turn |

- **Capital.** A civilization's first settlement is its capital. It has **one free, invisible Bureaucracy unit** on top of its manpower, so a civilization can hold 7 settlements before overextension outruns it. When the capital is lost, the largest remaining settlement becomes the capital at once, nearest the old capital first (lower area numbers break ties); nothing else happens. The capital is marked with a gold star on the map.
- **Distance from the capital lowers the threshold** by 1 for every 2 land moves beyond 2, by at most 4, and never below half the tier's base. A settlement with no land route to the capital counts as the farthest band. So as the civ-wide meter rises, **the far edge collapses first**; each collapse removes a settlement, which slows overextension, and the core settles close to its limit.

  | Distance | Village | Town | City | Metropolis |
  |---|---|---|---|---|
  | 0–2 | 8 | 10 | 12 | 14 |
  | 3–4 | 7 | 9 | 11 | 13 |
  | 5–6 | 6 | 8 | 10 | 12 |
  | 7–8 | 5 | 7 | 9 | 11 |
  | 9+ or no land route | 4 | 6 | 8 | 10 |

  Example: civ-wide meter 6, 9 settlements. Villages 5 or more moves out collapse; the meter stays at 6. Next turn overextension adds +1 (7 settlements, so +1 beyond the free 6), and villages 3–4 moves out (threshold 7) collapse. With 6 left, overextension stops and the meter holds at 7, below the core's 8.
- **Bureaucracy calms locally first.** Each unit removes 1 from its own settlement's meter; what is not needed there comes off the civ-wide meter. Example: a town with 1 unit, local 0 and civ-wide 3 lowers the civ-wide meter to 2. Meters never go below 0.
- **Timing.** Bureaucracy works in the resources phase, like production, so a change made in allocation counts from next turn. Resolution step 7 adds the turn's sources, then checks collapse; tiers lost to collapse add to the civ-wide meter after the check, counting toward next turn.
- **No settlements, no state.** A civilization left with no settlements at the end of step 7 has its civ-wide meter reset to 0, so a full collapse becomes a dark age it can rebuild from instead of a permanent lockout (a new village counts the civ-wide meter the turn it is founded). A surviving settlement keeps the meter; it must be brought down with Bureaucracy.
- **Capture** starts the captured settlement's local meter at 0 for its new owner (the nearby-conflict +1 still applies).
- **Interface.** Selecting a settlement shows "Instability 4 + 3 of 10" (local + civ-wide of threshold), why its threshold is what it is ("4 areas from the capital"), last turn's changes, and a Bureaucracy row beside the area's resources. While overextension outruns the civilization's Bureaucracy, the planning panel warns that unrest is rising and the farthest settlements will collapse first. Settlements within 2 of collapse carry a warning mark on the map. The Civilization overview has a Stability card (civ-wide meter, overextension, Bureaucracy, settlements close to collapse) and an instability column. The turn report names each collapse.

### Collapse

- When a settlement crosses its threshold, it **drops one tier** (§5, Tier drop); its freed tokens become refugees in adjacent areas, possibly in other civilizations' territory, carrying knowledge.
- The local meter is **partially reset** (e.g., halved).
- **Civilizations cannot collapse** as long as they have people left. Settlements can.

## 11. Conflict — Decided

| Element | Decision |
|---|---|
| Trigger | Combined tokens of two or more civilizations exceed the area's limit. Coexistence below the limit is allowed. Technologies may change this |
| Attrition | Deterministic. Each token has a **strength** (base 1); a civilization's **power** in an area is the sum of its tokens' strength. Discoveries raise strength; counters cancel matching modifiers. Losses follow the original's removal rule (below) |
| Commander figures | Temporary conflict modifiers |

### Removing tokens in conflict

- Following the original, the civilizations in an over-limit area remove tokens **one at a time, taking turns**, until the area is within its limit or only one civilization is left.
- **The side with the least power removes first** (the original used the fewest tokens; with every token at strength 1 the two are the same).
- Example: Plains, limit 3; you have 4 tokens, a rival 2. The rival removes (4 vs 1), then you (3 vs 1), then the rival (3 vs 0).
- **Rounds.** In each round every side removes one token, weakest power first, stopping as soon as the area is within its limit; the order is recomputed from power at the start of each round. **Sides with equal power remove together**, as in the original, even if that removes one more token than needed (Plains, limit 3, 2 vs 2 ends 1 vs 1).
- Three or more sides follow the same order. Example: Plains, limit 3; you 3, rival A 2, rival B 1. B removes (3/2/0), then A (3/1/0), then you (2/1/0).

### Attacking settlements

| Tier | Tokens needed to attack | Defends as |
|---|---|---|
| Village | 7 | 6 |
| Town | 10 | 9 |
| City | 15 | 14 |
| Metropolis | 22 | 21 |

- A settled area is fully populated (§5), so **any enemy token entering it attacks the settlement**. All tokens a civilization has in the area after movement attack together.
- **Below the threshold**, the attackers fight the settlement's defense value and are destroyed; the settlement is unharmed.
- **At or above the threshold**, the settlement fights as a side of tokens equal to its defense value, using the removal rule above, until one side has none left; there is no area limit to stop at. If the defense is eliminated, the attackers capture. Example: 9 attackers against a village (defends as 6): the village, weaker, removes first each round and is gone after its sixth removal, leaving 4 attackers to capture; 7 attackers capture with 2. If the last tokens on both sides fall together, no one is left to capture and the settlement holds.
- **Reinforcements.** The defender's own tokens in the area after movement add their power to the defense. The threshold is still checked against the settlement's own value; reinforcements only strengthen the fight. Example: 8 attackers against a village reinforced by 3 fight 8 vs 9 and are destroyed. Reinforcements that survive beyond the garrison are removed as surplus (§3, step 9).
- **Several attackers.** Each attacker's threshold is checked separately; attackers below it are destroyed first. The settlement then joins the remaining attackers as one side (power = defense value plus reinforcements) in a single fight under the removal rule, weakest first, until one side is left. A surviving attacker captures. Example: village (6) attacked by A 8 and B 7 runs 8/7/6 → 7/6/5 → … → 3/2/1; in the sixth round the village falls (A 2, B 1), then B removes and A captures with 2.
- Walls and similar advances raise these values; siege advances counter them.
- The settlement fights at its defense value using the defender's strength multiplier.
- **Capture:** the attacker takes the settlement **one tier lower** (§5, Tier drop). Figure marks on it transfer to the new owner.
- **Surviving attackers.** When a town or larger is captured, the survivors garrison it and are removed, since a settled area holds no loose tokens (§5). When a village is captured, it is destroyed and the survivors stay as loose tokens up to the area's limit; any extra is surplus. A capture releases no refugees (§5, Tier drop). Example: 13 attackers take a town (defends as 9), win with 5, and the 5 garrison the new village. The new owner must support the captured settlement the same turn (§5).
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
| Higher-tier value | With token-based tiers, tokens tied up per base manpower is roughly flat (village 8, town 7.5, city 8, metropolis 9). Accepted: climbing is justified by exclusive abilities and by advances, not by raw manpower |
| Weak town tier | With specialists available at any tier, the town's only exclusive ability is auto-built institutions |
| Development ratio replaced | v0.2 initially derived manpower from a population ratio that rose with development. Replaced by tier base plus advance bonuses, which keeps manpower in small, readable whole units |
| No instability decay | Meters accumulate over a long game unless the ruler actively stabilizes |
| Collapse cascades | Settlement losses raise the civ-wide meter, which raises every local meter, so one collapse can trigger others. Must not become routine |
| Fast map fill | Phase 0 simulation (before proportional growth, v0.10; to be re-run): with the original's growth rule and no effective cap, one civilization filled a 64-area map in about 20 turns. Resolved by the token cap (55, loose tokens only, 1–2 rises per era): with two Stone Age rises, land fills around turn 36; with fewer, it may never fill, so peace is the default until cap-raising advances add pressure |
| No support cascades | Settlements are supported by tokens, not lower tiers (v0.3). Simpler and keeps token counts small, but removes tier-to-tier cascades. Fully populated settled areas restore a hinterland requirement |
| Uneven expansion window on continents | On the continents map type, an isolated civilization may meet no one in the Stone Age while others meet early. Accepted for variety; the inland sea default keeps the 30–40 turn window predictable |
| Low manpower ceiling | Fully populated settled areas cap how much of the map can be settled (about 40–60% in Phase 0), and high tiers are rare at small limits. Chosen for spatial decisions over density; discoveries that raise limits lift the ceiling |
| Unlimited game counterparty | A currency-rich civilization can buy its way out of any shortage. Price-change rate is the main brake |
| Mild AST regression | Regression costs position within an era, never the era itself |
| Derived track lengths | Poor starts are already penalized by requirements; shorter rows for good starts penalize them twice. Offered as a setup option only |
| Deterministic combat | Uncertainty comes from figures, discovery timing, and calamities instead |
| No diplomacy | Diplomats act only on market reach and knowledge spread |
| Weak AI during tuning | The AI stays minimal until development Phase 7, so balance numbers set earlier are tuned against a weak opponent and need a retuning pass |
| Long-arc content | The emergent discovery model needs a large authored set of advances, each with conditions, counters, and adoption effects |

## 17. Open questions

### Design

- [x] ~~How the original's growth rule extends~~ — kept unchanged (v0.3).
- [x] ~~Growth variant: original rule vs proportional~~ — proportional, 0.5 per loose token with per-area progress (v0.10).
- [ ] What specific transport discoveries do to movement range and goods range.
- [ ] Conditions for absorbing independent settlements peacefully.
- [ ] Barbarian spawn rules.
- [ ] Technology-by-technology design: plausibility conditions, counters, adoption benefits, mitigated calamities.
- [ ] Final resource category list.
- [ ] Game name. Placeholder: *Succession* (after the Archaeological Succession Table).
- [x] ~~Per-area tier caps~~ — replaced by one settlement per area (v0.3).
- [ ] Map size per civilization (procedural maps scale land areas by civilization count). Phase 0 used 64 areas per civilization; with limits 1–5, cap 55, and two Stone Age rises, land filled around turn 36.
- [ ] Which advances unlock towns, cities, and metropolises.
- [ ] Tier drop details: how the host accepts or rejects refugees under simultaneous turns (standing policy or per-event choice); whether accepted refugees count against the host's cap; whether a ruler can exploit deliberate collapse to transfer tokens.
- [ ] Names for rival civilizations' settlements (generated name lists, or unnamed).
- [ ] What happens to a settlement's name when it dissolves or is refounded.
- [ ] Support variant: tokens only (current) vs tokens plus one lower-tier settlement in range. Compared in the Phase 0 simulation.
- [ ] Food: whether food still drives growth, stores buffer shortages, and shortage raises instability now that food is a special resource.

### Tuning (playtesting)

No balance changes until the Stone Age is complete (development plan §4, Tuning); the items below wait for that pass.

- [ ] Settlement conversion costs and support requirements
- [ ] Starting limit range and resource options per terrain; terrain mix on procedural maps; food odds per terrain and feature
- [ ] Tier exclusive abilities and tax per tier (the town tier especially)
- [ ] Base manpower per tier; stability, discovery, and culture yields per specialist
- [ ] Market starting prices and price-change rate
- [ ] Conflict state duration
- [ ] Settlement attack thresholds and defense values (set when settlements were worth 6/12/24/48 tokens; now 6/12/20/30)
- [ ] Instability thresholds, source and stabilizer magnitudes, partial-reset amount (first-version values in §10)
- [ ] Calamity exposure rate and condition weights
- [ ] Figure emergence odds
- [ ] AST track lengths, gate requirements, settlement point values
- [ ] Endgame countdown length and scoring weights

## 18. Recommended next steps

See the [development plan](development_plan.md) for build phases.

1. **Author a vertical slice of content:** the Stone and Bronze eras, with roughly 20 advances (conditions, counters, adoption effects), a handful of resources, and the first calamities.
2. ~~**Prototype the core loop economy**~~ — done in Phase 0 (`sim/phase0/sim.ts`); reshaped the pyramid, settlement, and cap rules (v0.3).
3. **Re-run the economy simulation** once Stone Age advances, calamities, and historical figures are designed, to retune pacing with them in play.
4. **Prototype the market** with several civilizations at different ranges, to confirm per-player pricing is readable to players.

---

## Change log

- **0.12 (October 19, 2026):** Instability, first version: overextension (+1 civ-wide per turn per settlement beyond 6), settlement losses (+1 civ-wide per tier lost), lost support (+2 local) and nearby conflict (+1 local). Bureaucracy is a manpower assignment in any settlement: −1 per unit per turn, its own meter first, the rest civ-wide; it works in the resources phase. Collapse thresholds rise by tier (village 8, town 10, city 12, metropolis 14) and fall with distance from the capital (−1 per 2 land moves beyond 2, at most −4, never below half); collapse drops one tier and halves the local meter, and does not count as a loss. The capital is the first settlement, has one free Bureaucracy unit, and passes to the largest remaining settlement when lost. A civilization with no settlements left has its civ-wide meter reset to 0. The planning panel warns while overextension outruns Bureaucracy. War, food, and the other sources and stabilizers wait for their systems.
- **0.11 (October 19, 2026):** Moves are planned by drag and drop: a drag sends one token, Shift-drag sends all; right-click an arrow takes one back, Shift-right-click cancels it. A drag starting off your tokens pans. A single click selects any land area and shows its details, plus its actions in allocation; the hover box stays. Each civilization has a movement range, starting at 1 and raised by transport discoveries. Settlement step: leaving one of your own settlements entered during a move costs nothing, once per move (plains → own village → hills is one move).
- **0.10 (October 18, 2026):** Food is a special resource found only in some areas, not a base need: nothing eats by default. Any settlement can produce it with production manpower once the farming technology for that resource is discovered. Food is gathered by production manpower and traded on the market like any other good; it substitutes for support tokens. Goods last one turn; storage arrives later through advances such as granaries. Food is placed by chance from terrain and features (floodplains always), and every start has a food area within reach (grain is added if none was rolled). Food goods are named (grain, fish), each with its own price; any of them counts for support. 1 manpower gathers 1 food and 1 food replaces 1 support token for every food good; goods differ through advances (plough and irrigation for grain, boats and nets for fish) and storage. Food supports its own settlement or an adjacent one of the same civilization, assigned by the engine after support tokens. Manpower assignments are standing orders, taking effect in the next resources phase; new settlements start on their area's food. Added open questions on the earlier growth, store, and instability roles of food. Growth replaces the original's rule (+1 / +2 per area) with 0.5 per loose token, boosted by resources and discoveries; each area keeps its fractional progress until it makes a whole token, losing it when the civilization's last token there leaves or dies; a full area keeps its progress but gains none. The expansion window and cap pacing must be re-simulated.
- **0.9 (October 16, 2026):** The undo button also clears planned foundings and upgrades. Ghost settlements ignore clicks; a planned founding or upgrade is undone with the planning panel's "Unfound village" / "Cancel upgrade" button. Conflict losses follow the original's removal rule: sides take turns removing one token until the area is within its limit or one side is left; the side with the least power (sum of token strength) removes first. Rounds run weakest first; equal power removes together; three or more sides follow the same order. A settlement attacked at or above its threshold fights as its defense value in tokens under the removal rule until one side is eliminated. Surviving attackers garrison a captured town or larger and are removed; a captured village is destroyed and survivors stay up to the area's limit. Capture releases no refugees. The defender's own tokens moved into an attacked settlement's area add their power to its defense. Several attackers on one settlement fight it and each other in a single fight, after attackers below the threshold are destroyed. A captured settlement keeps its name. If the last tokens on both sides of a settlement fight fall together, the settlement holds.
- **0.8 (October 16, 2026):** Conversions: the player picks the area, the engine picks the tokens at resolution (own area first, then the fullest adjacent areas). Planned conversions show on the map as ghost pieces and can be undone until resolution. Arrows carry their count; source badges show tokens leaving ("4−3/4"); Undo all moves clears the turn's moves. New settlements need their support the turn they are built, with a warning when planning; the engine assigns support tokens, larger tiers first. Refugees fill the dropped settlement's own area up to its limit, then own or empty neighbors with the most room; rival areas only as a last resort. Refugees ignore the token cap for their grace turn; any excess left after it is removed from the fullest areas. Urban growth goes to own or empty neighbors with the most room. An unsupported settlement drops one tier per turn.
- **0.7 (October 16, 2026):** Each civilization starts with one token in its starting area, as in the original. Movement orders resolve simultaneously from end-of-allocation positions; moves are planned by clicking an area, then its neighbors, and show as clickable green arrows. Growth counts from pre-growth tokens with a fixed fill order when a limit or cap runs out; surplus removal covers single-civilization areas, leaving shared ones to conflict.
- **0.6 (October 16, 2026):** Players can name settlements at founding or from the Civilization overview; unnamed ones show as "Unnamed". Added open questions on rival settlement names and names after dissolution or capture.
- **0.5 (October 16, 2026):** Civilizations raised to 2–15. Room to expand setup option (crowded, standard, spacious: 0.5×, 1×, 2× land per civilization) replaces map density; a 4× option was tried and dropped as too heavy to draw for now.
- **0.4 (October 15, 2026):** Civilization count is a setup option: 2–7, default 5; procedural maps scale with it. Land areas have one terrain (plains, forest, hills, mountains, desert, marsh) and feature flags (river, floodplain, coastal, volcanic/fault); terrain sets limit ranges and resource options, features drive calamity risk. Rivers are ordered chains of areas from source to sea, traveled by ship. Procedural map type is a setup option: inland sea (default), continents, single landmass; seas are divided into sea areas. Starting positions use fair spacing with a quality check.
- **0.3 (October 15, 2026):** Settlement pyramid reworked: each tier is reached by merging the settlement with additional tokens (village 6, town +6, city +8, metropolis +10) rather than merging two lower-tier settlements. Support is loose tokens scaling by tier (2/3/4/6); support cascades between tiers removed. A metropolis now ties up 36 tokens instead of 208. Token growth uses the original's rule unchanged (+1 / +2 per area). Urban growth set at 0/1/2/3 per tier, framed as recovery. Expansion window target of 30–40 turns; map density added as a setup option. Construction follows the original: area limits do not block it, one settlement per area, and a settled area is fully populated; area limits return to a small scale. Tiers above village are unlocked by advances (towns in the Stone Age). Token cap counts loose tokens only, starts at 55, and rises 1–2 times per era; starting area limits 1–5. Recommended next steps updated after Phase 0. Added a shared tier-drop procedure with refugees that ignore area limits for one turn; refugees in foreign territory join the host unless rejected. Any enemy entry into a settled area is an attack; below the threshold the attackers are destroyed. Updated §16 (higher-tier value accepted; fast map fill added); added open questions on per-area caps and the support variant.
- **0.2.2 (October 15, 2026):** Version 1 is single-player; multiplayer moved to a future enhancement. Added weak-AI tuning risk. Linked the development plan.
- **0.2.1 (October 15, 2026):** Manpower designed: replaces resource slots; tier base plus advance bonuses; assignments to production, Bureaucracy, High Learning, Artists, and wonders. Currency-funded specialists and player-built projects removed. Culture points added to scoring.
- **0.2 (October 14, 2026):** Design interview. Decided game frame, setup options, turn structure and resolution order, map and population, settlement pyramid, resources and currency, market trade, discovery lifecycle mechanics, institutions and wonders, instability and collapse, conflict, calamities, historical figures, AST extension, and victory. Recorded trade-offs and remaining open items.
- **0.1 (October 4, 2026):** Initial draft of vision, principles, candidate systems, and open questions.
