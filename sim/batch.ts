// Headless batch runs (development plan, Phase 3 step 7): plays all-AI games on the real engine and
// reports pacing. It measures; it does not tune (no balance changes until the Stone Age is complete).
//
// Run: npm run batch -- [--games 5] [--civs 5] [--map inlandSea|continents|singleLandmass|all]
//                       [--room veryCrowded|crowded|standard|spacious] [--turns 60] [--every 10]
//                       [--final stone|bronze|…|modern] [--json out.json] [--logs dir]
//
// A game stops early when its endgame countdown runs out (design doc §15).

import fs from 'node:fs';
import path from 'node:path';
import { content as bundle } from '../src/content';
import {
  aiCommands,
  BUREAUCRACY,
  hooks,
  knowledgePoints,
  scoreOf,
  settlementPoints,
  loadContent,
  looseTokens,
  MAP_TYPES,
  manpower,
  startSession,
  submit,
  toJsonLines,
  type EraId,
  type GameEvent,
  type MapType,
  type RoomToExpand,
  type Session,
} from '../src/engine';

interface Options {
  games: number;
  civs: number;
  maps: MapType[];
  room: RoomToExpand;
  turns: number;
  every: number;
  final: EraId;
  json: string | null;
  logs: string | null;
}

function parseArgs(argv: string[]): Options {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const map = get('map') ?? 'inlandSea';
  return {
    games: Number(get('games') ?? 5),
    civs: Number(get('civs') ?? 5),
    maps: map === 'all' ? [...MAP_TYPES] : [map as MapType],
    room: (get('room') ?? 'standard') as RoomToExpand,
    turns: Number(get('turns') ?? 60),
    every: Number(get('every') ?? 10),
    final: (get('final') ?? 'modern') as EraId,
    json: get('json') ?? null,
    logs: get('logs') ?? null,
  };
}

// One civilization at one sampled turn.
interface Sample {
  game: string;
  turn: number;
  civ: string;
  tokens: number;
  villages: number;
  towns: number;
  manpower: number;
  bureaucracy: number;
  instability: number;
  treasury: number;
  knowledge: number;
  settlementPoints: number;
  score: number;
}

// Counts of notable events over a whole game.
interface Totals {
  game: string;
  built: number;
  collapses: number;
  supportDrops: number;
  captures: number;
  fights: number;
  // Goods bought on the market.
  bought: number;
  // Calamities suffered, and bought off.
  calamities: number;
  averted: number;
  // First turn any civilization's loose tokens reached its cap.
  firstAtCap: number | null;
  // Turns civilizations entered a new era, in order; the countdown's start and the game's end.
  eraTurns: number[];
  countdown: number | null;
  ended: number | null;
  winnerScore: number | null;
  // Wonders started, turns stalled, turns each was completed, and races lost (design doc §9).
  wondersStarted: number;
  wonderStalls: number;
  wondersDone: number[];
  outbuilt: number;
}

function sample(session: Session, game: string): Sample[] {
  const { state } = session;
  return state.players.map((p) => {
    const own = state.settlements.filter((s) => s.player === p.id);
    return {
      game,
      turn: state.turn,
      civ: p.id,
      tokens: looseTokens(state, p.id),
      villages: own.filter((s) => s.tier === 'village').length,
      towns: own.filter((s) => s.tier === 'town').length,
      manpower: own.reduce((sum, s) => sum + manpower(state, s), 0),
      bureaucracy: own.reduce((sum, s) => sum + ((s.work ?? []).find((w) => w.resource === BUREAUCRACY)?.count ?? 0), 0),
      instability: p.instability,
      treasury: p.treasury,
      knowledge: knowledgePoints(state, session.content, p.id),
      settlementPoints: settlementPoints(state, p.id),
      score: scoreOf(state, session.content, p.id).total,
    };
  });
}

function count(totals: Totals, event: GameEvent, step: string, turn: number): void {
  if (event.type === 'eraEntered') totals.eraTurns.push(turn);
  if (event.type === 'endgameBegan') totals.countdown = turn;
  if (event.type === 'gameEnded') {
    totals.ended = turn;
    totals.winnerScore = event.scores[0]?.total ?? null;
  }
  if (event.type === 'settlementBuilt') totals.built += 1;
  if (event.type === 'settlementCollapsed') totals.collapses += 1;
  if (event.type === 'settlementDropped' && step === 'support') totals.supportDrops += 1;
  if (event.type === 'settlementAttacked' && event.capturedBy) totals.captures += 1;
  if (event.type === 'conflict' || event.type === 'settlementAttacked') totals.fights += 1;
  if (event.type === 'marketTrade' && event.side === 'buy') totals.bought += event.count;
  if (event.type === 'wonderStarted') totals.wondersStarted += 1;
  if (event.type === 'wonderStalled') totals.wonderStalls += 1;
  if (event.type === 'wonderCompleted') totals.wondersDone.push(turn);
  if (event.type === 'wonderOutbuilt') totals.outbuilt += 1;
  if (event.type === 'calamity') {
    if (event.averted) totals.averted += 1;
    else totals.calamities += 1;
  }
}

function playGame(options: Options, seed: number, map: MapType): { samples: Sample[]; totals: Totals; session: Session } {
  const loaded = loadContent(bundle, hooks);
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const players = Array.from({ length: options.civs }, (_, i) => ({ id: `c${i + 1}`, name: `Civ ${i + 1}`, kind: 'ai' as const }));
  const session = startSession({ seed, players, finalEra: options.final, map: { type: map, room: options.room } }, loaded.content);
  const game = `${map}/${seed}`;
  const samples: Sample[] = [];
  const totals: Totals = { game, built: 0, collapses: 0, supportDrops: 0, captures: 0, fights: 0, bought: 0, calamities: 0, averted: 0, firstAtCap: null, eraTurns: [], countdown: null, ended: null, winnerScore: null, wondersStarted: 0, wonderStalls: 0, wondersDone: [], outbuilt: 0 };
  let step = '';
  while (session.state.turn <= options.turns && !session.state.over) {
    const turn = session.state.turn;
    for (const p of session.state.players) {
      for (const command of aiCommands(session.state, session.content, p.id)) {
        const result = submit(session, command);
        if (!result.ok) throw new Error(`${game} turn ${turn}: AI command rejected: ${result.reason}`);
        for (const { event } of result.events) count(totals, event, 'allocation', turn);
      }
      const result = submit(session, { type: 'endPhase', player: p.id });
      if (!result.ok) throw new Error(`${game} turn ${turn}: ${result.reason}`);
      for (const { event } of result.events) {
        if (event.type === 'resolutionStep') step = event.step;
        count(totals, event, step, turn);
      }
    }
    if (session.state.turn > turn) {
      const { state } = session;
      if (totals.firstAtCap === null && state.players.some((p) => looseTokens(state, p.id) >= p.tokenCap)) totals.firstAtCap = state.turn;
      if (state.turn % options.every === 0 && state.turn <= options.turns) samples.push(...sample(session, game));
    }
  }
  return { samples, totals, session };
}

const opt = (n: number | null) => (n === null ? '—' : String(n));

function stats(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return `${median} (${sorted[0] ?? 0}–${sorted[sorted.length - 1] ?? 0})`;
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i]!)).join(' | ')} |`;
  return [line(headers), `|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`, ...rows.map(line)].join('\n');
}

const options = parseArgs(process.argv.slice(2));
const samples: Sample[] = [];
const totals: Totals[] = [];
const started = Date.now();
for (const map of options.maps) {
  for (let seed = 1; seed <= options.games; seed++) {
    const result = playGame(options, seed, map);
    samples.push(...result.samples);
    totals.push(result.totals);
    if (options.logs) {
      fs.mkdirSync(options.logs, { recursive: true });
      fs.writeFileSync(path.join(options.logs, `${map}-${seed}.jsonl`), toJsonLines(result.session.log));
    }
  }
}

console.log(`${totals.length} games · ${options.civs} civilizations · ${options.maps.join(', ')} · ${options.room} · ${options.turns} turns · final era ${options.final} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log('Per civilization at each sampled turn: median (min–max) across all games and civilizations.\n');
const turns = [...new Set(samples.map((s) => s.turn))].sort((a, b) => a - b);
console.log(
  table(
    ['Turn', 'Loose tokens', 'Villages', 'Towns', 'Manpower', 'Bureaucracy', 'Civ-wide instability', 'Treasury', 'Knowledge pts', 'Settlement pts', 'Score'],
    turns.map((t) => {
      const at = samples.filter((s) => s.turn === t);
      const col = (f: (s: Sample) => number) => stats(at.map(f));
      return [String(t), col((s) => s.tokens), col((s) => s.villages), col((s) => s.towns), col((s) => s.manpower), col((s) => s.bureaucracy), col((s) => s.instability), col((s) => s.treasury), col((s) => s.knowledge), col((s) => s.settlementPoints), col((s) => s.score)];
    }),
  ),
);
console.log('\nPer game: settlements built, collapses, support drops, captures, fights, goods bought on the market, calamities suffered and bought off, first turn a civilization reached its token cap, turns civilizations entered a new era (first and median), the turn the endgame countdown began and the game ended, the winning score, and wonders: started, turns stalled, completed (first and last turn), races lost.\n');
console.log(
  table(
    ['Game', 'Built', 'Collapses', 'Support drops', 'Captures', 'Fights', 'Bought', 'Calamities', 'Bought off', 'First at cap', 'New era', 'Countdown', 'Ended', 'Winner', 'Wonders', 'Stalls', 'Done', 'Lost'],
    totals.map((t) => [t.game, String(t.built), String(t.collapses), String(t.supportDrops), String(t.captures), String(t.fights), String(t.bought), String(t.calamities), String(t.averted), t.firstAtCap === null ? '—' : String(t.firstAtCap), t.eraTurns.length === 0 ? '—' : `${t.eraTurns[0]} / ${t.eraTurns[Math.floor(t.eraTurns.length / 2)]} (${t.eraTurns.length})`, opt(t.countdown), opt(t.ended), opt(t.winnerScore), String(t.wondersStarted), String(t.wonderStalls), t.wondersDone.length === 0 ? '0' : `${t.wondersDone.length} (${t.wondersDone[0]}–${t.wondersDone[t.wondersDone.length - 1]})`, String(t.outbuilt)]),
  ),
);
if (options.json) fs.writeFileSync(options.json, JSON.stringify({ options, samples, totals }, null, 2));
