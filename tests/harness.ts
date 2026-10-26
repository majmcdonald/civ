// Rules test harness: build games, apply commands, and inspect state and events.
import { expect } from 'vitest';
import { eras } from '../src/content/eras';
import type { ContentBundle } from '../src/content/types';
import {
  loadContent,
  startSession,
  submit,
  type Command,
  type Content,
  type GameEvent,
  type GameSetup,
  type HookRegistry,
  type PlayerId,
  type Session,
  type StampedEvent,
} from '../src/engine';

// The Phase 3 stand-in: grain and fish usable from turn 1 and villages open. Rules tests of
// systems other than discovery use it, so they do not depend on the game's advances; tests of the
// Stone Age content load `src/content` themselves.
export const standIn: ContentBundle = {
  eras,
  advances: [
    { id: 'agriculture', name: 'Agriculture', era: 'stone', domain: 'land', baseline: true, effects: [] },
    { id: 'fishing', name: 'Fishing', era: 'stone', domain: 'land', baseline: true, effects: [] },
  ],
  resources: [
    { id: 'grain', name: 'Grain', food: true, price: 5, requires: 'agriculture' },
    { id: 'fish', name: 'Fish', food: true, price: 5, requires: 'fishing' },
  ],
  calamities: [],
};

export function testContent(bundle: ContentBundle = standIn, hooks?: HookRegistry): Content {
  const result = loadContent(bundle, hooks);
  if (!result.ok) throw new Error(`Invalid test content:\n${result.errors.join('\n')}`);
  return result.content;
}

export function testSetup(overrides: Partial<GameSetup> = {}): GameSetup {
  return {
    seed: 12345,
    players: [
      { id: 'p1', name: 'Player', kind: 'human' },
      { id: 'ai1', name: 'Rival', kind: 'ai' },
    ],
    finalEra: 'iron',
    map: { type: 'inlandSea', room: 'standard' },
    unlockedTiers: ['village'],
    ...overrides,
  };
}

export function newGame(setup: Partial<GameSetup> = {}, content: Content = testContent()): Session {
  return startSession(testSetup(setup), content);
}

// Applies commands in order and fails the test on the first rejection.
export function play(session: Session, ...commands: Command[]): StampedEvent[] {
  const events: StampedEvent[] = [];
  for (const command of commands) {
    const result = submit(session, command);
    if (!result.ok) throw new Error(`Command rejected: ${JSON.stringify(command)}: ${result.reason}`);
    events.push(...result.events);
  }
  return events;
}

// Every player ends the current phase.
export function endPhaseAll(session: Session): StampedEvent[] {
  return play(session, ...session.state.players.map((p): Command => ({ type: 'endPhase', player: p.id as PlayerId })));
}

// Plays whole turns where every player only ends phases.
export function advanceTurns(session: Session, turns: number): void {
  const target = session.state.turn + turns;
  while (session.state.turn < target) endPhaseAll(session);
}

export function eventsOfType<T extends GameEvent['type']>(
  events: readonly StampedEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.map((e) => e.event).filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export function expectRejected(session: Session, command: Command, reason: RegExp): void {
  const result = submit(session, command);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toMatch(reason);
}
