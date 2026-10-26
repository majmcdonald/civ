import type { Era } from './types';

// Design doc §14. Gates and points are starting values (v0.26); later eras get theirs when their
// advances are designed. Bronze points follow the design doc's example.
export const eras = [
  { id: 'stone', name: 'Stone Age', order: 0, points: { developed: 1, mastered: 3, culture: 1 } },
  { id: 'bronze', name: 'Bronze Age', order: 1, gate: { settlement: 5, knowledge: 12 }, points: { developed: 3, mastered: 5, culture: 3 } },
  { id: 'iron', name: 'Iron Age', order: 2 },
  { id: 'classical', name: 'Classical', order: 3 },
  { id: 'medieval', name: 'Medieval', order: 4 },
  { id: 'renaissance', name: 'Renaissance', order: 5 },
  { id: 'industrial', name: 'Industrial', order: 6 },
  { id: 'modern', name: 'Modern', order: 7 },
] satisfies Era[];
