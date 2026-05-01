import { t } from '../i18n';
import type { SearchResult } from '../../shared/types';

const TIMEOUT_MS = 3_000;

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  weatherDesc: { value: string }[];
}

interface WttrResponse {
  current_condition?: WttrCurrentCondition[];
}

/**
 * Fetches current weather for the city. Returns `null` on any failure so the
 * caller can fall back to other search strategies.
 */
export async function fetchWeather(city: string): Promise<SearchResult | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as WttrResponse;
    const current = data?.current_condition?.[0];
    if (!current) return null;

    const display = city.charAt(0).toUpperCase() + city.slice(1);
    return {
      type: 'weather',
      name: display,
      tempText: `${current.temp_C}°C`,
      condition: current.weatherDesc[0]?.value ?? '',
      feelsLike: `${current.FeelsLikeC}°C`,
      humidity: `${current.humidity}%`,
      description: `${t('weatherTemp')}: ${current.temp_C}°C | ${t('weatherFeels')}: ${current.FeelsLikeC}°C | ${t('weatherHumidity')}: ${current.humidity}%`,
    };
  } catch (e) {
    console.error('Weather fetch failed:', e);
    return null;
  }
}
