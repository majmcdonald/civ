import { useMemo, useState } from 'react';
import {
  generateMap,
  MAP_TYPES,
  MAX_CIVILIZATIONS,
  ROOM_TO_EXPAND,
  nearestStart,
  startQuality,
  TERRAINS,
  type AreaId,
  type MapArea,
  type MapType,
  type RoomToExpand,
} from '../../engine';
import { CIV_COLORS, IsoMap, TERRAIN_FILL } from '../art/IsoMap';
import { NO_PIECES } from '../art/pieces';
import { samplePieces } from './samplePieces';
import './MapScreen.css';

export const TYPE_NAMES: Record<MapType, string> = {
  inlandSea: 'Inland sea',
  continents: 'Continents',
  singleLandmass: 'Single landmass',
};

export const ROOM_NAMES: Record<RoomToExpand, string> = {
  crowded: 'Crowded',
  standard: 'Standard',
  spacious: 'Spacious',
};

const CIVILIZATION_COUNTS = Array.from({ length: MAX_CIVILIZATIONS - 1 }, (_, i) => i + 2);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describe(area: MapArea): string {
  if (area.kind === 'sea') return 'Sea';
  const features = area.features.map((f) => (f === 'volcanic' ? 'volcanic/fault' : f));
  return [capitalize(area.terrain!), ...features].join(', ');
}

// Phase 2 map screen: the generated map on the isometric board, plus generator controls for review.
export function MapScreen() {
  const params = new URLSearchParams(window.location.search);
  const [seed, setSeed] = useState(Number(params.get('seed')) || 1);
  const [type, setType] = useState<MapType>((params.get('type') as MapType | null) ?? 'inlandSea');
  const [room, setRoom] = useState<RoomToExpand>((params.get('room') as RoomToExpand | null) ?? 'standard');
  const [civilizations, setCivilizations] = useState(Number(params.get('civs')) || 5);
  const [hovered, setHovered] = useState<AreaId | null>(null);
  const [showCounts, setShowCounts] = useState(params.get('counts') !== '0');
  const [showSample, setShowSample] = useState(params.get('sample') !== '0');
  const map = useMemo(() => generateMap({ seed, civilizations, type, room }), [seed, civilizations, type, room]);
  const land = map.areas.filter((a) => a.kind === 'land');
  const nearest = useMemo(() => nearestStart(map), [map]);
  const sample = useMemo(() => samplePieces(map), [map]);
  const hoveredArea = hovered === null ? null : map.areas[hovered];

  return (
    <main className="map-screen">
      <IsoMap map={map} insetLeft={320} pieces={showSample ? sample : NO_PIECES} showCounts={showCounts} hovered={hovered} onHover={setHovered} />

      <aside className="map-panel">
        <h1 className="map-panel-title">Map</h1>

        <div className="map-controls">
          <label>
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as MapType)}>
              {MAP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Room to expand</span>
            <select value={room} onChange={(e) => setRoom(e.target.value as RoomToExpand)}>
              {ROOM_TO_EXPAND.map((r) => (
                <option key={r} value={r}>
                  {ROOM_NAMES[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Civilizations</span>
            <select value={civilizations} onChange={(e) => setCivilizations(Number(e.target.value))}>
              {CIVILIZATION_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Seed</span>
            <input type="number" value={seed} onChange={(e) => setSeed(Math.trunc(Number(e.target.value)) || 0)} />
          </label>
          <button type="button" onClick={() => setSeed((s) => s + 1)}>
            Next seed
          </button>
        </div>

        <div className="map-toggles">
          <label>
            <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
            Show tokens / limits
          </label>
          <label>
            <input type="checkbox" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} />
            Sample pieces (review only)
          </label>
        </div>

        <table className="map-table">
          <tbody>
            <tr>
              <th>Land areas</th>
              <td>{land.length}</td>
            </tr>
            <tr>
              <th>Sea areas</th>
              <td>{map.areas.length - land.length}</td>
            </tr>
            <tr>
              <th>Rivers</th>
              <td>{map.rivers.length}</td>
            </tr>
            <tr>
              <th>Re-rolls</th>
              <td>{map.attempt}</td>
            </tr>
          </tbody>
        </table>

        <h2>Terrain</h2>
        <table className="map-table">
          <tbody>
            {TERRAINS.map((t) => {
              const count = land.filter((a) => a.terrain === t).length;
              return (
                <tr key={t}>
                  <th>
                    <i className="swatch" style={{ background: TERRAIN_FILL[t] }} />
                    {capitalize(t)}
                  </th>
                  <td>{count}</td>
                  <td>{Math.round((count / land.length) * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h2>Starts</h2>
        <p className="map-note">Nearby: total limit within 3 moves. Nearest: land areas closer to this start than to any other.</p>
        <table className="map-table">
          <thead>
            <tr>
              <th />
              <th>Terrain</th>
              <th>Limit</th>
              <th>Nearby</th>
              <th>Nearest</th>
            </tr>
          </thead>
          <tbody>
            {map.starts.map((id, civ) => {
              const area = map.areas[id]!;
              return (
                <tr key={civ}>
                  <th>
                    <i className="swatch" style={{ background: CIV_COLORS[civ] }} />
                    {civ + 1}
                  </th>
                  <td>{capitalize(area.terrain!)}</td>
                  <td>{area.limit}</td>
                  <td>{startQuality(map, id).totalLimit}</td>
                  <td>{nearest.filter((n) => n === civ).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </aside>

      <div className="map-hover" aria-live="polite">
        {hoveredArea ? (
          <>
            <strong>Area {hoveredArea.id}</strong> · {describe(hoveredArea)}
            {hoveredArea.kind === 'land' && <> · limit {hoveredArea.limit}</>}
          </>
        ) : (
          <span className="map-hint">Hover an area · drag to pan · scroll to zoom</span>
        )}
      </div>
    </main>
  );
}
