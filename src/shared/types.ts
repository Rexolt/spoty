/**
 * Shared types used by both main and renderer processes.
 * Type-only file: importing this in either context produces no runtime code.
 */

export type AIProvider = 'openai' | 'gemini' | 'ollama';
export type Theme = 'dark' | 'light' | 'ocean' | 'forest' | 'midnight';
export type Language = 'hu' | 'en';

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
  enableSysCommands: boolean;
  enableCalculator: boolean;
  enableClipboard: boolean;
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

/** Subset returned by the validator and sent over the IPC save-settings channel. */
export interface SettingsPayload {
  language: Language;
  theme: Theme;
  hotkey: string;
  autoLaunch: boolean;
  enableFiles: boolean;
  enableBookmarks: boolean;
  enableWebSearch: boolean;
  enableSysCommands: boolean;
  enableCalculator: boolean;
  enableClipboard: boolean;
  maxResults: number;
  aliases: Record<string, AliasAction[]>;
  ai: AppConfigAI;
}

export interface SaveSettingsResult {
  ok: boolean;
  settings?: SettingsPayload;
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
  commands?: AliasAction[];
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
  (channel: 'alias-run', actions: AliasAction[]): void;
  (channel: 'save-settings', settings: unknown): void;
  (channel: 'reset-ai-context'): void;
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
  (channel: 'get-settings'): Promise<AppConfig>;
  (channel: 'get-chat-history'): Promise<ChatEntry[]>;
  (channel: 'delete-chat-history', id: string): Promise<boolean>;
}
