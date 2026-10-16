import type { Context, GameEvent } from './types';

export function emit(ctx: Context, event: GameEvent): void {
  ctx.events.push({ turn: ctx.state.turn, phase: ctx.state.phase, event });
}

// Deep copy through JSON, which also guarantees the state stays serializable.
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
