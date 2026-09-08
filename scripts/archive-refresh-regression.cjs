const fs=require('node:fs'),assert=require('node:assert/strict');
const manager=fs.readFileSync('components/archive-manager.tsx','utf8'),ops=fs.readFileSync('components/operations-dashboard.tsx','utf8'),legacy=fs.readFileSync('components/orbit-archive-controls.tsx','utf8');
assert.ok(manager.includes('data-orbit-archive-resource={resource}'));
assert.ok(!manager.includes('location.reload'));
assert.ok(legacy.includes('!controls.querySelector(\'[data-orbit-archive-resource="clients"]\')'));
assert.ok(ops.includes('items={(db.projects || []).filter((x:R)=>!x.archived)}'));
for(const file of ['archive-manager','permanent-delete-button','crm-email-actions','operations-dashboard'])assert.ok(fs.readFileSync('components/'+file+'.tsx','utf8').includes('orbit:records-changed'));
console.log('PASS: one archive entry point, reactive archive notifications, hidden deleted projects and no restore reload');
