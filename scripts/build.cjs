'use strict';
const { build, Platform } = require('electron-builder');
const { Arch } = require('builder-util');
const path = require('node:path');
const asar = require('@electron/asar');
const release = process.argv.includes('--release');
(async () => {
  if (release && !(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) && !process.env.APPLE_API_KEY) throw Error('Apple-Zugang für die Notarisierung fehlt. Siehe Anleitung.');
  if (release && !process.env.CSC_NAME && !process.env.CSC_LINK) throw Error('CSC_NAME oder CSC_LINK für Developer ID Application angeben.');
    await build({ targets: Platform.MAC.createTarget(['dmg', 'zip'], Arch.universal), publish: 'never', config: {
      forceCodeSigning: release,
      afterPack: async context => {
        const archive = path.join(context.appOutDir, 'DB Tools.app/Contents/Resources/app.asar');
        for (const file of ['package.json', 'electron/main.cjs', 'app/index.html', 'node_modules/electron-updater/package.json']) {
          if (!asar.extractFile(archive, file).length) throw Error('Unvollständiger App-Build: ' + file);
        }
      },
      mac: release ? { identity: process.env.CSC_NAME, notarize: true } : { identity: null, notarize: false },
      publish: [{ provider: 'github', owner: 'UniverseMan12', repo: 'DB_Tools', private: false, releaseType: 'release', publishAutoUpdate: release }]
    } });
})().catch(e => { console.error(e.message); process.exitCode = 1; });
