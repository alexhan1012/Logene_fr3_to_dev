'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  convert: (filePath) => ipcRenderer.invoke('converter:convert', filePath),
  save: (savePath, content) => ipcRenderer.invoke('converter:save', savePath, content),
});
