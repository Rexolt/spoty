import { pollClipboard } from './search-engine';

const POLL_INTERVAL_MS = 1_000;

export function startClipboardMonitoring(): void {
  setInterval(pollClipboard, POLL_INTERVAL_MS);
}
