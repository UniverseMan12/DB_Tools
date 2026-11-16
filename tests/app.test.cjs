const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Packing = require('../app/packing.js');
const { readSettings, writeSettings } = require('../electron/settings.cjs');
const { hasDeveloperID } = require('../electron/apple-signature.cjs');
test('Updater erkennt Developer ID am App-Bundle und lehnt ad-hoc-Signaturen ab', () => {
  const executable='/Applications/DB Tools.app/Contents/MacOS/DB Tools';
  const signed=(command,args)=>{assert.equal(command,'/usr/bin/codesign');assert.equal(args.at(-1),'/Applications/DB Tools.app');return {status:0,stderr:'Authority=Developer ID Application: Example (TEAM123456)\n'};};
  assert.equal(hasDeveloperID(executable,true,signed),true);
  assert.equal(hasDeveloperID(executable,false,signed),false);
  assert.equal(hasDeveloperID(executable,true,()=>({status:0,stderr:'Signature=adhoc\n'})),false);
  assert.equal(hasDeveloperID(executable,true,()=>({status:1,stderr:'code object is not signed at all'})),false);
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
