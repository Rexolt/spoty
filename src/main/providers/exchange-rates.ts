const CACHE_TTL_MS = 3_600_000; // 1 hour
const TIMEOUT_MS = 5_000;
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

let rates: Record<string, number> | null = null;
let ratesTime = 0;

interface ExchangeApiResponse {
  rates?: Record<string, number>;
}

export async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  const now = Date.now();
  if (rates && now - ratesTime < CACHE_TTL_MS) {
    return rates;
  }
  try {
    const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const data = (await res.json()) as ExchangeApiResponse;
    if (data && data.rates) {
      rates = data.rates;
      ratesTime = now;
    }
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
  }
  return rates;
}
