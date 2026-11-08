const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  resolveYtStream: (params) => ipcRenderer.invoke('resolve-yt-stream', params),
  searchYt: (query, limit) => ipcRenderer.invoke('search-yt', { query, limit }),
  storageLoad: () => ipcRenderer.invoke('storage:load'),
  storageSave: (data) => ipcRenderer.invoke('storage:save', data),
  downloadTrack: (track) => ipcRenderer.invoke('download-track', track),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  getDownloadsFolder: () => ipcRenderer.invoke('get-downloads-folder'),
  onUpdaterStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('updater:restart-and-install'),
});
