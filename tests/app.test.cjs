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
  assert.throws(()=>Preferences.project({...value,planner:{...value.planner,rows:[['A','60','72','201']]}}),/Stückzahl/);
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
  assert.equal(result.area + result.rest.reduce((s,r)=>s+r.w*r.h,0),12200*result.length);
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
