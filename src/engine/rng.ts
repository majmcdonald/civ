import { emit } from './context';
import type { Context } from './types';

// Seeded generator (mulberry32). Its position lives in the game state, so save/load and replay
// continue the same sequence. All engine randomness goes through here.
export interface RngState {
  seed: number;
  state: number;
  draws: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, state: seed >>> 0, draws: 0 };
}

export function stepRng(rng: RngState): [number, RngState] {
  const state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { seed: rng.seed, state, draws: rng.draws + 1 }];
}

// A float in [0, 1). Every draw is logged with a label saying what it was for.
export function random(ctx: Context, label: string): number {
  const [value, next] = stepRng(ctx.state.rng);
  ctx.state.rng = next;
  emit(ctx, { type: 'randomDraw', label, value });
  return value;
}

// An integer in [min, max], inclusive.
export function randomInt(ctx: Context, label: string, min: number, max: number): number {
  return min + Math.floor(random(ctx, label) * (max - min + 1));
}
