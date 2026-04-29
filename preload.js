const { contextBridge, ipcRenderer } = require('electron');

const validSendChannels = [
  'window-hide', 'window-resize', 'app-launch', 'item-show-folder',
  'url-open', 'clipboard-copy', 'command-run', 'alias-run', 'save-settings',
  'reset-ai-context'
];
const validInvokeChannels = ['search', 'ask-ai', 'get-icon', 'get-settings', 'get-chat-history', 'delete-chat-history'];
const validOnChannels = ['window-show', 'window-hide', 'save-settings-result'];

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel, func) => {
    if (validOnChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  invoke: (channel, data) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  }
});
