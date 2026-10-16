import type { Era } from './types';

// Design doc §14.
export const eras = [
  { id: 'stone', name: 'Stone Age', order: 0 },
  { id: 'bronze', name: 'Bronze Age', order: 1 },
  { id: 'iron', name: 'Iron Age', order: 2 },
  { id: 'classical', name: 'Classical', order: 3 },
  { id: 'medieval', name: 'Medieval', order: 4 },
  { id: 'renaissance', name: 'Renaissance', order: 5 },
  { id: 'industrial', name: 'Industrial', order: 6 },
  { id: 'modern', name: 'Modern', order: 7 },
] satisfies Era[];
