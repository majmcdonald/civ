// Economy simulation (started in Phase 0): settlement pyramid return on investment and pacing.
// Run: node sim/phase0/sim.ts

type Tier = 1 | 2 | 3 | 4;
type UrbanMode = 'tiered' | 'flat';
// stacked: settlements count against the area limit at token value, several per area.
// full: one settlement per area; a settled area is fully populated (no loose tokens).
// one: one settlement per area; it counts as 1 token against the limit.
type SettleMode = 'stacked' | 'full' | 'one';

interface Config {
  seed: number;
  width: number;
  height: number;
  limitMin: number;
  limitMax: number;
  turns: number;
  tokenCap: number;
  capStep: number;
  capEvery: number;
  capCounts: 'all' | 'loose';
  maxTier: 0 | Tier;
  urban: UrbanMode;
  growthReserve: number;
  settleMode: SettleMode;
  townTurn: number;
  capRaises: [number, number][];
}

interface Settlement {
  area: number;
  tier: Tier;
}

interface State {
  mode: SettleMode;
  cap: number;
  limits: number[];
  neighbors: number[][];
  loose: number[];
  settlements: Settlement[];
}

interface TurnStats {
  turn: number;
  population: number;
  loose: number;
  tiers: [number, number, number, number];
  manpower: number;
  cumulativeManpower: number;
  occupied: number;
  supportFailures: number;
  fullness: number;
}

const TIER_VALUE = [0, 6, 12, 20, 30];
const CONVERT_COST = [0, 6, 6, 8, 10];
const SUPPORT = [0, 2, 3, 4, 6];
const MANPOWER = [0, 1, 2, 3, 4];
const AREA_TIER_CAP = [0, 2, 2, 2, 1];
const URBAN: Record<UrbanMode, number[]> = {
  tiered: [0, 0, 1, 2, 3],
  flat: [0, 2, 2, 2, 2],
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMap(cfg: Config): { limits: number[]; neighbors: number[][] } {
  const rand = mulberry32(cfg.seed);
  const n = cfg.width * cfg.height;
  const limits: number[] = [];
  const neighbors: number[][] = [];
  for (let i = 0; i < n; i++) {
    limits.push(cfg.limitMin + Math.floor(rand() * (cfg.limitMax - cfg.limitMin + 1)));
  }
  // Hex grid, odd-r offset: six neighbors per interior area.
  for (let r = 0; r < cfg.height; r++) {
    for (let c = 0; c < cfg.width; c++) {
      const odd = r % 2 === 1;
      const deltas = odd
        ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
        : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
      const list: number[] = [];
      for (const [dr, dc] of deltas) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= cfg.height || cc < 0 || cc >= cfg.width) continue;
        list.push(rr * cfg.width + cc);
      }
      neighbors.push(list);
    }
  }
  return { limits, neighbors };
}

function settledValue(s: State, area: number): number {
  let v = 0;
  for (const st of s.settlements) if (st.area === area) v += TIER_VALUE[st.tier];
  return v;
}

function usage(s: State, area: number): number {
  const settled = settledValue(s, area);
  if (s.mode === 'stacked' || settled === 0) return s.loose[area] + settled;
  if (s.mode === 'full') return s.limits[area] + s.loose[area];
  return s.loose[area] + 1;
}

function fullness(s: State): number {
  let room = 0;
  let total = 0;
  for (let a = 0; a < s.limits.length; a++) {
    room += Math.max(0, s.limits[a] - usage(s, a));
    total += s.limits[a];
  }
  return 1 - room / total;
}

function capped(s: State, cfg: Config): number {
  if (cfg.capCounts === 'all') return population(s);
  return s.loose.reduce((x, y) => x + y, 0);
}

function population(s: State): number {
  let p = 0;
  for (const l of s.loose) p += l;
  for (const st of s.settlements) p += TIER_VALUE[st.tier];
  return p;
}

// Greedy support assignment, highest tier first, own area before neighbors.
function assignSupport(s: State): { supported: boolean[]; free: number[] } {
  const free = [...s.loose];
  const order = s.settlements.map((_, i) => i).sort((a, b) => s.settlements[b].tier - s.settlements[a].tier);
  const supported = new Array(s.settlements.length).fill(false);
  for (const i of order) {
    const st = s.settlements[i];
    const need = SUPPORT[st.tier];
    // A fully populated area holds no loose tokens at end of turn, so support comes from neighbors.
    const sources = s.mode === 'full'
      ? s.neighbors[st.area].filter((a) => settledValue(s, a) === 0)
      : [st.area, ...s.neighbors[st.area]];
    const available = sources.reduce((sum, a) => sum + free[a], 0);
    if (available < need) continue;
    let remaining = need;
    for (const a of sources) {
      const take = Math.min(free[a], remaining);
      free[a] -= take;
      remaining -= take;
      if (remaining === 0) break;
    }
    supported[i] = true;
  }
  return { supported, free };
}

function move(s: State, cfg: Config): void {
  const { free } = assignSupport(s);
  const startLoose = [...s.loose];
  const targeted = new Set<number>();
  for (let a = 0; a < s.loose.length; a++) {
    // A full area cannot grow, so it keeps no growth reserve.
    const reserve = usage(s, a) >= s.limits[a] ? 0 : cfg.growthReserve;
    for (const b of s.neighbors[a]) {
      const excess = free[a] - reserve;
      if (excess <= 0) break;
      if (startLoose[b] > 0 || targeted.has(b)) continue;
      const room = s.limits[b] - usage(s, b);
      const amount = Math.min(2, excess, room);
      if (amount <= 0) continue;
      s.loose[a] -= amount;
      free[a] -= amount;
      s.loose[b] += amount;
      targeted.add(b);
    }
  }
}

// Take `cost` tokens for a conversion in `area`, own area first. Returns false if not possible.
function tryConsume(s: State, cfg: Config, area: number, cost: number, extraSupport: number): boolean {
  const { free } = assignSupport(s);
  const sources = [area, ...s.neighbors[area]];
  // Keep a growth reserve only where the area can still grow.
  const canGrow = capped(s, cfg) < s.cap;
  const spare = sources.map((a) => {
    const reserve = canGrow && usage(s, a) < s.limits[a] ? cfg.growthReserve : 0;
    return Math.max(0, free[a] - reserve);
  });
  const total = spare.reduce((x, y) => x + y, 0);
  if (total < cost + extraSupport) return false;

  const plan: number[] = new Array(sources.length).fill(0);
  let remaining = cost;
  for (let i = 0; i < sources.length && remaining > 0; i++) {
    const take = Math.min(spare[i], remaining);
    plan[i] = take;
    remaining -= take;
  }
  // In a fully populated area, the extra support must come from neighbors left over after the plan.
  if (cfg.settleMode === 'full') {
    let neighborLeft = 0;
    for (let i = 1; i < sources.length; i++) {
      if (settledValue(s, sources[i]) === 0) neighborLeft += spare[i] - plan[i];
    }
    if (neighborLeft < extraSupport) return false;
  }
  const absorbed = plan.slice(1).reduce((x, y) => x + y, 0);
  if (cfg.settleMode === 'stacked' && usage(s, area) + absorbed > s.limits[area]) return false;

  for (let i = 0; i < sources.length; i++) s.loose[sources[i]] -= plan[i];
  return true;
}

function countTier(s: State, area: number, tier: Tier): number {
  return s.settlements.filter((st) => st.area === area && st.tier === tier).length;
}

// Roll back a conversion that would leave any settlement unsupported.
function allSupported(s: State): boolean {
  return assignSupport(s).supported.every(Boolean);
}

function convert(s: State, cfg: Config, turn: number): void {
  if (cfg.maxTier === 0) return;
  const maxTier = turn < cfg.townTurn ? 1 : cfg.maxTier;
  let changed = true;
  while (changed) {
    changed = false;
    for (const st of s.settlements) {
      if (st.tier >= maxTier) continue;
      const next = (st.tier + 1) as Tier;
      if (countTier(s, st.area, next) >= AREA_TIER_CAP[next]) continue;
      const before = [...s.loose];
      if (!tryConsume(s, cfg, st.area, CONVERT_COST[next], SUPPORT[next] - SUPPORT[st.tier])) continue;
      st.tier = next;
      if (!allSupported(s)) {
        s.loose = before;
        st.tier = (next - 1) as Tier;
        continue;
      }
      changed = true;
    }
    for (let a = 0; a < s.loose.length; a++) {
      if (cfg.settleMode !== 'stacked' && settledValue(s, a) > 0) continue;
      if (countTier(s, a, 1) >= AREA_TIER_CAP[1]) continue;
      const before = [...s.loose];
      if (!tryConsume(s, cfg, a, CONVERT_COST[1], SUPPORT[1])) continue;
      s.settlements.push({ area: a, tier: 1 });
      if (!allSupported(s)) {
        s.loose = before;
        s.settlements.pop();
        continue;
      }
      changed = true;
    }
  }
}

function supportCheck(s: State): number {
  const { supported } = assignSupport(s);
  let failures = 0;
  const kept: Settlement[] = [];
  s.settlements.forEach((st, i) => {
    if (supported[i]) {
      kept.push(st);
      return;
    }
    failures++;
    const freed = TIER_VALUE[st.tier] - TIER_VALUE[st.tier - 1];
    s.loose[st.area] += freed;
    if (st.tier > 1) kept.push({ area: st.area, tier: (st.tier - 1) as Tier });
  });
  s.settlements = kept;
  return failures;
}

function grow(s: State, cfg: Config): void {
  let headroom = s.cap - capped(s, cfg);
  const snapshot = [...s.loose];
  for (let a = 0; a < s.loose.length && headroom > 0; a++) {
    const gain = snapshot[a] >= 2 ? 2 : snapshot[a];
    const add = Math.min(gain, s.limits[a] - usage(s, a), headroom);
    if (add <= 0) continue;
    s.loose[a] += add;
    headroom -= add;
  }
  for (const st of [...s.settlements]) {
    let amount = URBAN[cfg.urban][st.tier];
    while (amount > 0 && headroom > 0) {
      let best = -1;
      let bestRoom = 0;
      for (const b of s.neighbors[st.area]) {
        const room = s.limits[b] - usage(s, b);
        if (room > bestRoom) {
          best = b;
          bestRoom = room;
        }
      }
      if (best < 0) break;
      s.loose[best] += 1;
      headroom -= 1;
      amount -= 1;
    }
  }
}

function removeSurplus(s: State): void {
  for (let a = 0; a < s.loose.length; a++) {
    const over = usage(s, a) - s.limits[a];
    if (over > 0) s.loose[a] = Math.max(0, s.loose[a] - over);
  }
}

function run(cfg: Config): TurnStats[] {
  const { limits, neighbors } = buildMap(cfg);
  const s: State = { mode: cfg.settleMode, cap: cfg.tokenCap, limits, neighbors, loose: new Array(limits.length).fill(0), settlements: [] };
  const center = Math.floor(cfg.height / 2) * cfg.width + Math.floor(cfg.width / 2);
  s.loose[center] = 1;

  const history: TurnStats[] = [];
  let cumulative = 0;
  for (let turn = 1; turn <= cfg.turns; turn++) {
    if (cfg.capEvery > 0 && turn % cfg.capEvery === 0) s.cap += cfg.capStep;
    for (const [t, amount] of cfg.capRaises) if (t === turn) s.cap += amount;
    move(s, cfg);
    convert(s, cfg, turn);
    const supportFailures = supportCheck(s);
    grow(s, cfg);
    removeSurplus(s);

    const tiers: [number, number, number, number] = [0, 0, 0, 0];
    let manpower = 0;
    for (const st of s.settlements) {
      tiers[st.tier - 1]++;
      manpower += MANPOWER[st.tier];
    }
    cumulative += manpower;
    const occupied = s.loose.filter((l, a) => l > 0 || settledValue(s, a) > 0).length;
    history.push({
      turn,
      population: population(s),
      loose: s.loose.reduce((x, y) => x + y, 0),
      tiers,
      manpower,
      cumulativeManpower: cumulative,
      occupied,
      supportFailures,
      fullness: fullness(s),
    });
  }
  return history;
}

// ---- Experiment ----

const BASE: Omit<Config, 'seed' | 'maxTier' | 'urban' | 'tokenCap'> & Pick<Config, 'capStep' | 'capEvery' | 'capCounts'> = {
  width: 8,
  height: 8,
  limitMin: 12,
  limitMax: 40,
  turns: 80,
  growthReserve: 2,
  capStep: 0,
  capEvery: 0,
  capCounts: 'all',
  settleMode: 'stacked',
  townTurn: 0,
  capRaises: [],
};
const SEEDS = [1, 2, 3, 4, 5];
const CHECKPOINTS = [5, 10, 15, 20, 30, 80];
const STRATEGIES: { name: string; maxTier: 0 | Tier }[] = [
  { name: 'no settling', maxTier: 0 },
  { name: 'villages', maxTier: 1 },
  { name: 'up to town', maxTier: 2 },
  { name: 'up to city', maxTier: 3 },
  { name: 'up to metropolis', maxTier: 4 },
];

function average(cfgs: Config[]): TurnStats[] {
  const runs = cfgs.map(run);
  return runs[0].map((_, t) => {
    const avg = (f: (x: TurnStats) => number) => runs.reduce((sum, r) => sum + f(r[t]), 0) / runs.length;
    return {
      turn: t + 1,
      population: avg((x) => x.population),
      loose: avg((x) => x.loose),
      tiers: [0, 1, 2, 3].map((i) => avg((x) => x.tiers[i])) as [number, number, number, number],
      manpower: avg((x) => x.manpower),
      cumulativeManpower: avg((x) => x.cumulativeManpower),
      occupied: avg((x) => x.occupied),
      supportFailures: avg((x) => x.supportFailures),
      fullness: avg((x) => x.fullness),
    };
  });
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function report(tokenCap: number): void {
  const capLabel = Number.isFinite(tokenCap) ? `token cap ${tokenCap}` : 'no token cap';
  for (const urban of ['tiered', 'flat'] as UrbanMode[]) {
    console.log(`\n### Urban growth: ${urban} (${URBAN[urban].slice(1).join('/')}), ${capLabel}\n`);
    console.log('| Strategy | MP @' + CHECKPOINTS.join(' | @') + ' | Cum. MP | Pop @10 | Pop @20 | Pop @80 | V/T/C/M @80 |');
    console.log('|---|' + CHECKPOINTS.map(() => '---|').join('') + '---|---|---|---|---|');
    for (const strat of STRATEGIES) {
      const h = average(SEEDS.map((seed) => ({ ...BASE, seed, maxTier: strat.maxTier, urban, tokenCap })));
      const last = h[h.length - 1];
      const cols = CHECKPOINTS.map((c) => fmt(h[c - 1].manpower));
      console.log(
        `| ${strat.name} | ${cols.join(' | ')} | ${fmt(last.cumulativeManpower)} | ${fmt(h[9].population)} | ${fmt(h[19].population)} | ${fmt(last.population)} | ${last.tiers.map(fmt).join('/')} |`,
      );
    }
  }
}

// Expansion window: turns until a lone civilization reaches every area (frontier) and fills 90% of capacity.
function sweep(): void {
  const sizes = [6, 8, 10, 12];
  const limitRanges: [number, number][] = [[6, 18], [12, 40], [24, 60], [40, 100]];
  console.log('\n### Expansion window (up to metropolis, tiered urban growth, no token cap)\n');
  console.log('| Areas | Limits | Avg capacity | All areas reached | 90% full |');
  console.log('|---|---|---|---|---|');
  for (const size of sizes) {
    for (const [limitMin, limitMax] of limitRanges) {
      const reached: number[] = [];
      const full: number[] = [];
      let capacity = 0;
      for (const seed of SEEDS) {
        const cfg: Config = { ...BASE, width: size, height: size, limitMin, limitMax, turns: 200, seed, maxTier: 4, urban: 'tiered', tokenCap: Infinity };
        const cap = buildMap(cfg).limits.reduce((x, y) => x + y, 0);
        capacity += cap / SEEDS.length;
        const h = run(cfg);
        reached.push(h.find((t) => t.occupied === size * size)?.turn ?? NaN);
        full.push(h.find((t) => t.population >= 0.9 * cap)?.turn ?? NaN);
      }
      const avg = (xs: number[]) => fmt(xs.reduce((x, y) => x + y, 0) / xs.length);
      console.log(`| ${size * size} | ${limitMin}–${limitMax} | ${fmt(Math.round(capacity))} | ${avg(reached)} | ${avg(full)} |`);
    }
  }
}

// Token cap starting at the original's 55, raised every 5 turns as a stand-in for discoveries.
function capSweep(): void {
  const limitRanges: [number, number][] = [[6, 18], [12, 40]];
  const steps = [10, 25, 50, 100];
  for (const capCounts of ['all', 'loose'] as const) {
    console.log(`\n### Token cap 55, +step every 5 turns, cap counts: ${capCounts} (64 areas, up to metropolis, tiered urban)\n`);
    console.log('| Limits | Step | Capacity | 90% full | MP @10 | @20 | @30 | @40 | @60 | Pop @40 | Areas @40 | V/T/C/M @40 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [limitMin, limitMax] of limitRanges) {
      for (const capStep of steps) {
        const cfgs = SEEDS.map((seed): Config => ({ ...BASE, limitMin, limitMax, turns: 150, seed, maxTier: 4, urban: 'tiered', tokenCap: 55, capStep, capEvery: 5, capCounts }));
        const capacity = cfgs.reduce((sum, c) => sum + buildMap(c).limits.reduce((x, y) => x + y, 0), 0) / cfgs.length;
        const fullTurns = cfgs.map((c) => {
          const cap = buildMap(c).limits.reduce((x, y) => x + y, 0);
          return run(c).find((t) => t.population >= 0.9 * cap)?.turn ?? NaN;
        });
        const full = fullTurns.some(Number.isNaN) ? '>150' : fmt(fullTurns.reduce((x, y) => x + y, 0) / fullTurns.length);
        const h = average(cfgs);
        const at = (t: number) => h[t - 1];
        console.log(
          `| ${limitMin}–${limitMax} | ${capStep} | ${Math.round(capacity)} | ${full} | ${[10, 20, 30, 40, 60].map((t) => fmt(at(t).manpower)).join(' | ')} | ${fmt(at(40).population)} | ${fmt(at(40).occupied)} | ${at(40).tiers.map(fmt).join('/')} |`,
        );
      }
    }
  }
}

// Original-style construction: tokens gathered ignoring the limit, one settlement per area.
function settleSweep(): void {
  const limitRanges: [number, number][] = [[1, 5], [2, 10]];
  const steps = [10, 25, 50];
  for (const settleMode of ['full', 'one'] as const) {
    for (const capCounts of ['loose', 'all'] as const) {
      console.log(`\n### After construction: ${settleMode}; cap 55 +step/5 turns counts ${capCounts} (64 areas, up to metropolis, tiered urban)\n`);
      console.log('| Limits | Step | 90% full | MP @10 | @20 | @30 | @40 | @60 | Pop @40 | Settled areas @40 | V/T/C/M @40 | Support failures (total) |');
      console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
      for (const [limitMin, limitMax] of limitRanges) {
        for (const capStep of steps) {
          const cfgs = SEEDS.map((seed): Config => ({ ...BASE, limitMin, limitMax, turns: 150, seed, maxTier: 4, urban: 'tiered', tokenCap: 55, capStep, capEvery: 5, capCounts, settleMode }));
          const runs = cfgs.map(run);
          const fullTurns = runs.map((h) => h.find((t) => t.fullness >= 0.9)?.turn ?? NaN);
          const full = fullTurns.some(Number.isNaN) ? '>150' : fmt(fullTurns.reduce((x, y) => x + y, 0) / fullTurns.length);
          const failures = runs.reduce((sum, h) => sum + h.reduce((x, t) => x + t.supportFailures, 0), 0) / runs.length;
          const h = average(cfgs);
          const at = (t: number) => h[t - 1];
          const settled = (t: number) => fmt(at(t).tiers.reduce((x, y) => x + y, 0));
          console.log(
            `| ${limitMin}–${limitMax} | ${capStep} | ${full} | ${[10, 20, 30, 40, 60].map((t) => fmt(at(t).manpower)).join(' | ')} | ${fmt(at(40).population)} | ${settled(40)} | ${at(40).tiers.map(fmt).join('/')} | ${fmt(failures)} |`,
          );
        }
      }
    }
  }
}

// Villages only until a Stone Age advance unlocks towns at a random turn in 20–30.
function townSweep(): void {
  const configs: { limitMin: number; limitMax: number; capStep: number }[] = [
    { limitMin: 1, limitMax: 5, capStep: 10 },
    { limitMin: 2, limitMax: 10, capStep: 25 },
    { limitMin: 1, limitMax: 5, capStep: 5 },
    { limitMin: 2, limitMax: 10, capStep: 10 },
    { limitMin: 2, limitMax: 10, capStep: 15 },
  ];
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  for (const c of configs) {
    console.log(`\n### Towns unlocked turn 20–30; full rule; limits ${c.limitMin}–${c.limitMax}; cap 55 +${c.capStep}/5 turns (loose)\n`);
    console.log('| Seed | Town unlock | First town | 90% full | MP @20 | @30 | @40 | @60 | V/T @30 | V/T @60 | Settled @60 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    const rows: number[][] = [];
    for (const seed of seeds) {
      const townTurn = 20 + Math.floor(mulberry32(seed * 7919)() * 11);
      const h = run({ ...BASE, ...c, turns: 150, seed, maxTier: 2, urban: 'tiered', tokenCap: 55, capEvery: 5, capCounts: 'loose', settleMode: 'full', townTurn });
      const firstTown = h.find((t) => t.tiers[1] > 0)?.turn ?? NaN;
      const full = h.find((t) => t.fullness >= 0.9)?.turn ?? NaN;
      const at = (t: number) => h[t - 1];
      const vt = (t: number) => `${at(t).tiers[0]}/${at(t).tiers[1]}`;
      rows.push([townTurn, firstTown, full, at(20).manpower, at(30).manpower, at(40).manpower, at(60).manpower]);
      console.log(`| ${seed} | ${townTurn} | ${fmt(firstTown)} | ${fmt(full)} | ${at(20).manpower} | ${at(30).manpower} | ${at(40).manpower} | ${at(60).manpower} | ${vt(30)} | ${vt(60)} | ${at(60).tiers[0] + at(60).tiers[1]} |`);
    }
    const mean = (i: number) => fmt(rows.reduce((x, r) => x + r[i], 0) / rows.length);
    console.log(`| **Mean** | ${mean(0)} | ${mean(1)} | ${mean(2)} | ${mean(3)} | ${mean(4)} | ${mean(5)} | ${mean(6)} | | | |`);
    for (const [label, maxTier, townTurn] of [['villages only', 1, 0], ['towns from turn 1', 2, 0]] as const) {
      const h = average(seeds.map((seed): Config => ({ ...BASE, ...c, turns: 150, seed, maxTier, urban: 'tiered', tokenCap: 55, capEvery: 5, capCounts: 'loose', settleMode: 'full', townTurn })));
      const at = (t: number) => h[t - 1];
      console.log(`| *${label}* | | | | ${fmt(at(20).manpower)} | ${fmt(at(30).manpower)} | ${fmt(at(40).manpower)} | ${fmt(at(60).manpower)} | | ${fmt(at(60).tiers[0])}/${fmt(at(60).tiers[1])} | |`);
    }
  }
}

// Rare cap rises: a starting cap plus 0–2 advance-driven rises in the Stone Age; towns unlock at turn 20–30.
function rareCapSweep(): void {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const schedules: { label: string; raises: (start: number) => [number, number][] }[] = [
    { label: 'none', raises: () => [] },
    { label: '1 rise (+50% at 25)', raises: (c) => [[25, Math.round(c / 2)]] },
    { label: '2 rises (+50% at 15, 35)', raises: (c) => [[15, Math.round(c / 2)], [35, Math.round(c / 2)]] },
  ];
  for (const capCounts of ['loose', 'all'] as const) {
    console.log(`\n### Rare cap rises; full rule; towns at 20–30; cap counts ${capCounts} (64 areas, 10 seeds)\n`);
    console.log('| Limits | Start cap | Rises | 90% full | MP @20 | @40 | @60 | @100 | V/T @60 | Settled @60 | Loose @60 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [limitMin, limitMax] of [[1, 5], [2, 10]] as const) {
      for (const tokenCap of [30, 55, 80]) {
        for (const sch of schedules) {
          const cfgs = seeds.map((seed): Config => ({
            ...BASE, limitMin, limitMax, turns: 150, seed, maxTier: 2, urban: 'tiered', tokenCap, capCounts, settleMode: 'full',
            townTurn: 20 + Math.floor(mulberry32(seed * 7919)() * 11), capRaises: sch.raises(tokenCap),
          }));
          const fullTurns = cfgs.map((c) => run(c).find((t) => t.fullness >= 0.9)?.turn ?? NaN);
          const reached = fullTurns.filter((x) => !Number.isNaN(x));
          const full = reached.length === 0 ? '>150' : reached.length < fullTurns.length ? `${fmt(reached.reduce((x, y) => x + y, 0) / reached.length)} (${reached.length}/10)` : fmt(reached.reduce((x, y) => x + y, 0) / reached.length);
          const h = average(cfgs);
          const at = (t: number) => h[t - 1];
          console.log(`| ${limitMin}–${limitMax} | ${tokenCap} | ${sch.label} | ${full} | ${[20, 40, 60, 100].map((t) => fmt(at(t).manpower)).join(' | ')} | ${fmt(at(60).tiers[0])}/${fmt(at(60).tiers[1])} | ${fmt(at(60).tiers[0] + at(60).tiers[1])} | ${fmt(at(60).loose)} |`);
        }
      }
    }
  }
}

if (process.argv.includes('rare')) {
  rareCapSweep();
} else if (process.argv.includes('towns')) {
  townSweep();
} else if (process.argv.includes('settle')) {
  settleSweep();
} else if (process.argv.includes('cap')) {
  capSweep();
} else if (process.argv.includes('sweep')) {
  sweep();
} else {
  report(Infinity);
  report(150);
}
