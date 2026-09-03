const fs=require("node:fs"),assert=require("node:assert/strict"),ts=require("typescript")
function compile(path,requireFn=require){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(requireFn,m,m.exports);return m.exports}
const config=compile("lib/plan-pricing.ts")
const route=compile("app/api/plan-pricing/route.ts",id=>id==="@/lib/plan-pricing"?config:id==="next/server"?{NextResponse:{json:(body,options)=>({body,...options})}}:require(id))
const original=global.fetch
;(async()=>{
 global.fetch=async()=>({ok:true,json:async()=>({rate:5,date:"2026-09-03"})})
 for(const currency of config.planCurrencies){
  const result=await route.GET(new Request("https://orbit.test/api/plan-pricing?currency="+currency))
  assert.equal(result.body.currency,currency)
  assert.equal(result.body.rate,currency==="USD"?1:5)
  assert.equal(result.headers["Cache-Control"],"private, no-store")
 }
 for(const country of Object.keys(config.countryCurrency)){
  const result=await route.GET(new Request("https://orbit.test/api/plan-pricing",{headers:{"x-vercel-ip-country":country}}))
  assert.equal(result.body.currency,config.countryCurrency[country])
 }
 assert.equal((await route.GET(new Request("https://orbit.test/api/plan-pricing?currency=BAD"))).status,400)
 assert.equal(config.priceInCurrency(19.99,5).toFixed(2),"99.95")
 assert.throws(()=>config.priceInCurrency(19.99,0))
 global.fetch=async()=>{throw Error("offline")}
 const fallback=await route.GET(new Request("https://orbit.test/api/plan-pricing?currency=BRL"))
 assert.equal(fallback.body.currency,"USD");assert.equal(fallback.body.rate,1);assert.equal(fallback.body.fallback,true)
 console.log("PASS: 10 currencies, 15 country mappings, conversion math, invalid currency and safe USD fallback")
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>global.fetch=original)
