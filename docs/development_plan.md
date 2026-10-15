# Development Plan

**Version:** 0.1  
**Date:** October 15, 2026  
**Status:** Working draft

> Companion to the [design document](civilization_game_design_document.md). This plan covers how the game is built; the design document covers what is built.

## 1. Project setup

| Element | Decision |
|---|---|
| Team | Solo, AI-assisted (developer plus Claude Code) |
| Platform | Web browser; a desktop wrapper (Tauri or Electron) remains possible later |
| Language | TypeScript |
| Version 1 scope | Single-player against AI. Multiplayer is a future enhancement |

## 2. Architecture

| Element | Decision |
|---|---|
| Rules engine | **Headless.** Holds all game state and applies all rules. Knows nothing about screens |
| Presentation | Reads state, sends player commands to the engine, displays results |
| Commands | The player, the AI, tests, and replays all issue the same commands |
| Determinism | Seeded random number generator: the same seed and commands always produce the same game |
| Content | **Data + scripts.** Advances, wonders, figures, calamities, resources, and eras are data files. The engine provides a library of effect types; scripted hooks handle unusual rules |
| Save/load | The game state is a single serializable object |
| Game log | Structured, one JSON event per line (commands, state changes, resolution steps, random draws). Downloadable. The seed plus the command log replays a game exactly |

What the architecture enables:
- Headless batch runs for tuning.
- Rules tests without a UI.
- Reproducible bug reports and replays.
- Multiplayer later without an engine rewrite.

## 3. Phases

| Phase | Contents |
|---|---|
| **0. Pre-production** | Throwaway economy simulation script to test the settlement pyramid's return on investment (design doc §16) |
| **1. Foundation** | TypeScript project; headless deterministic rules engine with command layer; data + scripts content format; rules test harness; save/load format; game-log format |
| **2. Basic screens** | Title, map, and status screens, with no behavior; procedural map generator |
| **3. Core loop** | Turns and resolution order; settlements, conversion, support, growth, migration, surplus removal; first resource; manpower; simple conflict; basic instability and tier drop; working save/load; minimal AI; headless batch runs and downloadable game log |
| **4. Stone Age systems** | First techs and discovery accumulators; market (its own work item); full instability sources and stabilizers; first calamities; AST and endgame countdown; information panels and rules reference begin; art and audio for the era |
| **5. Stone Age content** | First wonders and historical figures; era art and audio; **playtest and design review** |
| **6. Remaining eras** | Repeat Phases 4–5 for each era (Bronze → Modern), with a playtest and design review after each; historical map |
| **7. AI enhancement** | Strategic depth and difficulty levels; retune balance numbers set against the minimal AI |
| **8. Polish and release** | Tutorial; broader testing (scenario tests, replay regression); performance optimization; final cleanup; distribution |

### Milestones

A **playtest and design review** follows every era. Each review:
1. Plays a complete game ending at that era (final era is a setup option).
2. Updates the design document with what play revealed.
3. Decides any changes before the next era's content is built.

## 4. Cross-cutting practices

| Area | Practice |
|---|---|
| Tests | Rules tests are written alongside each system from Phase 1. Scenario tests and replay regression are added in Phase 8 |
| Tuning | Headless batch runs and downloadable game logs, analyzed after runs; starts in Phase 3 |
| AI | Minimal until Phase 7 |
| UX | Every system ships with an information panel and tooltip breakdowns showing each number's sources. The rules reference is generated from data files. The tutorial is built in Phase 8 |
| Art | Claude-generated, vector, and stylized (board-game or map-atlas look); produced per era |
| Audio | Procedural, Claude-generated (Web Audio); produced per era |
| Performance | Addressed in Phase 8 |

## 5. Known risks

| Risk | Note |
|---|---|
| Balance tuned against a weak AI | Phases 4–6 tune against the minimal AI. Expect a retuning pass in Phase 7 |
| Performance found late | The long arc and per-player markets may be slow; headless batch runs will surface slowdowns before Phase 8 |
| Art limits | Claude can produce vector art and code-drawn maps, not raster illustrations or recorded audio. Art direction must stay vector and stylized |
| Content volume | Eight eras of advances, wonders, figures, and calamities. Data-driven content keeps this to authoring, not engine work |

## Change log

- **0.1 (October 15, 2026):** Initial plan.
