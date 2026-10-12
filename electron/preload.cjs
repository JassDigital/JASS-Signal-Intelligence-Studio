const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jass', {
  dashboard: { get: () => ipcRenderer.invoke('dashboard:get') },
  events: { list: (filters) => ipcRenderer.invoke('events:list', filters), save: (data) => ipcRenderer.invoke('events:save', data), delete: (id) => ipcRenderer.invoke('events:delete', { id }) },
  sources: { list: () => ipcRenderer.invoke('sources:list'), save: (data) => ipcRenderer.invoke('sources:save', data), delete: (id) => ipcRenderer.invoke('sources:delete', { id }) },
  feeds: { refresh: () => ipcRenderer.invoke('feeds:refresh') },
  topics: { list: () => ipcRenderer.invoke('topics:list'), save: (data) => ipcRenderer.invoke('topics:save', data), delete: (id) => ipcRenderer.invoke('topics:delete', { id }) },
  settings: { get: () => ipcRenderer.invoke('settings:get'), save: (data) => ipcRenderer.invoke('settings:save', data) },
  timeline: { list: () => ipcRenderer.invoke('timeline:list') },
  saved: { list: () => ipcRenderer.invoke('saved:list'), toggle: (eventId, note = '') => ipcRenderer.invoke('saved:toggle', { eventId, note }) },
  app: { version: () => ipcRenderer.invoke('app:version') }
});
