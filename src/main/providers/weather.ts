import { t } from '../i18n';
import { describeNetworkError, privacyFetch } from '../net';
import type { SearchResult } from '../../shared/types';

const TIMEOUT_MS = 3_000;
const MAX_BYTES = 200_000;
const MAX_CITY_LENGTH = 64;

/**
 * Per-city cache. The search box queries incrementally, so without a cache
 * typing "Budapest" would send a request for every prefix — handing the
 * endpoint a keystroke-level view of what the user is typing. Combined with
 * the longer debounce in the renderer, this keeps it to roughly one request
 * per city per 10 minutes.
 */
const CACHE_TTL_MS = 600_000;
const MAX_CACHE_ENTRIES = 20;

interface CachedWeather {
  at: number;
  result: SearchResult | null;
}

const cache = new Map<string, CachedWeather>();

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  weatherDesc: { value: string }[];
}

interface WttrResponse {
  current_condition?: WttrCurrentCondition[];
}

function readCache(key: string): CachedWeather | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, result: SearchResult | null): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), result });
}

/**
 * Fetches current weather for the city. Returns `null` on any failure so the
 * caller can fall back to other search strategies.
 *
 * Only the city name leaves the machine — the request carries no coordinates,
 * no referrer and no identifying User-Agent (see `net.ts`). The endpoint does
 * of course see the IP address; that is unavoidable for any remote lookup and
 * is why the whole provider can be switched off in Privacy settings.
 */
export async function fetchWeather(city: string): Promise<SearchResult | null> {
  const trimmed = city.trim().slice(0, MAX_CITY_LENGTH);
  if (!trimmed) return null;

  const key = trimmed.toLowerCase();
  const cached = readCache(key);
  if (cached) return cached.result;

  try {
    const res = await privacyFetch(
      `https://wttr.in/${encodeURIComponent(trimmed)}?format=j1`,
      { purpose: 'weather lookup', timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES }
    );
    if (!res.ok) {
      // Cache the miss too: an unknown city typed once should not be retried
      // on every keystroke that follows.
      writeCache(key, null);
      return null;
    }

    const data = JSON.parse(res.text) as WttrResponse;
    const current = data?.current_condition?.[0];
    if (!current) {
      writeCache(key, null);
      return null;
    }

    const display = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    const result: SearchResult = {
      type: 'weather',
      name: display,
      tempText: `${current.temp_C}°C`,
      condition: current.weatherDesc[0]?.value ?? '',
      feelsLike: `${current.FeelsLikeC}°C`,
      humidity: `${current.humidity}%`,
      description: `${t('weatherTemp')}: ${current.temp_C}°C | ${t('weatherFeels')}: ${current.FeelsLikeC}°C | ${t('weatherHumidity')}: ${current.humidity}%`,
    };
    writeCache(key, result);
    return result;
  } catch (error) {
    console.error(describeNetworkError('weather lookup', error));
    return null;
  }
}
