'use strict';
const fs = require('node:fs');
function normalizeFeed(value) {
  if (!value || !value.trim()) return '';
  const u = new URL(value.trim());
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error('Bitte eine HTTPS-Ordneradresse ohne Passwort, Suchparameter oder Fragment verwenden.');
  u.pathname = u.pathname.replace(/\/+$/, '') + '/';
  return u.href;
}
function readSettings(file, defaults) {
  try { const s = JSON.parse(fs.readFileSync(file, 'utf8')); return { automatic: s.automatic !== false }; }
  catch { return { ...defaults }; }
}
function writeSettings(file, s) {
  if (!s || typeof s.automatic !== 'boolean') throw Error('Ungültige Einstellungen.');
  const clean = { automatic: s.automatic };
  fs.writeFileSync(file + '.tmp', JSON.stringify(clean, null, 2), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
  return clean;
}
module.exports = { normalizeFeed, readSettings, writeSettings };
