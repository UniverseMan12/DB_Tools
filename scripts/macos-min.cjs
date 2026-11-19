'use strict';
// Fails the build when any binary in the app needs a newer macOS than
// DB Tools supports. Reads LC_BUILD_VERSION / LC_VERSION_MIN_MACOSX directly
// from the Mach-O headers (thin and universal binaries).
const fs = require('node:fs');
const path = require('node:path');

const MIN_MACOS = '12.0';
// The Sparkle bridge is only loaded on macOS 14+; older systems use
// electron/fallback-updater.cjs instead.
const MACOS14_ONLY = /electron_sparkle(\.darwin-[a-z0-9_]+)?\.node$/;

const LC_VERSION_MIN_MACOSX = 0x24, LC_BUILD_VERSION = 0x32, PLATFORM_MACOS = 1;
const decode = v => (v >>> 16) + '.' + ((v >>> 8) & 0xff) + '.' + (v & 0xff);

function thinVersions(buf, offset, out) {
  const magic = buf.readUInt32LE(offset);
  const is64 = magic === 0xfeedfacf;
  if (!is64 && magic !== 0xfeedface) return;
  const ncmds = buf.readUInt32LE(offset + 16);
  let p = offset + (is64 ? 32 : 28);
  for (let i = 0; i < ncmds && p + 8 <= buf.length; i++) {
    const cmd = buf.readUInt32LE(p), size = buf.readUInt32LE(p + 4);
    if (cmd === LC_BUILD_VERSION && buf.readUInt32LE(p + 8) === PLATFORM_MACOS) out.push(decode(buf.readUInt32LE(p + 12)));
    if (cmd === LC_VERSION_MIN_MACOSX) out.push(decode(buf.readUInt32LE(p + 8)));
    if (size < 8) break;
    p += size;
  }
}

// Minimum macOS versions declared by a Mach-O file ([] if not Mach-O).
function minimumVersions(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(4);
    if (fs.readSync(fd, head, 0, 4, 0) < 4) return [];
    const be = head.readUInt32BE(0), le = head.readUInt32LE(0);
    const out = [];
    if (be === 0xcafebabe || be === 0xcafebabf) {
      const wide = be === 0xcafebabf;
      const count = Buffer.alloc(4); fs.readSync(fd, count, 0, 4, 4);
      const n = count.readUInt32BE(0);
      if (n > 32) return []; // Java class files share this magic
      const table = Buffer.alloc(n * (wide ? 32 : 20)); fs.readSync(fd, table, 0, table.length, 8);
      for (let i = 0; i < n; i++) {
        const offset = wide ? Number(table.readBigUInt64BE(i * 32 + 8)) : table.readUInt32BE(i * 20 + 8);
        const header = Buffer.alloc(65536); const read = fs.readSync(fd, header, 0, header.length, offset);
        thinVersions(header.subarray(0, read), 0, out);
      }
    } else if (le === 0xfeedfacf || le === 0xfeedface) {
      const header = Buffer.alloc(65536); const read = fs.readSync(fd, header, 0, header.length, 0);
      thinVersions(header.subarray(0, read), 0, out);
    }
    return out;
  } finally { fs.closeSync(fd); }
}

const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

function checkMinimumMacOS(appPath, min = MIN_MACOS) {
  const problems = [];
  let checked = 0;
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!entry.name.endsWith('.dSYM')) walk(file); continue; }
      const versions = minimumVersions(file);
      if (versions.length) checked++;
      for (const v of versions) if (newer(v, min) && !MACOS14_ONLY.test(file)) problems.push(path.relative(appPath, file) + ' verlangt macOS ' + v);
    }
  };
  walk(appPath);
  if (!checked) throw Error('Keine Programmdateien gefunden: ' + appPath);
  if (problems.length) throw Error('App läuft nicht auf macOS ' + min + ':\n' + [...new Set(problems)].join('\n'));
  console.log('macOS-' + min + '-Prüfung bestanden (' + checked + ' Programmdateien): ' + appPath);
}

module.exports = { checkMinimumMacOS, minimumVersions, MIN_MACOS };
