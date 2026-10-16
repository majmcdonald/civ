import { describe, expect, it } from 'vitest';
import { createRng, random, randomInt, stepRng, type Context } from '../src/engine';
import { newGame, testContent } from './harness';

function contextFor(seed: number): Context {
  const game = newGame({ seed });
  return { state: game.state, content: testContent(), events: [] };
}

describe('seeded random number generator', () => {
  it('produces the same sequence for the same seed', () => {
    const a = contextFor(7);
    const b = contextFor(7);
    const seqA = Array.from({ length: 20 }, () => random(a, 'test'));
    const seqB = Array.from({ length: 20 }, () => random(b, 'test'));
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const [a] = stepRng(createRng(1));
    const [b] = stepRng(createRng(2));
    expect(a).not.toBe(b);
  });

  it('keeps its position in the state so a saved game continues the sequence', () => {
    const ctx = contextFor(7);
    random(ctx, 'first');
    const resumed: Context = { ...ctx, state: JSON.parse(JSON.stringify(ctx.state)), events: [] };
    expect(random(resumed, 'second')).toBe(random(ctx, 'second'));
    expect(ctx.state.rng.draws).toBe(2);
  });

  it('logs every draw with its label', () => {
    const ctx = contextFor(7);
    const value = random(ctx, 'calamity roll');
    expect(ctx.events.map((e) => e.event)).toEqual([{ type: 'randomDraw', label: 'calamity roll', value }]);
  });

  it('draws integers within inclusive bounds', () => {
    const ctx = contextFor(3);
    const values = Array.from({ length: 500 }, () => randomInt(ctx, 'die', 1, 6));
    expect(Math.min(...values)).toBe(1);
    expect(Math.max(...values)).toBe(6);
  });
});
