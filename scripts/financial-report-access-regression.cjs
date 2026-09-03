const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
function load(path,mocks={}){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>mocks[n]||require(n),m,m.exports);return m.exports}
const {featuresFor}=load("lib/plan-features.ts")
let signed=true,allowed=true,calls=[],fail=false
const api=load("app/api/reports/export-data/route.ts",{
 "next/server":{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},
 "next/headers":{cookies:async()=>({get:()=>signed?{value:"test"}:null})},
 "@/lib/auth":{getSession:async()=>({id:"owner"})},
 "@/lib/plan-access":{accountAccess:async id=>({features:allowed?featuresFor(id==="shared"?"personal":"small_business"):[]}),upgradeResponse:()=>({status:403})},
 "@/lib/plan-features":load("lib/plan-features.ts"),
 "@/lib/supabase":{db:async path=>{calls.push(path);if(fail)throw Error("Offline");if(path.startsWith("workspace_members"))return [{owner_user_id:"shared"}];if(path.startsWith("payment_records?user_id=eq.owner"))return path.endsWith("offset=0")?Array.from({length:500},(_,i)=>({id:i})):path.endsWith("offset=500")?[{id:500}]:[];return []}}
})
;(async()=>{
 signed=false;assert.equal((await api.GET()).status,401);assert.equal(calls.length,0)
 signed=true;allowed=false;assert.equal((await api.GET()).status,403);assert.equal(calls.length,0)
 allowed=true;const result=await api.GET();assert.equal(result.status,200);assert.equal(result.body.data.payments.length,501)
 assert.ok(calls.some(p=>p.includes("offset=500")))
 assert.ok(calls.some(p=>p.startsWith("holdings?user_id=eq.shared&asset_type=eq.Stock")))
 assert.ok(!calls.some(p=>p.startsWith("payment_records?user_id=eq.shared")))
 assert.ok(calls.filter(p=>!p.startsWith("workspace_members")).every(p=>p.includes("user_id=eq.owner")||p.includes("user_id=eq.shared")))
 fail=true;assert.equal((await api.GET()).status,503)
 console.log("PASS: export authentication, Reports entitlements, workspace isolation, typed shared access, pagination and no partial-success exports.")
})().catch(e=>{console.error(e);process.exitCode=1})

