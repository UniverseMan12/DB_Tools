'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { updater } = require('electron-sparkle');
const { createUpdates } = require('./updates.cjs');
const updateTest = require('../package.json').dbToolsUpdateTest === true;
const { readSettings, writeSettings } = require('./settings.cjs');
const defaults = require('./defaults.json');
app.setName('DB Tools');
// This path and appId remain stable across every version.
app.setPath('userData', path.join(app.getPath('appData'), updateTest ? 'DB Tools Update-Test' : 'DB Tools'));
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', path.join(app.getPath('temp'), 'db-tools-smoke-' + process.pid));
// `npm run preview`: try a build without touching the real profile or the installed app.
const preview = process.argv.includes('--preview');
if (preview) app.setPath('userData', path.join(app.getPath('appData'), 'DB Tools Vorschau'));
if (!smoke && !preview && !app.requestSingleInstanceLock()) app.quit();
let win, settings, updates;
const entry = path.join(__dirname, '../app/index.html');
const entryURL = pathToFileURL(entry).href;
const settingsFile = () => path.join(app.getPath('userData'), 'updates.json');
function trusted(event) { if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== entryURL) throw Error('Nicht erlaubte Anfrage.'); }
function audit(event) {
  if (updateTest) fs.appendFileSync(path.join(app.getPath('userData'), 'update-test.jsonl'), JSON.stringify({ at: new Date().toISOString(), version: app.getVersion(), ...event }) + '\n');
}
function check() { return updates.check(); }
function menuAction(name) { win?.webContents.send('app:menu', name); }
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 980, minWidth: 900, minHeight: 680, show: false, title: 'DB Tools', backgroundColor: '#f5f5f5', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 18 }, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: !smoke, offscreen: smoke } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (smoke) {
    win.webContents.on('console-message', event => console.log('RENDERER:', event.level, event.message));
    win.webContents.on('preload-error', (_, preload, err) => console.error('PRELOAD:', preload, err));
  }
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.once('ready-to-show', () => { if (!smoke) win.show(); });
  win.on('leave-full-screen',()=>win?.webContents.send('app:fullscreen',false));
  win.on('closed', () => { win = null; });
  win.loadFile(entry);
  return win;
}
app.whenReady().then(async () => {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  settings = readSettings(settingsFile(), defaults);
  updates = createUpdates({ updater, packaged: app.isPackaged, automatic: settings.automatic, audit, notify: state => { if (win && !win.isDestroyed()) win.webContents.send('updates:state', state); } });
  audit({ event: 'launch' });
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', async (_, item) => {
    const ext = path.extname(item.getFilename());
    if (!['.csv', '.svg', '.json'].includes(ext)) { item.cancel(); return; }
    // Electron's save dialog provides the native macOS export experience.
    item.setSaveDialogOptions({ title: 'Zuschnittplan speichern', defaultPath: path.join(app.getPath('documents'), item.getFilename()) });
  });
  for (const [channel, handler] of Object.entries({
    'app:info': () => ({ version: app.getVersion(), updater: 'sparkle', packaged: app.isPackaged }),
    'settings:get': () => ({ ...settings, state: updates.getState() }),
    'settings:save': (_, value) => { settings = writeSettings(settingsFile(), value); updates.setAutomatic(settings.automatic); return settings; },
    'window:plan-fullscreen': (_, value) => { if(typeof value!=='boolean')throw Error('Ungültiger Vollbildmodus.');const previous=win.isFullScreen();win.setFullScreen(value);return previous; },
    'plan:pdf': async (_, name) => {
      const base = path.basename(String(name || 'Zuschnittplan.pdf')).replace(/[^\p{L}\p{N} ._()-]+/gu, '-').slice(0, 100).replace(/(\.pdf)?$/i, '.pdf');
      const { canceled, filePath } = await dialog.showSaveDialog(win, { title: 'Zuschnittplan als PDF sichern', defaultPath: path.join(app.getPath('documents'), base), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (canceled || !filePath) return { saved: false };
      const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
      fs.writeFileSync(filePath, data);
      return { saved: true };
    },
    'updates:check': check,
    'updates:install': () => updates.showInstall()
  })) ipcMain.handle(channel, (event, ...args) => { trusted(event); return handler(event, ...args); });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'DB Tools', submenu: [{ role: 'about', label: 'Über DB Tools' }, { label: 'Einstellungen …', accelerator: 'CmdOrCtrl+,', click: () => menuAction('settings') }, { label: 'Nach Updates suchen …', click: () => { menuAction('updates'); check(); } }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: 'DB Tools beenden' }] },
    { label: 'Ablage', submenu: [
      { label: 'Neue Planung', accelerator: 'CmdOrCtrl+N', click: () => menuAction('new') },
      { label: 'Meine Projekte …', accelerator: 'CmdOrCtrl+Shift+O', click: () => menuAction('library') },
      { label: 'In Meine Projekte speichern', accelerator: 'CmdOrCtrl+S', click: () => menuAction('save') },
      { type: 'separator' },
      { label: 'Projektdatei öffnen …', accelerator: 'CmdOrCtrl+O', click: () => menuAction('import') },
      { label: 'Als Projektdatei sichern …', accelerator: 'CmdOrCtrl+Shift+S', click: () => menuAction('export') },
      { type: 'separator' },
      { label: 'Plan als PDF sichern …', accelerator: 'CmdOrCtrl+Shift+P', click: () => menuAction('pdf') },
      { label: 'Plan drucken …', accelerator: 'CmdOrCtrl+P', click: () => menuAction('print') }
    ] },
    { label: 'Bearbeiten', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Darstellung', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Fenster', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
    { label: 'Hilfe', submenu: [{ label: 'Willkommen bei DB Tools', click: () => menuAction('welcome') }, { label: 'Updates', click: () => menuAction('updates') }] }
  ]));
  app.setAboutPanelOptions({ applicationName: 'DB Tools', applicationVersion: app.getVersion(), copyright: 'DB SOLUTION', credits: 'Folien-Zuschnittplaner · Präzise planen. Mehr rausholen.' });
  const w = createWindow();
  await updates.start();
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
  const first = setTimeout(() => { if (settings.automatic) updates.check(true); }, updateTest ? 1500 : 12000); first.unref();
  if (updateTest) {
    w.webContents.once('did-finish-load', async () => {
      const value = await w.webContents.executeJavaScript('localStorage.getItem("dbtools-update-sentinel")');
      audit({ event: 'data-check', value });
      if (!value) await w.webContents.executeJavaScript('localStorage.setItem("dbtools-update-sentinel", "Eingaben bleiben beim Update erhalten");document.getElementById("start-example").click()');
    });
  }
});
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
