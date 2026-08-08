/**
 * Shared, dependency-free validators used by both the config loader and the
 * `save-settings` validator.
 *
 * Both entry points are untrusted: the config file can be hand-edited (or
 * replaced by another process running as the user), and the settings payload
 * arrives over IPC from the renderer. Anything that reaches the config
 * object goes through the helpers here first.
 */

import type { AliasAction } from '../shared/types';

export const MAX_ALIAS_COUNT = 100;
export const MAX_ALIAS_KEY_LENGTH = 64;
export const MAX_ALIAS_VALUE_LENGTH = 512;
export const MAX_ALIAS_ACTIONS = 20;

/** Keys that must never be copied out of parsed JSON into a live object. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function pickInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function pickString(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return fallback;
  return trimmed;
}

/**
 * Accepts only `http:`/`https:` URLs without embedded credentials. Used for
 * every URL that Spoty would hand to `shell.openExternal`, which on all
 * three platforms will happily launch a helper application for exotic
 * schemes (`file:`, `smb:`, custom protocol handlers).
 */
export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

function sanitizeAliasAction(value: unknown): AliasAction | null {
  if (typeof value === 'string') {
    // Legacy string form: a bare URL, or a system-command identifier.
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return isSafeExternalUrl(value) ? { type: 'url', url: value.trim() } : null;
    }
    const id = value.trim();
    return id && id.length <= MAX_ALIAS_VALUE_LENGTH
      ? { type: 'syscommand', id }
      : null;
  }

  if (!isPlainObject(value)) return null;

  if (value.type === 'url') {
    return isSafeExternalUrl(value.url) ? { type: 'url', url: value.url.trim() } : null;
  }
  if (value.type === 'syscommand' && typeof value.id === 'string') {
    const id = value.id.trim();
    // The identifier is re-checked against the command allowlist at run
    // time; the length cap here just keeps the config file bounded.
    return id && id.length <= MAX_ALIAS_VALUE_LENGTH
      ? { type: 'syscommand', id }
      : null;
  }
  return null;
}

/**
 * Normalizes an arbitrary value into the alias map. Unknown shapes, unsafe
 * URLs and oversized entries are dropped silently rather than failing the
 * whole save — one bad alias should not block a settings change.
 */
export function sanitizeAliases(input: unknown): Record<string, AliasAction[]> {
  const out: Record<string, AliasAction[]> = Object.create(null);
  if (!isPlainObject(input)) return { ...out };

  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (count >= MAX_ALIAS_COUNT) break;
    if (FORBIDDEN_KEYS.has(rawKey)) continue;

    const key = rawKey.trim().toLowerCase();
    if (!key || key.length > MAX_ALIAS_KEY_LENGTH) continue;

    const rawActions = Array.isArray(rawValue) ? rawValue : [rawValue];
    const actions: AliasAction[] = [];
    for (const raw of rawActions.slice(0, MAX_ALIAS_ACTIONS)) {
      const action = sanitizeAliasAction(raw);
      if (action) actions.push(action);
    }
    if (actions.length === 0) continue;

    out[key] = actions;
    count++;
  }

  // Spread into a normal object so downstream `JSON.stringify` and property
  // access behave as expected (Object.create(null) has no prototype).
  return { ...out };
}
