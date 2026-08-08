import type { Language } from '../shared/types';

export type DictKey =
  | 'tab_search'
  | 'tab_ai'
  | 'search_placeholder'
  | 'ai_placeholder'
  | 'footer_open'
  | 'footer_folder'
  | 'footer_nav'
  | 'footer_close'
  | 'settings_title'
  | 'settings_general'
  | 'settings_lang'
  | 'settings_theme'
  | 'theme_dark'
  | 'theme_light'
  | 'theme_ocean'
  | 'theme_forest'
  | 'theme_midnight'
  | 'settings_hotkey'
  | 'settings_autolaunch'
  | 'settings_modules'
  | 'settings_files'
  | 'settings_bookmarks'
  | 'settings_web'
  | 'settings_sys'
  | 'settings_calc'
  | 'settings_clip'
  | 'settings_limit_clip'
  | 'settings_max'
  | 'settings_aliases'
  | 'settings_aliases_hint'
  | 'settings_ai'
  | 'settings_provider'
  | 'settings_openai_key'
  | 'settings_gemini_key'
  | 'settings_ollama_url'
  | 'settings_model'
  | 'settings_save'
  | 'no_results'
  | 'type_app'
  | 'type_command'
  | 'type_syscommand'
  | 'type_alias'
  | 'type_weather'
  | 'type_web'
  | 'type_calc'
  | 'type_clipboard'
  | 'type_file'
  | 'type_default'
  | 'copy'
  | 'copied'
  | 'ai_error'
  | 'settings_ai_history'
  | 'settings_ai_context'
  | 'ai_history_title'
  | 'ai_history_empty'
  | 'ai_history_delete'
  | 'ai_history_delete_all'
  | 'ai_history_back'
  | 'ai_new_chat'
  | 'ai_context_on'
  | 'ai_context_hint'
  | 'settings_aliases_tab'
  | 'settings_search_tab'
  | 'settings_modules_tab'
  | 'settings_nav_tabs'
  | 'settings_search_engine'
  | 'settings_privacy_tab'
  | 'settings_privacy_hint'
  | 'settings_offline'
  | 'settings_weather_net'
  | 'settings_currency_net'
  | 'settings_clip_sensitive'
  | 'settings_clip_retention'
  | 'settings_clip_clear'
  | 'settings_clip_cleared'
  | 'settings_key_clear'
  | 'settings_key_saved'
  | 'settings_key_none'
  | 'settings_key_cleared'
  | 'settings_ai_cloud_hint'
  | 'settings_secrets_encrypted'
  | 'settings_secrets_plain';

type Dictionary = Record<DictKey, string>;

const dictionaries: Record<Language, Dictionary> = {
  hu: {
    tab_search: 'Keresés',
    tab_ai: 'AI Mód',
    search_placeholder: 'Keresés alkalmazások, fájlok, parancsok között...',
    ai_placeholder: 'Kérdezz bármit az AI-tól...',
    footer_open: 'Megnyitás',
    footer_folder: 'Mappa',
    footer_nav: 'Navigáció',
    footer_close: 'Bezárás',
    settings_title: 'Beállítások',
    settings_general: 'Általános',
    settings_lang: 'Nyelv',
    settings_theme: 'Téma',
    theme_dark: 'Sötét',
    theme_light: 'Világos',
    theme_ocean: 'Óceán',
    theme_forest: 'Erdő',
    theme_midnight: 'Éjfél (OLED)',
    settings_hotkey: 'Gyorsbillentyű',
    settings_autolaunch: 'Indítás a rendszerrel',
    settings_modules: 'Keresés & Modulok',
    settings_files: 'Fájlok keresése',
    settings_bookmarks: 'Könyvjelzők keresése',
    settings_web: 'Webes Keresés (g vagy ?)',
    settings_sys: 'Rendszer Parancsok (lock, sleep...)',
    settings_calc: 'Számológép',
    settings_clip: 'Vágólap (clip)',
    settings_limit_clip: 'Vágólap szövegének korlátozása (50k karakter)',
    settings_max: 'Max találatok száma',
    settings_aliases: 'Egyedi Gyorsparancsok (Aliasok)',
    settings_aliases_hint: 'Használj JSON formátumot a parancsokhoz.',
    settings_ai: 'AI Mód',
    settings_provider: 'Szolgáltató',
    settings_openai_key: 'OpenAI API Kulcs',
    settings_gemini_key: 'Gemini API Kulcs',
    settings_ollama_url: 'Ollama URL',
    settings_model: 'Modell',
    settings_save: 'Mentés',
    no_results: 'Nincs találat a következőre:',
    type_app: 'Alkalmazás',
    type_command: 'Parancs',
    type_syscommand: 'Rendszer Parancs',
    type_alias: 'Gyorsparancs (Alias)',
    type_weather: 'Időjárás',
    type_web: 'Web Keresés',
    type_calc: 'Kalkulátor',
    type_clipboard: 'Vágólap',
    type_file: 'Fájl',
    type_default: 'Találat',
    copy: 'Másolás',
    copied: 'Másolva!',
    ai_error: 'Hiba történt',
    settings_ai_history: 'Csevegési előzmények mentése',
    settings_ai_context: 'Kontextus megőrzése (csevegés)',
    ai_history_title: 'Korábbi beszélgetések',
    ai_history_empty: 'Még nincsenek mentett beszélgetések.',
    ai_history_delete: 'Törlés',
    ai_history_delete_all: 'Mindent töröl',
    ai_history_back: 'Vissza',
    ai_new_chat: 'Új beszélgetés',
    ai_context_on: 'Kontextus be',
    ai_context_hint: 'Az AI emlékszik a korábbi üzeneteidre ebben a munkamenetben',
    settings_aliases_tab: 'Aliasok',
    settings_search_tab: 'Keresés',
    settings_modules_tab: 'Modulok',
    settings_nav_tabs: 'Váltás',
    settings_search_engine: 'Keresőmotor',
    settings_privacy_tab: 'Adatvédelem',
    settings_privacy_hint:
      'A Spoty nem gyűjt telemetriát, és nem küld semmit magáról. Hálózatra csak az alábbi funkciók lépnek, akkor is csak amikor tényleg használod őket.',
    settings_offline: 'Offline mód (minden hálózati kérés tiltása)',
    settings_weather_net: 'Időjárás (wttr.in)',
    settings_currency_net: 'Valutaváltó (open.er-api.com)',
    settings_clip_sensitive: 'Jelszókezelőből másolt tartalom kihagyása',
    settings_clip_retention: 'Vágólap előzmények megőrzése (perc)',
    settings_clip_clear: 'Vágólap előzmények törlése',
    settings_clip_cleared: 'Vágólap előzmények törölve.',
    settings_key_clear: 'Mentett kulcs törlése',
    settings_key_saved: 'Mentett kulcs (nem jelenik meg) — új beírása felülírja.',
    settings_key_none: 'Nincs mentett kulcs.',
    settings_key_cleared: 'A kulcs törlődik mentéskor.',
    settings_ai_cloud_hint:
      'Az OpenAI és a Gemini felhős szolgáltatás: amit bekérdezel, elhagyja a gépet. Az Ollama helyben fut, semmit nem küld el.',
    settings_secrets_encrypted: 'Az API kulcsok a rendszer kulcstárában, titkosítva vannak tárolva.',
    settings_secrets_plain:
      'Nincs elérhető rendszer-kulcstár: a kulcsok titkosítás nélkül, csak 0600 fájljoggal védve tárolódnak.',
  },
  en: {
    tab_search: 'Search',
    tab_ai: 'AI Mode',
    search_placeholder: 'Search for apps, files, commands...',
    ai_placeholder: 'Ask the AI anything...',
    footer_open: 'Open',
    footer_folder: 'Folder',
    footer_nav: 'Navigation',
    footer_close: 'Close',
    settings_title: 'Settings',
    settings_general: 'General',
    settings_lang: 'Language',
    settings_theme: 'Theme',
    theme_dark: 'Dark',
    theme_light: 'Light',
    theme_ocean: 'Ocean',
    theme_forest: 'Forest',
    theme_midnight: 'Midnight (OLED)',
    settings_hotkey: 'Hotkey',
    settings_autolaunch: 'Start with system',
    settings_modules: 'Search & Modules',
    settings_files: 'Search Files',
    settings_bookmarks: 'Search Bookmarks',
    settings_web: 'Web Search (g or ?)',
    settings_sys: 'System Commands (lock, sleep...)',
    settings_calc: 'Calculator',
    settings_clip: 'Clipboard (clip)',
    settings_limit_clip: 'Limit clipboard text length (50k chars)',
    settings_max: 'Max results',
    settings_aliases: 'Custom Shortcuts (Aliases)',
    settings_aliases_hint: 'Use JSON format to define commands.',
    settings_ai: 'AI Mode',
    settings_provider: 'Provider',
    settings_openai_key: 'OpenAI API Key',
    settings_gemini_key: 'Gemini API Key',
    settings_ollama_url: 'Ollama URL',
    settings_model: 'Model',
    settings_save: 'Save',
    no_results: 'No results for:',
    type_app: 'Application',
    type_command: 'Command',
    type_syscommand: 'System Command',
    type_alias: 'Shortcut (Alias)',
    type_weather: 'Weather',
    type_web: 'Web Search',
    type_calc: 'Calculator',
    type_clipboard: 'Clipboard',
    type_file: 'File',
    type_default: 'Result',
    copy: 'Copy',
    copied: 'Copied!',
    ai_error: 'Error occurred',
    settings_ai_history: 'Save chat history',
    settings_ai_context: 'Keep context (conversation)',
    ai_history_title: 'Previous conversations',
    ai_history_empty: 'No saved conversations yet.',
    ai_history_delete: 'Delete',
    ai_history_delete_all: 'Delete all',
    ai_history_back: 'Back',
    ai_new_chat: 'New conversation',
    ai_context_on: 'Context on',
    ai_context_hint: 'The AI remembers your previous messages in this session',
    settings_aliases_tab: 'Aliases',
    settings_search_tab: 'Search',
    settings_modules_tab: 'Modules',
    settings_nav_tabs: 'Switch',
    settings_search_engine: 'Search engine',
    settings_privacy_tab: 'Privacy',
    settings_privacy_hint:
      'Spoty collects no telemetry and reports nothing about itself. Only the features below ever touch the network, and only when you actually use them.',
    settings_offline: 'Offline mode (block all network requests)',
    settings_weather_net: 'Weather (wttr.in)',
    settings_currency_net: 'Currency converter (open.er-api.com)',
    settings_clip_sensitive: 'Skip content copied from password managers',
    settings_clip_retention: 'Keep clipboard history for (minutes)',
    settings_clip_clear: 'Clear clipboard history',
    settings_clip_cleared: 'Clipboard history cleared.',
    settings_key_clear: 'Delete stored key',
    settings_key_saved: 'Key stored (never displayed) — typing a new one replaces it.',
    settings_key_none: 'No key stored.',
    settings_key_cleared: 'The key will be deleted when you save.',
    settings_ai_cloud_hint:
      'OpenAI and Gemini are cloud services: whatever you ask leaves this machine. Ollama runs locally and sends nothing.',
    settings_secrets_encrypted: 'API keys are encrypted at rest via the OS keychain.',
    settings_secrets_plain:
      'No OS keychain available: keys are stored unencrypted, protected only by 0600 file permissions.',
  },
};

export function getDict(lang?: string): Dictionary {
  return dictionaries[(lang as Language) || 'hu'] ?? dictionaries.hu;
}

export function translateUI(lang: Language, isAiMode: boolean, searchInput: HTMLInputElement): void {
  const dict = getDict(lang);

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as DictKey | null;
    if (key && dict[key]) el.textContent = dict[key];
  });

  document
    .querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')
    .forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder') as DictKey | null;
      if (key && dict[key]) el.placeholder = dict[key];
    });

  searchInput.placeholder = isAiMode ? dict.ai_placeholder : dict.search_placeholder;
}
