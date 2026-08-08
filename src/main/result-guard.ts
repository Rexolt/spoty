/**
 * Capability guard for the "open this" IPC channels.
 *
 * `app-launch`, `item-show-folder` and `url-open` used to accept any path or
 * URL the renderer sent. That makes renderer-side code execution equivalent
 * to arbitrary program execution: `send('app-launch', '/tmp/payload.desktop')`
 * would have been honoured.
 *
 * Instead, the main process remembers exactly which paths and URLs it handed
 * out in recent search results, and the IPC handlers only act on those. The
 * renderer can open what the user can see, and nothing else.
 */

const MAX_TRACKED_PATHS = 500;
const MAX_TRACKED_URLS = 500;

/**
 * Insertion-ordered sets act as a small LRU: results from a search several
 * queries ago fall out, so a stale reference cannot be replayed indefinitely.
 */
const allowedPaths = new Set<string>();
const allowedUrls = new Set<string>();

function remember(set: Set<string>, value: string, limit: number): void {
  // Re-inserting moves the entry to the end of the iteration order, keeping
  // the most recently offered results alive.
  set.delete(value);
  set.add(value);
  while (set.size > limit) {
    const oldest = set.values().next();
    if (oldest.done) break;
    set.delete(oldest.value);
  }
}

export function rememberPath(value: string): void {
  if (value) remember(allowedPaths, value, MAX_TRACKED_PATHS);
}

export function rememberUrl(value: string): void {
  if (value) remember(allowedUrls, value, MAX_TRACKED_URLS);
}

export function isAllowedPath(value: unknown): value is string {
  return typeof value === 'string' && allowedPaths.has(value);
}

export function isAllowedUrl(value: unknown): value is string {
  return typeof value === 'string' && allowedUrls.has(value);
}

/**
 * Records every openable target in a result set. Called from the `search` IPC
 * handler, i.e. at the single point where results become visible to the
 * renderer.
 */
export function rememberResultTargets(
  results: ReadonlyArray<{ path?: string; url?: string }>
): void {
  for (const result of results) {
    if (result.path) rememberPath(result.path);
    if (result.url) rememberUrl(result.url);
  }
}
