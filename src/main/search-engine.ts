import { clipboard } from 'electron';
import { getConfig } from './config';
import { t } from './i18n';
import { safeEvaluateMath } from './safe-math';
import { searchApplications } from './providers/applications';
import { searchFiles } from './providers/files';
import { searchBookmarks } from './providers/bookmarks';
import { fetchWeather } from './providers/weather';
import { fetchExchangeRates } from './providers/exchange-rates';
import type { SearchResult, SafeCommandId } from '../shared/types';

interface ClipboardEntry {
  text: string;
  time: string;
}

/** In-memory clipboard history populated by `clipboard-monitor.ts`. */
const clipboardHistory: ClipboardEntry[] = [];

export function recordClipboardEntry(text: string): void {
  if (!text || clipboardHistory.some((item) => item.text === text)) return;
  clipboardHistory.unshift({ text, time: new Date().toISOString() });
  if (clipboardHistory.length > 20) clipboardHistory.pop();
}

export function pollClipboard(): void {
  recordClipboardEntry(clipboard.readText());
}

export function getClipboardHistory(): ClipboardEntry[] {
  return clipboardHistory;
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

  // Currency
  const rates = await fetchExchangeRates();
  if (rates && rates[from.toUpperCase()] && rates[to.toUpperCase()]) {
    const usd = amount / rates[from.toUpperCase()];
    const final = usd * rates[to.toUpperCase()];
    const locale = getConfig().language === 'en' ? 'en-US' : 'hu-HU';
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

export async function search(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const config = getConfig();

  // Weather first — exclusive result if a hit
  const weatherMatch = query.match(/^(?:időjárás|weather)\s+(.+)$/i);
  if (weatherMatch) {
    const city = weatherMatch[1].trim();
    const weather = await fetchWeather(city);
    if (weather) return [weather];
  }

  const qLower = query.toLowerCase();

  // Aliases
  if (config.aliases && config.aliases[qLower]) {
    const commands = config.aliases[qLower];
    results.push({
      type: 'alias',
      name: `${t('alias')}: ${qLower}`,
      commands,
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
      results.push({
        type: 'web',
        name: `${t('webSearch')}: ${webQuery}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(webQuery)}`,
        description: t('webSearchEngine'),
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
  else if (config.search.enableCalculator && /^[\d+\-*/().\s%]+$/.test(query)) {
    try {
      const result = safeEvaluateMath(query);
      if (result !== null && isFinite(result)) {
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
    return clipboardHistory.map<SearchResult>((item) => ({
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
