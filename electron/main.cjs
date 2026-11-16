'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { hasDeveloperID } = require('./apple-signature.cjs');
const { autoUpdater } = require('electron-updater');
const { readSettings, writeSettings } = require('./settings.cjs');
const defaults = require('./defaults.json');
app.setName('DB Tools');
// This path and appId remain stable across every version.
app.setPath('userData', path.join(app.getPath('appData'), 'DB Tools'));
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'db-tools-smoke-' + process.pid));
if (!smoke && !app.requestSingleInstanceLock()) app.quit();
let win, settings, signed = false, busy = false, readyUpdate = false;
let state = { kind: 'setup', message: 'Automatische Updates noch nicht eingerichtet.' };
const entry = path.join(__dirname, '../app/index.html');
const entryURL = pathToFileURL(entry).href;
const settingsFile = () => path.join(app.getPath('userData'), 'updates.json');
function send(kind, message, extra = {}) { state = { kind, message, ...extra }; if (win && !win.isDestroyed()) win.webContents.send('updates:state', state); }
function trusted(event) { if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== entryURL) throw Error('Nicht erlaubte Anfrage.'); }
function signingStatus() {
  return hasDeveloperID(process.execPath, app.isPackaged);
}
function configure() {
  if (!signed) {
    send('setup', !signed ? 'Diese lokale Version ist noch nicht mit einer Apple Developer ID signiert. Automatische Updates sind nach Installation der ersten signierten Version verfügbar.' : 'Tragen Sie die HTTPS-Adresse Ihres Update-Ordners ein.');
    return false;
  }
  autoUpdater.setFeedURL({ provider: 'github', owner: 'UniverseMan12', repo: 'DB_Tools', private: false, releaseType: 'release' });
  send('idle', settings.automatic ? 'Automatische Prüfung aktiviert. Updates werden beim Beenden installiert.' : 'Automatische Prüfung pausiert. Sie können manuell nach Updates suchen.');
  return true;
}
async function check() {
  if (busy || readyUpdate || state.kind === 'downloading') return state;
  if (!configure()) return state;
  busy = true;
  try { await autoUpdater.checkForUpdates(); }
  catch { send('error', 'Update-Prüfung fehlgeschlagen. Bitte Internetverbindung und Update-Adresse prüfen. Ihre Arbeit bleibt gespeichert.'); }
  finally { busy = false; }
  return state;
}
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.on('checking-for-update', () => send('checking', 'Neue Version wird gesucht …'));
autoUpdater.on('update-available', info => send('downloading', 'Version ' + info.version + ' wird im Hintergrund geladen …'));
autoUpdater.on('update-not-available', () => send('current', 'DB Tools ist auf dem neuesten Stand.'));
autoUpdater.on('download-progress', p => send('downloading', 'Update wird geladen: ' + Math.round(p.percent) + ' %', { percent: p.percent }));
autoUpdater.on('update-downloaded', info => { readyUpdate = true; send('ready', 'Version ' + info.version + ' ist bereit. Installation beim Beenden oder über „Jetzt neu starten“.'); });
autoUpdater.on('error', () => { busy = false; send('error', 'Das Update konnte nicht geladen oder geprüft werden. Bitte die Update-Einrichtung kontrollieren.'); });
function menuAction(name) { win?.webContents.send('app:menu', name); }
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 980, minWidth: 900, minHeight: 680, show: false, title: 'DB Tools', backgroundColor: '#f4f5f1', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 18 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: !smoke } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (smoke) {
    win.webContents.on('console-message', event => console.log('RENDERER:', event.level, event.message));
    win.webContents.on('preload-error', (_, preload, err) => console.error('PRELOAD:', preload, err));
  }
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.once('ready-to-show', () => { if (!smoke) win.show(); });
  win.on('closed', () => { win = null; });
  win.loadFile(entry);
  return win;
}
app.whenReady().then(async () => {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  settings = readSettings(settingsFile(), defaults);
  signed = signingStatus();
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', async (_, item) => {
    const ext = path.extname(item.getFilename());
    if (!['.csv', '.svg'].includes(ext)) { item.cancel(); return; }
    // Electron's save dialog provides the native macOS export experience.
    item.setSaveDialogOptions({ title: 'Zuschnittplan speichern', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  for (const [channel, handler] of Object.entries({
    'app:info': () => ({ version: app.getVersion(), signed, packaged: app.isPackaged }),
    'settings:get': () => ({ ...settings, state }),
    'settings:save': (_, value) => { if (busy || readyUpdate) throw Error('Bitte das laufende Update zuerst abschliessen.'); settings = writeSettings(settingsFile(), value); configure(); if (settings.automatic) setTimeout(check, 200); return settings; },
    'updates:check': check,
    'updates:install': () => { if (readyUpdate) setTimeout(() => autoUpdater.quitAndInstall(), 100); return readyUpdate; }
  })) ipcMain.handle(channel, (event, ...args) => { trusted(event); return handler(event, ...args); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'DB Tools', submenu: [{ role: 'about', label: 'Über DB Tools' }, { label: 'Einstellungen …', accelerator: 'CmdOrCtrl+,', click: () => menuAction('settings') }, { label: 'Nach Updates suchen …', click: () => { menuAction('settings'); check(); } }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: 'DB Tools beenden' }] },
    { label: 'Ablage', submenu: [{ label: 'Plan drucken / PDF …', accelerator: 'CmdOrCtrl+P', click: () => win?.webContents.print({ printBackground: true }) }] },
    { label: 'Bearbeiten', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Darstellung', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Fenster', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
    { label: 'Hilfe', submenu: [{ label: 'Willkommen bei DB Tools', click: () => menuAction('welcome') }, { label: 'Updates einrichten', click: () => menuAction('settings') }] }
  ]));
  app.setAboutPanelOptions({ applicationName: 'DB Tools', applicationVersion: app.getVersion(), copyright: 'DB SOLUTION', credits: 'Folien-Zuschnittplaner · Präzise planen. Mehr rausholen.' });
  const w = createWindow();
  configure();
  if (smoke) {
    let failed = false;
    w.webContents.on('console-message', details => { if (details.level === 'error') { console.error(details.message); failed = true; } });
    await new Promise(resolve => w.webContents.once('did-finish-load', resolve));
    try {
      const result = await require('./smoke.cjs')(w);
      console.log(JSON.stringify(result, null, 2));
      app.exit(failed ? 1 : 0);
    } catch (e) { console.error(e); app.exit(1); }
    return;
  }
  const first = setTimeout(() => { if (settings.automatic) check(); }, 12000); first.unref();
  const timer = setInterval(() => { if (settings.automatic) check(); }, 4 * 60 * 60 * 1000); timer.unref();
});
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
