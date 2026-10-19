import { eras } from './eras';
import type { ContentBundle } from './types';

// Advances are authored in the technology-by-technology design pass (design doc §17). Agriculture
// and fishing stand in for the farming technologies, known from turn 1 until discovery exists
// (development plan, Phase 3).
export const content: ContentBundle = {
  eras,
  advances: [
    { id: 'agriculture', name: 'Agriculture', era: 'stone', effects: [] },
    { id: 'fishing', name: 'Fishing', era: 'stone', effects: [] },
  ],
  // Design doc §6, Food: every food good starts at 1 food per manpower; goods differ through advances.
  resources: [
    { id: 'grain', name: 'Grain', food: true, requires: 'agriculture' },
    { id: 'fish', name: 'Fish', food: true, requires: 'fishing' },
  ],
};
