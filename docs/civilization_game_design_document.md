# Civilization-Inspired Strategy Game — Design Document

**Version:** 0.32  
**Date:** October 26, 2026  
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
| Diplomacy | None for now. All civilizations start **neutral** (v0.25); War and Peace states come later (§11) |

### Setup options

| Option | Choices |
|---|---|
| Map | Procedural or historical |
| Map type (procedural) | **Inland sea** (default; like the original: one mainland around a central sea, a few islands), **continents** (landmasses separated by ocean; some civilizations isolated until ships), **single landmass** (little sea). Seas are divided into sea areas in every type |
| Civilizations | 2–15; default 5 (the player plus four AI). The original allowed 2–7. A procedural map scales with the count |
| Advanced start | Off (default) or on. On: each civilization draws **2 advances** of its own from the first ring (advances that build only on the starting baseline, §8), granted Developed and Mastered like the baseline. Draws come from the game seed, so civilizations differ from turn 1 and a game still replays exactly |
| Final era | Any era; e.g., end of the Iron Age for a single evening, end of the Modern era for a full campaign. Until later eras have gates, only a Stone Age game can end (v0.26) |
| Room to expand | Land per civilization: **very crowded** (a quarter of standard, 16 land areas; v0.19), **crowded** (half of standard, 32 land areas), **standard** (default, 64), **spacious** (2×, 128). Standard targets about 30–40 turns of expansion before a civilization's land meets a neighbor's (roughly the Stone Age); crowded makes neighbors meet early, spacious keeps the early game peaceful longer. Very crowded is for fighting from the start: a civilization's land holds fewer tokens than the starting cap, so tokens press into neighbors within about 15 turns, and starts may be 3 moves apart instead of 4 so that 2–15 civilizations fit |
| AI approaches | Each rival's approach (§2, AI approaches), or Random (default) |

### AI approaches (v0.32)

Each AI civilization plays one **approach**: a fixed priority pattern, not a strategy (real strategy and difficulty levels wait for development Phase 7). Approaches exist so the balance pass measures the numbers against more than one way of playing. Stone Age approaches:

| Approach | Favours |
|---|---|
| **Balanced** | The interim AI, extended: expands, studies, calms, builds wonders, and buys what it needs, with no single emphasis |
| **Expansion** | Founding villages early and often, spreading tokens; little study; Bureaucracy only near collapse |
| **Building** | Towns once Chiefdom allows, steady Bureaucracy, wonders first |
| **Study** | A large share of manpower on High Learning, queued toward the next era's gate |
| **Culture** | Artists and culture wonders (Newgrange), accepting slower growth |
| **Aggression** | Moving into rivals' areas and attacking weak settlements for spoils |

Trade waits for the Bronze Age, when the market has more to trade.

- **Assignment** (setup option): the new-game panel sets each rival's approach, or **Random** (default): a draw from the game seed without repeats until every approach has been used once. Batch runs set approaches the same way.
- **Hidden**: the interface does not name a rival's approach; the player reads it from how the rival plays.
- **Settings** (v0.32; placeholders, set character not balance): every approach is the Balanced pattern with different settings.

| Setting | Balanced | Expansion | Building | Study | Culture | Aggression |
|---|---|---|---|---|---|---|
| Loose tokens before founding | 12 | 8 | 12 | 12 | 12 | 12 |
| Founding or upgrading first | Found | Found | Upgrade | Found | Upgrade | Found |
| Manpower on High Learning | ⅓ | 0 | ⅙ | ½ | ⅙ | ⅙ |
| Study queue | Empty | Empty | Empty | Cheapest steps toward the next gate | Ritual, Masonry | Archery, Palisades |
| Manpower on Artists | 0 | 0 | 0 | 0 | ⅓ | 0 |
| Bureaucracy within N of collapse | 3 | 2 | 5 | 3 | 3 | 3 |
| Wonders | First no rival is building | Never | Any, in turn; Göbekli Tepe and Çatalhöyük first | Stonehenge first | Newgrange first | Walls of Jericho only |
| Spreads into rivals' land | No | No | No | No | No | Yes |

All approaches mark every buy-off, buy food or luxuries when short, never sell, and put idle manpower on food.
- **Aggression** (v0.32): it picks the rival settlement easiest to take (lowest attack threshold, then fewest of its owner's tokens in and next to it), from any rival alike, the player included. It masses tokens in the areas next to it over several turns, keeping what its own settlements need for support, and attacks once its power reaches the settlement's attack threshold. It also spreads into rivals' unsettled areas whenever it would win the fight there.

## 3. Turn structure — Decided

Three phases (v0.24; the separate trade phase of v0.2 is folded into Resources and Allocation). All players act simultaneously within each phase.

| Phase | What happens |
|---|---|
| **1. Resources** | Settlements produce from manpower assigned to production. Towns and larger pay tax into the treasury (§6, Currency). Standing market orders fill (§7): prices move, then sales and purchases; goods are usable this turn |
| **2. Allocation** | Players assign manpower (production, Bureaucracy, High Learning, Artists, wonders), set the study queue (§8), place or change market orders (§7), mark calamities to buy off (§12), order movement and migration, and order settlement conversions |
| **3. Resolution** | The game resolves all consequences in a fixed order (below) |

- **Why no trade phase** (v0.24). The original's trade phase existed for haggling between players; this design trades only through market listings with the game as counterparty (§7), so a phase of its own was a stop with nothing to decide. Market orders work like manpower: set in allocation, they take effect from the next turn's resources phase, and standing orders fill every turn before the player allocates, so plans are made against goods already bought.

### Resolution order (starting point; adjust in playtesting)

| Step | Resolves | Rationale |
|---|---|---|
| 1 | Movement | Positions settle before anything else |
| 2 | Conflict: attrition, sieges, capture, spoils | Depends on final positions |
| 3 | Settlement conversion (tier-ups ordered in allocation) | After conflict, as in the original |
| 4 | Food consumption and shortages | Uses post-conflict population |
| 5 | Calamities | Before wonders complete, so a calamity that destroys a settlement takes the progress of a wonder built there (§9) |
| 6 | Support check and cascades | After losses from conflict and calamities |
| 7 | Instability update and collapse | Uses all of this turn's sources |
| 8 | Growth: tokens, and settlement output into adjacent areas | After losses |
| 9 | Surplus removal (areas over their limit) | After growth |
| 10 | Discovery: accumulators, Known, Developed, adoption | Uses the turn's final conditions |
| 11 | Historical figures emerge | Conditions include this turn's discoveries |
| 12 | Wonders complete | After calamities |
| 13 | Era gates and endgame check | Uses final state |

### Resolution reports (v0.23)

After resolution the player sees what happened, in one of three modes chosen in the game menu (remembered by the browser; Normal by default):

| Mode | Shows |
|---|---|
| **Brief** | The notable results flash over the map and fade after a few seconds |
| **Normal** | The game pauses on a report page listing the notable results (settlements built, lost, or collapsed; fights; calamities; advances reached; trades; food standing in for support). A turn with nothing notable shows no page |
| **Detailed** | The same page, listing every event: also goods gathered, tax, price changes, each instability change, moves, and growth |

Each line about a place jumps to it on the map when clicked. The **Chronicle** lists every turn since the game started or was loaded, newest first, with its notable results; clicking a turn opens its Detailed page. Reports cover the player's own civilization and events that involve it.

### Screens and information panels (v0.29)

Every system has one home screen (Phase 4 step 9). Panels serve three needs, and a number is shown, flagged, or explained only for one of them; where a number came from (such as the treasury's history) is not shown for its own sake:

| Need | Question | Example |
|---|---|---|
| **State** | Where do I stand? | Score 23, 2nd of 5 |
| **Attention** | What needs me this turn? | 2 manpower idle in Ur |
| **Rules** | What does it cost, and what does it give? | Stonehenge: 1 stone and 2 manpower a turn for 8 turns; +2 learning a turn |

**Top bar** (on every screen): era and turn; loose tokens of the cap; settlements by tier; treasury; score with rank ("23 (2nd)"); progress to the next era's gate ("Bronze 4/5 settlement, 9/12 knowledge"); the endgame countdown once begun; and an **attention count** ("3 to address") that opens the list of items needing the player this turn.

**Attention items** are what will be lost, wasted, or risked if the player ends the turn now; each opens the screen or area where it is fixed. Zero means nothing goes wrong by ending the turn. Opportunities (a village site ready, a wonder or advance available) and an empty study queue are not attention items; they belong on their own screens.

| Item | Example |
|---|---|
| Idle manpower | "Ur: 1 manpower idle" |
| Support short at the next check | "Kish will drop to a village: 1 support short" |
| Near collapse (within 2 of the threshold) | "Lagash: instability 7 of 8" |
| A wonder that cannot be paid this turn | "Göbekli Tepe will stall: short of stone (0 of 1)" |
| A wonder race lost: choose | "Stonehenge lost to Rival 2: move 3 turns or take culture" |
| A planned founding or upgrade that will fail | "Village at Hills will not be built: 2 tokens short" |
| Tokens over the cap or an area limit | "3 tokens over the cap will be removed" |
| A buy order the treasury cannot fill | "Buy 3 stone: treasury covers 1" |
| A planned move that leads to a fight | "Your 4 tokens enter a fight at River" |
| A calamity marked to buy off that the treasury cannot pay (only when marked) | "Famine marked to buy off: treasury 6 of 10" |

The top bar holds eight screens:

| Screen | Holds |
|---|---|
| **Map** | The board, area details, and planning |
| **Civilization** | Settlements, support, manpower, and calamity risks |
| **Economy** | The market (prices, orders), the treasury and its sources, goods held and the durable stock |
| **Knowledge** | Advances and the study queue |
| **Society** | Wonders and builds, culture and Artists, instability |
| **Rivals** | Standings, conflicts, the endgame, wonders built |
| **Chronicle** | Past turn reports |
| **Rules** | The rules reference |

**Panel contents** (decided card by card; v0.29):

| Screen · card | Shows |
|---|---|
| Civilization · Settlements | Each tier with its count; a locked tier names what unlocks it ("Town: locked (Chiefdom)"); a tier table in the card: built from, support, manpower, tax, collapse threshold, points. Settlement points are not shown here |
| Map · Side panel | The selected area's details (name or terrain, features, limit, resources, terrain goods, everyone's tokens); for a settlement, its instability (with threshold reason and last turn's changes), support of need (red when short), its wonder ("Building Stonehenge 3/8 · will be worked"), and manpower chips with one-line job rules; moves left; Found or Upgrade with the preview; planned settlements. Idle manpower and unrest leave the panel for the attention list; a planned fight shows in the attention list and, when its area is selected, in the panel |
| Civilization · Population | Loose tokens of the cap; growth next turn as one line ("+8 next turn (6 area, 2 urban)"); room left below the cap; a rule note on how growth works. The token value of settlements is not shown |
| Civilization · Support | Support of need this turn; from food; free tokens; village sites (a count); shortfall warnings (also attention items); a rule note on how support works |
| Civilization · Manpower | Total; production split by good ("6: grain 3, fish 2, stone 1"); Bureaucracy, High Learning, Artists, Wonders; unassigned (highlighted above 0, and an attention item); a job table in the card: what one unit of each job gives |
| Civilization · Calamities | Chance this turn, with a rule note (1% per tier point, +5% per quiet turn, falls back when one strikes); buy-off marks, each with the calamity's one-line effect; medium and high risks; the full calamity table (effect, likelihood, softened by, buy-off cost) on the Rules screen, linked from the card |
| Civilization · Settlements table | Per settlement: name, tier, capital, terrain and features, terrain goods ("stone can be worked here"), and its wonder ("Building Stonehenge 3/8", or the completed wonder); work chips; support of need (red when short); manpower assigned of total (red when idle); instability of threshold (red within 2); top calamity risk (hover lists all). No urban growth column |
| Economy · Treasury | Treasury; tax a turn; spending a turn (buy orders at current prices, currency covering wonder manpower); expected next turn (treasury + tax + sales − spending; red below 0, since orders fill first and a wonder then stalls); a rule note on what currency is for. Where the treasury came from is not shown |
| Economy · Goods and market | One table, a row per good, grouped food, luxuries, other: good and kind (durable marked; legend below); gathered a turn by the standing assignments (where); held now (the part kept from earlier turns: durable stock, stored grain); needed this turn (wonder goods by good; food and luxuries by kind, since any of the kind serves: food for support tokens cannot cover and for wonders, luxuries for settlements with instability; red when held falls short, for a kind only once one of its goods can be gathered); price and next turn's; the standing order with its controls (shown with market access). Market membership, reach, and a market rule note above it |
| Knowledge · Advance card | Stage; the next step as a bar with turns at this turn's rate; what drives it (the inputs, as the rule for speeding it up); **the cost of every step** (Known, Developed, Mastered adoption, each with what adds to it; reached steps ticked); what it gives by stage; **the wonders it opens** (with any other advance needed); **its knowledge points** (Developed, Mastered); plausibility conditions before Known; the Study button |
| Knowledge · Header and queue | Learning a turn by source ("3 a turn (High Learning 1, Stonehenge 2)"); a rule line on what learning does; the study queue with each entry's learning this turn; learning the queue cannot use. Knowledge points are not shown here (the top bar has gate progress) |
| Society · Instability | Civ-wide meter; change next turn as one line with its parts (overextension, Bureaucracy, calm from advances and wonders); capital with its threshold rule; near-collapse settlements (also attention items); luxuries in stock; a raises/lowers table in the card |
| Society · Culture | Culture points; progress to the next award with turns at this turn's rate and its sources (Artists, Newgrange); points per award in this era (and the next); a rule note on where culture comes from |
| Society · Wonders | A card per wonder: name, points, effect; opened by (advances ticked when Developed); cost a turn (goods, manpower or 10 currency each); total cost; turns of work; rivals building it (who, not how far); for the player's build, progress, last turn's result, this turn's forecast ("Will be worked" or "Will stall: short of stone (0 of 1)") and the finish turn if every turn is paid; the start control (sites that cannot pay say why); completed: builder, site, holder, ruins |
| Rivals | Conflicts; endgame (final era, what completes it, countdown) with a rule note on the countdown and ties; wonders built or being built; standings (rank, civilization, era, next gate, settlements, tokens, knowledge, settlement, wonders, culture, score, toward you) with a rule note on how score is made. Market membership stays on the Economy screen |
| Rules | One scrolling page with a contents list down the side; rule notes and links on other screens open their section. Sections: turn (phases, resolution steps); map and tokens; settlements (tier table); goods; manpower (job table); market; advances (era, domain, costs by step, drivers, effects); wonders; instability (raises/lowers, thresholds, collapse); calamities (effect, likelihood, softened by, buy-off); conflict; eras and victory (gates, points, countdown, score). Every number comes from the data files or engine constants, never typed into the page |

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
- **Refugees stay their own civilization's tokens** (v0.31), wherever they land, as in the original, where a reduced city's people stayed its owner's. In another civilization's area they are ordinary tokens after their grace turn: they can move on, be used, or fight if the area is over its limit (§11). They do not join the host or carry knowledge to it.

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
| Village | 1 | Produce resources; host specialists; market endpoint; build named wonders (v0.27) |
| Town | 2 | Generic institutions auto-build here |
| City | 3 | None yet beyond the lower tiers' (v0.27: named wonders moved to villages); set when cities are unlocked |
| Metropolis | 4 | Build great wonders; extends market range; raises the civilization's administrative capacity (reduces overextension) |

- Base manpower is raised by advance bonuses (§6).
- Tax per settlement climbs with tier: village 0, town 1, city 2, metropolis 3 (v0.29; v0.20 had 2, 3, 4; §6).
- Every tier earns settlement points toward era gates and score: village 1, town 2, city 3, metropolis 4 (v0.26, §14).
- **Historical figures can emerge in any settlement**, with odds that scale with tier.

## 6. Resources, labor, and currency — Decided

### Resources

- Each area has resources that are farmed, mined, or built.
- A settlement produces through **manpower assigned to production**: each unit works one of the area's resources (see Manpower below). Example: a town with 2 manpower can produce food *and* iron; a village with 1 must choose food *or* iron.
- **Resources are revealed before they are usable,** and use has requirements. Example: iron is revealed by stone tools but cannot yet be used.
- **Occupation drives discovery.** Any presence (loose tokens or settlements) in an area with a revealed resource contributes progress toward the related discovery. Example: occupying an iron area leads toward mining.

- **Goods last one turn.** Goods are produced and traded in phase 1 (resources) and used in resolution; anything unused is lost at the end of the turn. Example: wheat gathered in turn 10 and not used cannot cover a support shortfall in turn 14. Storage comes later through advances (e.g., granaries for food), which may let some goods carry over or spoil slowly. The original kept commodity cards in hand between turns; this design does not, except for **durable goods** (v0.28): stone, copper, and cloth keep from turn to turn with no cap, in a civ-wide stock, shared as spoils on capture like the treasury (§11).

- **Luxury goods** (v0.14). A category of goods given to the people to lower instability (§10). They create demand on the market: a civilization struggling with instability buys luxuries, so a luxury's price is not just a sale price that only falls. **Copper** (Copper Working) and **cloth** (Weaving) are the first (§8). **Use is automatic** (v0.14): luxuries left after the market (resources phase) are used in resolution step 7, before the collapse check. Each calms −1 on the settlement nearest its collapse threshold (smallest margin; lower area numbers break ties), **at most 1 per settlement per turn**; luxuries beyond one per settlement come off the civ-wide meter. Luxuries reach every settlement of the civilization regardless of transport (the ruler's gifts). Ritual's calm comes off the civ-wide meter in the resources phase, after Bureaucracy. Example: 2 copper, a far village 1 below its threshold and a town 5 below: the village and then the town each lose 1. **Durable luxuries are used only where needed** (v0.28): copper and cloth calm only settlements with instability above 0, at most 1 each, and never the civ-wide meter; the rest stays in stock for later turns. Example: 6 copper in stock and calm settlements: none is used; next turn a calamity unsettles two settlements, and 2 are used. The ruler's choice is how much to gather, buy, or sell, not where each unit goes; the cap keeps currency from replacing governance.

Candidate resource categories (from v0.1, not yet finalized): renewable production, extracted materials, manufactured goods, stored resources.

### Transport

- Produced goods must be transported to where they are used.
- **Adjacent areas share goods freely**, with no discovery required.
- Moving goods farther requires transport discoveries. **Dugout Canoes** (v0.14, §8): a stretch of up to 3 areas along a river counts as one step for transport distance.

### Food

- **Food is a special resource**, not a base need. It appears only in some areas (e.g., wheat on a floodplain), and nothing consumes food by default: loose tokens live off the land (area limits stand for carrying capacity, as in the original) and settlements are fed by their support tokens.
- **Any settlement can produce food**, with production manpower, once its civilization has discovered the technology that farms that resource. Example: a village on a wheat floodplain farms nothing until irrigation (or similar) is discovered, then can assign its 1 manpower to wheat.
- **Food is a category of named goods**, each with its own market price: grain and fish to start, livestock with Herding (v0.14), more later (rice). Any food good counts as food for support. As in the original, where each commodity (grain, cloth, salt) had its own cards and value.
- **Food is a good like any other resource**: production manpower gathers it in phase 1, and it can be traded on the market in the same phase (§7). Further uses may be added later.
- **Food substitutes for support tokens: 1 food replaces 1 support token**, and 1 production manpower gathers 1 food. Example: a town (2 manpower, 3 support) left with 1 support token can farm with both manpower and stay a town, but does no other work that turn. A village (1 manpower, 2 support) can cover only half its own support, so settlements still need hinterland.
- **Food in reach.** A settlement can be supported by its own food or food gathered by one of its civilization's settlements in an adjacent area (§6, Transport); farther food needs transport discoveries or the market. The engine assigns food in the support check (resolution step 6), after support tokens, larger tiers first, then lower area numbers. Example: a town 1 support short is covered by a neighbouring village's grain; fish gathered three areas away cannot help.
- **Food goods differ through advances and storage, not base yield or conversion.** Every food good starts at 1 food per manpower and 1 support per food. Grain gains from the plough and irrigation and later keeps in granaries; fish gains from boats and nets, scales less, and spoils without salt. Historically, fishing matched or beat early farming (Jōmon, Pacific Northwest, Baltic), but grain scaled with technology and stored for years, which made it the base of early states.
- **Storage** (v0.14): with Pottery, each settlement keeps up to 1 unused grain (2 when Mastered) into the next turn to cover a support shortfall; fish does not keep (§8).
- **Stone** (v0.28): a non-food, non-luxury good used to build wonders (§9). It is **worked from terrain**, not placed on the map: any settlement in a hills or mountains area can work it, from the start of the game. It trades on the market like any other good. Stone is a **durable good**: unused stone keeps from turn to turn with no cap (copper and cloth too). Timber waits for the Bronze Age, when ships give it a use.
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
| **Artists** | Arts | Culture points (victory points): each unit adds 1 culture progress a turn, and every **5 progress is 1 culture point** in the Stone Age (v0.26). Later eras pay more per unit in step with their knowledge points (example: Bronze about 3 points per 5 progress), by the civilization's current era. No stability for now (v0.26); designed with institutions in the Bronze Age | Artist, Prophet |
| **Wonders** | Construction | Progress toward a wonder | — |

- **Specialists** are manpower in Bureaucracy, High Learning, or Artists. Any settlement can assign them. Currency cannot fund specialists.
- All three specialist assignments raise figure odds, favoring the categories listed.
- Manpower works on a wonder only **at the wonder's own settlement**; currency can cover it instead (v0.28, §9).
- **No projects.** Ordinary construction (roads, irrigation, granaries) is built automatically once the enabling advance applies, like institutions.

### Currency

- A single generic currency, held in each civilization's **treasury**.
- **Tax** (v0.20). Towns and larger pay a fixed tax each turn in the resources phase (phase 1): **village 0, town 1, city 2, metropolis 3** (v0.29; first set at 2, 3, 4). Villages pay nothing, so a civilization collects no tax until its first town (Chiefdom), as only cities paid tax in the original; chiefs collected tribute, villages did not. Before then, currency comes only from selling on the market (Barter, §7). Example: 2 villages and 1 town collect 2 a turn.
- **Tax is free** in the Stone Age: no token, instability, or manpower cost. A later advance (Coinage, as in the original, where it let a player set 1–3 per city) adds a **tax rate lever**: lighter or heavier tax, with heavier tax raising local instability. Designed with that era's advances.
- **The treasury keeps** (v0.20) from turn to turn with no cap or decay, unlike goods (§6, Goods last one turn). It is lost only to spoils when a settlement is captured (§11) and to calamities that take currency (Piracy, Market crash; §12).
- **Uses** (v0.20): **buying on the market** (§7), **building wonders** (§9), and (v0.22) **buying off calamities** (10 each: Famine with Barter, Superstition, Civil disorder, Barbarian raid; §12). Nothing else: currency does not buy calm (calm comes from Bureaucracy, luxuries, advances, institutions, and wonders), does not buy learning or advances (unlike the original's treasury, which bought civilization cards), and cannot fund specialists.

## 7. Trade and the market — Decided

Trade is **market listings only**. There is no negotiation, proposal round, or treaty system.

| Element | Decision |
|---|---|
| Access | Requires a trade discovery: **Barter** Developed (v0.14, §8); Barter Mastered adds 1 step of reach. Before it, a civilization has no market access at all |
| Phase | Orders are placed in allocation and stand; they fill in the resources phase, after gathering and tax, from the next turn on (v0.24); goods usable the same turn |
| Counterparty | The game supplies and absorbs any quantity |
| Order types | **Limit** (maximum buy / minimum sell price) or **market** (accept the resulting price) |
| Market scope | **Per player:** a player's market includes their own orders plus those of every player directly in reach who has discovered trade |
| Reach | Each player's transport range, measured **settlement to settlement** (village or higher at both ends): **2 steps** of transport distance (v0.21), 3 with Barter Mastered; a river stretch counts as one step with Dugout Canoes; no sea crossings until a Bronze Age boat advance |
| Reach symmetry | **Mutual:** if either player reaches the other, both include each other |
| Chaining | **Direct only:** A–B–C does not connect A and C |
| Pricing | Per player, recalculated each turn from the buy/sell imbalance in that player's market; orders then fill at the new price. Limit orders the new price misses go unfilled |
| Conflict | Deferred (v0.25): exclusion from each other's markets arrives with War and Peace states (§11) |
| Goods (v0.21) | **Sell** any good you can use (its advance Developed) and hold, including stored grain; selling food in the resources phase leaves it out of that turn's support check. **Buy** any good, with or without its advance: bought goods work as their category says (food supports, luxuries calm), as finished goods, the way copper was traded long before smelting spread |
| Starting prices (v0.21) | **Food 5** (grain, fish, livestock), **luxury 10** (copper, cloth), the same in every player's market at the start |
| Price change (v0.21) | Each turn, before orders fill, each good's price moves **10% of its starting price per unit of imbalance** (units ordered bought minus sold in that market), rounded; food ±0.5 per unit, luxury ±1. Example: grain at 5, 4 bought and none sold: grain 7, and the 4 cost 28 |
| Limits (v0.21) | **Price bounds only**: half to triple the starting price (food 3–15, luxury 5–30). No cap on quantity |
| Recovery (v0.21) | **None**: a price moves only with imbalance and stays where it is on quiet turns, so a heavy buyer raises prices for everyone in its market until sellers bring them down |
| Delivery (v0.21) | Bought goods go to a **civ-wide pool**: bought food covers any of the civilization's settlements' shortfalls in the support check, after local food (largest tiers first, as §6); bought luxuries are used as gathered ones (§6, Luxury goods). Market reach is the geographic test; there is no routing inside the civilization. Bought food does not keep (Pottery stores only grain a settlement gathered) |
| Standing orders (v0.21) | One order per good, buy or sell, with an optional price limit. Orders **stand**, repeating every turn until changed or cancelled, like manpower assignments. A sell order sells only what is held; a buy order fills only as far as the treasury allows (proceeds from the turn's sales count first) |
| AI (v0.21) | The minimal AI **buys only what it needs**, as market orders it can afford: food for forecast support shortfalls, luxuries for settlements within 2 of collapse. It does not sell. Richer trading waits for Phase 7 |

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
- **Scattered populations** carrying knowledge to other civilizations: deferred (v0.31: refugees stay their own civilization's tokens, §5).

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
- Named wonders require a **village** (v0.27; a city until then), so each era's wonders, the Stone Age's monuments included, can be built as soon as the era's settlements exist. Whether a larger class of **great wonders** exists, and what it requires, is open until the Bronze Age (§17).
- **Wonders are designed with each era** (v0.27), as part of that era's systems, so the era's AI approaches and balance pass include them.
- Wonders cost **goods and manpower**, and currency can cover the manpower (v0.28; see Cost below). Manpower works only at the wonder's own settlement. Amounts are placeholders until the era's balance pass.
- Institutions **reduce instability**. Wonders score victory points; a wonder calms only if its own effect does (v0.28).

### Wonders (v0.28)

| Element | Decision |
|---|---|
| Uniqueness | **One of each wonder in the world.** The first civilization to complete it gets it. **Same-turn completion** (v0.30): when two or more civilizations would finish it on the same turn, the build **started last** gets it; builds started the same turn are decided by a random draw from the game seed. If the winner's last turn cannot be paid, the next in that order may still finish it. Every other civilization building it loses the race, and in its next allocation phase **chooses** what happens to its progress: move it to **another wonder** it can build that no one has completed, keeping the **same share of completion**, rounded down to whole turns (v0.28; example: 4 of Stonehenge's 8 turns becomes 2 of Göbekli Tepe's 5), or convert it to **culture points**: the wonder's victory points times the share of its turns of work done, **rounded down** (v0.28). Example: 4 of Stonehenge's 8 turns, worth 5 points: 4/8 × 5 = 2.5, so 2 culture points. A loser never earns more than the winner |
| Visibility | **Who, not how far.** The Rivals screen lists each wonder under construction and who is building it, without progress. A rival starting a wonder is announced in the turn report as a notable line, as is its completion |
| Stone Age wonders | Five (about one per civilization in a default game), each opened when its advances are **Developed**: **Göbekli Tepe** (Ritual), **Çatalhöyük** (Pottery), **Walls of Jericho** (Palisades), **Newgrange** (Masonry and Ritual), **Stonehenge** (Masonry and Ritual) |
| What a wonder gives | **Victory points and one themed effect** of its own (v0.28). The victory points are **flat per era**: every wonder of an era is worth the same, rising with later eras in step with knowledge points (placeholder: Stone Age 5). No general calm: a wonder lowers instability only if its themed effect does |
| Göbekli Tepe | **Pilgrimage centre:** −1 civ-wide instability every turn |
| Çatalhöyük | **Dense living:** +1 manpower in its settlement |
| Walls of Jericho | **No raiders dare:** Barbarian raids cannot strike any of its owner's settlements |
| Newgrange | **Carved stones:** +2 culture progress a turn, as if its settlement had 2 free Artists |
| Stonehenge | **Sky watchers:** +2 learning a turn, as if its settlement had 2 free High Learning units, sent down the study queue |
| Cost | Chosen when the wonder is started: its **location**, one of the builder's settlements. The wonder needs a number of **turns of work**; each turn it needs its **goods** and its **manpower**, the manpower working at that location or **covered with currency** instead: for a Stone Age wonder, **10 currency covers 1 manpower** for that turn, and manpower and currency can be mixed. Example: Stonehenge needs 3 manpower a turn: 3 manpower, 30 currency, or 2 manpower and 10 currency. **Goods cannot be replaced with currency**: a builder short of goods buys them on the market at the market price (§7). The goods can come from **anywhere in the civilization**: any of the builder's settlements or goods bought into the pool. **Support comes first**: a wonder takes only goods left after its civilization's support (§6), so a wonder never starves its people. Construction **may begin only when the first turn can be paid**. Each turn of construction is checked: if the goods and the manpower or currency are there, the wonder advances one turn of work; if not, it **stalls** at its current turn: no progress that turn, and nothing is spent. The turns already worked are kept. Each wonder needs **themed goods**; wherever it needs food, **any food good counts** (grain, fish, livestock), as for support (§6). The Stone Age wonders need stone (§6) and food. Amounts set with each wonder (v0.28; replaces paying manpower from settlements in range) |
| Losing the site | The builder **keeps the victory points** for good. The **themed effect follows the settlement**: it works for whoever holds the wonder's settlement, passing to a captor (§11). If the settlement collapses to nothing, the effect ends; the wonder stays completed, so no one can build it again. A wonder **still being built** whose settlement is captured or collapses **loses all its progress**; the wonder is open again to anyone, the captor included, from zero. A calamity that reduces the settlement without destroying it leaves progress alone (v0.28) |
| Stone Age costs (placeholders until the balance pass) | Göbekli Tepe: 1 stone and 1 food a turn, 5 turns, 1 manpower. Çatalhöyük: 1 food, 5 turns, 1 manpower. Walls of Jericho: 1 stone, 6 turns, 2 manpower. Newgrange: 1 stone and 1 food, 6 turns, 1 manpower. Stonehenge: 1 stone, 8 turns, 2 manpower (v0.28; reduced in the build so wonders are reachable in the Stone Age's ~30 turns) |
| AI | By approach (§2, v0.32): Balanced starts the first wonder it can build that **no rival is building**, at its **largest settlement**; other approaches prefer their own wonders, and Expansion builds none. Earlier interim rule: when it can afford a wonder's goods after support, the AI starts the first wonder it can build that no rival is building, at its largest settlement. If it loses a race, it always converts its progress to culture points (v0.28) |
| Build notes (v0.28, Phase 4 step 8) | Manpower on a wonder is counted in the resources phase like every assignment (§6), so a wonder started in allocation is **first worked the next turn**; the start check uses the goods held now, less what support is expected to eat. **One wonder in progress per settlement.** Food for a wonder is what is left after support and Pottery storage. Progress from a lost race that is not moved by the end of the next allocation phase **becomes culture**. Moving progress to another wonder skips the start check (the work is already done). Wonders are worked in player order, so if two builders would complete the same wonder in the same turn, the earlier player gets it (open, §17) |

## 10. Instability and collapse — Decided

### Meters

- Each settlement has a **local meter**. The civilization has a **civ-wide meter** that adds to every local meter.
- Collapse is checked **per settlement**.

| Raises local | Raises civ-wide | Lowers either |
|---|---|---|
| Lost support (v0.25: covers food shortage) | Overextension | Bureaucracy |
| Fighting at the settlement | War (deferred: War and Peace states, §11) | Institutions; wonders whose themed effect calms (v0.28) |
| Disasters (calamities, §12) | Settlement losses anywhere | Luxury goods |
| Harsh figures (e.g., a tyrannical governor) | Rapid change (v0.25: many advance steps in one turn) | Calming figures |
| | | Advances (Ritual's calm); Artists (slightly) |

- **No natural decay.** A meter falls only when a stabilizer is active.
- **Still to come** (v0.25): Artists arrive with culture points (Phase 4 step 7) but give no stability until the Bronze Age (v0.26); institutions with the first institution advances (Bronze Age; no Stone Age advance builds one); harsh and calming figures with historical figures (Phase 5); war instability with War and Peace states (§11).
- **Food does not affect instability** (v0.25): a settlement short of food loses support and takes the lost-support +2; there is no separate shortage source and no surplus or stores stabilizer. Food already pays off through support, urban growth (§5), and stores (Pottery).

### First version (Phase 3)

Built before most sources and stabilizers exist; the rest arrive in Phase 4. Starting numbers, to be tuned.

| Item | Meter | Value |
|---|---|---|
| Overextension | Civ-wide | +1 per turn for each settlement beyond 6 |
| Settlement losses | Civ-wide | +1 per tier lost to support failure (a drop or dissolve) or capture (the loser loses the whole settlement: village 1, town 2, city 3, metropolis 4). **Collapse does not count**: it is already the result of instability, and counting it would turn a collapse at the edge into a cascade |
| Lost support | Local, on the settlement that dropped | +2 (none if it dissolved) |
| Fighting at the settlement (v0.25) | Local | **+3** if the settlement itself is attacked (held or not); otherwise **+1** if its civilization lost tokens in a fight in or next to it. Fighting with no friendly losses adds nothing; never both |
| Bureaucracy | Local first, the rest civ-wide | −1 per unit per turn; the capital has 1 free unit |
| Rapid change (v0.25) | Civ-wide | +1 per advance step (Known, Developed, Mastered) beyond 2 reached in one turn; a Developed advance with no adoption stage counts once. Added at resolution step 10, so it counts toward next turn's collapse check. Ordinary use rarely finishes three steps at once (about 1 turn in 20 for the minimal AI); a scholar-driven sprint does |
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
- **Capture** starts the captured settlement's local meter at 0 for its new owner (the attack's +3 is the old owner's, not the new one's).
- **Interface.** Selecting a settlement shows "Instability 4 + 3 of 10" (local + civ-wide of threshold), why its threshold is what it is ("4 areas from the capital"), last turn's changes, and a Bureaucracy row beside the area's resources. While overextension outruns the civilization's Bureaucracy, the planning panel warns that unrest is rising and the farthest settlements will collapse first. Settlements within 2 of collapse carry a warning mark on the map. The Civilization overview has an Instability card (civ-wide meter, overextension, Bureaucracy, settlements close to collapse) and an instability column. The turn report names each collapse.

### Collapse

- When a settlement crosses its threshold, it **drops one tier** (§5, Tier drop); its freed tokens become refugees in adjacent areas, possibly in other civilizations' territory, where they stay its own tokens (v0.31).
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
- **Spoils:** a share of the defender's currency plus discovery progress toward the defender's advances (designed later). **Currency** (v0.20): the capturing attacker takes a share of the defender's treasury by the tier of the settlement lost: **village 10%, town 20%, city 30%, metropolis 40%**, rounded down, taken at the capture. A destroyed village counts. Example: a treasury of 20 loses 4 to the capture of a town, 2 to a village. **Durable goods** (v0.28) are taken the same way: the same share of each good in the defender's stock, rounded down. Example: 20 stone and 10 copper lose 4 stone and 2 copper to the capture of a town. Failed attacks take nothing.

### Conflict state

- **Deferred** (v0.25). All civilizations start **neutral**: fighting creates no lasting state, no civ-wide war instability, and no market exclusion. **War and Peace states** are introduced later and take over these effects (§7 market exclusion, slower idea spread, war instability). Until then the only instability from fighting is local (§10): +3 to an attacked settlement, +1 where friendly tokens are lost in or next to a settlement.

## 12. Calamities — Decided

### Trigger

- **Exposure-based:** frequency scales with a civilization's settlements and tiers (the original's equivalent: more cities drew more cards).
- Once a calamity occurs, **local conditions choose both the type and the target settlement**.
- **Risk levels are visible:** each settlement shows low/medium/high risk per calamity type, with reasons.
- **Specific advances mitigate specific calamities**, as in the original.
- Calamities that **spread** (the original's tradable calamities) travel along market reach or contact.

### Chance and choice (v0.22)

- **One roll per civilization a turn**, in resolution step 5, for a civilization with at least one settlement. The chance is **1% per settlement tier point** (village 1, town 2, city 3, metropolis 4), plus **5% for every turn in a row without a calamity**. The build-up **resets** the turn a calamity strikes; turns without a settlement do not add to it. Example: 6 villages and 2 towns are 10 points, so 10%; after 4 quiet turns, 30%; a calamity strikes, and it is 10% again.
- **One weighted draw picks both the calamity and the settlement**: every settlement × calamity pair has a weight from that settlement's conditions (below), pairs with weight 0 are left out, and one pair is drawn in proportion to its weight. The weights are what each settlement shows as its risk: **1–2 low, 3–4 medium, 5 or more high**, with the conditions behind them; the civilization's chance this turn is shown with its parts.
- **Mitigation lessens the damage, not the chance** (as in the original): each softening advance, once Developed, **halves** the effect, rounded down; some also halve again when Mastered. The calamity still strikes.
- Calamities hit before the support check (resolution step 6), so lost tokens or food can drop a settlement a tier that same turn.
- **Buying off** (v0.22). In allocation the ruler marks which calamities to buy off, a standing choice like manpower and market orders. When a marked calamity strikes and the treasury holds **10**, the 10 is paid automatically and the calamity is averted. It still counts as a strike: the build-up resets. Eligible: **Famine** (only with Barter Developed: food bought in), **Superstition**, **Civil disorder**, and **Barbarian raid** (tribute). Epidemic, Flood, Earthquake/volcano, and Drought cannot be bought off. Example: Superstition strikes a village with Superstition marked and 30 in the treasury: 10 is paid, nothing happens, and the chance falls back to its base.

### Stone Age calamities (v0.22)

Eight calamities exist in the Stone Age. Civil war, heresy, piracy, and market crash wait for the systems they need (independent settlements, institutions, sea trade, later eras).

| Calamity | Weight (per settlement) | Effect | Softened by |
|---|---|---|---|
| **Famine** | 2 if it ate food for support last turn, 1 if it gathers food; doubled for towns and larger | Tokens lost from its support areas (next to it, nearest first): village 3, town 4, city 6, metropolis 8; +2 local instability | Pottery Developed halves; Pottery Mastered halves again |
| **Superstition** | 1; 2 while the civilization lacks Ritual Known | +3 local instability, and its manpower is idle next turn. Ritual also gains 1 free High Learning (2 progress) toward its next step, Known or Developed, while plausible | Ritual Developed halves; Ritual Mastered halves again |
| **Civil disorder** | 1 per point of instability (local plus civ-wide), only at half its collapse threshold or more | Its manpower is idle next turn (strikes, riots); +2 local instability | Tallies Developed halves; Tallies Mastered halves again |
| **Epidemic** | Town 2, city 3, metropolis 4 (villages 0); +1 if it is in a market with other civilizations | Tokens lost from its support areas: town 4, city 6, metropolis 8; each other settlement of the civilization within 2 steps loses 1. **Spreads**: each civilization in the victim's market is struck at its settlement nearest the victim, with the same effect; this counts as its calamity for the turn and resets its build-up | Nothing until Medicine |
| **Barbarian raid** | 1 per adjacent unsettled land area with no tokens | Raiders strike the support around it: 3 tokens lost from its support areas, +2 local instability; towns and larger also drop a tier | Archery, Palisades, and Masonry each halve the loss and instability (archers defend the fields); Palisades or Masonry prevents the tier drop (the people shelter inside) |
| **Flood** | Its own area: floodplain 2, river 1; +1 per adjacent floodplain or river area | Half the loose tokens (rounded up) in its own and adjacent floodplain and river areas are lost, and the food it gathered this turn is lost | Nothing until Irrigation |
| **Earthquake/volcano** | Its own area volcanic 3; +1 per adjacent volcanic area | Tier drop (with refugees) | Masonry Developed: a town or larger does not drop, and loses 3 tokens from its support areas instead |
| **Drought** | Its own area desert 2; +1 per adjacent desert area | It gathers no food for 2 turns, and each of its support areas has its limit lowered by 1 for 2 turns (tokens over the limit are removed as surplus) | Pottery Developed halves the food part (1 turn) |

Details set in the build (v0.22): a village struck by a spreading epidemic loses 2 tokens; Flood and the support losses take only the victim's own tokens; Drought's lowered limits last this turn and next; a bought-off calamity does not count as striking the settlement (Ritual's Superstition input counts only real strikes).

Halving counts each unit separately and rounds down: a raid on a village with Archery and Palisades costs 3 → 1 → 0 tokens. "Manpower idle" halved idles half the settlement's manpower, rounded down, so a village with the counter keeps working.

### Full list (all eras, v0.2; Stone Age rules above)

| Calamity | Kind | Favored by | Effect | Mitigated by (example) | Spreads |
|---|---|---|---|---|---|
| Flood | Environmental | Floodplains, rivers | Tokens lost; possible tier drop | Irrigation, flood control | No |
| Earthquake / volcano | Environmental | Fault or volcanic areas | Tier drop | Engineering, building codes | No |
| Drought | Environmental | Arid areas, climate | Food output drops for N turns | Irrigation, storage | No |
| Famine | Economic | Food deficit, low stores | Tokens lost; local instability | Pottery/storage, agriculture | No |
| Epidemic | Social | Dense settlements, trade contact | Tokens lost across settlements | Medicine, sanitation | Yes (market reach) |
| Superstition | Social | Settlements without belief advances | Instability and idle manpower (v0.22, above) | Ritual (as Mysticism in the original) | No |
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
| First era | **Bronze Age** (v0.27): figures are named individuals, and recorded names begin with writing. The Stone Age has none; its leadership is anonymous (Chiefdom) |
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

**Culture figures** (Artist, Prophet, Thinker) generate culture points (v0.26), which score; the figures themselves are not scored.

## 14. AST and civilizational progression — Decided

Follows the original Archaeological Succession Table's eras and gates, extended to the Modern era. v0.26 removes the original's turn-by-turn track: a civilization moves to the next era as soon as it meets that era's gate, so advancing depends only on growth.

| Element | Decision |
|---|---|
| Eras | Stone → Bronze → Iron → Classical → Medieval → Renaissance → Industrial → Modern |
| Gate | Each era after the Stone Age opens with a **gate**: a number of **settlement points** plus a number of **knowledge points**. A civilization that meets the next era's gate in resolution step 13 enters that era |
| Settlement points | Every settlement: **village 1, town 2, city 3, metropolis 4** (the same scale as calamity exposure, §12) |
| Knowledge points | Per advance: **Developed 1, Mastered 3** (3 in all, not added to the 1). An advance with no adoption stage scores 1 even though it is Mastered when Developed, so 3 rewards adoption work. The starting baseline advances score nothing. Later eras' advances score more (example: a Bronze Age advance might score Developed 3, Mastered 5; set when the era is designed). Knowledge points are also victory points (§15) |
| Bronze gate | **5 settlement points and 12 knowledge points** (starting values). The Stone Age has 15 scoring advances: 10 with adoption (up to 3 each) and 5 without (1 each), 35 points at most |
| No turn clock | No track and no movement per turn; sprinting is gone. Pace comes from growth itself: study and adoption time, the token cap, and calamities |
| No regression | An era, once entered, is kept: the gate is checked only on entry, as in the original. A civilization that falls below its current era's gate suffers nothing further; the decline shows in its score through lost settlement points |

Note (batch measurement, v0.26, before tuning): with the starting values, AI civilizations reach 5 settlement points around turn 18 (16–23) and 12 knowledge points around turn 31 (24–41), so knowledge decides the Bronze gate.

## 15. Victory — Decided

| Element | Decision |
|---|---|
| Final era | Setup option |
| Trigger | When any civilization completes the final era, an **endgame countdown** begins. A civilization completes the final era when it meets the **next era's gate** (v0.26); the Modern era, with no next era, has one **closing gate** in the same form. Example: final era Stone; the first civilization to meet the Bronze gate starts the countdown |
| Countdown | **5 turns** (starting value, v0.26): the game ends at the end of the fifth turn after the one in which the countdown began. Every civilization keeps playing and adding points; finishing first keeps its era lead |
| Winner | Highest points when the countdown ends |
| Scoring | **Knowledge points + settlement points + wonders + culture points** (v0.26). Era reached scores nothing, since the gates already measure knowledge and settlement points; culture figures score through the culture points they generate. The scale lives in the point values: settlement points climb with tier, and knowledge points with era (§14) |

## 16. Deliberate trade-offs and known tensions

These are choices made knowingly, or risks to watch in playtesting.

| Item | Tension |
|---|---|
| Civ-wide adoption % | Conflicts with the v0.1 idea that adoption spreads unevenly by region. Chosen for simplicity |
| Institutions auto-build at Known | Conflicts with "knowledge is not capability." Wonders still require Developed |
| Higher-tier value | With token-based tiers, tokens tied up per base manpower is roughly flat (village 8, town 7.5, city 8, metropolis 9). Accepted: climbing is justified by exclusive abilities and by advances, not by raw manpower |
| Weak town tier | With specialists available at any tier, the town's exclusive abilities are auto-built institutions and tax (v0.20: villages pay none) |
| Development ratio replaced | v0.2 initially derived manpower from a population ratio that rose with development. Replaced by tier base plus advance bonuses, which keeps manpower in small, readable whole units |
| No instability decay | Meters accumulate over a long game unless the ruler actively stabilizes |
| Collapse cascades | Settlement losses raise the civ-wide meter, which raises every local meter, so one collapse can trigger others. Must not become routine |
| Fast map fill | Phase 0 simulation (before proportional growth, v0.10; to be re-run): with the original's growth rule and no effective cap, one civilization filled a 64-area map in about 20 turns. Resolved by the token cap (55, loose tokens only, 1–2 rises per era): with two Stone Age rises, land fills around turn 36; with fewer, it may never fill, so peace is the default until cap-raising advances add pressure |
| No support cascades | Settlements are supported by tokens, not lower tiers (v0.3). Simpler and keeps token counts small, but removes tier-to-tier cascades. Fully populated settled areas restore a hinterland requirement |
| Uneven expansion window on continents | On the continents map type, an isolated civilization may meet no one in the Stone Age while others meet early. Accepted for variety; the inland sea default keeps the 30–40 turn window predictable |
| Low manpower ceiling | Fully populated settled areas cap how much of the map can be settled (about 40–60% in Phase 0), and high tiers are rare at small limits. Chosen for spatial decisions over density; discoveries that raise limits lift the ceiling |
| Narrow currency | Currency buys on the market, builds wonders (v0.20), and buys off some calamities (v0.22). It does not buy calm or learning directly, so it never replaces governance or scholarship; buying off a Civil disorder or Superstition strike comes close to buying calm, but only against a strike, at a flat 10 |
| Unlimited game counterparty | A currency-rich civilization can buy its way out of any shortage. Price-change rate is the main brake (v0.21: 10% of the starting price per unit, capped at triple, no quantity limit) |
| No price recovery | Prices move only with imbalance (v0.21), so one heavy buyer can keep a market expensive for its neighbours for many turns. Chosen so prices carry memory; watch in tuning |
| No era clock | Without the original's turn-by-turn track (v0.26), game length depends on growth rather than a fixed pace, and the endgame countdown is the only clock. A civilization that grows fast can race through eras; calamities and the token cap are the brakes |
| No regression | An era is a high-water mark (v0.26): a civilization that collapses after entering an era keeps it and is penalized only through lost points and the collapses themselves |
| Deterministic combat | Uncertainty comes from figures and calamities instead |
| Deterministic discovery | Advances arrive exactly when progress reaches their cost (v0.13). Fully plannable; surprise comes only from historical figures, which spike or redirect progress, and calamities |
| No diplomacy | Diplomats act only on market reach and knowledge spread |
| Weak AI during tuning | Resolved in part (v0.27): before each era's balance pass, several AI approaches (fixed priority patterns favouring different strategies) are built, so numbers are measured against more than one way of playing. Real strategy and difficulty levels still wait for development Phase 7 |
| Empty city tier | With named wonders at villages (v0.27), cities have no exclusive ability yet. To be filled when advances unlock cities |
| Long-arc content | The emergent discovery model needs a large authored set of advances, each with conditions, counters, and adoption effects |

## 17. Open questions

### Design

- [x] ~~How the original's growth rule extends~~ — kept unchanged (v0.3).
- [x] ~~Growth variant: original rule vs proportional~~ — proportional, 0.5 per loose token with per-area progress (v0.10).
- [ ] What specific transport discoveries do to movement range and goods range. (Dugout Canoes: up to 2 more areas along a river, v0.14.)
- [ ] Conditions for absorbing independent settlements peacefully.
- [ ] Barbarian spawn rules.
- [ ] Great wonders (v0.28): whether a larger class of wonder exists above named wonders, and what it requires (earlier drafts said a metropolis). Decide with the Bronze Age wonders.
- [ ] War and Peace states (v0.25: all civilizations start neutral): how they begin and end, war instability, market exclusion, slower idea spread.
- [x] Whether token cap rises from adoption are permanent. Resolved v0.16: adoption no longer falls, so Mastered rises (Agriculture's +5) are permanent.
- [x] Calamity mitigators: confirmed in v0.22 (§12): Pottery (Famine, Drought), Ritual (Superstition), Tallies (Civil disorder), Archery, Palisades, Masonry (Barbarian raid), Masonry (Earthquake). Dropped: Fishing, Agriculture, Herding, Barter (Famine), Chiefdom (Civil war, not in the Stone Age), Copper Working (Civil disorder).
- [ ] Technology-by-technology design: plausibility conditions, Known and Developed inputs and costs, what each stage does, what drives adoption and how benefit scales, counters, mitigated calamities. Every advance is reviewed one at a time.
- [ ] Final resource category list.
- [ ] Game name. Placeholder: *Succession* (after the Archaeological Succession Table).
- [x] ~~Per-area tier caps~~ — replaced by one settlement per area (v0.3).
- [ ] Map size per civilization (procedural maps scale land areas by civilization count). Phase 0 used 64 areas per civilization; with limits 1–5, cap 55, and two Stone Age rises, land filled around turn 36.
- [ ] Which advances unlock cities and metropolises. (Villages: Permanent Settlement; towns: Chiefdom, v0.14.)
- [ ] Names for rival civilizations' settlements (generated name lists, or unnamed).
- [ ] What happens to a settlement's name when it dissolves or is refounded.
- [ ] Support variant: tokens only (current) vs tokens plus one lower-tier settlement in range. Compared in the Phase 0 simulation.
- [ ] Food: whether food still drives growth now that food is a special resource. (Stores buffer support shortfalls: Pottery, v0.14; eating its own food adds urban growth, v0.18; food has no instability effect, v0.25.)

### Tuning (playtesting)

No balance changes until the Stone Age is complete (development plan §4, Tuning); the items below wait for that pass.

- [ ] Settlement conversion costs and support requirements
- [ ] Starting limit range and resource options per terrain; terrain mix on procedural maps; food odds per terrain and feature
- [ ] Tier exclusive abilities and tax per tier (the town tier especially; first values village 0, town 2, city 3, metropolis 4, v0.20; now 0, 1, 2, 3, v0.29)
- [ ] Base manpower per tier; stability, discovery, and culture yields per specialist
- [ ] Market starting prices and price-change rate (first values v0.21: food 5, luxury 10; 10% per unit; bounds half to triple; base reach 2)
- [ ] Conflict state duration
- [ ] Settlement attack thresholds and defense values (set when settlements were worth 6/12/24/48 tokens; now 6/12/20/30)
- [ ] Instability thresholds, source and stabilizer magnitudes, partial-reset amount (first-version values in §10)
- [ ] Calamity exposure rate and condition weights (first values v0.22: 1% per tier point, +5% per quiet turn; weights and effects in §12)
- [ ] Figure emergence odds
- [ ] Era gate requirements and point values (first values v0.26: settlement points village 1, town 2, city 3, metropolis 4; knowledge points Developed 1, Mastered 3; Bronze gate 5 settlement + 12 knowledge)
- [ ] Endgame countdown length (first value v0.26: 5 turns) and scoring weights
- [ ] Artists' culture rate (first value v0.26: 1 culture point per 5 unit-turns in the Stone Age; about twice what High Learning on Mastering earns in score, three times Developing, but with no advance effects) and per-era scaling
- [ ] Discovery outliers under v0.17 (2 progress / 10 adoption per learning, doubled Developed costs and adoption): low-usage advances (Masonry +1 a turn from one hill settlement, Tallies) take 20+ turns to develop without High Learning, which makes it near-mandatory there; high-usage advances (Ritual, Chiefdom) scale with civilization size, so learning barely moves them; advances whose adoption drivers have nothing to count yet (Barter before the market, Archery without fights) can be mastered only through learning, so Barter could master before the market exists

## 18. Recommended next steps

See the [development plan](development_plan.md) for build phases.

1. **Author a vertical slice of content:** the Stone and Bronze eras, with roughly 20 advances (conditions, counters, adoption effects), a handful of resources, and the first calamities.
2. ~~**Prototype the core loop economy**~~ — done in Phase 0 (`sim/phase0/sim.ts`); reshaped the pyramid, settlement, and cap rules (v0.3).
3. **Re-run the economy simulation** once Stone Age advances, calamities, and historical figures are designed, to retune pacing with them in play.
4. **Prototype the market** with several civilizations at different ranges, to confirm per-player pricing is readable to players.

---

## Change log

- **0.32 (October 26, 2026):** AI approaches for the Stone Age (§2; Phase 4 step 11): Balanced (the interim AI, extended), Expansion, Building, Study, Culture, and Aggression; Trade waits for the Bronze Age. Assignment is a setup option per rival, Random by default (seeded, no repeats until all are used); approaches are hidden from the player. Each approach is the Balanced pattern with its own settings (§2 table). Aggression masses tokens beside the easiest rival settlement and attacks at its threshold, any rival alike.
- **0.31 (October 26, 2026):** Refugees decided (§5; closes the §17 tier drop question): refugees always stay their own civilization's tokens, wherever they land, as in the original; they never join a host, so there is no accept or reject choice, no effect on another civilization's cap, and no transfer of tokens by deliberate collapse. Knowledge carried by scattered populations is deferred (§8). Matches the engine as built.
- **0.30 (October 26, 2026):** Same-turn wonder completion decided (§9; closes the §17 question): the build started last gets the wonder; builds started the same turn are decided by a seeded random draw; if the winner cannot pay its last turn, the next in order may finish. Replaces player order, which always favoured the first player.
- **0.29 (October 26, 2026):** Screens and information panels designed (§3; Phase 4 step 9). Eight screens by theme: Map, Civilization (settlements, support, manpower, calamity risks), Economy (the market, the treasury and its sources, goods and the durable stock; replaces the Market screen), Knowledge, Society (wonders, culture and Artists, instability; replaces the Wonders screen), Rivals, Chronicle, Rules (the rules reference). Panels serve three needs: state, attention, and rules; sources are not shown for their own sake. Top bar: era and turn, tokens of the cap, settlements, treasury, score with rank, next-era gate progress, the endgame countdown, and an attention count that opens the list. Attention items: idle manpower, support short at the next check, near collapse (within 2), a wonder that cannot be paid, a lost wonder race to resolve, a failing planned conversion, tokens over the cap or an area limit, a buy order the treasury cannot fill, a planned move into a fight; not opportunities or an empty study queue. Civilization · Population: tokens of the cap, one growth line (area and urban), room below the cap, a growth rule note; settlement token value dropped. Civilization · Settlements: counts by tier, the unlock named for locked tiers, and a tier table in the card; settlement points not shown. Tax lowered to town 1, city 2, metropolis 3 (§6; was 2, 3, 4). Civilization · Support: as before, plus a support rule note; village sites as a count only. Civilization · Manpower: production split by good and a job table in the card. Civilization · Calamities: chance with a rule note (the settlement and quiet-turn parts dropped), buy-off marks with each calamity's effect, risks; the calamity table on the Rules screen. A marked buy-off the treasury cannot pay is an attention item. Civilization · Settlements table: terrain goods and the settlement's wonder added; urban growth column dropped; instability stays per row. Economy · Treasury: treasury, tax, spending, expected next turn, and a currency rule note. Economy · Goods and market: one table of goods with gathered, held, needed, price, and order. Knowledge · Advance card: adds every step's cost, the wonders it opens, and its knowledge points. Knowledge · Header and queue: learning by source and a rule line. Society · Instability: meter, next turn's change with its parts, capital rule, near collapse, luxuries in stock, and a raises/lowers table. Society · Culture: points, progress with sources and turns, points per award, a rule note. Society · Wonders: adds ticked advances, total cost, this turn's forecast, and the finish turn. Rivals: as before, plus rule notes on the endgame and on score. Map · Side panel: adds the settlement's support and wonder; idle, unrest, and fight lists move to the attention list (a fight also shows in the panel for its selected area). Rules: one scrolling page with a contents list, generated from the data files and engine constants.
- **0.28 (October 26, 2026):** Wonders designed (§9, Decided). Each wonder exists once in the world: the first to complete it gets it; other builders choose to move their progress to another wonder they can build (the same share of completion, rounded down) or convert it to culture points (the wonder's points times the share of turns done, rounded down). Each wonder gives victory points and one themed effect, with no general calm; its victory points are flat per era (placeholder Stone Age 5) (replacing "institutions and wonders reduce instability"). Göbekli Tepe: −1 civ-wide instability a turn. Çatalhöyük: +1 manpower in its settlement. Walls of Jericho: raids cannot strike its owner. Newgrange: +2 culture progress a turn. Stonehenge: +2 learning a turn. Cost: a location chosen at the start; each turn of work needs the wonder's goods (from anywhere in the civilization, after support; never currency; short goods are bought on the market) (themed; any food good counts as food; new good **stone**, worked in hills or mountains areas, §6; timber waits for the Bronze Age) plus its manpower at that location, or 10 currency per manpower unit in its place for a Stone Age wonder (mixing allowed); a turn missing either stalls and spends nothing; construction may begin only when the first turn can be paid. Durable goods: stone, copper, and cloth keep from turn to turn with no cap (all other goods still last one turn). Stored luxuries (copper, cloth) calm only settlements with instability above 0 (1 each) and are otherwise kept. A capture takes the same share of the defender's durable stock as of its treasury (§11). Losing a completed wonder's settlement: the builder keeps its points; the effect passes to whoever holds the settlement and ends if it collapses; a wonder in progress loses all its progress if its settlement is captured or collapses. Interim AI: starts the first wonder it can afford that no rival is building, at its largest settlement, and converts to culture on losing a race. Who is building each wonder is public (not progress); starts and completions appear in the turn report. Stone Age wonders: Göbekli Tepe (Ritual), Çatalhöyük (Pottery), Walls of Jericho (Palisades), Newgrange and Stonehenge (Masonry and Ritual). Great wonders (formerly a metropolis) are moved to an open question for the Bronze Age (§17). Built (Phase 4 step 8): wonders are first worked the turn after they are started; one wonder in progress per settlement; unclaimed progress from a lost race becomes culture after the next allocation; same-turn completion goes to the earlier player for now (§17). Placeholder wonder costs reduced to 1 stone and/or 1 food a turn and 1–2 manpower (Walls of Jericho and Stonehenge 2).
- **0.27 (October 26, 2026):** Wonders (§9): named wonders require a village instead of a city; great wonders still require a metropolis. Wonders are designed with each era, before its AI approaches and balance pass. Cities lose their only exclusive ability (§5, §16). §16: the weak-AI tension is resolved in part by AI approaches before balance. Historical figures (§13) begin in the Bronze Age; the Stone Age has none.
- **0.26 (October 26, 2026):** Era progression reworked (§14). The turn-by-turn AST track, sprinting, and the track length setup option are removed: a civilization enters the next era as soon as it meets the gate. Gates count settlement points (now every tier: village 1, town 2, city 3, metropolis 4) and knowledge points (Developed 1, Mastered 3; advances with no adoption stage 1; baseline advances 0). Bronze gate: 5 settlement + 12 knowledge. Scoring (§15): knowledge points + settlement points + wonders + culture points; era reached and culture figures are no longer scored (figures generate culture points). Knowledge points climb with era (for example Bronze Developed 3, Mastered 5). Artists (§6): 1 culture progress per unit a turn, 5 progress per culture point in the Stone Age, more per unit in later eras in step with knowledge points. Artists give no stability until the Bronze Age. No regression: an era once entered is kept, and the gate is checked only on entry. Endgame trigger (§15): meeting the gate of the era after the final era; the Modern era has a closing gate in the same form. Endgame countdown: 5 turns.
- **0.25 (October 25, 2026):** Instability sources and stabilizers for the Stone Age (Phase 4 step 6). Artists wait for culture points (step 7), institutions for the Bronze Age, figures for Phase 5. Rapid change (§10): +1 civ-wide per advance step beyond 2 reached in one turn. Food has no instability effect (§10): shortage is covered by lost support; no surplus or stores stabilizer. Conflict state deferred (§11): all civilizations start neutral; War and Peace states come later with war instability and market exclusion. Instability from fighting (§10) is local only: +3 to a settlement that is attacked, otherwise +1 where its civilization lost tokens in or next to it; fighting without friendly losses adds nothing.
- **0.24 (October 25, 2026):** The trade phase is removed (§3): three phases, Resources, Allocation, Resolution. Market orders are placed in allocation and fill in the resources phase after gathering and tax, so a change takes effect next turn and standing orders fill before the player allocates (§7).
- **0.23 (October 25, 2026):** Resolution reports (§3): Brief (the current flash), Normal (a paused page of notable results, each line linked to the map), Detailed (every event, routine ones included). The Chronicle lists past turns, each opening its Detailed page.
- **0.22 (October 25, 2026):** Calamities designed (§12). One roll per civilization a turn: 1% per settlement tier point plus 5% per turn in a row without a calamity, reset when one strikes. One weighted draw over settlement × calamity pairs picks both; the weights are the shown risk (low, medium, high). Softening advances halve the damage once Developed (some again when Mastered), not the chance. Eight Stone Age calamities: Famine (Pottery), Superstition (Ritual; a strike also gives Ritual 1 free learning), Civil disorder (Tallies), Epidemic (spreads through the victim's market; no counter yet), Barbarian raid (Archery, Palisades, Masonry), Flood, Earthquake/volcano (Masonry), Drought (Pottery). Civil war, heresy, piracy, and market crash wait for later systems. Buying off: a standing choice to pay 10 when a marked calamity strikes (Famine with Barter Developed, Superstition, Civil disorder, Barbarian raid); it is averted but still resets the build-up; currency gains this use (§6). The candidate calamity tags of §8 are confirmed or dropped (§17).
- **0.21 (October 25, 2026):** Market details (§7). Sell any good you can use and hold; buy any good, which works as its category says without its advance. Starting prices food 5, luxury 10. Prices move 10% of the starting price per unit of imbalance, rounded, within half to triple the start; no quantity limit and no recovery on quiet turns. Bought goods go to a civ-wide pool (food covers any settlement's shortfall after local food). Base market reach 2 steps settlement to settlement (3 with Barter Mastered). Orders stand until changed. The minimal AI buys food for shortfalls and luxuries for settlements near collapse, and does not sell.
- **0.20 (October 25, 2026):** Currency designed (§6). Towns and larger pay a fixed tax each turn in the resources phase: village 0, town 2, city 3, metropolis 4; villages pay nothing, so tax starts with the first town (Chiefdom), as only cities paid tax in the original. Tax is free in the Stone Age; a later advance (Coinage) adds a tax rate lever. The treasury keeps from turn to turn with no cap, lost only to spoils and currency calamities. Currency is used only to buy on the market and, new, to build wonders (§9: wonders cost manpower, resources, and currency). Currency no longer buys calm: stabilization is removed from allocation (§3) and §10's stabilizers; it does not buy learning or advances. Spoils (§11): a capture takes 10% of the defender's treasury per tier of the settlement lost (village 10% to metropolis 40%).
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
