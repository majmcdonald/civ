import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { generateMap, type MapType, type RoomToExpand } from '../../engine';
import { IsoMap, type IsoMapHandle } from '../art/IsoMap';
import { lateGamePieces } from './samplePieces';
import './MapScreen.css';

// Rendering stress test (?screen=stress): a late-game board, panned automatically while frame
// times are recorded. Modes: svg (current drawing), noart (no upright terrain art), cached (the
// board drawn once into an image, then moved).

type Mode = 'svg' | 'noart' | 'cached';

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await nextFrame();
}

function stats(deltas: number[]) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const at = (q: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! * 10) / 10;
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return { fps: Math.round(1000 / mean), medianMs: at(0.5), p95Ms: at(0.95), maxMs: at(1) };
}

// Serializes the live SVG (with CSS variables resolved) and draws it into an image `width` px wide.
async function rasterize(svg: SVGSVGElement, width: number): Promise<string> {
  const rect = svg.getBoundingClientRect();
  const root = getComputedStyle(document.documentElement);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(Math.round((width * rect.height) / rect.width)));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer()
    .serializeToString(clone)
    .replace(/var\((--[a-z-]+)\)/g, (_, name: string) => root.getPropertyValue(name).trim() || svg.style.getPropertyValue(name) || '1');
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((width * rect.height) / rect.width);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!)));
  return URL.createObjectURL(blob);
}

export function StressScreen() {
  const params = new URLSearchParams(window.location.search);
  const mode = (params.get('mode') ?? 'svg') as Mode;
  const zoom = Number(params.get('zoom')) || 1;
  const options = {
    seed: Number(params.get('seed')) || 1,
    civilizations: Number(params.get('civs')) || 15,
    type: (params.get('type') ?? 'inlandSea') as MapType,
    room: (params.get('room') ?? 'spacious') as RoomToExpand,
  };
  const started = useRef(performance.now());
  const handle = useRef<IsoMapHandle>(null);
  const cacheRef = useRef<HTMLDivElement>(null);
  const generated = useMemo(() => {
    const t = performance.now();
    const map = generateMap(options);
    return { map, generateMs: Math.round(performance.now() - t) };
  }, []);
  const [turn, setTurn] = useState(0);
  const pieces = useMemo(() => lateGamePieces(generated.map, turn), [generated, turn]);
  const [cached, setCached] = useState<string | null>(null);
  const [result, setResult] = useState('running…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await frames(3);
      const firstRenderMs = Math.round(performance.now() - started.current);
      const iso = handle.current!;
      const home = iso.home();
      let cacheMs: number | null = null;
      if (mode === 'cached') {
        await frames(2);
        const t = performance.now();
        setCached(await rasterize(iso.svg()!, 4096));
        await frames(3);
        cacheMs = Math.round(performance.now() - t);
      }

      // Pan in a loop around the board's center for 180 frames.
      const svgRect = iso.svg()!.getBoundingClientRect();
      const deltas: number[] = [];
      let last = await nextFrame();
      for (let i = 0; i < 180 && !cancelled; i++) {
        const t = (i / 180) * Math.PI * 2;
        if (mode === 'cached') {
          const px = Math.sin(t) * svgRect.width * 0.2;
          const py = Math.cos(t) * svgRect.height * 0.1;
          cacheRef.current!.style.transform = `translate(${px}px, ${py}px) scale(${zoom})`;
        } else {
          iso.setView({ zoom, cx: home.cx + Math.sin(t) * 400, cy: home.cy + Math.cos(t) * 150 });
        }
        const now = await nextFrame();
        deltas.push(now - last);
        last = now;
      }

      // A turn ends: the pieces change and the board redraws.
      let turnUpdateMs: number | null = null;
      if (mode !== 'cached') {
        const t = performance.now();
        setTurn(1);
        await frames(2);
        turnUpdateMs = Math.round(performance.now() - t);
      }

      const land = generated.map.areas.filter((a) => a.kind === 'land').length;
      const out = {
        mode,
        zoom,
        options,
        land,
        settlements: pieces.settlements.length,
        stacks: pieces.stacks.length,
        roads: pieces.roads.length,
        svgElements: iso.svg()!.querySelectorAll('*').length,
        generateMs: generated.generateMs,
        firstRenderMs,
        cacheMs,
        turnUpdateMs,
        pan: stats(deltas),
      };
      if (!cancelled) {
        setResult(JSON.stringify(out, null, 2));
        document.title = 'bench-done';
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cacheStyle: CSSProperties = { position: 'absolute', inset: 0, transformOrigin: 'center', willChange: 'transform' };
  return (
    <main className="map-screen">
      <div style={{ position: 'absolute', inset: 0, visibility: cached ? 'hidden' : 'visible' }}>
        <IsoMap
          map={generated.map}
          pieces={pieces}
          showCounts
          hovered={null}
          onHover={() => {}}
          hideTerrainArt={mode === 'noart'}
          handle={handle}
        />
      </div>
      {cached && (
        <div ref={cacheRef} style={cacheStyle}>
          <img src={cached} alt="" style={{ width: '100%', height: '100%' }} />
        </div>
      )}
      <pre id="bench" className="map-panel" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
        {result}
      </pre>
    </main>
  );
}
