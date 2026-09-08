const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id],m,m.exports);return m.exports}
let user={id:'11111111-1111-4111-8111-111111111111'},allowed=true,visible=true,calls=[];
const api=load('app/api/leads/transition/route.ts',{
 'next/server':{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}},
 'next/headers':{cookies:async()=>({get:()=>({value:'session'})})},
 '@/lib/auth':{getSession:async()=>user},
 '@/lib/plan-access':{accountAccess:async()=>({features:allowed?['leads','clients','projects']:[]}),upgradeResponse:()=>({status:403}),planWriteError:()=>null},
 '@/lib/supabase':{db:async(path,init)=>{calls.push({path,init});if(path.startsWith('workspace_members'))return [];if(path.startsWith('rpc/'))return {lead:{id:'created'}};return visible?[{user_id:user.id}]:[]}}
});
const req=body=>({json:async()=>body});
(async()=>{
 const id='22222222-2222-4222-8222-222222222222';
 assert.equal((await api.POST(req({id,changes:{status:'New',user_id:'spoof'}}))).status,200);
 let payload=JSON.parse(calls.at(-1).init.body);assert.equal(payload.p_owner,user.id);assert.ok(!('user_id' in payload.p_changes));
 assert.equal((await api.POST(req({changes:{company:'Test',status:'Client'}}))).status,200);
 assert.equal(JSON.parse(calls.at(-1).init.body).p_id,null);
 assert.equal((await api.POST(req({clientId:id,changes:{status:'New'}}))).status,200);assert.equal(calls.at(-1).path,'rpc/orbit_reenter_client');
 visible=false;assert.equal((await api.POST(req({id,changes:{status:'New'}}))).status,403);
 visible=true;allowed=false;assert.equal((await api.POST(req({id,changes:{status:'New'}}))).status,403);
 allowed=true;assert.equal((await api.POST(req({id,changes:{status:'Hacked'}}))).status,400);
 assert.equal((await api.POST(req({id:'bad',changes:{status:'New'}}))).status,400);
 user=null;assert.equal((await api.POST(req({id,changes:{status:'New'}}))).status,401);
 const route=fs.readFileSync('app/api/data/[resource]/route.ts','utf8');
 assert.ok(route.includes('if(!row.archived || confirmation!=="DELETE")'));
 assert.ok(route.includes('&archived=eq.true'));
 console.log('PASS: CRM create/reentry routing, workspace ownership, permissions, input validation and archive deletion guards');
})().catch(e=>{console.error(e);process.exitCode=1});
