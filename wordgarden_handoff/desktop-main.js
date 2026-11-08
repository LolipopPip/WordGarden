const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

const appHtml = path.join(__dirname, '词间花园.html');
const preload = path.join(__dirname, 'wordgarden-preload.js');
const compactWindowSize = { width: 72, height: 68 };
const expandedWindowSize = { width: 320, height: 320 };

let mainWindow = null;
let widgetWindow = null;

function dataPath() {
  return path.join(app.getPath('appData'), 'WordGarden', 'wordgarden-data.json');
}

function readDataFile() {
  try {
    const raw = fs.readFileSync(dataPath(), 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDataFile(data) {
  const filePath = dataPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function storageGet(key) {
  const data = readDataFile();
  return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
}

function storageSet(key, value) {
  const data = readDataFile();
  data[key] = String(value);
  writeDataFile(data);
}

function storageRemove(key) {
  const data = readDataFile();
  delete data[key];
  writeDataFile(data);
}

function getDockedBounds(size) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  return {
    x: Math.round(x + width - size.width - 24),
    y: Math.round(y + height - size.height + 4),
    width: size.width,
    height: size.height
  };
}

function createWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return widgetWindow;
  }

  widgetWindow = new BrowserWindow({
    ...getDockedBounds(compactWindowSize),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widgetWindow.loadFile(appHtml, { query: { widget: '1', desktop: '1' } });
  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
  return widgetWindow;
}

function showWidgetWindow() {
  const win = createWidgetWindow();
  win.setBounds(getDockedBounds(compactWindowSize), false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once('did-finish-load', () => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('wordgarden:force-compact');
      }
    });
  } else {
    win.webContents.send('wordgarden:force-compact');
  }
  win.showInactive();
  win.moveTop();
}

function hideWidgetWindow() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide();
  }
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: '词间花园 · 单词记忆',
    backgroundColor: '#E9EEDF',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(appHtml);
  mainWindow.on('minimize', () => {
    showWidgetWindow();
  });
  mainWindow.on('restore', () => {
    hideWidgetWindow();
  });
  mainWindow.on('show', () => {
    if (!mainWindow.isMinimized()) hideWidgetWindow();
  });

  mainWindow.on('closed', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.close();
    }
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();

  app.on('activate', () => {
    createMainWindow();
  });
});

ipcMain.handle('wordgarden:widget-mode', (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if(!win || win.isDestroyed()) return false;
  const size = mode === 'expanded' ? expandedWindowSize : compactWindowSize;
  win.setBounds(getDockedBounds(size), false);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.moveTop();
  return true;
});

ipcMain.handle('wordgarden:restore-main', () => {
  const win = createMainWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  hideWidgetWindow();
  return true;
});

ipcMain.on('wordgarden-storage:get', (event, key) => {
  event.returnValue = storageGet(String(key || ''));
});

ipcMain.on('wordgarden-storage:set', (event, key, value) => {
  storageSet(String(key || ''), String(value || ''));
  event.returnValue = true;
});

ipcMain.on('wordgarden-storage:remove', (event, key) => {
  storageRemove(String(key || ''));
  event.returnValue = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
