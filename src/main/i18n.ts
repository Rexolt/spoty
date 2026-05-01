import { getConfig } from './config';
import type { Language } from '../shared/types';

type LabelKey =
  | 'bookmark'
  | 'file'
  | 'inFolder'
  | 'weatherTemp'
  | 'weatherFeels'
  | 'weatherHumidity'
  | 'alias'
  | 'aliasMulti'
  | 'aliasItems'
  | 'run'
  | 'terminalCommand'
  | 'webSearch'
  | 'webSearchEngine'
  | 'sysCommand'
  | 'calcResult'
  | 'clipboardItem'
  | 'unitConverter'
  | 'tempConverter'
  | 'currencyConverter'
  | 'lockScreen'
  | 'sleep'
  | 'shutdown'
  | 'restart';

const labels: Record<Language, Record<LabelKey, string>> = {
  hu: {
    bookmark: 'Könyvjelző',
    file: 'Fájl',
    inFolder: 'mappában',
    weatherTemp: 'Hőmérséklet',
    weatherFeels: 'Érzet',
    weatherHumidity: 'Páratartalom',
    alias: 'Gyorsparancs',
    aliasMulti: 'Több művelet futtatása',
    aliasItems: 'elem',
    run: 'Futtatás',
    terminalCommand: 'Terminal parancs',
    webSearch: 'Keresés a weben',
    webSearchEngine: 'Web keresés (Google)',
    sysCommand: 'Rendszer parancs',
    calcResult: 'Számítás eredménye',
    clipboardItem: 'Vágólap elem',
    unitConverter: 'Mértékegység konverter',
    tempConverter: 'Hőmérséklet konverter',
    currencyConverter: 'Valutaváltó',
    lockScreen: 'Képernyő zárolása',
    sleep: 'Alvó mód',
    shutdown: 'Leállítás',
    restart: 'Újraindítás',
  },
  en: {
    bookmark: 'Bookmark',
    file: 'File',
    inFolder: 'folder',
    weatherTemp: 'Temperature',
    weatherFeels: 'Feels like',
    weatherHumidity: 'Humidity',
    alias: 'Shortcut',
    aliasMulti: 'Run multiple actions',
    aliasItems: 'items',
    run: 'Run',
    terminalCommand: 'Terminal command',
    webSearch: 'Search the web',
    webSearchEngine: 'Web search (Google)',
    sysCommand: 'System command',
    calcResult: 'Calculation result',
    clipboardItem: 'Clipboard item',
    unitConverter: 'Unit converter',
    tempConverter: 'Temperature converter',
    currencyConverter: 'Currency converter',
    lockScreen: 'Lock Screen',
    sleep: 'Sleep',
    shutdown: 'Shutdown',
    restart: 'Restart',
  },
};

export function t(key: LabelKey): string {
  const lang = getConfig().language || 'hu';
  return (labels[lang] || labels.hu)[key] ?? key;
}
