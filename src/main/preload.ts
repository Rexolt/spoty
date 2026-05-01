import { contextBridge, ipcRenderer } from 'electron';

const validSendChannels = [
  'window-hide',
  'window-resize',
  'app-launch',
  'item-show-folder',
  'url-open',
  'clipboard-copy',
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

contextBridge.exposeInMainWorld('electron', {
  send: (channel: SendChannel, data?: unknown) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: OnChannel, func: (...args: unknown[]) => void) => {
    if (validOnChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
  invoke: (channel: InvokeChannel, data?: unknown): Promise<unknown> => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },
});
