const crypto = require('node:crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Packing = require('../app/packing.js');
const { readSettings, writeSettings } = require('../electron/settings.cjs');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../electron/updates.cjs');
const Preferences = require('../app/preferences.js');
test('Kostenloser Updater startet ohne Developer ID und steuert Download, Installation und Fehler', async () => {
  const native=new EventEmitter();let started=0,manual=0,background=0,checks,downloads;
  Object.assign(native,{start:async()=>{started++;},getState:()=>({started:true}),setAutomaticallyChecksForUpdates:v=>{checks=v;},setAutomaticallyDownloadsUpdates:v=>{downloads=v;},checkForUpdates:()=>{manual++;},checkForUpdatesInBackground:()=>{background++;}});
  const controller=createUpdates({updater:native,packaged:true,automatic:true,notify:()=>{}});
  await controller.start();assert.equal(started,1);assert.equal(checks,true);assert.equal(downloads,true);
  controller.check(true);assert.equal(background,1);
  native.emit('update-available',{update:{displayVersion:'1.1.1'}});assert.equal(controller.getState().kind,'downloading');
  native.emit('update-downloaded',{update:{displayVersion:'1.1.1'}});assert.equal(controller.getState().kind,'ready');
  controller.showInstall();assert.equal(manual,1);
  controller.setAutomatic(false);assert.equal(checks,false);assert.equal(downloads,false);
  native.emit('error',{error:new Error('Invalid signature')});assert.equal(controller.getState().kind,'error');assert.match(controller.getState().message,/abgelehnt/);
});
test('Projektdateien werden validiert; Schadcode und ungültige Stückzahlen werden nicht übernommen', () => {
  const value={format:'db-tools-project',version:1,planner:{rows:[['Front','60','72','4']],rollW:'122',rollH:'50',allowance:'2',film:'uni',measure:'finished'},preferences:{theme:'dark',density:'compact',accent:'teal'}};
  const data=Preferences.project(value);assert.equal(data.planner.rows[0][0],'Front');assert.equal(data.preferences.theme,'dark');
  assert.throws(()=>Preferences.project({...value,version:2}),/unterstützt/);
  assert.throws(()=>Preferences.project({...value,planner:{...value.planner,rows:[['A','60','72','501']]}}),/Stückzahl/);
  assert.throws(()=>Preferences.project({...value,planner:{...value.planner,rollW:'<script>'}}),/Ungültige/);
  assert.equal(Preferences.clean({theme:'invalid',motion:false,defaultRollH:-1}).theme,'system');
  assert.equal(Preferences.clean({motion:false}).motion,false);
  assert.equal(Preferences.clean({defaultRollH:-1}).defaultRollH,50);
});
test('Beispiel: keine Überschneidungen, vollständige Flächenbilanz', () => {
  const parts = []; for (const [name,w,h,n] of [['Front',6000,7200,4],['Wand',5800,21000,2],['Blende',9000,1800,3],['Tisch',12000,8000,1]]) for(let i=0;i<n;i++) parts.push({id:parts.length,name,w,h});
  const result = Packing.optimize(parts,12200,500000,true);
  Packing.validate(result,parts,12200,500000,true);
  assert.equal(result.placed.length,10);
  assert.equal(result.area + [...result.rest,...result.scrap].reduce((s,r)=>s+r.w*r.h,0),12200*result.length);
  for(let i=0;i<result.rest.length;i++) {for(const p of result.placed) assert.equal(Packing.overlap(result.rest[i],p),false); for(let j=i+1;j<result.rest.length;j++) assert.equal(Packing.overlap(result.rest[i],result.rest[j]),false);}
});
test('Strukturfolie wird nicht gedreht; unpassende Masse werden abgewiesen', () => {
  const p = [{id:0,name:'Test',w:60,h:100}];
  assert.throws(()=>Packing.optimize(p,50,200,false),/passt nicht/);
  const result = Packing.optimize(p,120,200,false);
  assert.equal(result.placed[0].rotated,false);
  assert.throws(()=>Packing.optimize([{...p[0],w:-2}],120,200,true),/Ungültige/);
});
test('Update-Einstellungen bleiben über Neustarts erhalten; beschädigte Datei fällt sicher zurück', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dbtools-test-'));
  try {
    const file=path.join(dir,'updates.json'), defaults={automatic:true};
    assert.deepEqual(readSettings(file,defaults),defaults);
    writeSettings(file,{automatic:false});
    assert.equal(readSettings(file,defaults).automatic,false);
    assert.throws(()=>writeSettings(file,{automatic:'true'}),/Ungültige/);
    fs.writeFileSync(file,'not json');
    assert.deepEqual(readSettings(file,defaults),defaults);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('Schnittfuge: Teile halten Abstand, Flächenbilanz inklusive Fuge stimmt', () => {
  const parts=[];for(let i=0;i<12;i++)parts.push({id:i,name:'T',w:3000+i*100,h:4000});
  const gap=30, r=Packing.optimize(parts,12200,500000,true,{gap});
  Packing.validate(r,parts,12200,500000,true,gap);
  const rest=[...r.rest,...r.scrap].reduce((s,p)=>s+p.w*p.h,0);
  assert.equal(r.area+rest+r.kerfArea,12200*r.length);
  assert.ok(r.kerfArea>0);
  for(const a of r.placed)for(const b of r.placed)if(a!==b)assert.equal(Packing.overlap({...a,w:a.w+gap,h:a.h+gap},{...b,w:b.w+gap,h:b.h+gap}),false);
});
test('Neue Optimierung ist reproduzierbar und nie schlechter als die einfache Anordnung', () => {
  let seed=7;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let t=0;t<15;t++){
    const parts=[];const n=5+Math.floor(rand()*40);
    for(let i=0;i<n;i++)parts.push({id:i,name:'P',w:(10+Math.floor(rand()*100))*100,h:(10+Math.floor(rand()*150))*100});
    const a=Packing.optimize(parts,12200,10000000,true),b=Packing.optimize(parts,12200,10000000,true);
    assert.equal(a.length,b.length);
    const quick=Packing.optimize(parts,12200,10000000,true,{iterations:0});
    assert.ok(a.length<=quick.length);
  }
});
test('Reststücke werden zu grösseren Rechtecken zusammengefasst', () => {
  const merged=Packing.mergeRest([{x:0,y:0,w:10,h:5},{x:0,y:5,w:10,h:5},{x:10,y:0,w:5,h:10}]);
  assert.deepEqual(merged,[{x:0,y:0,w:15,h:10}]);
});
test('Projektdateien: Komma-Dezimalen und neue optionale Felder; alte Dateien bleiben gültig', () => {
  const base={format:'db-tools-project',version:1,planner:{rows:[['Front','60,5','72','2']],rollW:'122',rollH:'50',allowance:'2',film:'uni',measure:'finished'}};
  const old=Preferences.project(base);assert.equal(old.planner.gap,'');assert.equal(old.planner.projectName,'');
  const next=Preferences.project({...base,planner:{...base.planner,gap:'3',price:'12,5',projectName:'Küche'}});
  assert.equal(next.planner.price,'12.5');assert.equal(next.planner.projectName,'Küche');
  assert.throws(()=>Preferences.project({...base,planner:{...base.planner,gap:'99'}}),/Schnittfuge/);
  assert.equal(Preferences.clean({defaultGap:2.5,defaultPrice:12}).defaultGap,2.5);
});
test('Zugabe pro Position: alte Projekte werden ohne Ergebnisänderung übernommen', () => {
  const base={format:'db-tools-project',version:1,planner:{rows:[['Front','60','72','2']],rollW:'122',rollH:'50',allowance:'2.5',film:'uni',measure:'component'}};
  assert.deepEqual(Preferences.project(base).planner.rows[0],['Front','60','72','2','2.5']);
  assert.equal(Preferences.project({...base,planner:{...base.planner,measure:'finished'}}).planner.rows[0][4],'0');
  const now={format:'db-tools-project',version:1,planner:{rows:[['Front','60','72','2','3'],['Seite','58','210','1','0,5']],rollW:'122',rollH:'50',film:'uni'}};
  assert.deepEqual(Preferences.project(now).planner.rows.map(r=>r[4]),['3','0,5']);
  assert.throws(()=>Preferences.project({...now,planner:{...now.planner,rows:[['A','1','1','1','-2']]}}),/Zugabe/);
  assert.equal(Preferences.clean({}).rowAllowance,3);
});
test('macOS-12-Updater: Appcast, Ed25519-Signatur, Adressen und Versionen', () => {
  const F = require('../electron/fallback-updater.cjs');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
  const data = Buffer.from('update archive bytes');
  const sig = crypto.sign(null, data, privateKey).toString('base64');
  assert.equal(F.verifySignature(data, sig, raw), true);
  assert.equal(F.verifySignature(Buffer.from('manipuliert'), sig, raw), false);
  const other = crypto.generateKeyPairSync('ed25519').publicKey;
  assert.equal(F.verifySignature(data, sig, Buffer.from(other.export({ format: 'jwk' }).x, 'base64url').toString('base64')), false);
  const xml = `<rss><channel>
    <item><title>1.3.0</title><sparkle:version>1.3.999</sparkle:version><sparkle:shortVersionString>1.3.0</sparkle:shortVersionString><sparkle:minimumSystemVersion>12.0</sparkle:minimumSystemVersion><enclosure url="https://github.com/UniverseMan12/DB_Tools/releases/download/v1.3.0/DB-Tools-1.3.0-universal.zip" length="20" type="application/octet-stream" sparkle:edSignature="${sig}"/></item>
    <item><sparkle:version>1.4.999</sparkle:version><sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion><enclosure url="https://github.com/x.zip" length="1" sparkle:edSignature="${sig}"/></item>
  </channel></rss>`;
  const item = F.parseAppcast(xml, '12.7.4');
  assert.equal(item.version, '1.3.999'); assert.equal(item.displayVersion, '1.3.0'); assert.equal(item.length, 20);
  assert.equal(F.parseAppcast(xml, '14.1').version, '1.4.999');
  assert.equal(F.compareVersions('1.3.999', '1.3.1'), 1); assert.equal(F.compareVersions('1.2.3', '1.3.1'), -1); assert.equal(F.compareVersions('1.3.0', '1.3'), 0);
  const feed = 'https://github.com/UniverseMan12/DB_Tools/releases/latest/download/appcast.xml';
  assert.equal(F.allowedUrl(item.url, feed), true);
  assert.equal(F.allowedUrl('http://github.com/a.zip', feed), false);
  assert.equal(F.allowedUrl('https://evil.example/a.zip', feed), false);
  assert.equal(F.allowedUrl('http://127.0.0.1:8765/a.zip', 'http://127.0.0.1:8765/appcast.xml'), true);
  assert.equal(F.plistString('<key>CFBundleVersion</key>\n<string>1.3.999</string>', 'CFBundleVersion'), '1.3.999');
});
