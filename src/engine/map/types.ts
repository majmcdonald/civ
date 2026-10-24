// Design doc §2 (map type, civilization count) and §4 (areas, terrain, features, rivers, starts).

export type MapType = 'inlandSea' | 'continents' | 'singleLandmass';
export const MAP_TYPES: readonly MapType[] = ['inlandSea', 'continents', 'singleLandmass'];

// Room to expand (design doc §2): land per civilization.
export type RoomToExpand = 'crowded' | 'standard' | 'spacious';
export const ROOM_TO_EXPAND: readonly RoomToExpand[] = ['crowded', 'standard', 'spacious'];

export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains' | 'desert' | 'marsh';
export const TERRAINS: readonly Terrain[] = ['plains', 'forest', 'hills', 'mountains', 'desert', 'marsh'];

export type Feature = 'river' | 'floodplain' | 'coastal' | 'volcanic';

export type AreaId = number;
// A resource's content id (design doc §6), e.g. 'grain'.
export type ResourceId = string;
export type Point = [number, number];

export interface MapOptions {
  seed: number;
  civilizations: number;
  type: MapType;
  room: RoomToExpand;
}

export interface MapArea {
  id: AreaId;
  kind: 'land' | 'sea';
  terrain: Terrain | null;
  features: Feature[];
  // Starting population limit; 0 for sea areas.
  limit: number;
  // Resources in the area: food, livestock, or copper, at most one (design doc §4, Procedural maps).
  resources: ResourceId[];
  neighbors: AreaId[];
  // A point inside the area, for labels and pieces.
  center: Point;
  // Closed rings in map coordinates.
  outline: Point[][];
  // Centers of the grid cells that make up the area, for placing terrain art.
  cells: Point[];
  // Connected landmass (land) or water body (sea).
  body: number;
}

export interface River {
  id: number;
  // Land areas from source to mouth; consecutive areas are neighbors.
  areas: AreaId[];
  // A sea area, or an area of another river this one joins.
  outlet: AreaId;
  // Drawn path in map coordinates: through land only, ending on the coast or at the joined river.
  course: Point[];
}

export interface GameMap {
  options: MapOptions;
  // Re-rolls needed before a layout passed every check (0 = first try).
  attempt: number;
  width: number;
  height: number;
  areas: MapArea[];
  rivers: River[];
  // Starting area per civilization, in civilization order.
  starts: AreaId[];
  // Land/sea boundary paths, for drawing the coast.
  coastline: Point[][];
}
