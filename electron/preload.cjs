'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  planFullscreen: value => ipcRenderer.invoke('window:plan-fullscreen',value),
  onFullscreen: callback => {const listener=(_,value)=>callback(value);ipcRenderer.on('app:fullscreen',listener);return ()=>ipcRenderer.removeListener('app:fullscreen',listener);},
  info: () => ipcRenderer.invoke('app:info'),
  savePdf: name => ipcRenderer.invoke('plan:pdf', name),
  settings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: value => ipcRenderer.invoke('settings:save', value),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdate: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('updates:state', listener); return () => ipcRenderer.removeListener('updates:state', listener); },
  onMenu: callback => { const listener = (_, value) => callback(value); ipcRenderer.on('app:menu', listener); return () => ipcRenderer.removeListener('app:menu', listener); }
});
