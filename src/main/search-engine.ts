import { getConfig } from './config';
import { t } from './i18n';
import { safeEvaluateMath } from './safe-math';
import { searchApplications } from './providers/applications';
import { searchFiles } from './providers/files';
import { searchBookmarks } from './providers/bookmarks';
import { fetchWeather } from './providers/weather';
import { fetchExchangeRates } from './providers/exchange-rates';
import type { SearchResult, SafeCommandId, WebSearchEngine } from '../shared/types';

interface ClipboardEntry {
  text: string;
  time: string;
  /** Capture time in epoch millis, used to expire the entry. */
  at: number;
}

/**
 * In-memory clipboard history populated by `clipboard-monitor.ts`. Never
 * written to disk: copied secrets should not outlive the process, let alone
 * end up in a backup.
 */
const clipboardHistory: ClipboardEntry[] = [];

const MAX_CLIPBOARD_TEXT_LENGTH = 50_000;
const MAX_CLIPBOARD_ENTRIES = 20;

/** Drops entries older than the configured retention window. */
function pruneClipboardHistory(): void {
  const retentionMs = getConfig().privacy.clipboardRetentionMinutes * 60_000;
  const cutoff = Date.now() - retentionMs;
  for (let i = clipboardHistory.length - 1; i >= 0; i--) {
    if (clipboardHistory[i].at < cutoff) clipboardHistory.splice(i, 1);
  }
}

export function recordClipboardEntry(text: string): void {
  const config = getConfig();
  if (!text) return;

  pruneClipboardHistory();
  if (clipboardHistory.some((item) => item.text === text)) return;

  let entryText = text;
  if (
    config.search.limitClipboardText &&
    entryText.length > MAX_CLIPBOARD_TEXT_LENGTH
  ) {
    entryText = entryText.substring(0, MAX_CLIPBOARD_TEXT_LENGTH) + '...';
  }

  clipboardHistory.unshift({
    text: entryText,
    time: new Date().toISOString(),
    at: Date.now(),
  });
  if (clipboardHistory.length > MAX_CLIPBOARD_ENTRIES) clipboardHistory.pop();
}

export function getClipboardHistory(): ClipboardEntry[] {
  pruneClipboardHistory();
  return clipboardHistory;
}

/** Forgets everything collected so far (module disabled, or user request). */
export function clearClipboardHistory(): void {
  clipboardHistory.length = 0;
}

const SYS_COMMANDS: Record<string, { id: SafeCommandId; label: () => string }> = {
  lock: { id: 'lock_screen', label: () => t('lockScreen') },
  zár: { id: 'lock_screen', label: () => t('lockScreen') },
  sleep: { id: 'sleep', label: () => t('sleep') },
  alvás: { id: 'sleep', label: () => t('sleep') },
  shutdown: { id: 'shutdown', label: () => t('shutdown') },
  leállítás: { id: 'shutdown', label: () => t('shutdown') },
  kikapcs: { id: 'shutdown', label: () => t('shutdown') },
  restart: { id: 'restart', label: () => t('restart') },
  újraindítás: { id: 'restart', label: () => t('restart') },
};

const UNIT_CONVERSIONS: Record<string, number> = {
  mm: 0.001, cm: 0.01, m: 1, km: 1000,
  in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
  mg: 0.001, g: 1, kg: 1000, oz: 28.3495, lb: 453.592,
};

/**
 * Query templates for the supported engines. DuckDuckGo is the default: it
 * neither profiles searchers nor ties a query to an account.
 */
const WEB_SEARCH_URLS: Record<WebSearchEngine, string> = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  startpage: 'https://www.startpage.com/sp/search?query=',
  brave: 'https://search.brave.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
  google: 'https://www.google.com/search?q=',
};

const WEB_SEARCH_LABELS: Record<WebSearchEngine, string> = {
  duckduckgo: 'DuckDuckGo',
  startpage: 'Startpage',
  brave: 'Brave Search',
  ecosia: 'Ecosia',
  google: 'Google',
};

/** Currency codes are exactly three letters; anything else is not a currency. */
function looksLikeCurrencyCode(value: string): boolean {
  return /^[a-z]{3}$/i.test(value);
}

async function tryConverter(query: string): Promise<SearchResult | null> {
  const match = query.match(/^([\d.,]+)\s*([a-zA-Z]+)\s+(?:in|to|ba|be)\s+([a-zA-Z]+)$/i);
  if (!match) return null;

  const amount = parseFloat(match[1].replace(',', '.'));
  if (isNaN(amount)) return null;
  const from = match[2].toLowerCase();
  const to = match[3].toLowerCase();

  // Temperature
  if (from === 'c' && to === 'f') {
    const v = (amount * 9) / 5 + 32;
    return {
      type: 'calc',
      name: `${amount}°${from.toUpperCase()} = ${v.toFixed(2)}°${to.toUpperCase()}`,
      value: v.toString(),
      description: t('tempConverter'),
    };
  }
  if (from === 'f' && to === 'c') {
    const v = ((amount - 32) * 5) / 9;
    return {
      type: 'calc',
      name: `${amount}°${from.toUpperCase()} = ${v.toFixed(2)}°${to.toUpperCase()}`,
      value: v.toString(),
      description: t('tempConverter'),
    };
  }

  // Units
  if (UNIT_CONVERSIONS[from] && UNIT_CONVERSIONS[to]) {
    const v = (amount * UNIT_CONVERSIONS[from]) / UNIT_CONVERSIONS[to];
    return {
      type: 'calc',
      name: `${amount} ${from} = ${v.toFixed(4)} ${to}`,
      value: v.toString(),
      description: t('unitConverter'),
    };
  }

  // Currency. This is the only branch that needs the network, so it is
  // reached only for genuinely currency-shaped queries and only when the
  // user has left the module enabled — no rates are prefetched at startup.
  const config = getConfig();
  if (
    !config.privacy.enableCurrency ||
    config.privacy.offlineMode ||
    !looksLikeCurrencyCode(from) ||
    !looksLikeCurrencyCode(to)
  ) {
    return null;
  }

  const rates = await fetchExchangeRates();
  if (rates && rates[from.toUpperCase()] && rates[to.toUpperCase()]) {
    const usd = amount / rates[from.toUpperCase()];
    const final = usd * rates[to.toUpperCase()];
    const locale = config.language === 'en' ? 'en-US' : 'hu-HU';
    return {
      type: 'calc',
      name: `${amount} ${from.toUpperCase()} = ${final.toLocaleString(locale, {
        maximumFractionDigits: 2,
      })} ${to.toUpperCase()}`,
      value: final.toString(),
      description: t('currencyConverter'),
    };
  }

  return null;
}

/** Queries longer than this are pointless and only widen the input surface. */
const MAX_QUERY_LENGTH = 512;

export async function search(rawQuery: string): Promise<SearchResult[]> {
  if (typeof rawQuery !== 'string') return [];
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH);

  const results: SearchResult[] = [];
  const config = getConfig();

  // Weather first — exclusive result if a hit
  const weatherMatch = query.match(/^(?:időjárás|weather)\s+(.+)$/i);
  if (weatherMatch && config.privacy.enableWeather && !config.privacy.offlineMode) {
    const city = weatherMatch[1].trim();
    const weather = await fetchWeather(city);
    if (weather) return [weather];
  }

  const qLower = query.toLowerCase();

  // Aliases. Only the key travels to the renderer; the main process resolves
  // it against its own config when the user runs it.
  if (config.aliases && Object.hasOwn(config.aliases, qLower)) {
    const commands = config.aliases[qLower];
    results.push({
      type: 'alias',
      name: `${t('alias')}: ${qLower}`,
      aliasKey: qLower,
      aliasCount: commands.length,
      description: `${t('aliasMulti')} (${commands.length} ${t('aliasItems')})`,
    });
  }

  // Web search
  if (
    config.search.enableWebSearch &&
    (query.startsWith('g ') || query.startsWith('? '))
  ) {
    const webQuery = query.substring(2).trim();
    if (webQuery) {
      const engine = config.search.webSearchEngine;
      results.push({
        type: 'web',
        name: `${t('webSearch')}: ${webQuery}`,
        url: `${WEB_SEARCH_URLS[engine]}${encodeURIComponent(webQuery)}`,
        description: `${t('webSearchEngine')} (${WEB_SEARCH_LABELS[engine]})`,
      });
    }
  }
  // System commands
  else if (config.search.enableSysCommands && SYS_COMMANDS[qLower]) {
    const cmd = SYS_COMMANDS[qLower];
    results.push({
      type: 'syscommand',
      name: cmd.label(),
      action: { type: 'syscommand', id: cmd.id },
      description: `${t('sysCommand')} (${qLower})`,
    });
  }
  // Calculator
  else if (config.search.enableCalculator && /^[\d+\-*/().\s%^eE]+$/.test(query)) {
    try {
      const rawResult = safeEvaluateMath(query);
      if (rawResult !== null && isFinite(rawResult)) {
        // Fix precision issues (e.g. 0.1 + 0.2) by rounding to a high but reasonable decimal count.
        const result = Number(rawResult.toFixed(10));
        results.push({
          type: 'calc',
          name: `= ${result}`,
          value: result.toString(),
          description: t('calcResult'),
        });
      }
    } catch {
      // ignore
    }
  }
  // Clipboard history
  else if (config.search.enableClipboard && qLower === 'clip') {
    return getClipboardHistory().map<SearchResult>((item) => ({
      type: 'clipboard',
      name: item.text.substring(0, 50),
      value: item.text,
      description: t('clipboardItem'),
    }));
  }
  // Converters and fallback search
  else {
    const converted = await tryConverter(query);
    if (converted) results.push(converted);

    if (results.length === 0 && query.length > 0) {
      const [apps, files, bookmarks] = await Promise.all([
        searchApplications(query),
        searchFiles(query),
        searchBookmarks(query),
      ]);
      results.push(...apps.slice(0, 5));
      results.push(...bookmarks.slice(0, 3));
      results.push(...files.slice(0, 3));
    }
  }

  return results.slice(0, config.search.maxResults);
}
