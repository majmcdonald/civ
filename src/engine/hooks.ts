import type { HookParams } from '../content/types';
import type { Context } from './types';

// Scripted hooks for rules that do not fit the effect library. Content references them by id.
export type Hook = (ctx: Context, params: HookParams) => void;
export type HookRegistry = Readonly<Record<string, Hook>>;

export const hooks: HookRegistry = {};
