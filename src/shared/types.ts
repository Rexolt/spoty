/**
 * Shared types used by both main and renderer processes.
 *
 * Almost everything here is type-only (erased at compile time). The one
 * exception is `KEEP_SECRET_SENTINEL`, which both sides must agree on
 * literally, so it lives here as a real runtime constant.
 */

export type AIProvider = 'openai' | 'gemini' | 'ollama';
export type Theme = 'dark' | 'light' | 'ocean' | 'forest' | 'midnight';
export type Language = 'hu' | 'en';

/**
 * Web search engines the user can pick from. The default is DuckDuckGo:
 * it does not profile users and does not require a query to be tied to an
 * account, so it is the privacy-preserving choice for a launcher that
 * forwards typed text to a third party.
 */
export type WebSearchEngine =
  | 'duckduckgo'
  | 'startpage'
  | 'brave'
  | 'ecosia'
  | 'google';

/**
 * Sentinel sent by the renderer on the `save-settings` channel in place of
 * an API key that the user did not touch. The renderer never receives the
 * real key (see `PublicConfig`), so it cannot echo it back — this marker
 * tells the main process to keep whatever is already stored.
 */
export const KEEP_SECRET_SENTINEL = '__SPOTY_KEEP__';

export type SafeCommandId = 'lock_screen' | 'sleep' | 'shutdown' | 'restart';

export interface SafeCommandAction {
  type: 'syscommand';
  id: SafeCommandId | string;
}

export type AliasAction =
  | { type: 'url'; url: string }
  | { type: 'syscommand'; id: string };

export interface AppConfigWindow {
  width: number;
  minHeight: number;
  maxHeight: number;
}

export interface AppConfigSearch {
  maxResults: number;
  enableFiles: boolean;
  enableBookmarks: boolean;
  enableWebSearch: boolean;
  webSearchEngine: WebSearchEngine;
  enableSysCommands: boolean;
  enableCalculator: boolean;
  enableClipboard: boolean;
  limitClipboardText: boolean;
}

/**
 * Everything that causes Spoty to either leave the machine or retain user
 * data lives here, so a user can audit the whole data-flow surface from a
 * single settings panel.
 */
export interface AppConfigPrivacy {
  /**
   * Hard kill-switch for outbound network traffic. When enabled, the only
   * connections Spoty will make are to a loopback Ollama instance; weather,
   * exchange rates, OpenAI and Gemini are all refused in the main process
   * (not merely hidden in the UI).
   */
  offlineMode: boolean;
  /** Allow the `weather <city>` provider to query wttr.in. */
  enableWeather: boolean;
  /** Allow the currency converter to fetch rates from open.er-api.com. */
  enableCurrency: boolean;
  /** Drop clipboard entries older than this (minutes, 1–1440). */
  clipboardRetentionMinutes: number;
  /**
   * Skip clipboard entries that the source application marked as
   * sensitive (password managers set a per-platform "concealed" flag).
   */
  clipboardIgnoreSensitive: boolean;
}

export interface AppConfigAI {
  provider: AIProvider;
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  saveHistory: boolean;
  useContext: boolean;
}

export interface AppConfig {
  window: AppConfigWindow;
  search: AppConfigSearch;
  ai: AppConfigAI;
  privacy: AppConfigPrivacy;
  aliases: Record<string, AliasAction[]>;
  theme: Theme;
  language: Language;
  hotkey: string;
  autoLaunch: boolean;
  /**
   * Set to true once the user has acknowledged the Wayland
   * hotkey-workaround dialog. Persisted so the notice is shown at most
   * once per install rather than on every launch. Always present after
   * `loadConfig()` — defaulted by the config loader for older files.
   */
  waylandNoticeDismissed: boolean;
}

/**
 * AI settings as they cross the IPC boundary. API keys are never handed to
 * the renderer: `openaiApiKey` / `geminiApiKey` are always empty strings in
 * this direction and the booleans only report *whether* a key is stored.
 */
export interface PublicConfigAI extends AppConfigAI {
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
}

/** The redacted view of the config that the renderer is allowed to see. */
export interface PublicConfig extends Omit<AppConfig, 'ai'> {
  ai: PublicConfigAI;
  /** True when API keys are encrypted at rest via the OS keychain. */
  secretsEncrypted: boolean;
}

/** Subset returned by the validator and sent over the IPC save-settings channel. */
export interface SettingsPayload {
  language: Language;
  theme: Theme;
  hotkey: string;
  autoLaunch: boolean;
  enableFiles: boolean;
  enableBookmarks: boolean;
  enableWebSearch: boolean;
  webSearchEngine: WebSearchEngine;
  enableSysCommands: boolean;
  enableCalculator: boolean;
  enableClipboard: boolean;
  limitClipboardText: boolean;
  maxResults: number;
  aliases: Record<string, AliasAction[]>;
  ai: AppConfigAI;
  privacy: AppConfigPrivacy;
}

/**
 * `SettingsPayload` with the secrets stripped — what the main process
 * echoes back to the renderer after a successful save.
 */
export interface PublicSettingsPayload extends Omit<SettingsPayload, 'ai'> {
  ai: PublicConfigAI;
}

export interface SaveSettingsResult {
  ok: boolean;
  settings?: PublicSettingsPayload;
  error?: string;
  /**
   * Advisory, non-fatal message shown to the user after a successful
   * save. Currently used on Wayland to inform the user that the hotkey
   * may not be delivered by the compositor and that `spoty --toggle`
   * can be bound to a DE-level custom shortcut instead.
   */
  warning?: string;
}

export type SearchResultType =
  | 'app'
  | 'file'
  | 'web'
  | 'weather'
  | 'alias'
  | 'syscommand'
  | 'calc'
  | 'clipboard'
  | 'command';

export interface SearchResult {
  type: SearchResultType;
  name: string;
  description?: string;
  path?: string;
  url?: string;
  value?: string;
  action?: SafeCommandAction;
  /**
   * Key of the alias to run. Only the key travels to the renderer and back;
   * the main process resolves it against its own config so a compromised
   * renderer cannot inject arbitrary URLs or commands into `alias-run`.
   */
  aliasKey?: string;
  /** How many actions the alias expands to (display only). */
  aliasCount?: number;
  icon?: string;
  iconPath?: string;
  // Weather-specific
  tempText?: string;
  condition?: string;
  feelsLike?: string;
  humidity?: string;
}

export interface ChatEntry {
  id: string;
  prompt: string;
  reply: string;
  time: string;
  provider: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatDisplayMessage extends ChatMessage {
  isError?: boolean;
}

/**
 * The contract surface exposed by `preload.ts` to the renderer through
 * `contextBridge.exposeInMainWorld('electron', ...)`.
 */
export interface ElectronApi {
  send: ElectronApiSend;
  on: ElectronApiOn;
  invoke: ElectronApiInvoke;
}

export interface ElectronApiSend {
  (channel: 'renderer-ready'): void;
  (channel: 'window-hide'): void;
  (channel: 'window-resize', height: number): void;
  (channel: 'app-launch', appPath: string): void;
  (channel: 'item-show-folder', itemPath: string): void;
  (channel: 'url-open', url: string): void;
  (channel: 'clipboard-copy', text: string): void;
  (channel: 'command-run', action: SafeCommandAction): void;
  (channel: 'alias-run', aliasKey: string): void;
  (channel: 'save-settings', settings: unknown): void;
  (channel: 'reset-ai-context'): void;
  (channel: 'clipboard-history-clear'): void;
}

export type RendererListener<T> = (payload: T) => void;

export interface ElectronApiOn {
  (channel: 'window-show', listener: RendererListener<void>): void;
  (channel: 'window-hide', listener: RendererListener<void>): void;
  (
    channel: 'save-settings-result',
    listener: RendererListener<SaveSettingsResult>
  ): void;
}

export interface ElectronApiInvoke {
  (channel: 'search', query: string): Promise<SearchResult[]>;
  (channel: 'ask-ai', prompt: string): Promise<string>;
  (channel: 'get-icon', iconName: string): Promise<string | null>;
  (channel: 'get-settings'): Promise<PublicConfig>;
  (channel: 'get-chat-history'): Promise<ChatEntry[]>;
  (channel: 'delete-chat-history', id: string): Promise<boolean>;
}
