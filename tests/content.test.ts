import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import type { ContentBundle } from '../src/content/types';
import { loadContent } from '../src/engine';

const base: ContentBundle = {
  eras: [
    { id: 'stone', name: 'Stone Age', order: 0 },
    { id: 'bronze', name: 'Bronze Age', order: 1 },
  ],
  advances: [],
};

function errorsFor(bundle: ContentBundle, hooks = {}): string[] {
  const result = loadContent(bundle, hooks);
  return result.ok ? [] : result.errors;
}

describe('content loading', () => {
  it('accepts the game content', () => {
    expect(loadContent(content).ok).toBe(true);
  });

  it('accepts effects from the library and known hooks', () => {
    const bundle: ContentBundle = {
      ...base,
      advances: [
        {
          id: 'test-advance',
          name: 'Test',
          era: 'stone',
          effects: [
            { type: 'unlockTier', tier: 'town' },
            { type: 'raiseTokenCap', amount: 25 },
            { type: 'hook', hook: 'special', params: { strength: 2 } },
          ],
        },
      ],
    };
    expect(errorsFor(bundle, { special: () => {} })).toEqual([]);
  });

  it('reports duplicate ids', () => {
    const advance = { id: 'a', name: 'A', era: 'stone' as const, effects: [] };
    expect(errorsFor({ ...base, advances: [advance, advance] })).toEqual(['Duplicate advance id "a"']);
  });

  it('reports references to unknown eras', () => {
    const bundle: ContentBundle = { ...base, advances: [{ id: 'a', name: 'A', era: 'modern', effects: [] }] };
    expect(errorsFor(bundle)).toEqual(['Advance "a" references unknown era "modern"']);
  });

  it('reports unknown hooks', () => {
    const bundle: ContentBundle = {
      ...base,
      advances: [{ id: 'a', name: 'A', era: 'stone', effects: [{ type: 'hook', hook: 'missing' }] }],
    };
    expect(errorsFor(bundle)).toEqual(['Advance "a": unknown hook "missing"']);
  });

  it('reports invalid amounts', () => {
    const bundle: ContentBundle = {
      ...base,
      advances: [{ id: 'a', name: 'A', era: 'stone', effects: [{ type: 'raiseAreaLimit', amount: 0 }] }],
    };
    expect(errorsFor(bundle)).toEqual(['Advance "a": raiseAreaLimit amount must be a positive integer (got 0)']);
  });
});
