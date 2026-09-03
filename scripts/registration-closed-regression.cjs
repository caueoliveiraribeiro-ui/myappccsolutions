const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
const source=fs.readFileSync("app/api/auth/signup/route.ts","utf8")
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const m={exports:{}}
const forbidden=()=>{throw Error("Closed signup must not read or write users or issue sessions")}
new Function("require","module","exports",output)(id=>id==="next/server"?{NextResponse:{json:(body,options)=>({body,...options})}}:id==="@/lib/supabase"?{db:forbidden}:{createSession:forbidden,hashUserPassword:forbidden},m,m.exports)
;(async()=>{
 for(const email of ["caue.oliveira.ribeiro@gmail.com","new@example.com"]){
  const response=await m.exports.POST({json:forbidden,email})
  assert.equal(response.status,403)
  assert.match(response.body.error,/registration is currently closed/i)
  assert.equal(response.cookies,undefined)
 }
 const page=fs.readFileSync("components/login-form.tsx","utf8")
 assert(!page.includes("/api/auth/signup"))
 assert(page.includes("/api/auth/login"))
 assert(page.includes("New registrations are currently closed"))
 console.log("PASS: signup denied before body parsing, DB access or session creation; sign-in retained")
})().catch(e=>{console.error(e);process.exitCode=1})
