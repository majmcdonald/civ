import { saveGame, type Session } from '../engine';

// Save slots in browser storage, plus export and import as files (development plan: save/load).
// The autosave is one slot, rewritten at the end of every turn. Storage can be unavailable or
// full; writes report failure and reads fall back to no saves.

export interface SaveSlot {
  id: string;
  name: string;
  turn: number;
  players: number;
  savedAt: number;
  autosave: boolean;
}

const INDEX_KEY = 'succession.saves';
const slotKey = (id: string) => `succession.save.${id}`;
export const AUTOSAVE_ID = 'autosave';

export function listSaves(): SaveSlot[] {
  try {
    const slots = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as SaveSlot[];
    return slots.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function writeIndex(slots: SaveSlot[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(slots));
}

// Writes a slot; returns an error message, or null on success.
export function writeSave(session: Session, name: string, id: string = newId()): string | null {
  const slot: SaveSlot = { id, name, turn: session.state.turn, players: session.state.players.length, savedAt: Date.now(), autosave: id === AUTOSAVE_ID };
  try {
    localStorage.setItem(slotKey(id), saveGame(session));
    writeIndex([...listSaves().filter((s) => s.id !== id), slot]);
    return null;
  } catch {
    return 'Unable to save: browser storage is unavailable or full. Export to a file instead.';
  }
}

export function readSave(id: string): string | null {
  try {
    return localStorage.getItem(slotKey(id));
  } catch {
    return null;
  }
}

export function deleteSave(id: string): void {
  try {
    localStorage.removeItem(slotKey(id));
    writeIndex(listSaves().filter((s) => s.id !== id));
  } catch {
    // Nothing to delete when storage is unavailable.
  }
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function fileName(name: string, turn: number): string {
  const safe = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'game';
  return `succession-${safe}-turn-${turn}.json`;
}

export function downloadSave(json: string, name: string, turn: number): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(name, turn);
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The name for an imported file: its file name without the extension.
export function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, '').replace(/^succession-/, '') || 'Imported game';
}
