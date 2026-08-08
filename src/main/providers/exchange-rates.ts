import { describeNetworkError, privacyFetch } from '../net';

const CACHE_TTL_MS = 3_600_000; // 1 hour
const TIMEOUT_MS = 5_000;
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
const MAX_BYTES = 200_000;

let rates: Record<string, number> | null = null;
let ratesTime = 0;

interface ExchangeApiResponse {
  rates?: Record<string, number>;
}

/**
 * Fetches USD-based exchange rates, cached for an hour.
 *
 * Called lazily: only a currency-shaped conversion query triggers a request.
 * Earlier versions warmed this cache during startup, which meant every launch
 * of the app announced itself to a third-party API even for users who never
 * converted a currency.
 */
export async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  const now = Date.now();
  if (rates && now - ratesTime < CACHE_TTL_MS) {
    return rates;
  }
  try {
    const res = await privacyFetch(ENDPOINT, {
      purpose: 'exchange-rate lookup',
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
    });
    if (!res.ok) return rates;

    const data = JSON.parse(res.text) as ExchangeApiResponse;
    if (data && data.rates) {
      rates = data.rates;
      ratesTime = now;
    }
  } catch (error) {
    console.error(describeNetworkError('exchange-rate lookup', error));
  }
  return rates;
}
