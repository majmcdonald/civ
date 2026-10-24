import { eras } from './eras';
import type { ContentBundle } from './types';

// Advances are authored one at a time in the technology-by-technology design pass (Phase 4 step 2,
// design doc §17). Until then Agriculture and Fishing stand in as baseline advances, Developed from
// turn 1 (development plan, Phase 3).
export const content: ContentBundle = {
  eras,
  advances: [
    { id: 'agriculture', name: 'Agriculture', era: 'stone', domain: 'land', baseline: true, effects: [] },
    { id: 'fishing', name: 'Fishing', era: 'stone', domain: 'land', baseline: true, effects: [] },
  ],
  // Design doc §6, Food: every food good starts at 1 food per manpower; goods differ through advances.
  resources: [
    { id: 'grain', name: 'Grain', food: true, requires: 'agriculture' },
    { id: 'fish', name: 'Fish', food: true, requires: 'fishing' },
  ],
};
