const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  const module = {exports:{}}
  new Function('exports', 'module', code)(module.exports, module)
  return module.exports
}
const {foodTimestamp, foodDayKey, groupFoodHistory} = load('lib/food-history.ts')
const {answerOrbitSupport} = load('lib/orbit-support-agent.ts')
async function main() {
  const now = new Date(2026, 8, 8, 0, 10)
  assert.equal(foodTimestamp('2026-09-08', now), now.toISOString())
  assert.equal(foodDayKey(foodTimestamp('2026-09-07', now)), '2026-09-07')
  for (const invalid of ['2026-09-09', '2026-02-30', '', 'not a date']) assert.equal(foodTimestamp(invalid, now), null)
  assert.equal(groupFoodHistory([{consumed_at:foodTimestamp('2026-09-07',now),calories:100,grams:20},{consumed_at:foodTimestamp('2026-09-07',now),calories:50,grams:10}])[0].calories,150)
  assert.match((await answerOrbitSupport('send invoice email')).reply,/To create an invoice/)
  assert.match((await answerOrbitSupport('how?',{history:[{role:'user',content:'invoice'}]})).reply,/To create an invoice/)
  assert.match((await answerOrbitSupport('health')).reply,/date you ate/)
  assert.equal((await answerOrbitSupport('Talk to support')).needsHuman,false)
  assert.equal((await answerOrbitSupport('Talk to support',{authenticated:true})).needsHuman,true)
  assert.notEqual((await answerOrbitSupport('personal')).needsHuman,true)
  assert.match((await answerOrbitSupport('payment')).reply,/Awaiting payment/)
  assert.match((await answerOrbitSupport('hello')).reply,/Hi!/)
  assert.match((await answerOrbitSupport('save failed')).reply,/cannot inspect or change/)
  console.log('PASS: food dates, daily totals, chat routing, follow-up context and authenticated handoff')
}
main().catch(error=>{console.error(error);process.exitCode=1})
