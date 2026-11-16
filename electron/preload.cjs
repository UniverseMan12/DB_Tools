'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('app:info'),
  settings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: value => ipcRenderer.invoke('settings:save', value),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdate: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('updates:state', listener); return () => ipcRenderer.removeListener('updates:state', listener); },
  onMenu: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('app:menu', listener); return () => ipcRenderer.removeListener('app:menu', listener); }
});
