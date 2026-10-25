# Civilization-Inspired Strategy Game — Design Document

**Version:** 0.19  
**Date:** October 24, 2026  
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
| Advanced start | Off (default) or on. On: each civilization draws **2 advances** of its own from the first ring (advances that build only on the starting baseline, §8), granted Developed and Mastered like the baseline. Draws come from the game seed, so civilizations differ from turn 1 and a game still replays exactly |
| AST track length | Same for everyone / derived from starting conditions / authored per civilization (historical maps only) |
| Final era | Any era; e.g., end of the Iron Age for a single evening, end of the Modern era for a full campaign |
| Room to expand | Land per civilization: **very crowded** (a quarter of standard, 16 land areas; v0.19), **crowded** (half of standard, 32 land areas), **standard** (default, 64), **spacious** (2×, 128). Standard targets about 30–40 turns of expansion before a civilization's land meets a neighbor's (roughly the Stone Age); crowded makes neighbors meet early, spacious keeps the early game peaceful longer. Very crowded is for fighting from the start: a civilization's land holds fewer tokens than the starting cap, so tokens press into neighbors within about 15 turns, and starts may be 3 moves apart instead of 4 so that 2–15 civilizations fit |

## 3. Turn structure — Decided

Four phases. All players act simultaneously within each phase.

| Phase | What happens |
|---|---|
| **1. Resources** | Settlements produce from manpower assigned to production. Taxes are collected as currency |
| **2. Trade** | Players with the trade discovery place market orders; prices are set and orders filled. Goods are usable this turn |
| **3. Allocation** | Players assign manpower (production, Bureaucracy, High Learning, Artists, wonders), set the study queue (§8), spend currency (stabilization), order movement and migration, and order settlement conversions |
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
- **Starting positions use fair spacing.** Starts are placed as far apart as possible by travel distance, at least 4 moves apart (3 on very crowded maps), and each must pass a quality check: enough total area limit within about 3 moves and no more than a set share of mountains or desert. Among passing layouts, the generator prefers balanced nearby land (each start's share of the land closer to it than to any other start). If no layout passes, the generator re-rolls. On the continents type, the check applies per landmass. The original used hand-tuned printed starting regions instead.
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
- **Livestock and copper** (v0.14) are placed after food, on their own random stream, only in areas with no other resource, so an area holds at most one: livestock on plains (25%) and hills (20%), then copper on hills (15%) and mountains (30%). Starting odds; tuning.
- Other resources are not placed until their categories are decided (§6, §17).

### Population tokens

- Population is represented by **tokens** in areas.
- **No fixed supply.** A civilization's maximum token count is a **cap** that discoveries raise.
  - The cap counts **loose tokens only**. Tokens absorbed into settlements leave the count, as in the original, where building a city returned its tokens to the stock.
  - The cap starts at **55**, the original's token stock.
  - Advances raise the cap **1–2 times per era**. Rise sizes are set when those advances are designed. Stone Age: Weaving +5 when Developed (clothing) and Agriculture +5 when Mastered (food surplus), 55 → 65 (v0.14, §8).
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
- **Tiers are unlocked by advances.** A game starts with no tiers: Permanent Settlement unlocks villages and Chiefdom unlocks towns (v0.14, §8). Cities and metropolises are unlocked by later advances, following history: towns like Jericho and Çatalhöyük appeared late in the Stone Age, cities like Uruk at the Bronze Age transition, and metropolises like Babylon and Rome in the Iron and Classical ages.
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

- **Fed from its own fields** (v0.18): a settlement of any tier that has manpower gathering food and eats some of its own food for support in resolution step 6 adds **+1 urban growth** that turn, however much food it gathered. Food it sends to a neighbor does not count, and neither does food it eats from a neighbor. Example: a village with 1 manpower on grain is 1 support short and eats its own grain: it adds 1 token to a neighbor that turn; with its support fully covered by tokens, the grain goes uneaten and it adds none.
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

- **Luxury goods** (v0.14). A category of goods given to the people to lower instability (§10). They create demand on the market: a civilization struggling with instability buys luxuries, so a luxury's price is not just a sale price that only falls. **Copper** (Copper Working) and **cloth** (Weaving) are the first (§8). **Use is automatic** (v0.14): luxuries left after the market (phase 2) are used in resolution step 7, before the collapse check. Each calms −1 on the settlement nearest its collapse threshold (smallest margin; lower area numbers break ties), **at most 1 per settlement per turn**; luxuries beyond one per settlement come off the civ-wide meter. Luxuries reach every settlement of the civilization regardless of transport (the ruler's gifts). Ritual's calm comes off the civ-wide meter in the resources phase, after Bureaucracy. Example: 2 copper, a far village 1 below its threshold and a town 5 below: the village and then the town each lose 1. The ruler's choice is how much to gather, buy, or sell, not where each unit goes; the cap keeps currency from replacing governance.

Candidate resource categories (from v0.1, not yet finalized): renewable production, extracted materials, manufactured goods, stored resources.

### Transport

- Produced goods must be transported to where they are used.
- **Adjacent areas share goods freely**, with no discovery required.
- Moving goods farther requires transport discoveries. **Dugout Canoes** (v0.14, §8): a stretch of up to 3 areas along a river counts as one step for transport distance.

### Food

- **Food is a special resource**, not a base need. It appears only in some areas (e.g., wheat on a floodplain), and nothing consumes food by default: loose tokens live off the land (area limits stand for carrying capacity, as in the original) and settlements are fed by their support tokens.
- **Any settlement can produce food**, with production manpower, once its civilization has discovered the technology that farms that resource. Example: a village on a wheat floodplain farms nothing until irrigation (or similar) is discovered, then can assign its 1 manpower to wheat.
- **Food is a category of named goods**, each with its own market price: grain and fish to start, livestock with Herding (v0.14), more later (rice). Any food good counts as food for support. As in the original, where each commodity (grain, cloth, salt) had its own cards and value.
- **Food is a good like any other resource**: production manpower gathers it in phase 1, and it can be traded on the market in phase 2 (§7). Further uses may be added later.
- **Food substitutes for support tokens: 1 food replaces 1 support token**, and 1 production manpower gathers 1 food. Example: a town (2 manpower, 3 support) left with 1 support token can farm with both manpower and stay a town, but does no other work that turn. A village (1 manpower, 2 support) can cover only half its own support, so settlements still need hinterland.
- **Food in reach.** A settlement can be supported by its own food or food gathered by one of its civilization's settlements in an adjacent area (§6, Transport); farther food needs transport discoveries or the market. The engine assigns food in the support check (resolution step 6), after support tokens, larger tiers first, then lower area numbers. Example: a town 1 support short is covered by a neighbouring village's grain; fish gathered three areas away cannot help.
- **Food goods differ through advances and storage, not base yield or conversion.** Every food good starts at 1 food per manpower and 1 support per food. Grain gains from the plough and irrigation and later keeps in granaries; fish gains from boats and nets, scales less, and spoils without salt. Historically, fishing matched or beat early farming (Jōmon, Pacific Northwest, Baltic), but grain scaled with technology and stored for years, which made it the base of early states.
- **Storage** (v0.14): with Pottery, each settlement keeps up to 1 unused grain (2 when Mastered) into the next turn to cover a support shortfall; fish does not keep (§8).
- Earlier direction, not decided now that food is a special resource (§17): food surplus drives growth; stores buffer calamities; shortage raises instability, surplus and stores lower it.

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
- **Uses:** buying on the market, stabilizing settlements. (Setting discovery focus was a use until v0.16, when the study queue replaced the focus; whether currency speeds learning is for the currency design, Phase 4 step 3.)

## 7. Trade and the market — Decided

Trade is **market listings only**. There is no negotiation, proposal round, or treaty system.

| Element | Decision |
|---|---|
| Access | Requires a trade discovery: **Barter** Developed (v0.14, §8); Barter Mastered adds 1 step of reach. Before it, a civilization has no market access at all |
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
| **Known** | The idea exists in the society | Accumulator: usage, sped up by learning (v0.17), plus historical-figure spikes |
| **Developed** | The technique is usable; applies **civ-wide** automatically | Accumulator: usage, sped up by learning (v0.17) |
| **Adopted → Mastered** | The society uses it, then gets full benefit | Civ-wide adoption: 200 points (100%) from the advance's adoption drivers, sped up by learning (v0.17); never falls. How benefit scales varies by technology |

- **Every advance uses the full ladder** (v0.13). What each stage does is defined **per advance**, and each is reviewed one at a time. Example, Agriculture: Known reveals grain on the map and makes advances that build on it plausible; Developed lets manpower gather grain; adoption rises each turn from 0% to 100% and the benefit (e.g., extra grain) scales with it until Mastered. Fast adoption raises instability (§10).
- What drives each advance's adoption also varies by advance and is designed with it.

### Accumulators

- Each plausible advance has an accumulator and a cost. Conditions add progress each turn; **the advance is reached exactly when progress reaches its cost**. There is no chance involved, so timing is fully predictable: the panel can say "Known in 3 turns" at the current rate. Example: Pottery costs 20 and gains +3 a turn, so it becomes Known on the seventh turn.
- Historical figures spike or redirect accumulators.
- **Accumulators are fully visible** to the player.
- **Learning speeds advances up; it is never required** (v0.17). Usage alone reaches every step; learning from High Learning adds to the same accumulator. v0.16 made learning a required half of each step; that was reverted as too restrictive, and costs were raised instead so that learning matters:
  - **Known** costs are unchanged.
  - **Developed** costs are **twice** their reviewed values, except Permanent Settlement's (cost 4), which keeps the opening pace: High Learning cannot help before the first settlement.
  - **Mastered** takes **200 adoption points** (twice the old 100), from the advance's adoption drivers as before.
  - **Each unit of learning adds 2 progress** toward Known or Developed, or **10 adoption points** toward Mastered. Example: Fishing, Developed cost 16, one fish area and a fishing village (+2 a turn): 8 turns on usage alone; with 2 learning on it (+4), 3 turns.
  - **Nothing decays** (v0.16): Known, Developed, and adoption stay. Mastered is permanent. The per-advance fall rates of v0.13–v0.15 are retired.
  - The Knowledge screen shows each step as one bar: progress so far, then this turn's usage and learning.
- **Details.** Progress beyond a stage's cost is dropped when it fills; the next stage starts from 0 the following turn. Advances reached in the same turn do not affect each other's progress that turn. An advance without adoption rules is Mastered as soon as it is Developed and is shown as Developed only; it takes no learning after Developed. Partial progress pauses while an advance's plausibility conditions lapse.
- **Resources** are revealed (shown on the map and in panels) when their advance is Known and gatherable when it is Developed (§6).
- **The whole tree is visible** (v0.13): the Knowledge screen lists every advance in the game with its conditions, costs, and stage effects, including those with no route yet, like a tech tree. Planning is fully open; surprise comes from figures and calamities.

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
2. **Order the study queue** (v0.16): which advances learning goes to, in order.

- **Domains.** Every advance belongs to one of five domains, and a focus picks one: **Land and food** (agriculture, fishing, herding, irrigation), **Crafts** (stone tools, pottery, weaving, masonry, metalworking), **Beliefs and society** (mysticism, burial rites, law, writing), **Travel and trade** (boats, the wheel, trade), **War** (archery, bronze weapons, walls). Domains group the Knowledge screen; the domain focus of v0.13 is replaced by the study queue (v0.16).
- **Learning is a pool** (v0.16). Each High Learning unit adds 1 learning a turn. (The free +1 from oral tradition of v0.16 is retired in v0.17: with learning optional, the opening needs no help.)
- **The study queue** (v0.16). The ruler orders advances; learning fills the first one waiting for learning, and any left over moves to the next, the same turn. An advance waits for learning while it is plausible (or Developed, short of Mastered) and this turn's usage leaves its next step unfinished; it takes only the learning needed to finish the step, so none is wasted. Only plausible advances (or Developed ones still short of Mastered) can be added; an entry that stops being plausible stays but is skipped until it is plausible again, and finished entries leave the queue. The ruler chooses the exact invention, as players bought specific cards in the original. Example: 3 learning, queue Fishing then Archery; Fishing needs 2 more progress after usage, so it takes 1 learning and Archery 2.
- **Empty queue.** Learning the queue cannot use splits evenly among every advance waiting for learning, and the turn report warns that the queue is empty.
- **Study speeds use** (v0.17). Example: Agriculture Known, Developed cost 24: field use +3 a turn takes 8 turns; 2 learning a turn on it (+4) makes 7 a turn, Developed in 4 turns if queued first.

### Knowledge spread between civilizations

- Uses the **same reach rules as market pricing** (settlement to settlement, mutual, direct only).
- Political conditions modify it: **conflict slows idea spread** between the two civilizations.
- **Conquest** grants discovery progress toward the defender's advances.
- **Scattered populations** carry knowledge into the areas and civilizations they migrate to.

### Military advances and counters

- Military advances modify conflict (strength multipliers, attack thresholds).
- **Each advance has a counter** (walls → siege weapons). Counters cancel the matching modifier.
- Counter relationships are designed **one technology at a time**.

### Starting knowledge

- Every civilization starts with a **baseline** of advances already Developed and Mastered: **Fire, Stone Tools, Foraging** (v0.13). The game opens on the eve of settled life: everything else is earned, as in the original, where civilizations started with no advances.
- **Permanent Settlement** is the first advance earned. It is cheap; field use comes from tokens staying put (e.g., each area filled to its limit). **Villages unlock when it is Developed**, so every settlement tier is unlocked by an advance. Historically, permanent villages (the Natufians, around 12,000 BC) came shortly before farming.
- **Agriculture and Fishing must be earned**, so food arrives once field use develops it, perhaps 10–20 turns in. This replaces the Phase 3 stand-in (both known from turn 1).

### Stone Age advances (v0.14)

The list for the Stone Age: 3 baseline advances and 15 to earn. Each advance's conditions, costs, stage effects, and adoption are still reviewed one at a time; "Unlocks" is the headline only, and a stage may do nothing.

| Advance | Domain | Builds on | Unlocks (headline) |
|---|---|---|---|
| Fire *(baseline)* | Crafts | — | Root of Pottery (and through it Copper Working) |
| Stone Tools *(baseline)* | Crafts | — | Root of Masonry, Archery, Dugout Canoes, Palisades |
| Foraging *(baseline)* | Land and food | — | Reveals grain and fish; root of Permanent Settlement, Agriculture, Fishing |
| Permanent Settlement | Land and food | Foraging | **Villages** |
| Agriculture | Land and food | Foraging, Permanent Settlement | Grain can be gathered |
| Fishing | Land and food | Foraging | Fish can be gathered |
| Herding | Land and food | Agriculture | Livestock (new resource) or a food bonus |
| Pottery | Crafts | Fire, Permanent Settlement | Food storage |
| Weaving | Crafts | Agriculture | **Cloth**, a luxury good worked from grain or livestock areas; token cap +5 |
| Masonry | Crafts | Stone Tools, Permanent Settlement | Walls and later wonders |
| Copper Working | Crafts | Pottery | Copper, the first luxury good; bridge to Bronze Working (Bronze Age) |
| Ritual | Beliefs and society | Permanent Settlement | Shrines (first institution; lowers instability) |
| Chiefdom | Beliefs and society | Ritual | **Towns** |
| Tallies | Beliefs and society | Chiefdom | Record-keeping; root of Writing |
| Dugout Canoes | Travel and trade | Stone Tools | River travel and river transport |
| Barter | Travel and trade | Permanent Settlement | Market access |
| Archery | War | Stone Tools | Token strength **+0.25**; **+0.5** when Mastered |
| Palisades | War | Stone Tools, Permanent Settlement | Higher settlement defense |

- **Chiefdom unlocks towns** (v0.14): a town is a social step, a leader and a centre for the villages around it, more than a building one. Masonry keeps walls and later wonders.
- **Archery adds +0.25 strength** per token (v0.14), not +1: a whole point would let 4 archers beat 5 tokens outright. Strength may be fractional. Bonus power turns into a volley (every 4 archers remove 1 enemy token before the first round), and settlement thresholds count power (§11, v0.14), so 8 archers may attack a town that needs 10. Mastered Archery doubles it to **+0.5** (v0.15): every 2 archers remove 1 token in the volley.
- **Irrigation opens the Bronze Age** (v0.14), not the Stone Age.
- **Gathering bonuses are flat** (v0.14). Mastered Fishing, Agriculture, Herding, and Weaving give **+1 of their good to each settlement gathering (or making, for cloth) at least 1**, not +1 per worker: doubling every worker was too strong. Example: a town with 2 manpower on grain gathers 3 grain; a village with 1 on grain gathers 2.

**Timing targets** (v0.14). **Superseded for now by v0.16–v0.17**: with Developed costs and adoption doubled, these turns will be passed without High Learning; they are re-set in the tuning pass. Game turns at which a typical civilization, with no High Learning, reaches each stage. Each advance's costs are set to meet them; High Learning and a focus pull them earlier. Placeholders until the tuning pass (development plan §3, step 9); an advance's own review may move its row. An advance with no adoption is Mastered when Developed; the game shows it as Developed only (v0.15). Archery is Mastered only through war, so it has no Mastered target.

| Advance | Known | Developed | Mastered |
|---|---|---|---|
| Permanent Settlement | 3 | 5 | 5 |
| Fishing | 5 | 10 | 18 |
| Archery | 6 | 12 | through conflict |
| Agriculture | 8 | 14 | 24 |
| Ritual | 8 | 14 | 22 |
| Dugout Canoes | 10 | 18 | 18 |
| Pottery | 10 | 16 | 26 |
| Chiefdom | 14 | 20 | 20 |
| Herding | 15 | 22 | 30 |
| Masonry | 15 | 22 | 30 |
| Barter | 15 | 22 | 30 |
| Palisades | 16 | 24 | 24 |
| Weaving | 18 | 26 | 34 |
| Tallies | 22 | 30 | 36 |
| Copper Working | 24 | 32 | 32 |

Arc: villages, fish, and archers by turn 10; grain, shrines, pottery, and towns by turn 20; herding, clothing, barter, walls, and copper by turn 35, opening the Bronze Age.

#### Reviewed advances

Each advance below is final for the Stone Age content (numbers still placeholders until the tuning pass). Since v0.17, the Developed costs below are shown doubled from their reviewed values (all but Permanent Settlement's) and Mastered takes 200 adoption points; learning speeds every step (2 progress or 10 adoption per unit); nothing falls (the fall rates below are retired).

| Advance | Plausible | Toward Known | Toward Developed | Known does | Developed does | Adoption / Mastered |
|---|---|---|---|---|---|---|
| **Permanent Settlement** (Land and food) | From turn 1 (Foraging) | Cost 3: +1 a turn, +1 per area filled to its limit | Cost 4: same inputs | Opens Agriculture, Pottery, Ritual, Masonry, Barter, Palisades | **Villages** unlock | None; Mastered when Developed |
| **Fishing** (Land and food) | Hold an area with fish | Cost 3: +1 per fish area held | Cost 16: +1 per fish area held, +1 per settlement on a fish area | Nothing | Fish can be gathered | +15 a turn per settlement gathering fish. Mastered: +1 fish to each settlement gathering fish |
| **Archery** (War) | Hold a forest area | Cost 4: +1 per forest area held | Cost 16: +1 per forest area held | Nothing | Token strength +0.25; **countered by Palisades** when attacking a settlement | +20 a turn per **conflict fought** that turn (an area over its limit shared with a rival, or a settlement attack, on either side). Mastered: token strength +0.5 in all, still countered by Palisades |
| **Agriculture** (Land and food) | Permanent Settlement Known; hold an area with grain | Cost 5: +1 per grain area held | Cost 24: +1 per grain area held, +1 per settlement on a grain area | Opens Herding, Weaving | Grain can be gathered | +10 a turn per settlement gathering grain. Mastered: +1 grain to each settlement gathering grain; **token cap +5** |
| **Ritual** (Beliefs and society) | Permanent Settlement Known; 1+ village | Cost 4: +1 per settlement, +1 per civ-wide instability point, +3 per settlement struck by Superstition that turn | Cost 16: same inputs | Opens Chiefdom | −1 civ-wide instability a turn | +5 a turn per settlement. Mastered: −2 civ-wide a turn |
| **Dugout Canoes** (Travel and trade) | Hold a river area | Cost 6: +1 per river area held | Cost 20: +1 per river area held, +1 per settlement on a river | Nothing | **River travel**: a move starting in a river area may continue up to 2 more areas along the river. **River transport**: everything measured by transport distance counts the same river leg as one step | None; Mastered when Developed |
| **Pottery** (Crafts) | Permanent Settlement Known; 1+ village | Cost 5: +1 per village | Cost 12: +1 per settlement gathering food | Nothing | **Grain storage**: each settlement keeps up to 1 unused grain into the next turn, where it covers a support shortfall; fish spoils and is not stored | +5 a turn per settlement gathering grain. Mastered: keeps up to 2 |
| **Chiefdom** (Beliefs and society) | Ritual Known; 3+ villages | Cost 12: +1 per settlement, +1 per Bureaucracy unit | Cost 48: same inputs | Nothing | **Towns** unlock | None; Mastered when Developed |
| **Herding** (Land and food) | Agriculture Known; hold a plains or hills area | Cost 14: +1 per plains or hills area held | Cost 24: +1 per livestock area held, +1 per settlement on a livestock area | **Reveals livestock** (new map resource) | Livestock can be gathered (food) | +15 a turn per settlement gathering livestock. Mastered: +1 livestock to each settlement gathering it |
| **Masonry** (Crafts) | Permanent Settlement Known; hold a hills or mountain area | Cost 12: +1 per hills or mountain area held | Cost 20: +1 per settlement on hills or mountains | Nothing | **Stone walls**: towns and larger +1 attack threshold and +1 defense value | +15 a turn per town. Mastered: +2 and +2. Opens Bronze Age building advances and wonders later |
| **Barter** (Travel and trade) | Permanent Settlement Known; gather any good | Cost 6: +1 per kind of good gathered, +1 per rival civilization in contact | Cost 24: +1 per settlement gathering any good, +1 per rival civilization in contact | Nothing | **Market access** (§7) | +10 a turn per kind of good bought or sold on the market that turn. Mastered: market reach +1 step |
| **Palisades** (War) | Permanent Settlement Known; 1+ village | Cost 8: +1 per own settlement in contact with a rival, +3 per own settlement attacked that turn | Cost 28: same inputs | Nothing | Every settlement +1 attack threshold and +1 defense value; **counters Archery** (archers attacking it lose their bonus) | None; Mastered when Developed |
| **Weaving** (Crafts) | Agriculture Known | Cost 8: +1 per settlement on a grain or livestock area | Cost 32: same input | Nothing | **Cloth**: a settlement on a grain or livestock area may put manpower on cloth instead of food, 1 per unit; cloth is a luxury good (§6). **Token cap +5** | +15 a turn per settlement making cloth. Mastered: +1 cloth to each settlement making cloth |
| **Tallies** (Beliefs and society) | Chiefdom Known; 1+ town | Cost 4: +1 per town, +1 per Bureaucracy unit | Cost 48: +1 per settlement more than 2 land moves from the capital | Opens Writing (Bronze Age) | **Records reach the frontier**: the capital-distance penalty (§10) starts beyond 4 land moves instead of 2 | +5 a turn per Bureaucracy unit, +5 per town. Mastered: beyond 6 |
| **Copper Working** (Crafts) | Pottery Known; hold a hills or mountain area | Cost 14: +1 per hills or mountain area held | Cost 28: +1 per copper area held, +1 per settlement on a copper area | **Reveals copper** (new map resource, hills and mountains) | Copper can be gathered: the first **luxury good** (§6), given to the people to lower instability; opens Bronze Working | None; Mastered when Developed |

- **Permanent Settlement** (v0.14): time alone guarantees the idea; crowding speeds it. Example: a start area with limit 3 is Known on turn 3, full on turn 4, and Developed on turn 5; a limit-5 start with nothing full is Developed on turn 7. The original needed no advance, only 6 tokens in one area; this keeps its "crowd up, then build" feel.
- **Fishing** (v0.14): tied to the fish Foraging shows on the map (coastal areas only), so inland civilizations may never find it plausible. Example: a token reaches a fish area on turn 2, Known on turn 4; a village there from turn 6 makes +2 a turn, Developed on turn 9. One fishing village masters it in 7 turns, two in 4.
- **Archery** (v0.14): the bow comes from wood and hunting grounds, so forest peoples arm first; it also gives forests, poor in food, a reason to hold them. Example: one forest from turn 2, Known on turn 5 and Developed on turn 13; two forests from turn 4, Developed around turn 9. Counter: archers attacking a settlement with Palisades fight at plain strength (8 archers: power 8, not 10); in open areas the bonus holds. Bows won in the field; walls held towns.
- **Agriculture** (v0.14): the same pattern as Fishing. Example: a grain area held when Permanent Settlement becomes Known on turn 3, Known on turn 8; a village on it from turn 6, Developed on turn 14. Grain is common (every floodplain, half of river plains), so nearly every civilization meets the target. Adoption is slower per settlement than Fishing for the same reason: one farming village masters it in 10 turns, two in 5. Mastered also raises the token cap +5 (food surplus, the Neolithic demographic transition).
- **Ritual** (v0.14): shared belief holds a growing people together, so its calm is civ-wide and needs no building; §9 institutions (temples) wait for towns. Example: 7 villages make +1 overextension a turn, cancelled once Ritual is Developed; Mastered, 8 run free. No shrine piece, so no exception to §9's towns-and-larger rule. Belief arises from need: unrest and Superstition strikes speed it. Example: a first village on turn 5 and a calm civilization, Known on turn 9; a second village from turn 10, Developed on turn 14; each point of civ-wide instability or Superstition strike brings it sooner. Inputs per instability point and per settlement struck are new input types. Adoption follows the people who practise it: 3–4 villages at turn 14 master it in 5–7 turns.
- **Dugout Canoes** (v0.14): rivers get their promised use early (§4). Example: Highland → Valley → Delta in one turn at range 1. Sea crossings wait for a Bronze Age boat advance, keeping the continents map isolated until ships. Up and downstream alike. It builds on Stone Tools alone, not Fishing: fish lie only on coasts, and a dugout is a river tool, so inland river peoples are not locked out. Example: 2 river areas held from turn 4, Known on turn 6; a village on the river from turn 8, Developed on turn 10. **River transport:** anything that depends on transport distance (food in reach, goods transport, market reach, knowledge spread, distance from the capital) treats a stretch of up to 3 areas along a river as one step, the same leg tokens can travel. Example: a village's grain feeds a town 2 areas downstream.
- **Pottery** (v0.14): stores grain only, as §6 intends (grain keeps; fish spoils without salt). Example: a village loses a support token in a conflict, and last turn's stored grain keeps it a village. Grain left unused after the support check (resolution step 6) is stored, up to the settlement's limit, and is used first in the next support check. Fishing peoples get the same from Salt later. Pottery also counters Famine (decided; how much is set in step 5). The idea comes from settled life, real use from food to store; as with the Jōmon fishers, the oldest potters, it can come before farming. Example: a first village on turn 5, Known on turn 10; a settlement gathering food from turn 11, Developed on turn 16. Adoption follows the farmers who benefit: two farming villages master it in 10 turns; a fishing-only people never does.
- **Chiefdom** (v0.14): leaders emerge from people organising others, so Bureaucracy, already the main calming tool, also speeds towns. Example: Ritual Known on turn 9 with 3 villages, and 1 Bureaucracy unit from turn 12: Known on turn 13; with 4 villages, Developed on turn 18 (turn 19 without the unit). The capital's free Bureaucracy unit does not count; only assigned manpower does.
- **Herding** (v0.14): livestock is a new food resource placed on plains and hills, mostly away from grain, so grazing land becomes a second food belt beside the river valleys. Map generation places it on its own random stream, so existing maps keep everything else. It becomes a market good (step 4). Livestock is hidden until Known, so the first stage comes from the land and the second from the livestock it reveals. Example: Agriculture Known on turn 8 with 2 plains and hills areas, Known on turn 15; a village on livestock from turn 16, Developed on turn 21. "Plains or hills" needs an any-of terrain filter. Adoption matches Fishing, since livestock is about as scarce as fish: one herding village masters it in 7 turns.
- **Masonry** (v0.14): stone walls rise over time with adoption. Example: a town needs 10 to attack and defends as 9; Masonry Developed, 11 and 10; Mastered, 12 and 11. Walls work against every attacker; Palisades (+1, every settlement) mainly stop bows (§11 example). Countered by siege in the Bronze Age. Known from holding stony land, Developed from building on it, as Göbekli Tepe and Jericho's tower used local stone. Example: Permanent Settlement Known on turn 3 with 1 hill held, Known on turn 15; 2 villages on hills from turn 16, Developed on turn 20 (1 village, turn 25). Walls are built where they stand: one town masters it in 7 turns, two in 4.
- **Barter** (v0.14): access is the gate and reach is the lever. Developed opens the market (§7); Mastered adds 1 step of market reach, so a Mastered civilization's market includes settlements one step farther, and (reach being mutual) its neighbors see it too: a middleman's advance. Example: a village 3 areas from a rival town is out of reach with Barter Developed and in reach once Mastered. Reach numbers are set with the market (step 4). Surplus breeds exchange, and the game is the market's counterparty (§7), so goods alone give every people a path, isolated or not; contact speeds it. **Contact** is any of a rival's tokens or settlements in or next to an area you hold; no settlement needs to be in market reach. Example: fish from turn 10, grain from turn 15, and contact with one rival from turn 12: Known on turn 14; with 2 settlements gathering, Developed on turn 18. Adoption comes from trading itself: 2 goods traded a turn master it in 5 turns. It sits idle until the market exists (step 4), which is harmless, since reach means nothing without one; a civilization that stops trading loses the reach bonus.
- **Palisades** (v0.14): a fence answers a threat. Contact and attacks drive it, so a raided frontier fortifies fast, isolated peoples hit by barbarians (step 5) get there too, and a peaceful, isolated people never needs it. Example: 2 frontier villages from turn 12, Known on turn 15 and Developed on turn 22; each attack adds 3. Archery's counter comes fastest to those archers attack.
- **Weaving** (v0.14, revisited): **cloth is a luxury good** like copper (§6). It is worked from the area's own resource: a settlement on grain (flax) or livestock (wool) may put manpower on cloth instead of food, 1 cloth per unit, so every unit on cloth is one not feeding the settlement. Example: a town on grain with 2 manpower gathers 1 grain and makes 1 cloth. A well-fed civilization turns fields to luxury; a hungry one cannot. Hill peoples have copper, farming and herding peoples cloth. Weaving also raises the token cap by +5 when Developed (warmer clothing opens colder, denser living); the era's second +5 comes from Agriculture Mastered (food surplus), so each rise has a clear reason and the total stays 55 → 65 for the step 9 batch runs. Fibres come from flax and wool, so settlements on grain or livestock drive it (an any-of resource filter). Example: Agriculture Known on turn 8 and 1 grain village from turn 11, Known on turn 18; 2 such settlements, Developed on turn 26. Adoption follows the settlements making cloth, as each food advance follows its gatherers: one weaving settlement masters it in 7 turns.
- **Tallies** (v0.14): record-keeping lets a ruler track what distant villages owe, so the far edge holds longer. A different lever from Ritual: Ritual lowers how much trouble builds; Tallies change where it breaks. Example: a village 6 moves from the capital has threshold 6 today, 7 with Tallies Developed, and the full 8 when Mastered. A long, thin realm needs Tallies. Known from administration, Developed from distance: records develop where needed. Example: a first town on turn 20 and 1 Bureaucracy unit, Known on turn 22; 3 far settlements, Developed on turn 30. Needs an input per settlement beyond N moves from the capital (the distance instability already computes). The administrators adopt it: 2 towns and 1 Bureaucracy unit master it in 7 turns.
- **Copper Working** (v0.14): copper is a new resource on hills and mountains, placed on its own random stream like livestock. The Bronze Age transition becomes a geographic race, as real copper sources (Cyprus, Anatolia, Sinai) shaped early trade, and the market gets its first good that is not food. Copper is a **luxury good**: given to the people, it lowers instability, so a civilization in trouble buys it and its price does not only fall from selling. Smelting grew out of pottery kilns, so it builds on Pottery: Fire → Pottery → Copper → Bronze. Example: Pottery Known on turn 10 with 1 hill held, Known on turn 24; a village on copper from turn 25, Developed on turn 31.

**Candidate calamity tags** (v0.14). Each reviewed advance notes the calamity it may soften. These are notes, not rules: calamities are designed in development plan §3, step 5, starting from this list, which confirms or changes them; an advance is revisited only if its main effect then duplicates its calamity role.

| Advance | Candidate calamity |
|---|---|
| Permanent Settlement | None |
| Fishing | Famine (a second food source) |
| Archery | Barbarian raid |
| Agriculture | Famine |
| Ritual | Superstition, civil disorder |
| Dugout Canoes | None |
| Pottery | **Famine** (intended counter, as in the original) |
| Chiefdom | Civil war |
| Herding | Famine |
| Masonry | Barbarian raid, earthquake |
| Barter | Famine (food bought on the market) |
| Palisades | Barbarian raid |
| Weaving | None |
| Tallies | Civil disorder |
| Copper Working | Civil disorder (luxuries calm) |

### Knowledge and collapse (from v0.1, still the direction)

- **Known, Developed, and adoption are never lost** (v0.13; adoption since v0.16, when it stopped falling). **Partial progress pauses** when its conditions lapse and resumes from where it stopped when they return. Example: a civilization loses every settlement on grain areas; Agriculture stays Developed and keeps its adoption, and Irrigation's 12 of 25 toward Known waits.

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
| Luxury goods | Local first (1 per settlement, nearest collapse first), the rest civ-wide | −1 per unit, used automatically in step 7 (v0.14, §6) |
| Threshold | Local + civ-wide | Village 8, town 10, city 12, metropolis 14, lowered by distance from the capital (below) |
| Collapse | — | One tier (§5, Tier drop, with refugees); the local meter is halved, rounded down; at most one drop per turn |

- **Capital.** A civilization's first settlement is its capital. It has **one free, invisible Bureaucracy unit** on top of its manpower, so a civilization can hold 7 settlements before overextension outruns it. When the capital is lost, the largest remaining settlement becomes the capital at once, nearest the old capital first (lower area numbers break ties); nothing else happens. The capital is marked with a gold star on the map.
- **Distance from the capital lowers the threshold** by 1 for every 2 land moves beyond 2 (beyond 4 with Tallies Developed, beyond 6 Mastered; v0.14, §8), by at most 4, and never below half the tier's base. A settlement with no land route to the capital counts as the farthest band. So as the civ-wide meter rises, **the far edge collapses first**; each collapse removes a settlement, which slows overextension, and the core settles close to its limit.

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
- **Interface.** Selecting a settlement shows "Instability 4 + 3 of 10" (local + civ-wide of threshold), why its threshold is what it is ("4 areas from the capital"), last turn's changes, and a Bureaucracy row beside the area's resources. While overextension outruns the civilization's Bureaucracy, the planning panel warns that unrest is rising and the farthest settlements will collapse first. Settlements within 2 of collapse carry a warning mark on the map. The Civilization overview has an Instability card (civ-wide meter, overextension, Bureaucracy, settlements close to collapse) and an instability column. The turn report names each collapse.

### Collapse

- When a settlement crosses its threshold, it **drops one tier** (§5, Tier drop); its freed tokens become refugees in adjacent areas, possibly in other civilizations' territory, carrying knowledge.
- The local meter is **partially reset** (e.g., halved).
- **Civilizations cannot collapse** as long as they have people left. Settlements can.

## 11. Conflict — Decided

| Element | Decision |
|---|---|
| Trigger | Combined tokens of two or more civilizations exceed the area's limit. Coexistence below the limit is allowed. Technologies may change this |
| Attrition | Deterministic. Each token has a **strength** (base 1); a civilization's **power** in an area is the sum of its tokens' strength. Bonus power becomes a **volley** of extra removals, and settlement thresholds are checked against power (v0.14). Discoveries raise strength, possibly by fractions (Archery +0.25, +0.5 when Mastered, §8); counters cancel matching modifiers. Losses follow the original's removal rule (below) |
| Commander figures | Temporary conflict modifiers |

### Removing tokens in conflict

- Following the original, the civilizations in an over-limit area remove tokens **one at a time, taking turns**, until the area is within its limit or only one civilization is left.
- **The side with the least power removes first** (the original used the fewest tokens; with every token at strength 1 the two are the same).
- Example: Plains, limit 3; you have 4 tokens, a rival 2. The rival removes (4 vs 1), then you (3 vs 1), then the rival (3 vs 0).
- **Rounds.** In each round every side removes one token, weakest power first, stopping as soon as the area is within its limit; the order is recomputed from power at the start of each round. **Sides with equal power remove together**, as in the original, even if that removes one more token than needed (Plains, limit 3, 2 vs 2 ends 1 vs 1).
- Three or more sides follow the same order. Example: Plains, limit 3; you 3, rival A 2, rival B 1. B removes (3/2/0), then A (3/1/0), then you (2/1/0).
- **Volley** (v0.14). Before the first round, each side removes extra tokens equal to the **whole part of its opponent's bonus power** (power minus tokens). Example: 4 archers (+0.25 each) have bonus power 1, so their opponent removes 1 token first; 8 archers force 2; 3 archers force none. The removal rule then runs as usual, and the volley also counts toward reaching the area's limit. With three or more sides, each side's volley falls on the opponent with the most power (earlier player order on ties). Without the volley, strength only decided who removed first, so a bonus saved at most one token in an even fight and +0.25 and +0.5 played the same.

### Attacking settlements

| Tier | Tokens needed to attack | Defends as |
|---|---|---|
| Village | 7 | 6 |
| Town | 10 | 9 |
| City | 15 | 14 |
| Metropolis | 22 | 21 |

- **Thresholds are power** (v0.14): an attacker's power, not its token count, must reach the threshold. Example: 8 archers (power 10) may attack a town; 8 plain tokens may not.
- A settled area is fully populated (§5), so **any enemy token entering it attacks the settlement**. All tokens a civilization has in the area after movement attack together.
- **Below the threshold**, the attackers fight the settlement's defense value and are destroyed; the settlement is unharmed.
- **At or above the threshold**, the settlement fights as a side of tokens equal to its defense value, using the removal rule above, until one side has none left; there is no area limit to stop at. If the defense is eliminated, the attackers capture. Example: 9 attackers against a village (defends as 6): the village, weaker, removes first each round and is gone after its sixth removal, leaving 4 attackers to capture; 7 attackers capture with 2. If the last tokens on both sides fall together, no one is left to capture and the settlement holds.
- **Reinforcements.** The defender's own tokens in the area after movement add their power to the defense. The threshold is still checked against the settlement's own value; reinforcements only strengthen the fight. Example: 8 attackers against a village reinforced by 3 fight 8 vs 9 and are destroyed. Reinforcements that survive beyond the garrison are removed as surplus (§3, step 9).
- **Several attackers.** Each attacker's threshold is checked separately; attackers below it are destroyed first. The settlement then joins the remaining attackers as one side (power = defense value plus reinforcements) in a single fight under the removal rule, weakest first, until one side is left. A surviving attacker captures. Example: village (6) attacked by A 8 and B 7 runs 8/7/6 → 7/6/5 → … → 3/2/1; in the sixth round the village falls (A 2, B 1), then B removes and A captures with 2.
- Walls and similar advances raise these values; siege advances counter them.
- The settlement fights at its defense value using the defender's strength multiplier, so a defender's bonus power gives it a volley too. Attacker volleys remove defense tokens.
- **Example** (v0.14; Palisades and Masonry values as drafted, §8). Fewest tokens needed to take a town; each attack below captures with 2 left:

| Town's defenses | Plain attackers | Archers |
|---|---|---|
| None | 10 | 8 (power 10; volley 2) |
| Palisades | 11 | 11 (bonus countered) |
| Masonry Developed | 11 | 9 (power 11.25; volley 2) |
| Masonry Mastered | 12 | 10 (power 12.5; volley 2) |
| Masonry Mastered + Palisades | 13 | 13 (countered) |
| None, defended by archers | 12 | — |
| Masonry Mastered + Palisades, defended by archers | 16 | — |

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
| Superstition | Social | Settlements without belief advances | To be designed (step 5); added v0.14, as in the original | Ritual (as Mysticism in the original) | — |
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
| Deterministic combat | Uncertainty comes from figures and calamities instead |
| Deterministic discovery | Advances arrive exactly when progress reaches their cost (v0.13). Fully plannable; surprise comes only from historical figures, which spike or redirect progress, and calamities |
| No diplomacy | Diplomats act only on market reach and knowledge spread |
| Weak AI during tuning | The AI stays minimal until development Phase 7, so balance numbers set earlier are tuned against a weak opponent and need a retuning pass |
| Long-arc content | The emergent discovery model needs a large authored set of advances, each with conditions, counters, and adoption effects |

## 17. Open questions

### Design

- [x] ~~How the original's growth rule extends~~ — kept unchanged (v0.3).
- [x] ~~Growth variant: original rule vs proportional~~ — proportional, 0.5 per loose token with per-area progress (v0.10).
- [ ] What specific transport discoveries do to movement range and goods range. (Dugout Canoes: up to 2 more areas along a river, v0.14.)
- [ ] Conditions for absorbing independent settlements peacefully.
- [ ] Barbarian spawn rules.
- [x] Whether token cap rises from adoption are permanent. Resolved v0.16: adoption no longer falls, so Mastered rises (Agriculture's +5) are permanent.
- [ ] Calamity mitigators: confirm or change the candidate tags on Stone Age advances (§8) when calamities are designed.
- [ ] Technology-by-technology design: plausibility conditions, Known and Developed inputs and costs, what each stage does, what drives adoption and how benefit scales, counters, mitigated calamities. Every advance is reviewed one at a time.
- [ ] Final resource category list.
- [ ] Game name. Placeholder: *Succession* (after the Archaeological Succession Table).
- [x] ~~Per-area tier caps~~ — replaced by one settlement per area (v0.3).
- [ ] Map size per civilization (procedural maps scale land areas by civilization count). Phase 0 used 64 areas per civilization; with limits 1–5, cap 55, and two Stone Age rises, land filled around turn 36.
- [ ] Which advances unlock cities and metropolises. (Villages: Permanent Settlement; towns: Chiefdom, v0.14.)
- [ ] Tier drop details: how the host accepts or rejects refugees under simultaneous turns (standing policy or per-event choice); whether accepted refugees count against the host's cap; whether a ruler can exploit deliberate collapse to transfer tokens.
- [ ] Names for rival civilizations' settlements (generated name lists, or unnamed).
- [ ] What happens to a settlement's name when it dissolves or is refounded.
- [ ] Support variant: tokens only (current) vs tokens plus one lower-tier settlement in range. Compared in the Phase 0 simulation.
- [ ] Food: whether food still drives growth and shortage raises instability now that food is a special resource. (Stores buffer support shortfalls: Pottery, v0.14.)

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
- [ ] Discovery outliers under v0.17 (2 progress / 10 adoption per learning, doubled Developed costs and adoption): low-usage advances (Masonry +1 a turn from one hill settlement, Tallies) take 20+ turns to develop without High Learning, which makes it near-mandatory there; high-usage advances (Ritual, Chiefdom) scale with civilization size, so learning barely moves them; advances whose adoption drivers have nothing to count yet (Barter before the market, Archery without fights) can be mastered only through learning, so Barter could master before the market exists

## 18. Recommended next steps

See the [development plan](development_plan.md) for build phases.

1. **Author a vertical slice of content:** the Stone and Bronze eras, with roughly 20 advances (conditions, counters, adoption effects), a handful of resources, and the first calamities.
2. ~~**Prototype the core loop economy**~~ — done in Phase 0 (`sim/phase0/sim.ts`); reshaped the pyramid, settlement, and cap rules (v0.3).
3. **Re-run the economy simulation** once Stone Age advances, calamities, and historical figures are designed, to retune pacing with them in play.
4. **Prototype the market** with several civilizations at different ranges, to confirm per-player pricing is readable to players.

---

## Change log

- **0.19 (October 25, 2026):** Room to expand (§2) gains **very crowded**: 16 land areas per civilization (0.25×), so borders meet and fighting starts early; crowded, standard, and spacious are unchanged. Very crowded starts may be 3 moves apart (4 elsewhere) so 2–15 civilizations fit (at 4, maps with 10 or more civilizations often failed to generate).
- **0.18 (October 25, 2026):** Urban growth (§5): a settlement of any tier, villages included, that gathers food and eats some of its own for support adds +1 urban growth that turn, regardless of the amount; food eaten by or from a neighbor does not count.
- **0.17 (October 25, 2026):** Learning optional again (§8): v0.16's required learning halves are reverted. Usage alone reaches every step; learning adds to the same accumulator, **2 progress per unit** toward Known or Developed and **10 adoption points** toward Mastered, taking only what usage leaves unfinished. To make learning matter, **Developed costs are doubled** (except Permanent Settlement, which keeps the opening pace) and **Mastered takes 200 adoption points**; Known costs are unchanged. Kept from v0.16: the study queue (fill in order, then an even split, with the empty-queue warning; only plausible advances can be queued), nothing decays, and the minimal AI's third of manpower on High Learning with an empty queue. Oral tradition and the Permanent Settlement Known exception are retired. Discovery outliers are logged for the tuning pass (§17).
- **0.16 (October 24, 2026):** Discovery needs study (§8): every step is **half usage, half learning**: Known, Developed, and Mastered, except Permanent Settlement, which becomes Known from usage alone. Known and Developed each split their cost into a usage half (its inputs) and a learning half (High Learning); both must fill, and excess in either is wasted; shown as one two-colour bar. Mastered is 50 adoption from usage (the adoption drivers) plus 50 from learning, the learning half costing twice the Developed learning half. Nothing decays: adoption no longer falls, so Mastered is permanent (the fall rates are retired; Agriculture's cap rise is permanent, closing that §17 item). The domain focus is replaced by a **study queue**: learning fills the first advance waiting for it, then the next; only plausible advances can be queued; an empty queue splits learning evenly among every advance waiting, with a warning in the turn report. Every civilization gets +1 learning a turn from **oral tradition**, which breaks the deadlock of needing learning for villages and settlements for High Learning. High Learning no longer counts toward Known's usage. The minimal AI puts about 1 manpower in 3 on High Learning and leaves its queue empty. Currency no longer pays for a focus. Timing targets are superseded until the tuning pass.
- **0.15 (October 24, 2026):** Archery gains an adoption track: +20 a turn per conflict the civilization fought that turn (an over-limit area shared with a rival, or a settlement attack, as attacker or defender), falling 5 a turn without one. Mastered Archery raises token strength to +0.5 in all (every 2 archers remove 1 token in the volley), still countered by Palisades. Archery has no Mastered timing target; a peaceful civilization stays at Developed. Advances with no adoption are still Mastered when Developed but are shown as Developed only.
- **0.14 (October 23, 2026):** Stone Age advance list (§8): baseline Fire, Stone Tools, Foraging; to earn Permanent Settlement, Agriculture, Fishing, Herding, Pottery, Weaving, Masonry, Copper Working, Ritual, Chiefdom, Tallies, Dugout Canoes, Barter, Archery, Palisades. Chiefdom unlocks towns. Archery adds +0.25 token strength; strength may be fractional. Irrigation moves to the Bronze Age. Mastered gathering advances give +1 per settlement gathering the good, not per worker. Permanent Settlement reviewed: +1 a turn and +1 per full area, Known cost 3, Developed cost 4. Fishing reviewed: plausible with a fish area held; Known cost 3 (+1 per fish area), Developed cost 8 (+1 per fish area, +1 per settlement on one); adoption +15 per settlement gathering fish, falls 10. Archery reviewed: plausible with a forest held; Known cost 4, Developed cost 8, both +1 per forest area; countered by Palisades when attacking settlements. Agriculture reviewed: plausible with Permanent Settlement Known and a grain area held; Known cost 5, Developed cost 12, mirroring Fishing; adoption +10 per settlement gathering grain, falls 10. Ritual: −1 civ-wide instability a turn when Developed, −2 when Mastered; no shrine building; driven by settlements, civ-wide instability points, and Superstition strikes (Known cost 4, Developed cost 8); adoption +5 per settlement, falls 10. Dugout Canoes: river travel, a move starting on a river may continue up to 2 more areas along it; sea crossings wait for a Bronze Age boat advance; transport distance (food in reach, market reach, knowledge spread, capital distance) counts the same river leg as one step; plausible with a river area held, built on Stone Tools alone (Known cost 6, Developed cost 10). Pottery stores grain (1 per settlement, 2 when Mastered) to cover support shortfalls; fish spoils; it is the intended counter to Famine; plausible with Permanent Settlement Known and a village (Known cost 5, +1 per village; Developed cost 6, +1 per settlement gathering food; adoption +5 per settlement gathering grain, falls 10). Chiefdom (towns): plausible with Ritual Known and 3 villages; +1 per settlement and +1 per Bureaucracy unit (Known cost 12, Developed cost 24). Herding reveals livestock, a new food resource on plains and hills; plausible with Agriculture Known and plains or hills held (Known cost 14, +1 per such area; Developed cost 12, +1 per livestock area and per settlement on one; adoption +15 per settlement gathering livestock, falls 10). Superstition is added to the calamity list (§12), as in the original. Conflict (§11): bonus power becomes a volley of extra removals before the first round, and settlement thresholds are checked against power, so strength modifiers matter in every fight. Masonry: stone walls for towns and larger, +1 threshold and defense when Developed, +2 when Mastered; plausible with Permanent Settlement Known and hills or mountains held (Known cost 12, +1 per such area; Developed cost 10, +1 per settlement on one; adoption +15 per town, falls 10). Barter: Developed opens market access; Mastered adds 1 step of market reach; plausible with Permanent Settlement Known and any good gathered; driven by kinds of goods and settlements gathering, plus +1 per rival in contact through tokens or settlements (Known cost 6, Developed cost 12); adoption +10 per kind of good traded that turn, falls 10. Palisades: every settlement +1 threshold and defense, counters Archery; driven by own settlements in contact with a rival (+1) and attacked that turn (+3) (Known cost 8, Developed cost 14). Weaving (see the revision below): plausible with Agriculture Known, +1 per settlement on grain or livestock (Known cost 8, Developed cost 16); adoption +15 per such settlement, falls 10; a cap can shrink when adoption falls. Tallies: the capital-distance penalty starts beyond 4 land moves when Developed, beyond 6 when Mastered; plausible with Chiefdom Known and a town (Known cost 4, +1 per town and per Bureaucracy unit; Developed cost 24, +1 per settlement more than 2 moves from the capital; adoption +5 per Bureaucracy unit and per town, falls 10). Copper Working reveals copper, a new resource on hills and mountains, gathered when Developed; opens Bronze Working. New good category, **luxury goods** (§6): given to the people to lower instability, creating market demand; copper is the first. Luxuries are used automatically in resolution step 7: −1 each on the settlements nearest collapse, at most 1 per settlement, the rest civ-wide. Copper Working: plausible with Pottery Known and hills or mountains held (Known cost 14, +1 per such area; Developed cost 14, +1 per copper area and per settlement on one). All 15 Stone Age advances reviewed. Livestock and copper are placed only in areas with no other resource (one per area): livestock on plains 25% and hills 20%, copper on hills 15% and mountains 30%. Weaving revisited: cloth is a luxury good worked instead of food on grain or livestock areas; token cap +5 when Weaving is Developed and +5 when Agriculture is Mastered (55 → 65); Weaving adoption +15 per settlement making cloth. Advances carry candidate calamity tags (notes, not rules) for the calamity design in step 5. Timing targets per advance (Known, Developed, Mastered turns) set the scale for costs; the Stone Age ends around turn 35. Details of each advance are still reviewed one at a time.
- **0.13 (October 19, 2026):** Discovery is deterministic: an advance is reached exactly when its accumulator's progress reaches its cost, with no breakthrough chance. Every advance uses the full ladder (Plausible, Known, Developed, Adopted → Mastered); each stage's effects and the drivers of adoption are defined per advance and reviewed one at a time. High Learning is a pool of 1 progress per unit, sent to the focused domain's advances (split evenly), or split across all advances without a focus; it counts at half toward Developed, where field use leads. Five domains (Land and food, Crafts, Beliefs and society, Travel and trade, War); focus is free until currency exists. Known and Developed are never lost; adoption falls while its drivers are missing; partial progress pauses. The whole advance tree is visible. Starting baseline: Fire, Stone Tools, Foraging (Developed and Mastered); Permanent Settlement is earned first and unlocks villages; Agriculture and Fishing are earned. New setup option, Advanced start (off by default): each civilization draws 2 first-ring advances of its own, Developed and Mastered.
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
