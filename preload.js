const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Egyirányú kommunikáció: renderer -> main
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  // Egyirányú kommunikáció: main -> renderer
  on: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  // Kétirányú kommunikáció: renderer -> main -> renderer
  invoke: (channel, data) => {
    return ipcRenderer.invoke(channel, data);
  }
});