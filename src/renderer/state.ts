import type { ChatDisplayMessage, PublicConfig, SearchResult } from '../shared/types';

/** Mutable per-session UI state shared by feature modules. */
export const state = {
  currentResults: [] as SearchResult[],
  selectedIndex: -1,
  searchTimeout: null as ReturnType<typeof setTimeout> | null,
  /**
   * The redacted config: API keys are never sent to the renderer, only the
   * `hasOpenaiKey` / `hasGeminiKey` flags.
   */
  appSettings: null as PublicConfig | null,
  isAiMode: false,
  /** Persistent display chat in AI mode. Survives hide/show. */
  chatDisplayMessages: [] as ChatDisplayMessage[],
  /** Tracks the most recent search request to ignore out-of-order responses. */
  lastSearchId: 0,
};
