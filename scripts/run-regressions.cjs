const { readdirSync } = require("node:fs")
const { spawnSync } = require("node:child_process")
const { join } = require("node:path")

const scripts = readdirSync(__dirname)
  .filter((name) => name.endsWith("-regression.cjs"))
  .filter((name) => name !== "registration-closed-regression.cjs")
  .sort()

for (const script of scripts) {
  console.log(`\n> ${script}`)
  const result = spawnSync(process.execPath, [join(__dirname, script)], {
    stdio: "inherit",
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log(`\nPASS: ${scripts.length} regression suites completed.`)
