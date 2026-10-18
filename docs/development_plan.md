# Development Plan

**Version:** 0.10  
**Date:** October 16, 2026  
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
| **3. Core loop** | Turns and resolution order; settlements, conversion, support, growth, migration, surplus removal; first resource; manpower; simple conflict; basic instability and tier drop; working save/load; minimal AI; headless batch runs and downloadable game log |
| **4. Stone Age systems** | First techs and discovery accumulators; market (its own work item); full instability sources and stabilizers; first calamities; AST and endgame countdown; information panels and rules reference begin; art and audio for the era |
| **5. Stone Age content** | First wonders and historical figures; era art and audio; **re-run the economy simulation with Stone Age discoveries, calamities, and figures**; **playtest and design review** |
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
| Tuning | The economy simulation (`sim/phase0/sim.ts`) is re-run whenever economy-affecting rules change, until headless batch runs of the real engine replace it (Phase 3). Batch runs and downloadable game logs are analyzed after runs |
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
