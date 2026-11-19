'use strict';
const { build, Platform } = require('electron-builder');
const { Arch } = require('builder-util');
const { electronSparkle } = require('electron-sparkle/electron-builder');
const path = require('node:path');
const asar = require('@electron/asar');
const { checkMinimumMacOS } = require('./macos-min.cjs');
const config = require('../electron/update-config.json');
const { macBuildVersion } = require('./version.cjs');
const staging = process.argv.includes('--staging');
const dirOnly = process.argv.includes('--dir');
const output = staging ? process.env.DB_TOOLS_QA_OUT || 'qa-builds/staging' : 'dist-free';
const name = staging ? 'DB Tools Update-Test' : 'DB Tools';
(async () => {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(config.publicEdKey)) throw Error('Gültiger öffentlicher Update-Schlüssel fehlt.');
  await build({ targets: Platform.MAC.createTarget(dirOnly ? ['dir'] : staging ? ['zip'] : ['dmg', 'zip'], staging ? Arch.arm64 : Arch.universal), publish: 'never', config: {
    productName: name,
    buildVersion: macBuildVersion(staging ? process.env.DB_TOOLS_QA_VERSION || '1.1.0' : require('../package.json').version),
    appId: staging ? 'ch.dbsolution.dbtools.updatetest' : 'ch.dbsolution.dbtools',
    directories: { output }, forceCodeSigning: false,
    ...(staging ? { extraMetadata: { version: process.env.DB_TOOLS_QA_VERSION || '1.1.0', dbToolsUpdateTest: true } } : {}),
    mac: {
      identity: '-', hardenedRuntime: false, notarize: false,
      extendInfo: {
        SUFeedURL: staging ? 'http://127.0.0.1:8765/appcast.xml' : config.feedUrl,
        SUPublicEDKey: staging && process.env.DB_TOOLS_QA_PUBLIC_KEY ? process.env.DB_TOOLS_QA_PUBLIC_KEY : config.publicEdKey,
        SUEnableAutomaticChecks: true, SUAutomaticallyUpdate: true, SUAllowsAutomaticUpdates: true,
        SUScheduledCheckInterval: 14400, SUShowReleaseNotes: false,
        SUVerifyUpdateBeforeExtraction: true, SURequireSignedFeed: true,
        SUSignedFeedFailureExpirationInterval: 0, CFBundleLocalizations: ['de', 'en']
      }
    },
    dmg: { writeUpdateInfo: false, sign: false }, publish: null,
    afterPack: async context => {
      const archive = path.join(context.appOutDir, name + '.app/Contents/Resources/app.asar');
      for (const file of ['package.json', 'electron/main.cjs', 'app/index.html', 'node_modules/electron-sparkle/package.json']) {
        if (!asar.extractFile(archive, file).length) throw Error('Unvollständiger App-Build: ' + file);
      }
      await electronSparkle(context);
      checkMinimumMacOS(path.join(context.appOutDir, name + '.app'));
    }
  } });
})().catch(e => { console.error(e); process.exitCode = 1; });
