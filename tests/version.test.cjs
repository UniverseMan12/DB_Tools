const {test}=require('node:test');
const assert=require('node:assert/strict');
const {macBuildVersion}=require('../scripts/version.cjs');
test('Beta builds advance numerically; stable and the next patch sort after them',()=>{
 assert.equal(macBuildVersion('1.2.0-beta.3'),'1.2.3');
 assert.equal(macBuildVersion('1.2.0-beta.4'),'1.2.4');
 assert.equal(macBuildVersion('1.2.0'),'1.2.999');
 assert.equal(macBuildVersion('1.2.1-beta.1'),'1.2.1001');
 assert.equal(macBuildVersion('1.2.1'),'1.2.1999');
 assert.throws(()=>macBuildVersion('1.2.0-beta.999'));
 assert.throws(()=>macBuildVersion('1.2.0-beta.0'));
});
