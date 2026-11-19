'use strict';
// Self-contained updater for macOS 12 and 13.
//
// The Sparkle bridge (electron-sparkle) ships a Swift addon built for
// macOS 14, so on older systems DB Tools uses this updater instead. It reads
// the same signed GitHub appcast, verifies every update archive with the
// app's Ed25519 key (SUPublicEDKey) exactly like Sparkle, checks bundle id,
// version and code signature, and swaps the app bundle after DB Tools quits.
// It exposes the subset of the electron-sparkle API that updates.cjs uses.
const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_ARCHIVE = 800 * 1024 * 1024;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(Object.assign(error, { stderr })) : resolve(stdout)));
}

function plistString(xml, key) {
  const m = new RegExp('<key>' + key + '</key>\\s*<string>([^<]*)</string>').exec(xml);
  return m ? m[1].trim() : '';
}

function compareVersions(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function tag(block, name) { const m = new RegExp('<' + name + '>([^<]*)</' + name + '>').exec(block); return m ? decode(m[1].trim()) : ''; }
function attr(block, name) { const m = new RegExp('\\s' + name + '="([^"]*)"').exec(block); return m ? decode(m[1]) : ''; }

// Returns the newest applicable update from a Sparkle appcast.
function parseAppcast(xml, systemVersion) {
  const items = [];
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const enclosure = (/<enclosure\b[^>]*>/.exec(block) || [''])[0];
    const version = tag(block, 'sparkle:version') || attr(enclosure, 'sparkle:version');
    const item = {
      version,
      displayVersion: tag(block, 'sparkle:shortVersionString') || attr(enclosure, 'sparkle:shortVersionString') || version,
      minimumSystemVersion: tag(block, 'sparkle:minimumSystemVersion'),
      url: attr(enclosure, 'url'),
      length: Number(attr(enclosure, 'length')),
      signature: attr(enclosure, 'sparkle:edSignature')
    };
    if (!item.version || !item.url || !item.signature) continue;
    if (item.minimumSystemVersion && compareVersions(systemVersion, item.minimumSystemVersion) < 0) continue;
    items.push(item);
  }
  items.sort((a, b) => compareVersions(b.version, a.version));
  return items[0] || null;
}

function verifySignature(data, signatureBase64, publicKeyBase64) {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  if (raw.length !== 32) throw Error('Ungültiger öffentlicher Update-Schlüssel.');
  const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]), format: 'der', type: 'spki' });
  const signature = Buffer.from(signatureBase64, 'base64');
  return signature.length === 64 && crypto.verify(null, data, key, signature);
}

// The download must come from the same host as the feed, over HTTPS
// (plain HTTP only for the local update test on 127.0.0.1).
function allowedUrl(url, feedUrl) {
  const u = new URL(url), f = new URL(feedUrl);
  if (u.username || u.password) return false;
  if (u.protocol === 'https:') return u.host === f.host;
  return u.protocol === 'http:' && u.hostname === '127.0.0.1' && f.hostname === '127.0.0.1';
}

function createFallbackUpdater({ app, fetch, audit = () => {}, bundlePath, systemVersion, tempDir }) {
  const emitter = new EventEmitter();
  const bundle = bundlePath || path.resolve(process.execPath, '../../..');
  let info = null, automaticChecks = true, automaticDownloads = true, timer = null;
  let busy = false, ready = null, installing = false;
  const work = tempDir || path.join(app.getPath('userData'), 'Updates');

  function fail(error) { audit({ event: 'fallback-error', message: error.message }); emitter.emit('error', { error }); }

  async function readInfo() {
    const xml = await fs.promises.readFile(path.join(bundle, 'Contents/Info.plist'), 'utf8');
    return {
      version: plistString(xml, 'CFBundleVersion'),
      identifier: plistString(xml, 'CFBundleIdentifier'),
      feedUrl: plistString(xml, 'SUFeedURL'),
      publicKey: plistString(xml, 'SUPublicEDKey')
    };
  }

  async function download(item) {
    if (!allowedUrl(item.url, info.feedUrl)) throw Error('Update-Adresse nicht erlaubt: ' + item.url);
    if (!(item.length > 0) || item.length > MAX_ARCHIVE) throw Error('Ungültige Update-Grösse.');
    const response = await fetch(item.url, { cache: 'no-store' });
    if (!response.ok) throw Error('Download fehlgeschlagen (HTTP ' + response.status + ').');
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== item.length) throw Error('Update-Archiv unvollständig.');
    if (!verifySignature(data, item.signature, info.publicKey)) throw Error('Invalid signature: Die Update-Signatur ist ungültig.');
    await fs.promises.rm(work, { recursive: true, force: true });
    await fs.promises.mkdir(work, { recursive: true, mode: 0o700 });
    const archive = path.join(work, 'update.zip'), unpacked = path.join(work, 'unpacked');
    await fs.promises.writeFile(archive, data, { mode: 0o600 });
    await run('/usr/bin/ditto', ['-x', '-k', archive, unpacked]);
    const apps = (await fs.promises.readdir(unpacked)).filter(n => n.endsWith('.app'));
    if (apps.length !== 1) throw Error('Update-Archiv enthält keine eindeutige App.');
    const candidate = path.join(unpacked, apps[0]);
    const xml = await fs.promises.readFile(path.join(candidate, 'Contents/Info.plist'), 'utf8');
    if (plistString(xml, 'CFBundleIdentifier') !== info.identifier) throw Error('Update gehört zu einer anderen App.');
    if (plistString(xml, 'CFBundleVersion') !== item.version) throw Error('Update-Version passt nicht zum Appcast.');
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', candidate]);
    await fs.promises.rm(archive, { force: true });
    return candidate;
  }

  async function check(userInitiated) {
    if (busy || installing) return;
    if (ready) { emitter.emit('update-downloaded', { update: ready.item }); return; }
    busy = true;
    try {
      const response = await fetch(info.feedUrl, { cache: 'no-store' });
      if (!response.ok) throw Error('Appcast nicht erreichbar (HTTP ' + response.status + ').');
      const item = parseAppcast(await response.text(), systemVersion || process.getSystemVersion());
      if (!item || compareVersions(item.version, info.version) <= 0) { emitter.emit('update-not-available', {}); return; }
      emitter.emit('update-available', { update: item });
      if (!automaticDownloads && !userInitiated) return;
      const candidate = await download(item);
      ready = { item, candidate };
      audit({ event: 'fallback-ready', version: item.version });
      emitter.emit('update-downloaded', { update: item });
    } catch (error) { fail(error); }
    finally { busy = false; emitter.emit('cycle-complete', {}); }
  }

  function canReplaceBundle() {
    if (bundle.includes('/AppTranslocation/')) throw Error('DB Tools läuft nicht aus dem Programme-Ordner. Bitte die App einmal in „Programme“ ziehen.');
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
    fs.accessSync(bundle, fs.constants.W_OK);
  }

  // Replace the bundle in a detached helper once this process has exited.
  function install(relaunch) {
    if (!ready || installing) return false;
    try { canReplaceBundle(); } catch (error) { fail(error.code ? Error('Keine Schreibrechte für ' + bundle + '. Bitte das Update als DMG installieren.') : error); return false; }
    installing = true;
    emitter.emit('before-install', { update: ready.item });
    const script = path.join(os.tmpdir(), 'db-tools-install-' + process.pid + '.sh');
    fs.writeFileSync(script, [
      '#!/bin/sh',
      'PID="$1"; APP="$2"; NEW="$3"; RELAUNCH="$4"',
      'i=0; while kill -0 "$PID" 2>/dev/null && [ $i -lt 600 ]; do sleep 0.2; i=$((i+1)); done',
      'BACKUP="$APP.update-backup"',
      'rm -rf "$BACKUP"',
      'if mv "$APP" "$BACKUP"; then',
      '  if mv "$NEW" "$APP" || /usr/bin/ditto "$NEW" "$APP"; then rm -rf "$BACKUP"; else rm -rf "$APP"; mv "$BACKUP" "$APP"; fi',
      'fi',
      '[ "$RELAUNCH" = 1 ] && /usr/bin/open "$APP"',
      'rm -f "$0"'
    ].join('\n'), { mode: 0o700 });
    spawn('/bin/sh', [script, String(process.pid), bundle, ready.candidate, relaunch ? '1' : '0'], { detached: true, stdio: 'ignore' }).unref();
    audit({ event: 'fallback-install', version: ready.item.version, relaunch });
    return true;
  }
  function installAndRelaunch() { if (install(true)) { emitter.emit('before-relaunch', {}); setTimeout(() => app.quit(), 200); } }

  function schedule() {
    clearInterval(timer);
    if (automaticChecks) { timer = setInterval(() => check(false), CHECK_INTERVAL); timer.unref?.(); }
  }

  return Object.assign(emitter, {
    kind: 'fallback',
    async start() {
      info = await readInfo();
      if (!info.feedUrl || !info.publicKey || !info.version) throw Error('Update-Konfiguration in Info.plist fehlt.');
      app.on('will-quit', () => { if (ready && automaticDownloads && !installing) install(false); });
      schedule();
    },
    getState: () => ({ started: !!info, kind: 'fallback', version: info?.version, ready: !!ready }),
    setAutomaticallyChecksForUpdates(value) { automaticChecks = !!value; schedule(); },
    setAutomaticallyDownloadsUpdates(value) { automaticDownloads = !!value; },
    checkForUpdates() { check(true); },
    installAndRelaunch,
    checkForUpdatesInBackground() { check(false); }
  });
}

module.exports = { createFallbackUpdater, parseAppcast, verifySignature, compareVersions, allowedUrl, plistString };
