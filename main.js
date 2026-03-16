'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { convertFrToRepx } = require('./src/converter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 720,
    minHeight: 520,
    title: 'FastReport → DevExpress Converter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: open file dialog ────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select FastReport File',
    filters: [
      { name: 'FastReport Files', extensions: ['fr3', 'frf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

// ─── IPC: save file dialog ────────────────────────────────────────────────────
ipcMain.handle('dialog:saveFile', async (_event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save DevExpress REPX File',
    defaultPath: defaultName || 'report.repx',
    filters: [
      { name: 'DevExpress Report', extensions: ['repx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return null;
  return filePath;
});

// ─── IPC: convert file ────────────────────────────────────────────────────────
ipcMain.handle('converter:convert', async (_event, filePath) => {
  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const repx = await convertFrToRepx(xml);
    return { success: true, repx };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: save repx ──────────────────────────────────────────────────────────
ipcMain.handle('converter:save', async (_event, savePath, content) => {
  try {
    fs.writeFileSync(savePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
