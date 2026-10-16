import type { Point } from './types';

// Fine hex grid that areas are built from. Pointy-top hexes in offset rows (odd rows shifted right).
// Uses only arithmetic and sqrt so results match across JavaScript engines.

export const CELL = 10;
const RADIUS = CELL / Math.sqrt(3);
const ROW = RADIUS * 1.5;

// Neighbor directions, matching edge order: edge k runs from corner k to corner k + 1.
// Corners: top, upper right, lower right, bottom, lower left, upper left.
// Edges face: upper right, right, lower right, lower left, left, upper left.
const EVEN_ROW: readonly Point[] = [[0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const ODD_ROW: readonly Point[] = [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1]];
// Corner offsets in integer units: x in half cells, y in half radii.
const CORNER_X = [0, 1, 1, 0, -1, -1];
const CORNER_Y = [-2, -1, 1, 2, 1, -1];

export interface HexGrid {
  cols: number;
  rows: number;
  count: number;
  width: number;
  height: number;
  x: number[];
  y: number[];
  // Six neighbor cells per cell in edge order; -1 off the grid.
  neighbors: number[][];
  cornerKeys: string[][];
  corners: Map<string, Point>;
}

export function hash(a: number, b: number, seed: number): number {
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function buildGrid(cols: number, rows: number, seed: number): HexGrid {
  const count = cols * rows;
  const x: number[] = [];
  const y: number[] = [];
  const neighbors: number[][] = [];
  const cornerKeys: string[][] = [];
  const corners = new Map<string, Point>();
  const jitter = CELL * 0.38;

  for (let row = 0; row < rows; row++) {
    const odd = row % 2 === 1;
    for (let col = 0; col < cols; col++) {
      x.push((col + (odd ? 1 : 0.5)) * CELL);
      y.push(row * ROW + RADIUS);
      neighbors.push(
        (odd ? ODD_ROW : EVEN_ROW).map(([dc, dr]) => {
          const c = col + dc;
          const r = row + dr;
          return c < 0 || c >= cols || r < 0 || r >= rows ? -1 : r * cols + c;
        }),
      );
      const keys: string[] = [];
      for (let k = 0; k < 6; k++) {
        const kx = 2 * col + (odd ? 2 : 1) + CORNER_X[k]!;
        const ky = 3 * row + 2 + CORNER_Y[k]!;
        const key = `${kx},${ky}`;
        if (!corners.has(key)) {
          corners.set(key, [
            (kx * CELL) / 2 + (hash(kx, ky, seed) - 0.5) * jitter,
            (ky * RADIUS) / 2 + (hash(ky, kx, seed + 1) - 0.5) * jitter,
          ]);
        }
        keys.push(key);
      }
      cornerKeys.push(keys);
    }
  }

  return { cols, rows, count, width: (cols + 0.5) * CELL, height: (rows - 1) * ROW + 2 * RADIUS, x, y, neighbors, cornerKeys, corners };
}

const round = (v: number) => Math.round(v * 100) / 100;

// Chains the edges where `isBoundary` holds into paths. Closed rings repeat no point; open paths
// (cut by the grid edge) are returned as they run.
export function boundaryPaths(grid: HexGrid, cells: Iterable<number>, isBoundary: (cell: number, neighbor: number) => boolean): Point[][] {
  const next = new Map<string, string>();
  for (const cell of cells) {
    const keys = grid.cornerKeys[cell]!;
    grid.neighbors[cell]!.forEach((neighbor, k) => {
      if (isBoundary(cell, neighbor)) next.set(keys[k]!, keys[(k + 1) % 6]!);
    });
  }
  const point = (key: string): Point => {
    const [px, py] = grid.corners.get(key)!;
    return [round(px), round(py)];
  };
  const incoming = new Set(next.values());
  const paths: Point[][] = [];
  const follow = (start: string) => {
    const path: Point[] = [point(start)];
    let key = next.get(start);
    next.delete(start);
    while (key !== undefined && key !== start) {
      path.push(point(key));
      const after = next.get(key);
      next.delete(key);
      key = after;
    }
    paths.push(path);
  };
  for (const start of [...next.keys()]) if (!incoming.has(start) && next.has(start)) follow(start);
  for (const start of [...next.keys()]) if (next.has(start)) follow(start);
  return paths;
}
