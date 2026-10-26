# CLAUDE.md

Single-player, turn-based civilization strategy game inspired by Francis Tresham's *Civilization* board game (1980), spanning the Stone Age to the Modern era.

## Source of truth

- `docs/civilization_game_design_document.md` — what the game is. All design decisions.
- `docs/development_plan.md` — how it is built. Architecture, phases, practices.

Read both before design or build work. When a decision is made in conversation, write it back to the relevant doc: update the section, update §16 (trade-offs) / §17 (open questions) if affected, bump the version, and add a change-log entry. Only sections marked **Decided** are rules; do not let open ideas become rules silently.

## Current status

- Design: core systems decided (v0.25); Stone Age advances reviewed; numbers untuned.
- Build: Phases 0–3 done (Phase 3 core loop: tokens, movement and growth, settlements, conflict, food and manpower, instability, minimal AI, save/load, batch runs, game log). **Phase 4 (Stone Age systems) in progress** on branch `phase-4`: 10 steps (development plan §3), ending in the tuning pass and a full review of advances and screens. Steps 1 (discovery core) and 2 (Stone Age advances, design doc v0.14) done, plus the v0.16–v0.17 discovery rework (study queue; learning speeds advances, Developed costs and adoption doubled); step 3 (currency: tax from towns, a treasury that keeps, spoils; design doc v0.20) done; step 4 (market, design doc v0.21) built, Market screen awaiting review; step 5 (calamities, design doc v0.22) and step 6 (instability, v0.25) built; step 7 (AST and endgame) next.
- **No balance changes until the Stone Age is complete**; every number is a placeholder until then. Batch runs (`npm run batch`) measure the real engine and only report. The Phase 0 economy simulation (`sim/phase0/sim.ts`) predates the engine and is no longer re-run.

## Stack and architecture

- Web browser, TypeScript. A desktop wrapper (Tauri/Electron) is a later option.
- **Headless rules engine**: holds all state and applies all rules; no UI code inside it. The UI reads state and sends commands.
- **Commands**: player, AI, tests, and replays issue the same commands to the engine.
- **Deterministic**: seeded RNG only. Same seed + same commands = same game. No `Math.random()` or wall-clock time in the engine.
- **Content is data + scripts**: advances, wonders, figures, calamities, resources, and eras live in data files referencing a library of effect types; scripted hooks only for rules that do not fit the library.
- **State is one serializable object** (save/load).
- **Game log**: structured JSON lines (commands, state changes, resolution steps, random draws); downloadable; seed + commands replays a game.

## Commands

- `npm run check` — typecheck (engine, tests, sim) and run all tests. Run before every commit.
- `npm test` / `npm run test:watch` — Vitest.
- `npm run batch -- [--games N] [--civs N] [--map type|all] [--room size] [--turns N] [--json file] [--logs dir]` — all-AI batch runs on the real engine; pacing report.
- `npm run sim -- <mode>` — Phase 0 economy simulation (historical).
- `?screen=stress` (dev server) — map rendering stress test; results and the Phase 8 rendering plan are in `docs/development_plan.md` §6.

## Conventions

- The engine (`src/engine/`) and content (`src/content/`) compile without browser or Node types; a test fails if they use unseeded randomness or wall-clock time.
- Every game action is a `Command` applied through `applyCommand`; resolution steps live in `src/engine/phases.ts`.
- Content is TypeScript data (`satisfies`), no functions; unusual rules go in the hook registry (`src/engine/hooks.ts`) and are referenced by id.

- Write rules tests alongside each engine system.
- Every player-facing number should be explainable: systems expose the sources behind their values for tooltip breakdowns.
- Art is vector/SVG and code-drawn; audio is procedural (Web Audio).
- The AI stays minimal until Phase 7; do not invest in AI strategy before then.
- Performance work is deferred to Phase 8 unless something blocks development.
- Version 1 is single-player. Preserve determinism and the command layer so multiplayer stays possible later.

## Working with the user

- Ask design questions one at a time, in plain language, with a concrete example; reference how the original board game did it when relevant.
- Never commit unless asked; use conventional commits.
