import { contextBridge, ipcRenderer } from 'electron';

/**
 * The entire privileged surface available to the renderer. Channels are
 * allowlisted per direction, and nothing else — no `ipcRenderer`, no
 * `require`, no Node globals — is exposed.
 */
const validSendChannels = [
  'renderer-ready',
  'window-hide',
  'window-resize',
  'app-launch',
  'item-show-folder',
  'url-open',
  'clipboard-copy',
  'clipboard-history-clear',
  'command-run',
  'alias-run',
  'save-settings',
  'reset-ai-context',
] as const;

const validInvokeChannels = [
  'search',
  'ask-ai',
  'get-icon',
  'get-settings',
  'get-chat-history',
  'delete-chat-history',
] as const;

const validOnChannels = [
  'window-show',
  'window-hide',
  'save-settings-result',
] as const;

type SendChannel = (typeof validSendChannels)[number];
type InvokeChannel = (typeof validInvokeChannels)[number];
type OnChannel = (typeof validOnChannels)[number];

// `includes` on the readonly tuples is typed against the literal union, so
// compare through a plain string set instead: the renderer is untrusted input
// here and may pass any value at run time.
const sendChannels: ReadonlySet<string> = new Set(validSendChannels);
const invokeChannels: ReadonlySet<string> = new Set(validInvokeChannels);
const onChannels: ReadonlySet<string> = new Set(validOnChannels);

contextBridge.exposeInMainWorld('electron', {
  send: (channel: SendChannel, data?: unknown) => {
    if (sendChannels.has(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: OnChannel, func: (...args: unknown[]) => void) => {
    if (onChannels.has(channel)) {
      // Only the payload is forwarded: handing the renderer the raw
      // `IpcRendererEvent` would leak `sender`, and with it a path back to
      // privileged APIs.
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
  invoke: (channel: InvokeChannel, data?: unknown): Promise<unknown> => {
    if (invokeChannels.has(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },
});
