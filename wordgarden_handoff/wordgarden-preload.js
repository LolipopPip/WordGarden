const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wordGardenDesktop', {
  setWidgetMode: (mode) => ipcRenderer.invoke('wordgarden:widget-mode', mode),
  restoreMain: () => ipcRenderer.invoke('wordgarden:restore-main'),
  onForceCompact: (cb) => ipcRenderer.on('wordgarden:force-compact', () => cb())
});

contextBridge.exposeInMainWorld('wordGardenStorage', {
  getItem: (key) => ipcRenderer.sendSync('wordgarden-storage:get', key),
  setItem: (key, value) => ipcRenderer.sendSync('wordgarden-storage:set', key, value),
  removeItem: (key) => ipcRenderer.sendSync('wordgarden-storage:remove', key)
});
