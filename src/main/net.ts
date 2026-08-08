/**
 * Single choke point for every outbound request Spoty makes.
 *
 * Nothing in the app is allowed to call `fetch` directly: routing all
 * traffic through here means the privacy guarantees are enforced in one
 * auditable place rather than re-implemented per provider.
 *
 * Guarantees:
 *   - Offline mode is a hard block in the main process, not a UI hint.
 *   - Only the fixed set of hosts below can ever be contacted; a tampered
 *     config file cannot repoint a provider at an attacker's server.
 *   - Redirects are refused outright (a redirect is the classic way to move
 *     an Authorization header or an API key onto a third-party host).
 *   - No cookies, no referrer, no `Accept-Language` — nothing that would
 *     let an endpoint correlate requests or fingerprint the machine.
 *   - Responses are size-capped so a hostile/broken endpoint cannot exhaust
 *     memory.
 *   - Log lines carry the host and purpose only, never the URL: query
 *     strings can contain API keys and search terms.
 */

import { getConfig } from './config';

/** Hosts Spoty is ever permitted to talk to, with what they are used for. */
const ALLOWED_HOSTS = new Map<string, string>([
  ['api.openai.com', 'OpenAI chat completions'],
  ['generativelanguage.googleapis.com', 'Google Gemini'],
  ['wttr.in', 'weather lookup'],
  ['open.er-api.com', 'currency exchange rates'],
]);

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const DEFAULT_MAX_BYTES = 1_000_000;

/** Thrown when a request is refused locally; never wraps a network error. */
export class NetworkBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkBlockedError';
  }
}

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

export interface PrivacyFetchOptions {
  /** Short human-readable purpose, used for log lines and error messages. */
  purpose: string;
  timeoutMs: number;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  /**
   * When true the target must be a loopback address. Used by the Ollama
   * provider, which is the only integration that stays on the machine and
   * is therefore also the only one allowed while offline mode is on.
   */
  loopbackOnly?: boolean;
}

export interface PrivacyFetchResult {
  ok: boolean;
  status: number;
  text: string;
}

function assertAllowed(target: URL, opts: PrivacyFetchOptions): void {
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new NetworkBlockedError(`Blocked non-HTTP request (${opts.purpose}).`);
  }

  const loopback = isLoopbackHost(target.hostname);

  // Plaintext HTTP is only tolerable on loopback, where there is no network
  // path to intercept.
  if (target.protocol === 'http:' && !loopback) {
    throw new NetworkBlockedError(
      `Blocked plaintext HTTP request to ${target.hostname} (${opts.purpose}).`
    );
  }

  if (opts.loopbackOnly && !loopback) {
    throw new NetworkBlockedError(
      `Blocked non-loopback request to ${target.hostname} (${opts.purpose}).`
    );
  }

  if (!loopback && !ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    throw new NetworkBlockedError(
      `Blocked request to unexpected host ${target.hostname} (${opts.purpose}).`
    );
  }

  // Credentials embedded in the URL would be written to logs and proxies.
  if (target.username || target.password) {
    throw new NetworkBlockedError(
      `Blocked request carrying inline credentials (${opts.purpose}).`
    );
  }

  if (getConfig().privacy.offlineMode && !loopback) {
    throw new NetworkBlockedError(
      `Offline mode is on — ${opts.purpose} was not sent.`
    );
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Response exceeded ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    // Releasing the lock lets the underlying socket be torn down promptly
    // when we bailed out on the size cap.
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Performs a request under the guarantees documented at the top of this
 * file. Returns the body as text; callers do their own JSON parsing so a
 * malformed payload surfaces as their own error message.
 */
export async function privacyFetch(
  url: string,
  opts: PrivacyFetchOptions
): Promise<PrivacyFetchResult> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new NetworkBlockedError(`Invalid URL (${opts.purpose}).`);
  }

  assertAllowed(target, opts);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    // A fixed, contentless User-Agent. Sending the Electron/Chrome build
    // string would hand every endpoint a version fingerprint.
    'User-Agent': 'Spoty',
    ...(opts.headers ?? {}),
  };

  const response = await fetch(target, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body,
    // A redirect is the standard trick for smuggling an Authorization
    // header to another origin, so treat one as a hard failure.
    redirect: 'error',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  const text = await readCapped(response, opts.maxBytes ?? DEFAULT_MAX_BYTES);
  return { ok: response.ok, status: response.status, text };
}

/**
 * Formats an error for logging without leaking the request URL (which may
 * carry an API key) or the response body.
 */
export function describeNetworkError(purpose: string, error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  const message = error instanceof Error ? error.message : 'unknown failure';
  return `[net] ${purpose} failed (${name}): ${message}`;
}
