const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict")
let rows=[],calls=0,fail=false
const m={exports:{}}
new Function("require","module","exports",ts.transpileModule(fs.readFileSync("lib/auth.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==="@/lib/supabase"?{db:async()=>{calls++;if(fail)throw Error("offline");return rows}}:require(id),m,m.exports)
;(async()=>{
 const auth=m.exports,id="956f1193-ca69-4a04-a978-d509bec9eb75",email="test@example.com",token=auth.createSession(email,id)
 rows=[{id}];assert.equal((await auth.getSession(token)).id,id)
 rows=[];assert.equal(await auth.getSession(token),null)
 rows=[{id:"different"}];assert.equal(await auth.getSession(token),null)
 fail=true;assert.equal(await auth.getSession(token),null)
 const before=calls;assert.equal((await auth.getSession(auth.createSession("owner@example.com"))).id,auth.OWNER_ID);assert.equal(calls,before)
 assert.equal(await auth.getSession(token+"tampered"),null)
 console.log("PASS: removed accounts rejected; active and legacy owner sessions preserved; tampering and DB failure rejected")
})().catch(e=>{console.error(e);process.exitCode=1})
