import type { ElectronApi } from '../shared/types';

declare global {
  interface Window {
    electron: ElectronApi;
  }
}

/** Single typed entry point for the IPC bridge exposed by `preload.ts`. */
export const api: ElectronApi = window.electron;

/* External libs loaded as classic <script> tags from CDN. */
declare global {
  // eslint-disable-next-line no-var
  var marked: { parse(input: string): string };
  // eslint-disable-next-line no-var
  var DOMPurify: { sanitize(input: string): string };
}
