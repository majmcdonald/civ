import { generateMap, validateMapOptions } from './map/generate';
import type { GameMap, MapOptions } from './map/types';
import type { GameSetup } from './types';

// The map is rebuilt from the setup rather than stored in the state: the generator is deterministic,
// so saves stay small. A small cache avoids regenerating it for every command.
const CACHE_SIZE = 4;
const cache = new Map<string, GameMap>();

export function mapOptions(setup: GameSetup): MapOptions {
  return { seed: setup.seed, civilizations: setup.players.length, type: setup.map.type, room: setup.map.room };
}

export function validateMap(setup: GameSetup): string | null {
  return validateMapOptions(mapOptions(setup));
}

export function mapFor(setup: GameSetup): GameMap {
  const options = mapOptions(setup);
  const key = JSON.stringify(options);
  let map = cache.get(key);
  if (!map) {
    map = generateMap(options);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, map);
  }
  return map;
}
