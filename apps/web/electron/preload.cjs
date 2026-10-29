const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  resolveYtStream: (params) => ipcRenderer.invoke('resolve-yt-stream', params),
});
