# CLAUDE.md

Single-player, turn-based civilization strategy game inspired by Francis Tresham's *Civilization* board game (1980), spanning the Stone Age to the Modern era.

## Source of truth

- `docs/civilization_game_design_document.md` — what the game is. All design decisions.
- `docs/development_plan.md` — how it is built. Architecture, phases, practices.

Read both before design or build work. When a decision is made in conversation, write it back to the relevant doc: update the section, update §16 (trade-offs) / §17 (open questions) if affected, bump the version, and add a change-log entry. Only sections marked **Decided** are rules; do not let open ideas become rules silently.

## Current status

- Design: core systems decided (v0.9); numbers untuned.
- Build: Phases 0–2 done. **Phase 3 in progress** — core loop (steps 1–4 of 7 done: tokens, movement and growth, settlements, conflict; minimal AI from step 7 started early).
- Economy simulation: `sim/phase0/sim.ts` (`node sim/phase0/sim.ts [cap|settle|towns|rare|sweep]`). Kept and extended as systems are designed; re-run it when economy-affecting rules change.

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
- `npm run sim -- <mode>` — economy simulation.
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
