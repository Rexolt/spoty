import type { AppConfig, ChatDisplayMessage, SearchResult } from '../shared/types';

/** Mutable per-session UI state shared by feature modules. */
export const state = {
  currentResults: [] as SearchResult[],
  selectedIndex: -1,
  searchTimeout: null as ReturnType<typeof setTimeout> | null,
  appSettings: null as AppConfig | null,
  isAiMode: false,
  /** Persistent display chat in AI mode. Survives hide/show. */
  chatDisplayMessages: [] as ChatDisplayMessage[],
};
