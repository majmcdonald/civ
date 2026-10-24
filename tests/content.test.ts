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
  resources: [],
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
          domain: 'land',
          baseline: true,
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
    const advance = { id: 'a', name: 'A', era: 'stone' as const, domain: 'land' as const, baseline: true, effects: [] };
    expect(errorsFor({ ...base, advances: [advance, advance] })).toEqual(['Duplicate advance id "a"']);
  });

  it('reports references to unknown eras', () => {
    const bundle: ContentBundle = { ...base, advances: [{ id: 'a', name: 'A', era: 'modern', domain: 'land', baseline: true, effects: [] }] };
    expect(errorsFor(bundle)).toEqual(['Advance "a" references unknown era "modern"']);
  });

  it('reports duplicate resources and resources requiring unknown advances', () => {
    const grain = { id: 'grain', name: 'Grain', food: true, requires: 'agriculture' };
    expect(errorsFor({ ...base, resources: [grain, grain] })).toEqual([
      'Resource "grain" requires unknown advance "agriculture"',
      'Duplicate resource id "grain"',
      'Resource "grain" requires unknown advance "agriculture"',
    ]);
  });

  it('reports problems in discovery data', () => {
    const bundle: ContentBundle = {
      ...base,
      resources: [],
      advances: [
        {
          id: 'a',
          name: 'A',
          era: 'stone',
          domain: 'land',
          plausible: [{ type: 'knows', advance: 'missing', stage: 'known' }, { type: 'presence', where: { resource: 'gold' } }],
          known: { cost: 0, inputs: [{ per: 'turn', amount: -1 }] },
          adoption: { inputs: [{ per: 'worker', amount: 1, resource: 'gold' }], fall: -2 },
          effects: [],
        },
      ],
    };
    expect(errorsFor(bundle)).toEqual([
      'Advance "a": condition references unknown advance "missing"',
      'Advance "a": unknown resource "gold"',
      'Advance "a": known cost must be positive (got 0)',
      'Advance "a": input amount must be positive (got -1)',
      'Advance "a": needs developed rules (or baseline)',
      'Advance "a": unknown resource "gold"',
      'Advance "a": adoption fall must be 0 or more (got -2)',
    ]);
  });

  it('reports unknown hooks', () => {
    const bundle: ContentBundle = {
      ...base,
      advances: [{ id: 'a', name: 'A', era: 'stone', domain: 'land', baseline: true, effects: [{ type: 'hook', hook: 'missing' }] }],
    };
    expect(errorsFor(bundle)).toEqual(['Advance "a": unknown hook "missing"']);
  });

  it('reports invalid amounts', () => {
    const bundle: ContentBundle = {
      ...base,
      advances: [{ id: 'a', name: 'A', era: 'stone', domain: 'land', baseline: true, effects: [{ type: 'raiseAreaLimit', amount: 0 }] }],
    };
    expect(errorsFor(bundle)).toEqual(['Advance "a": raiseAreaLimit amount must be a positive integer (got 0)']);
  });
});
