'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { publicEdKey } = require('../electron/update-config.json');
const { version } = require('../package.json');
const directory = 'dist-free';
let privateFile = process.env.SPARKLE_PRIVATE_KEY_FILE;
let temporary;
try {
  if (!privateFile) {
    if (!process.env.SPARKLE_PRIVATE_KEY) throw Error('SPARKLE_PRIVATE_KEY oder SPARKLE_PRIVATE_KEY_FILE fehlt. Siehe Anleitung.');
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dbtools-sign-'));
    privateFile = path.join(temporary, 'update.private');
    fs.writeFileSync(privateFile, process.env.SPARKLE_PRIVATE_KEY.trim()+'\n', {mode:0o600});
  }
  const seed = Buffer.from(fs.readFileSync(privateFile,'utf8').trim(), 'base64');
  if (seed.length !== 32) throw Error('Der Update-Schlüssel muss ein gültiger Sparkle-Ed25519-Schlüssel mit 32 Byte Seed sein.');
  const key = crypto.createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),seed]),format:'der',type:'pkcs8'});
  const publicValue = Buffer.from(crypto.createPublicKey(key).export({format:'jwk'}).x,'base64url').toString('base64');
  if (publicValue !== publicEdKey) throw Error('Privater Schlüssel passt nicht zur installierten App. Keinen neuen Schlüssel erzeugen.');
  const feedDir=path.join(directory,'feed');fs.mkdirSync(feedDir,{recursive:true});
  const archive='DB-Tools-'+version+'-universal.zip';
  fs.copyFileSync(path.join(directory,archive),path.join(feedDir,archive));
  const cli=path.join(path.dirname(require.resolve('electron-sparkle/package.json')),'dist/cli.js');
  execFileSync(process.execPath,[cli,'generate-appcast','--ed-key-file',privateFile,'--download-url-prefix','https://github.com/UniverseMan12/DB_Tools/releases/download/v'+version+'/','--maximum-deltas','0',feedDir],{stdio:'inherit'});
  const feed=path.join(feedDir,'appcast.xml');
  execFileSync(process.execPath,[cli,'sign-update','--verify','--ed-key-file',privateFile,feed],{stdio:'inherit'});
  fs.copyFileSync(feed,path.join(directory,'appcast.xml'));
  console.log('Update-Archiv und signierter Appcast für Version '+version+' sind bereit.');
} finally {
  if(temporary)fs.rmSync(temporary,{recursive:true,force:true});
}
