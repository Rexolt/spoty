import type { ElectronApi } from '../shared/types';

declare global {
  interface Window {
    electron: ElectronApi;
  }
}

/** Single typed entry point for the IPC bridge exposed by `preload.ts`. */
export const api: ElectronApi = window.electron;

/*
 * The renderer deliberately has no third-party runtime dependencies. Markdown
 * rendering used to rely on `marked` and `DOMPurify` fetched from a CDN on
 * every launch; it is now handled locally by `markdown.ts`. Keep it that way:
 * a remote <script> would both leak that the app is running and hand a third
 * party control over this window.
 */
