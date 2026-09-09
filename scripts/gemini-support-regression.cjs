const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/support-gemini.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
async function main() {
  const env = {}
  let requests = 0
  let response = {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Hello from Orbit'}]}}]})}
  const module = {exports:{}}
  new Function('exports','module','process','fetch',code)(module.exports,module,{env},async()=>{requests++;return response})
  const fallback = {reply:'Local answer',mode:'knowledge',needsHuman:false}
  const call = () => module.exports.geminiSupport('How do invoices work?',{},fallback)
  assert.equal(await call(),fallback)
  env.GEMINI_API_KEY = 'test-only'
  assert.equal(await call(),fallback)
  assert.equal(requests,0,'Disabled AI must never send conversations')
  env.ORBIT_SUPPORT_AI_ENABLED = 'true'
  assert.equal((await call()).reply,'Hello from Orbit')
  const human = {...fallback,needsHuman:true}
  assert.equal(await module.exports.geminiSupport('Help',{},human),human)
  assert.equal(requests,1)
  response = {ok:false,status:429}
  assert.equal(await call(),fallback)
  response = {ok:true,json:async()=>({})}
  assert.equal(await call(),fallback)
  console.log('PASS: Gemini is opt-in, respects human handoff and falls back safely')
}
main().catch(error=>{console.error(error);process.exitCode=1})
