const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports });
  return JSON.parse(JSON.stringify(exports.default()));
}
const sitemap = load("app/sitemap.ts");
assert.deepEqual(sitemap.map(row => row.url), ["https://orbit-lm.com/", "https://orbit-lm.com/plans"]);
assert.ok(sitemap.every(row => !row.lastModified));
const robots = load("app/robots.ts");
assert.equal(robots.sitemap, "https://orbit-lm.com/sitemap.xml");
assert.equal(robots.rules.allow, "/");
assert.ok(robots.rules.disallow.includes("/api/"));
assert.ok(robots.rules.disallow.includes("/dashboard"));
assert.ok(!robots.rules.disallow.includes("/orbit-plans.html"));
assert.ok(!fs.existsSync("public/sitemap.xml"), "Avoid conflicting sitemap routes");
assert.ok(!fs.existsSync("public/robots.txt"), "Avoid conflicting robots routes");
console.log("PASS: canonical public sitemap, private routes excluded, robots discovery, no duplicate routes");
