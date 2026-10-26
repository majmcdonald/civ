import { eras } from './eras';
import type { ContentBundle } from './types';

// The Stone Age advances (design doc §8, Stone Age advances and Reviewed advances). Costs and
// amounts are placeholders until the balance pass (development plan §3, Phase 4 step 12).
export const content: ContentBundle = {
  eras,
  advances: [
    { id: 'fire', name: 'Fire', era: 'stone', domain: 'crafts', baseline: true, effects: [] },
    { id: 'stoneTools', name: 'Stone Tools', era: 'stone', domain: 'crafts', baseline: true, effects: [] },
    { id: 'foraging', name: 'Foraging', era: 'stone', domain: 'land', baseline: true, effects: [] },
    {
      id: 'permanentSettlement',
      name: 'Permanent Settlement',
      era: 'stone',
      domain: 'land',
      plausible: [{ type: 'knows', advance: 'foraging', stage: 'developed' }],
      known: { cost: 3, inputs: [{ per: 'turn', amount: 1 }, { per: 'area', amount: 1, where: { full: true } }] },
      developed: { cost: 4, inputs: [{ per: 'turn', amount: 1 }, { per: 'area', amount: 1, where: { full: true } }] },
      effects: [{ type: 'unlockTier', tier: 'village' }],
    },
    {
      id: 'fishing',
      name: 'Fishing',
      era: 'stone',
      domain: 'land',
      plausible: [{ type: 'presence', where: { resource: 'fish' } }],
      known: { cost: 3, inputs: [{ per: 'area', amount: 1, where: { resource: 'fish' } }] },
      developed: {
        cost: 16,
        inputs: [
          { per: 'area', amount: 1, where: { resource: 'fish' } },
          { per: 'settlement', amount: 1, where: { resource: 'fish' } },
        ],
      },
      adoption: { inputs: [{ per: 'settlement', amount: 15, gathering: ['fish'] }] },
      effects: [],
      mastered: [{ type: 'gatherBonus', resource: 'fish', amount: 1 }],
    },
    {
      id: 'archery',
      name: 'Archery',
      era: 'stone',
      domain: 'war',
      plausible: [{ type: 'presence', where: { terrain: 'forest' } }],
      known: { cost: 4, inputs: [{ per: 'area', amount: 1, where: { terrain: 'forest' } }] },
      developed: { cost: 16, inputs: [{ per: 'area', amount: 1, where: { terrain: 'forest' } }] },
      adoption: { inputs: [{ per: 'fought', amount: 20 }] },
      effects: [{ type: 'strength', amount: 0.25, counteredBy: 'palisades' }],
      mastered: [{ type: 'strength', amount: 0.25, counteredBy: 'palisades' }],
    },
    {
      id: 'agriculture',
      name: 'Agriculture',
      era: 'stone',
      domain: 'land',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'presence', where: { resource: 'grain' } },
      ],
      known: { cost: 5, inputs: [{ per: 'area', amount: 1, where: { resource: 'grain' } }] },
      developed: {
        cost: 24,
        inputs: [
          { per: 'area', amount: 1, where: { resource: 'grain' } },
          { per: 'settlement', amount: 1, where: { resource: 'grain' } },
        ],
      },
      adoption: { inputs: [{ per: 'settlement', amount: 10, gathering: ['grain'] }] },
      effects: [],
      mastered: [
        { type: 'gatherBonus', resource: 'grain', amount: 1 },
        { type: 'raiseTokenCap', amount: 5 },
      ],
    },
    {
      id: 'ritual',
      name: 'Ritual',
      era: 'stone',
      domain: 'beliefs',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'settlements', min: 1 },
      ],
      known: {
        cost: 4,
        inputs: [
          { per: 'settlement', amount: 1 },
          { per: 'instability', amount: 1 },
          { per: 'struck', amount: 3, calamity: 'superstition' },
        ],
      },
      developed: {
        cost: 16,
        inputs: [
          { per: 'settlement', amount: 1 },
          { per: 'instability', amount: 1 },
          { per: 'struck', amount: 3, calamity: 'superstition' },
        ],
      },
      adoption: { inputs: [{ per: 'settlement', amount: 5 }] },
      effects: [{ type: 'calm', amount: 1 }],
      mastered: [{ type: 'calm', amount: 1 }],
    },
    {
      id: 'dugoutCanoes',
      name: 'Dugout Canoes',
      era: 'stone',
      domain: 'travel',
      plausible: [{ type: 'presence', where: { feature: 'river' } }],
      known: { cost: 6, inputs: [{ per: 'area', amount: 1, where: { feature: 'river' } }] },
      developed: {
        cost: 20,
        inputs: [
          { per: 'area', amount: 1, where: { feature: 'river' } },
          { per: 'settlement', amount: 1, where: { feature: 'river' } },
        ],
      },
      effects: [{ type: 'riverLeg', areas: 3 }],
    },
    {
      id: 'pottery',
      name: 'Pottery',
      era: 'stone',
      domain: 'crafts',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'settlements', min: 1 },
      ],
      known: { cost: 5, inputs: [{ per: 'settlement', amount: 1, tier: 'village' }] },
      developed: { cost: 12, inputs: [{ per: 'settlement', amount: 1, gathering: 'food' }] },
      adoption: { inputs: [{ per: 'settlement', amount: 5, gathering: ['grain'] }] },
      effects: [{ type: 'store', resource: 'grain', amount: 1 }],
      mastered: [{ type: 'store', resource: 'grain', amount: 1 }],
    },
    {
      id: 'chiefdom',
      name: 'Chiefdom',
      era: 'stone',
      domain: 'beliefs',
      plausible: [
        { type: 'knows', advance: 'ritual', stage: 'known' },
        { type: 'settlements', min: 3, tier: 'village' },
      ],
      known: {
        cost: 12,
        inputs: [
          { per: 'settlement', amount: 1 },
          { per: 'worker', amount: 1, resource: 'bureaucracy' },
        ],
      },
      developed: {
        cost: 48,
        inputs: [
          { per: 'settlement', amount: 1 },
          { per: 'worker', amount: 1, resource: 'bureaucracy' },
        ],
      },
      effects: [{ type: 'unlockTier', tier: 'town' }],
    },
    {
      id: 'herding',
      name: 'Herding',
      era: 'stone',
      domain: 'land',
      plausible: [
        { type: 'knows', advance: 'agriculture', stage: 'known' },
        { type: 'presence', where: { terrain: ['plains', 'hills'] } },
      ],
      known: { cost: 14, inputs: [{ per: 'area', amount: 1, where: { terrain: ['plains', 'hills'] } }] },
      developed: {
        cost: 24,
        inputs: [
          { per: 'area', amount: 1, where: { resource: 'livestock' } },
          { per: 'settlement', amount: 1, where: { resource: 'livestock' } },
        ],
      },
      adoption: { inputs: [{ per: 'settlement', amount: 15, gathering: ['livestock'] }] },
      effects: [],
      mastered: [{ type: 'gatherBonus', resource: 'livestock', amount: 1 }],
    },
    {
      id: 'masonry',
      name: 'Masonry',
      era: 'stone',
      domain: 'crafts',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'presence', where: { terrain: ['hills', 'mountains'] } },
      ],
      known: { cost: 12, inputs: [{ per: 'area', amount: 1, where: { terrain: ['hills', 'mountains'] } }] },
      developed: { cost: 20, inputs: [{ per: 'settlement', amount: 1, where: { terrain: ['hills', 'mountains'] } }] },
      adoption: { inputs: [{ per: 'settlement', amount: 15, tier: 'town' }] },
      effects: [{ type: 'settlementDefense', amount: 1, minTier: 'town' }],
      mastered: [{ type: 'settlementDefense', amount: 1, minTier: 'town' }],
    },
    {
      id: 'barter',
      name: 'Barter',
      era: 'stone',
      domain: 'travel',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'gathering', what: 'any' },
      ],
      known: {
        cost: 6,
        inputs: [
          { per: 'goodKind', amount: 1 },
          { per: 'rival', amount: 1 },
        ],
      },
      developed: {
        cost: 24,
        inputs: [
          { per: 'settlement', amount: 1, gathering: 'any' },
          { per: 'rival', amount: 1 },
        ],
      },
      adoption: { inputs: [{ per: 'traded', amount: 10 }] },
      effects: [{ type: 'marketAccess' }],
      mastered: [{ type: 'marketReach', amount: 1 }],
    },
    {
      id: 'palisades',
      name: 'Palisades',
      era: 'stone',
      domain: 'war',
      plausible: [
        { type: 'knows', advance: 'permanentSettlement', stage: 'known' },
        { type: 'settlements', min: 1 },
      ],
      known: {
        cost: 8,
        inputs: [
          { per: 'settlement', amount: 1, contact: true },
          { per: 'attacked', amount: 3 },
        ],
      },
      developed: {
        cost: 28,
        inputs: [
          { per: 'settlement', amount: 1, contact: true },
          { per: 'attacked', amount: 3 },
        ],
      },
      effects: [{ type: 'settlementDefense', amount: 1 }],
    },
    {
      id: 'weaving',
      name: 'Weaving',
      era: 'stone',
      domain: 'crafts',
      plausible: [{ type: 'knows', advance: 'agriculture', stage: 'known' }],
      known: { cost: 8, inputs: [{ per: 'settlement', amount: 1, where: { resource: ['grain', 'livestock'] } }] },
      developed: { cost: 32, inputs: [{ per: 'settlement', amount: 1, where: { resource: ['grain', 'livestock'] } }] },
      adoption: { inputs: [{ per: 'settlement', amount: 15, gathering: ['cloth'] }] },
      effects: [{ type: 'raiseTokenCap', amount: 5 }],
      mastered: [{ type: 'gatherBonus', resource: 'cloth', amount: 1 }],
    },
    {
      id: 'tallies',
      name: 'Tallies',
      era: 'stone',
      domain: 'beliefs',
      plausible: [
        { type: 'knows', advance: 'chiefdom', stage: 'known' },
        { type: 'settlements', min: 1, tier: 'town' },
      ],
      known: {
        cost: 4,
        inputs: [
          { per: 'settlement', amount: 1, tier: 'town' },
          { per: 'worker', amount: 1, resource: 'bureaucracy' },
        ],
      },
      developed: { cost: 48, inputs: [{ per: 'settlement', amount: 1, beyond: 2 }] },
      adoption: {
        inputs: [
          { per: 'worker', amount: 5, resource: 'bureaucracy' },
          { per: 'settlement', amount: 5, tier: 'town' },
        ],
      },
      effects: [{ type: 'capitalReach', amount: 2 }],
      mastered: [{ type: 'capitalReach', amount: 2 }],
    },
    {
      id: 'copperWorking',
      name: 'Copper Working',
      era: 'stone',
      domain: 'crafts',
      plausible: [
        { type: 'knows', advance: 'pottery', stage: 'known' },
        { type: 'presence', where: { terrain: ['hills', 'mountains'] } },
      ],
      known: { cost: 14, inputs: [{ per: 'area', amount: 1, where: { terrain: ['hills', 'mountains'] } }] },
      developed: {
        cost: 28,
        inputs: [
          { per: 'area', amount: 1, where: { resource: 'copper' } },
          { per: 'settlement', amount: 1, where: { resource: 'copper' } },
        ],
      },
      effects: [],
    },
  ],
  // Design doc §6: every food good starts at 1 food per manpower; goods differ through advances.
  // Foraging shows grain and fish from turn 1; gathering them needs Agriculture and Fishing.
  resources: [
    { id: 'grain', name: 'Grain', food: true, price: 5, requires: 'agriculture', revealedBy: 'foraging' },
    { id: 'fish', name: 'Fish', food: true, price: 5, requires: 'fishing', revealedBy: 'foraging' },
    { id: 'livestock', name: 'Livestock', food: true, price: 5, requires: 'herding' },
    { id: 'copper', name: 'Copper', food: false, price: 10, luxury: true, durable: true, requires: 'copperWorking' },
    { id: 'cloth', name: 'Cloth', food: false, price: 10, luxury: true, durable: true, requires: 'weaving', from: ['grain', 'livestock'] },
    // Worked in hills and mountains from the start; builds wonders (design doc §6, §9, v0.28).
    { id: 'stone', name: 'Stone', food: false, price: 5, durable: true, requires: 'stoneTools', terrain: ['hills', 'mountains'] },
  ],
  // Stone Age calamities (design doc §12, v0.22); weights and effects are engine rules.
  calamities: [
    { id: 'famine', name: 'Famine', softenedBy: [{ advance: 'pottery' }, { advance: 'pottery', stage: 'mastered' }], buyOff: { cost: 10, requires: 'barter' } },
    { id: 'superstition', name: 'Superstition', softenedBy: [{ advance: 'ritual' }, { advance: 'ritual', stage: 'mastered' }], buyOff: { cost: 10 }, grants: { advance: 'ritual', learning: 1 } },
    { id: 'civilDisorder', name: 'Civil disorder', softenedBy: [{ advance: 'tallies' }, { advance: 'tallies', stage: 'mastered' }], buyOff: { cost: 10 } },
    { id: 'epidemic', name: 'Epidemic', spreads: true },
    {
      id: 'raid',
      name: 'Barbarian raid',
      softenedBy: [{ advance: 'archery' }, { advance: 'palisades' }, { advance: 'masonry', minTier: 'town' }],
      shelter: ['palisades', 'masonry'],
      buyOff: { cost: 10 },
    },
    { id: 'flood', name: 'Flood' },
    { id: 'earthquake', name: 'Earthquake', shelter: ['masonry'] },
    { id: 'drought', name: 'Drought', softenedBy: [{ advance: 'pottery' }] },
  ],
  // Stone Age wonders (design doc §9, v0.28); costs are placeholders until the balance pass.
  wonders: [
    {
      id: 'gobekliTepe',
      name: 'Göbekli Tepe',
      era: 'stone',
      requires: ['ritual'],
      turns: 5,
      manpower: 1,
      goods: [{ resource: 'stone', count: 1 }, { resource: 'food', count: 1 }],
      effects: [{ type: 'calm', amount: 1 }],
      summary: '−1 civ-wide instability every turn',
    },
    {
      id: 'catalhoyuk',
      name: 'Çatalhöyük',
      era: 'stone',
      requires: ['pottery'],
      turns: 5,
      manpower: 1,
      goods: [{ resource: 'food', count: 1 }],
      effects: [{ type: 'manpower', amount: 1 }],
      summary: '+1 manpower in its settlement',
    },
    {
      id: 'wallsOfJericho',
      name: 'Walls of Jericho',
      era: 'stone',
      requires: ['palisades'],
      turns: 6,
      manpower: 2,
      goods: [{ resource: 'stone', count: 1 }],
      effects: [{ type: 'raidImmunity' }],
      summary: "Barbarian raids cannot strike the owner's settlements",
    },
    {
      id: 'newgrange',
      name: 'Newgrange',
      era: 'stone',
      requires: ['masonry', 'ritual'],
      turns: 6,
      manpower: 1,
      goods: [{ resource: 'stone', count: 1 }, { resource: 'food', count: 1 }],
      effects: [{ type: 'culture', amount: 2 }],
      summary: '+2 culture progress a turn',
    },
    {
      id: 'stonehenge',
      name: 'Stonehenge',
      era: 'stone',
      requires: ['masonry', 'ritual'],
      turns: 8,
      manpower: 2,
      goods: [{ resource: 'stone', count: 1 }],
      effects: [{ type: 'learning', amount: 2 }],
      summary: '+2 learning a turn, down the study queue',
    },
  ],
};
