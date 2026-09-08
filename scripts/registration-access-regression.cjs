const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
function load(file,mocks={}){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports}
const response={NextResponse:{json:(body,o)=>({body,status:o?.status||200})}}
let calls=[],existing=false
const database={db:async(path,init)=>{
 calls.push({path,method:init?.method,body:init?.body&&JSON.parse(init.body)})
 if(path.startsWith("app_users?"))return existing?[{id:"11111111-1111-4111-8111-111111111111",email:"member@example.com",password_salt:"salt",password_hash:"hash"}]:[]
 if(path==="app_users"&&init?.method==="POST"){existing=true;return []}
 return []
}}
const auth={hashUserPassword:()=>({salt:"salt",hash:"hash"}),verifyUserPassword:(password,salt,hash)=>password==="safe-test-password"&&salt==="salt"&&hash==="hash"}
const reg=load("lib/registration.ts",{"@/lib/supabase":database,"@/lib/auth":auth})
const signup=load("app/api/auth/signup/route.ts",{"next/server":response,"@/lib/registration":reg})
const req=(body={},origin=reg.APP_ORIGIN)=>new Request(reg.APP_ORIGIN+"/api/auth/signup",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({name:"Member",email:"member@example.com",password:"safe-test-password",...body})})
;(async()=>{
 assert.equal((await signup.POST(req({},"https://attacker.invalid"))).status,403);assert.equal(calls.length,0)
 assert.equal((await signup.POST(req({password:"short"}))).status,400);assert.equal(calls.length,0)
 assert.equal((await signup.POST(req({website:"bot"}))).status,200);assert.equal(calls.length,0)
 const result=await signup.POST(req());assert.equal(result.status,200);assert.equal(result.cookies,undefined)
 const insert=calls.find(call=>call.method==="POST");assert.ok(insert);assert.equal(insert.body.email,"member@example.com");assert.equal(insert.body.password_hash,"hash");assert.ok(!JSON.stringify(calls).includes("safe-test-password"))
 assert.equal((await signup.POST(req())).status,409)
 const login=fs.readFileSync("components/login-form.tsx","utf8");assert.ok(login.includes("/api/auth/signup"));assert.ok(login.includes("No verification email is required"))
 console.log("PASS: open signup origin/input/honeypot checks, secure password storage, duplicate protection and no automatic session")
})().catch(e=>{console.error(e);process.exitCode=1})
