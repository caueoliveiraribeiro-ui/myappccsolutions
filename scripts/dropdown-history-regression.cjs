const fs=require('node:fs'),assert=require('node:assert/strict');
const css=fs.readFileSync('app/orbit-polish.css','utf8'),ops=fs.readFileSync('components/operations-dashboard.tsx','utf8'),archive=fs.readFileSync('components/orbit-archive-controls.tsx','utf8');
assert.ok(css.includes('.invoice-create-card { background-color:#07111f; }'));
assert.ok(css.includes('details[class~="border"]'));
assert.ok(css.includes('scrollbar-color:var(--orbit-scroll-thumb)'));
assert.ok(css.includes('select :is(option,optgroup)'));
assert.ok(ops.includes('!["Client", "Won"].includes(x.status) && (archiveMode ? x.archived : !x.archived && x.status === "Lost")'));
assert.ok(archive.includes('searchWrapper?.parentElement === controls'));
console.log('PASS: explicit dark invoice surface, nested-border scope, Orbit native controls, Won history exclusion and safe archive insertion');
