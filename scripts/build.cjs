'use strict';
const { build, Platform } = require('electron-builder');
const { Arch } = require('builder-util');
const release = process.argv.includes('--release');
(async () => {
  if (release && !(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) && !process.env.APPLE_API_KEY) throw Error('Apple-Zugang für die Notarisierung fehlt. Siehe Anleitung.');
  if (release && !process.env.CSC_NAME && !process.env.CSC_LINK) throw Error('CSC_NAME oder CSC_LINK für Developer ID Application angeben.');
    await build({ targets: Platform.MAC.createTarget(['dmg', 'zip'], Arch.universal), publish: 'never', config: {
      forceCodeSigning: release,
      mac: release ? { identity: process.env.CSC_NAME, notarize: true } : { identity: null, notarize: false },
      publish: [{ provider: 'github', owner: 'UniverseMan12', repo: 'DB_Tools', private: false, releaseType: 'release', publishAutoUpdate: release }]
    } });
})().catch(e => { console.error(e.message); process.exitCode = 1; });
