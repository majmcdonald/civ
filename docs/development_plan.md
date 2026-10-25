# Development Plan

**Version:** 0.23  
**Date:** October 25, 2026  
**Status:** Working draft

> Companion to the [design document](civilization_game_design_document.md). This plan covers how the game is built; the design document covers what is built.

## 1. Project setup

| Element | Decision |
|---|---|
| Team | Solo, AI-assisted (developer plus Claude Code) |
| Platform | Web browser; a desktop wrapper (Tauri or Electron) remains possible later |
| Language | TypeScript |
| Version 1 scope | Single-player against AI. Multiplayer is a future enhancement |
| Tooling | npm, TypeScript (strict), Vitest, Vite, React (`src/ui/`, the only code with browser types) |
| Layout | `src/engine/` (rules engine; compiled without browser types), `src/content/` (game data), `tests/`, `sim/` (economy simulation) |

## 2. Architecture

| Element | Decision |
|---|---|
| Rules engine | **Headless.** Holds all game state and applies all rules. Knows nothing about screens |
| Presentation | Reads state, sends player commands to the engine, displays results |
| Commands | The player, the AI, tests, and replays all issue the same commands |
| Determinism | Seeded random number generator: the same seed and commands always produce the same game |
| Content | **Data + scripts.** Advances, wonders, figures, calamities, resources, and eras are data files. The engine provides a library of effect types; scripted hooks handle unusual rules |
| Content format | **TypeScript data files**: plain, serializable objects checked by the compiler (`satisfies`). Effects are typed entries from the effect library; hooks are referenced by id into a script registry. No inline functions in data, so the rules reference and tooltip sources can be generated from it. Converting to JSON later is mechanical if modding becomes a goal |
| Save/load | The game state is a single serializable object. The procedural map is not stored in it: the setup holds the map options, and the map is rebuilt from the seed on load (the generator is deterministic across JavaScript engines), so saves stay small |
| Game log | Structured, one JSON event per line (commands, state changes, resolution steps, random draws). Downloadable. The seed plus the command log replays a game exactly |

What the architecture enables:
- Headless batch runs for tuning.
- Rules tests without a UI.
- Reproducible bug reports and replays.
- Multiplayer later without an engine rewrite.

## 3. Phases

| Phase | Contents |
|---|---|
| **0. Pre-production** | **Done.** Economy simulation (`sim/phase0/sim.ts`) tested the settlement pyramid's return on investment and early-game pacing; results reshaped design doc v0.3. The simulation is kept and extended as systems are designed |
| **1. Foundation** | **Done.** TypeScript project; headless deterministic rules engine with command layer; data + scripts content format; rules test harness; save/load format; game-log format |
| **2. Basic screens** | **Done.** Title and map screens; an in-game frame (top bar, navigation) with seven status screens: Civilization overview and Rivals and standings laid out, the rest (Economy, Market, Knowledge, Society, Chronicle) as placeholders until their systems are built; no behavior; procedural map generator |
| **3. Core loop** | **Done.** Turns and resolution order; settlements, conversion, support, growth, migration, surplus removal; first resource; manpower; simple conflict; basic instability and tier drop; working save/load; minimal AI; headless batch runs and downloadable game log |
| **4. Stone Age systems** | In order, each designed then built: (1) discovery core: advance data, accumulators, stages, High Learning, Knowledge screen; replaces the farming stand-in; (2) Stone Age advances; (3) currency; (4) market (its own work item); (5) calamities; (6) full instability sources and stabilizers (conflict state, institutions, food); (7) AST and endgame countdown; (8) information panels and rules reference; (9) **tuning pass**: batch runs across seeds and settings, then evaluate and set the numbers frozen until now; (10) **full review** before the phase is complete: every advance's steps, effects, and costs, and every screen (e.g., which step the Knowledge screen's Study button feeds). Art and audio for the era alongside |
| **5. Stone Age content** | First wonders and historical figures; era art and audio; **re-run batch runs with wonders and figures and retune**; **playtest and design review** |
| **6. Remaining eras** | Repeat Phases 4–5 for each era (Bronze → Modern), with a playtest and design review after each; historical map |
| **7. AI enhancement** | Strategic depth and difficulty levels; retune balance numbers set against the minimal AI |
| **8. Polish and release** | Tutorial; broader testing (scenario tests, replay regression); performance optimization, starting with map rendering (§6); final cleanup; distribution |

### Milestones

A **playtest and design review** follows every era. Each review:
1. Plays a complete game ending at that era (final era is a setup option).
2. Updates the design document with what play revealed.
3. Decides any changes before the next era's content is built.

## 4. Cross-cutting practices

| Area | Practice |
|---|---|
| Tests | Rules tests are written alongside each system from Phase 1. Scenario tests and replay regression are added in Phase 8 |
| Tuning | **No balance changes until the Stone Age systems are complete** (Phase 4 steps 1–8: advances, discovery, market, resources, calamities, full instability); step 9 is the tuning pass. Until then every number is a placeholder and tuning is wasted, because those systems change growth, support, and stability. Batch runs (`npm run batch`) measure the real engine and are kept for that tuning pass; they report, they do not tune. The Phase 0 economy simulation (`sim/phase0/sim.ts`) predates the engine and is not re-run |
| AI | Minimal until Phase 7 |
| UX | Every system ships with an information panel and tooltip breakdowns showing each number's sources. The rules reference is generated from data files. The tutorial is built in Phase 8 |
| Art | Claude-generated, vector, and stylized (board-game or map-atlas look); produced per era. The in-game map uses an **isometric view**: the flat atlas map tilted like a board on a table, with settlements, tokens, and terrain features as upright vector pieces. Areas stay flat and the map data stays 2-D; the projection is presentation only. The title screen uses a flat atlas look |
| Audio | Procedural, Claude-generated (Web Audio); produced per era |
| Performance | Addressed in Phase 8. **Map rendering (Phase 2 stress test):** live SVG holds 60 fps only up to a few thousand elements; a late-game 15-civilization spacious board (~20,000 elements) pans at 6 fps, and dropping terrain art alone only reaches 10. Drawing the board once into an image and moving it holds 60 fps at every size tested. Results and the Phase 8 plan: §6 |

## 5. Known risks

| Risk | Note |
|---|---|
| Balance tuned against a weak AI | Phases 4–6 tune against the minimal AI. Expect a retuning pass in Phase 7 |
| Performance found late | The long arc and per-player markets may be slow; headless batch runs will surface slowdowns before Phase 8 |
| Art limits | Claude can produce vector art and code-drawn maps, not raster illustrations or recorded audio. Art direction must stay vector and stylized |
| Content volume | Eight eras of advances, wonders, figures, and calamities. Data-driven content keeps this to authoring, not engine work |

## 6. Performance findings

### Map rendering stress test (Phase 2, October 16, 2026)

**Setup.** The stress screen (`?screen=stress`, `src/ui/screens/StressScreen.tsx`) builds a late-game board with `lateGamePieces` (`src/ui/screens/samplePieces.ts`): about 50% of land settled, loose tokens in every unsettled area, border conflicts, and trails between settlements. It pans the board automatically for 180 frames and records frame times. Run headless in Chrome for Testing at 1440×900 via puppeteer; frame rate caps at 60. URL options: `civs`, `room`, `type`, `seed`, `mode` (`svg` | `noart` | `cached`), `zoom`. Results appear in a panel on the page.

| Map | Drawing | Zoom | Settlements / stacks / trails | SVG elements | Pan fps | Median frame |
|---|---|---|---|---|---|---|
| 5 civs, standard | Live SVG | 1× | 149 / 186 / 134 | 3,600 | 33 | 33 ms |
| 5 civs, standard | Cached image | 1× | same | — | 60 | 17 ms |
| 15 civs, standard | Live SVG | 1× | 461 / 549 / 431 | 10,400 | 12 | 83 ms |
| 15 civs, spacious | Live SVG | 1× | 928 / 1,047 / 927 | 20,300 | 6 | 167 ms |
| 15 civs, spacious | Live SVG | 4× | same | 20,300 | 14 | 67 ms |
| 15 civs, spacious | No terrain art | 1× | same | 17,400 | 10 | 100 ms |
| 15 civs, spacious | No terrain art | 4× | same | 17,400 | 20 | 50 ms |
| 15 civs, spacious | Cached image | 1× | same | — | 60 | 17 ms |
| 15 civs, spacious | Cached image | 4× | same | — | 60 | 17 ms |

Other costs on the 15-civilization spacious board: map generation 0.3 s, first render 1.4 s, redrawing pieces after a turn 0.1–0.2 s, building the single cached image 1.8 s.

**Findings.**
- Live SVG pan speed falls with element count; even a late-game 5-civilization board drops to 33 fps.
- Pieces (tokens, settlements, badges, trails) are a large share of the cost: hiding all terrain art lifts the 15-civilization board only from 6 to 10 fps.
- Moving a cached image holds 60 fps regardless of content.
- Limits of the test: headless numbers, not the player's GPU; the cached image was one 4096 px picture (sharp at 1×, blurry at 4×); the sample has about half the trails estimated for a late game.

**Phase 8 plan.**
1. Cached raster layers: terrain drawn once per game; trails, settlements, and tokens once per turn.
2. Tiles per zoom level for sharpness, built in the background (a worker or idle time) so the 1.8 s build never blocks.
3. Only hover, selection, move previews, and animation drawn live.
4. Zoomed-out simplification: owner tint and settlement dots instead of full pieces.
5. All map drawing lives in `src/ui/art/IsoMap.tsx`; the change stays inside it. Re-run the stress test before and after.

## Change log

- **0.23 (October 25, 2026):** Phase 4 step 4, the market (design doc v0.21), built in `src/engine/market.ts`. `Resource.price` is the starting price (food 5, luxury 10). `PlayerState` gains `prices` (unrounded, per player's market), `orders` (standing, one per good; `setOrder` command in the trade phase), and `traded` (kinds traded this turn, Barter's `traded` input). At the close of the trade phase `resolveMarket` moves each trader's prices by the imbalance in its market (its own orders plus those of traders within reach: 2 steps settlement to settlement plus `marketReach`, mutual), within half to triple the start, then fills its orders at the rounded price: sales first, then purchases within the treasury. Bought goods are `Good`s with no area (the civilization's pool); the support check uses pooled food after local food. The minimal AI sets buy orders for forecast support shortfalls and settlements within 2 of collapse. The game screen stops at the trade phase once the player can trade; the Market screen shows prices, the forecast at the close, goods held, and order controls. Batch runs report goods bought. Save schema 13.
- **0.22 (October 25, 2026):** Phase 4 step 3, currency (design doc v0.20), built. `PlayerState.treasury` keeps from turn to turn; `TierRules` gains `tax` (village 0, town 2, city 3, metropolis 4) and `spoils` (10% per tier). `collectTax` runs in the resources phase after gathering (`taxCollected` event; `taxIncome` for the interface). A capture moves the spoils from the defender's treasury to the capturer (`settlementAttacked.spoils`). The top bar shows the treasury and tax income; turn reports and conflict forecasts show spoils; batch runs report the treasury. Nothing spends currency until the market (step 4). Currency is no longer an instability stabilizer, so step 6 drops it. Save schema 12.
- **0.21 (October 25, 2026):** Very crowded room to expand for design doc v0.19: `RoomToExpand` gains `veryCrowded` (`ROOM_FACTOR` 0.25); minimum start spacing is per room size (3 very crowded, 4 otherwise). Map tests cover 15 civilizations on very crowded maps; `npm run batch -- --room veryCrowded`.
- **0.20 (October 25, 2026):** Urban growth for design doc v0.18: `allocateSupport` reports `ateOwn` (settlements that gathered food and ate their own), `resolveSupport` records it as `Settlement.ateOwn` (the turn), and `urbanGrowthOf` adds 1 that turn. `supportSummary` predicts it for the Civilization screen's urban growth figures.
- **0.19 (October 25, 2026):** Discovery for design doc v0.17: learning is optional again. `AdvanceProgress.learning`, `ORAL_TRADITION`, and the usage and learning halves are removed; usage and learning share one accumulator (`LEARNING_PROGRESS` 2 per unit toward Known and Developed, `LEARNING_ADOPTION` 10 toward Mastered, `ADOPTION_COST` 200 points). `learningPlan` sends each advance only the learning its step needs after this turn's usage. Developed costs doubled in content except Permanent Settlement. `discoveryView` reports one progress, cost, and rate per step; the Knowledge screen shows one bar (done, this turn's usage, this turn's learning). Save schema 11.
- **0.18 (October 24, 2026):** Phase 4 gains step 10, a full review of advances and screens before the phase is complete. Discovery reworked for design doc v0.16 (between steps 2 and 3). Known, Developed, and Mastered take half usage, half learning (`StageRules.usageOnly` exempts a step; Permanent Settlement's Known uses it); only plausible advances can be queued: `AdvanceProgress` gains `learning`; `progress` is usage toward the next step (after Developed, the usage half of adoption, 0–50); adoption never falls (`AdoptionRules.fall` removed). Learning is a pool (High Learning plus `ORAL_TRADITION`, 1) sent down `PlayerState.study` (`setStudy` command, allocation phase) by `learningPlan`: queue in order, then an even split, with a `studyQueueEmpty` event; finished advances leave the queue. The domain focus (`focus`, `setFocus`) is removed. `discoveryView` reports each step's usage and learning halves and rates. Archery: `fought` input (conflicts per turn, `PlayerState.fought`), adoption, and a Mastered +0.25 strength (design doc v0.15). Knowledge screen: study queue (reorder, remove, Study buttons), two-colour step bars, no focus picker; advances without adoption show Developed only. Civilization screen: manpower assigned from the settlement table. The minimal AI keeps a third of its manpower on High Learning, queue empty. Save schema 10.
- **0.17 (October 24, 2026):** Phase 4 step 2 built (design doc v0.14): the 15 Stone Age advances and 3 baseline advances replace the farming stand-in in `src/content/index.ts`; new games start with no settlement tiers (Permanent Settlement unlocks villages, Chiefdom towns). Content library: any-of terrain and resource filters; `contact` and `gathering` conditions; inputs per civ-wide instability point, rival in contact, kind of good gathered, settlement attacked, settlement gathering given goods, in contact, or beyond a capital distance (and `struck` and `traded`, which count nothing until calamities and the market exist); `mastered` effects. Effects in force are kept in `PlayerState.effects` (Developed, plus Mastered at adoption 100, so Mastered effects lapse when adoption falls); the token cap and tiers follow from them. New effects in `src/engine/effects.ts`: strength (with counters), settlement defense, calm, river legs (movement, food reach, capital distance), storage, capital reach, gathering bonus, market access and reach (idle until step 4). Conflict: volley and power thresholds. Instability: Ritual's calm in the resources phase, luxuries used in step 7. Resources: `revealedBy`, luxury goods, goods worked from other resources (cloth); Pottery stores grain between support checks. Maps place livestock and copper. Rules tests other than discovery use a stand-in bundle in `tests/harness.ts`. The AI puts idle manpower to work. Save schema 9.
- **0.16 (October 19, 2026):** Phase 4 step 1 built (design doc v0.13): discovery core in `src/engine/discovery.ts`. Advances carry a domain, plausibility conditions (`knows`, `presence`, `settlements`), Known and Developed accumulators (cost plus inputs: per turn, per area held with a filter, per settlement, per manpower working a resource), adoption rules, and effects applied when Developed (`unlockTier`, `raiseTokenCap`, hooks); `loadContent` validates them. `PlayerState.advances` holds stage, progress, and adoption per advance; `focus` holds the discovery domain (`setFocus` command). Resolution step 10 applies exactly the rates `discoveryView` reports. High Learning is a manpower assignment like Bureaucracy. Starting knowledge: baseline advances Developed and Mastered; the Advanced start setup option draws 2 first-ring advances per civilization from the seeded generator (logged draws). Resources are revealed at Known and usable at Developed; unrevealed resources are hidden on the map and in panels. The Knowledge screen replaces its placeholder: the whole tree by domain, stage, progress, turns to the next stage, each source of the rate, conditions, effects, and the focus picker; the turn report names advances reached. Game content keeps the Phase 3 stand-in (Agriculture and Fishing as baseline, villages and towns open) until step 2 designs the real advances; with no first-ring advances yet, Advanced start draws nothing. Save schema 8.
- **0.15 (October 19, 2026):** Phase 4 plan: discovery core, Stone Age advances, currency, market, calamities, full instability, AST and endgame, information panels, then a tuning pass (batch runs, then evaluate and set numbers). Phase 5 re-runs batch runs with wonders and figures. Work on branch `phase-4`.
- **0.14 (October 19, 2026):** Phase 3 complete. Headless batch runs: `npm run batch -- [--games N] [--civs N] [--map type|all] [--room size] [--turns N] [--every N] [--json file] [--logs dir]` plays all-AI games on the real engine (`sim/batch.ts`, run through Vite's module runner by `sim/run.mjs`) and prints, per sampled turn, the median and range of loose tokens, villages, towns, manpower, Bureaucracy, and civ-wide instability, plus per-game counts (settlements built, collapses, support drops, captures, fights, first turn at the token cap); `--logs` writes each game's log. The in-game Menu downloads the game log as JSON lines. Tuning is frozen until the Stone Age is complete (§4); batch runs only report. Baseline (3 games, 5 civilizations, inland sea, standard): first civilization at the cap on turns 20–23; 0–23 collapses per game; no fights, since the minimal AI never enters rival areas.
- **0.13 (October 19, 2026):** Phase 3 step 6: instability (design doc v0.12). `src/engine/instability.ts`: local meters on settlements and a civ-wide meter per player; resolution step 7 adds overextension, losses, lost support and nearby conflict from the turn's events, then collapses settlements at their threshold (tier base lowered by land distance from the capital) through the shared tier drop; collapses are not counted as losses. `PlayerState.capital` is kept on a settlement after conversion and after the instability step (`updateCapitals`); the capital adds one free Bureaucracy unit (`bureaucracyAt`). Bureaucracy is a `work` entry (`assignWork` with `bureaucracy`) applied in the resources phase. Events `instabilityChanged` (with source, for breakdowns) and `settlementCollapsed`. The minimal AI moves manpower to Bureaucracy when a settlement would be within 3 of its threshold after two more turns of overextension, and back when 6 clear; without the look-ahead, all-AI games collapsed every village at once and the civ-wide meter locked them out of settling. All-AI runs (5 civilizations, standard map, seeds 1–3, 60 turns): 0–23 collapses per game, at the edges between turns 20 and 40; empires settle at 7–12 settlements with no full cascades. Save schema 7.
- **0.12 (October 19, 2026):** Map interaction reworked (design doc v0.11): moves are dragged (Shift for all tokens) and arrows right-clicked to take back (Shift to cancel); a click selects any land area, and the planning panel shows its details plus allocation actions. `IsoMap` takes `moveTargets` / `onMoveDrop`; drags that start off a movable area pan. Engine: `PlayerState.movement` (base 1) and `reachable()` (settlement step, once per move) validate move orders. Save schema 5. The minimal AI still moves to adjacent areas only.
- **0.11 (October 18, 2026):** Phase 3 step 5 plan: food resources are placed on the map now, and every civilization knows the farming technology from turn 1 as a stand-in, recorded in state as a known technology so Phase 4 replaces it with the real discovery. The "revealed but not usable" state is built and tested in Phase 4. Built (step 5, food part): growth is 0.5 per loose token with per-stack progress (shown on area badges as "+½"); grain and fish are placed on the map and drawn as markers; content has resources (data entries tagged as food, each requiring an advance); settlements have base manpower by tier and standing assignments (`assignWork` command; planning panel controls and a flag for idle manpower); goods are gathered in the resources phase and cleared the next; food covers missing support tokens in the support check, own or adjacent, after tokens. Save schema 4. The AI relies on the default assignments. All-AI runs (5 civilizations, standard map, 3 seeds): the first civilization reaches the token cap around turn 30 with 8–11 settlements; food areas are about 20% of land.
- **0.10 (October 18, 2026):** Phase 3 step 7: save/load in the game. Saves are named slots in browser storage plus an autosave slot rewritten at the end of every turn; the title screen's Continue opens the newest save and Load Game lists them (open, export to file, delete, import a file as a new slot). The in-game Menu saves to a slot, exports to a file, or exits to the title. `openSave` loads a save whose replay no longer matches (rules changed since saving) from its saved state with a warning; saves from an older state layout are refused. New Game asks for a game name (kept in the setup, no effect on rules); saves default to "<name> - turn N" and the autosave is "<name> - autosave".
- **0.9 (October 16, 2026):** Phase 3 step 4: conflict runs at resolution step 2 (removal rule in over-limit areas; settlement attacks with thresholds, defense value, reinforcements, several attackers, capture one tier lower). The planning panel forecasts the fights planned moves lead to, and the turn report lists them; conversion and support previews now include conflict. Spoils and the conflict state wait for currency and instability (steps 5 and 6). New Game opens a setup panel on the title screen (opponents 1–14, map type, map size as room to expand, seed) before the game starts; `?screen=game` still opens a default game. Minimal AI started early (part of step 7): `aiCommands` in `src/engine/ai.ts` gives a fixed, deterministic pattern of allocation orders (fill an area, then overflow into empty or own neighbours; found one village per turn at the densest site not next to a settlement, else upgrade one; keep only orders the engine's preview says will be built and supported). AI players issue them through the same command layer before ending allocation.
- **0.8 (October 16, 2026):** Phase 3 step 3: settlements live in the engine (founding, upgrading, support check, tier drop with refugees, urban growth, naming as a command). Planned conversions show on the map and in the planning panel with a preview of the tokens taken and the support left; results are reported after resolution. Towns are unlocked from the start in the game screen (setup option `unlockedTiers`) until the advance that unlocks them exists. The game screen skips the trade phase while no one can trade. The Civilization overview gains a Support card (support needed and supplied, free tokens, village sites, settlements that will drop), computed by the engine at this turn's support check including planned moves and settlements.
- **0.7 (October 16, 2026):** Phase 2 complete: title, map, in-game frame, Civilization overview, Rivals and standings, five placeholder screens, procedural map generator, rendering stress test. Phase 3 started: the game setup holds the map options (type, room to expand; one civilization per player, 2–15) and the map is rebuilt from the seed rather than saved; the state tracks loose tokens per area, starting with one token per civilization. Movement orders, simultaneous movement, growth, and surplus removal work, with move planning on the map.
- **0.6 (October 16, 2026):** Civilization overview: settlement table with player names, resources available and worked, and click-to-show on the map. Settlement names live in UI state and resources are a review sample until the engine tracks settlements and resources are designed.
- **0.5 (October 16, 2026):** Phase 2 status screens split into an in-game frame plus seven screens (two laid out, five placeholders). Map rendering stress test: results, findings, and the Phase 8 rendering plan recorded in §6 (Performance findings).
- **0.4 (October 15, 2026):** Phase 2: React + Vite for screens; title screen approved; in-game map is isometric.
- **0.3 (October 15, 2026):** Phase 1 complete. Decisions: content format (TypeScript data files, hooks by id), tooling, and layout.
- **0.2 (October 15, 2026):** Phase 0 complete. The economy simulation is kept, not thrown away; it is re-run as rules change, including in Phase 5.
- **0.1 (October 15, 2026):** Initial plan.
