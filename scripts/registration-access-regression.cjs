const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
function load(file,mocks={}){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports}
const response={NextResponse:{json:(body,o)=>({body,status:o?.status||200}),redirect:(url,status)=>({url:String(url),status})}}
let calls=[],allowed=true,mails=[],mailOk=true,confirmation=true,user=null
const database={db:async(path,init)=>{calls.push({path,body:init?.body&&JSON.parse(init.body)});if(path.includes("registration_request"))return allowed;if(path.includes("registration_confirm"))return confirmation;if(path.startsWith("app_users"))return [{id:"11111111-1111-4111-8111-111111111111",email:"member@example.com",name:"Member"}];return []}}
process.env.SESSION_SECRET="a".repeat(64);process.env.RESEND_API_KEY="test-only";process.env.RESEND_FROM_EMAIL="test@example.com"
global.fetch=async(url,init)=>{mails.push(JSON.parse(init.body));return {ok:mailOk}}
const reg=load("lib/registration.ts",{"@/lib/supabase":database,"@/lib/auth":{hashUserPassword:()=>({salt:"salt",hash:"hashed-password"})}})
const signup=load("app/api/auth/signup/route.ts",{"next/server":response,"@/lib/registration":reg})
const verify=load("app/api/auth/verify/route.ts",{"next/server":response,"@/lib/registration":reg,"@/lib/supabase":database})
const req=(body={},origin=reg.APP_ORIGIN)=>new Request(reg.APP_ORIGIN+"/api/auth/signup",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({name:"Member",email:"member@example.com",password:"safe-test-password",...body})})
const owners=new Set(["00000000-0000-4000-8000-000000000001"])
const admin=load("app/api/admin/plans/route.ts",{"next/server":response,"next/headers":{cookies:async()=>({get:()=>({value:"session"})})},"@/lib/auth":{getSession:async()=>user},"@/lib/supabase":database,"@/lib/plan-access":{ownerAccountIds:owners,accountAccess:async()=>({plan:"none"})}})
;(async()=>{
 assert.equal((await signup.POST(req({}, "https://attacker.invalid"))).status,403);assert.equal(calls.length,0)
 assert.equal((await signup.POST(req({password:"short"}))).status,400);assert.equal(calls.length,0)
 assert.equal((await signup.POST(req({website:"bot"}))).status,200);assert.equal(calls.length,0)
 const result=await signup.POST(req());assert.equal(result.status,200);assert.equal(result.cookies,undefined);assert.equal(mails.length,1)
 const token=mails[0].text.match(/token=([a-f0-9]{64})/)[1]
 assert.equal(calls[0].body.p_token_hash,reg.tokenHash(token));assert.equal(calls[0].body.p_password_hash,"hashed-password");assert.ok(!JSON.stringify(calls).includes("safe-test-password"))
 allowed=false;const duplicate=await signup.POST(req());assert.deepEqual(duplicate,result);assert.equal(mails.length,1)
 const before=calls.length;assert.equal((await verify.GET(new Request(reg.APP_ORIGIN+"/api/auth/verify?token="+token))).status,200);assert.equal(calls.length,before,"Email scanner GET must not create account")
 const confirm=()=>new Request(reg.APP_ORIGIN+"/api/auth/verify",{method:"POST",headers:{origin:reg.APP_ORIGIN},body:"token="+token})
 assert.equal((await verify.POST(confirm())).status,303);confirmation=false;assert.equal((await verify.POST(confirm())).status,400)
 allowed=true;mailOk=false;assert.equal((await signup.POST(req())).status,503);assert.ok(calls.at(-1).path.includes("orbit_registration_pending"))
 const beforeAdmin=calls.length;assert.equal((await admin.GET(new Request(reg.APP_ORIGIN+"/api/admin/plans?email=member@example.com"))).status,403);assert.equal(calls.length,beforeAdmin)
 user={id:[...owners][0]};assert.equal((await admin.GET(new Request(reg.APP_ORIGIN+"/api/admin/plans?email=member@example.com"))).status,200)
 const assign=(body,origin=reg.APP_ORIGIN)=>new Request(reg.APP_ORIGIN+"/api/admin/plans",{method:"POST",headers:{origin},body:JSON.stringify({email:"member@example.com",plan:"small_business",status:"active",accessUntil:new Date(Date.now()+86400000).toISOString(),...body})})
 assert.equal((await admin.POST(assign({},"https://attacker.invalid"))).status,403)
 assert.equal((await admin.POST(assign({plan:"owner"}))).status,400)
 assert.equal((await admin.POST(assign({accessUntil:"2000-01-01"}))).status,400)
 assert.equal((await admin.POST(assign({}))).status,200);assert.equal(calls.at(-1).body.p_actor,user.id)
 const login=fs.readFileSync("components/login-form.tsx","utf8");assert.ok(login.includes("/api/auth/signup"));assert.ok(login.includes("/api/auth/login"));assert.ok(!login.includes("registrations are currently closed"))
 console.log("PASS: verified signup, no session before sign-in, generic duplicate/rate response, token hashing, mail failures, safe scanner GET, expired links, owner-only access assignment and input/origin checks")
})().catch(e=>{console.error(e);process.exitCode=1})

