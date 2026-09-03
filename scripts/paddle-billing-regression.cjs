const fs=require("node:fs"),ts=require("typescript"),assert=require("node:assert/strict"),crypto=require("node:crypto");
function load(file,mocks={}){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>Object.hasOwn(mocks,id)?mocks[id]:require(id),m,m.exports);return m.exports}
const catalog=load("lib/paddle-plans.ts"),paddle=load("lib/paddle.ts");
const response={"next/server":{NextResponse:{json:(body,o)=>({body,status:o?.status||200})}}};
async function main(){
 for(const plan of ["personal","small_business","big_business"])assert.equal(catalog.planForPrice(catalog.paddleOffers[plan].priceId),plan);
 for(const key of ["business_customization","invite_friend"])assert.equal(catalog.planForPrice(catalog.paddleOffers[key].priceId),null);
 assert.equal(catalog.isStandardPlan("owner"),false);
 const now=Date.now(),tsNow=Math.floor(now/1000),raw='{"test":true}',secret="test-secret";
 const sign=crypto.createHmac("sha256",secret).update(tsNow+":"+raw).digest("hex"),header="ts="+tsNow+";h1="+sign;
 assert.ok(paddle.verifyPaddleSignature(raw,header,secret,now));
 assert.ok(!paddle.verifyPaddleSignature(raw+" ",header,secret,now));
 assert.ok(!paddle.verifyPaddleSignature(raw,header,secret,now+10000));
 assert.ok(!paddle.verifyPaddleSignature(raw,header,secret,now-10000));
 assert.ok(!paddle.verifyPaddleSignature(raw,"ts="+tsNow+";h1=00",secret,now));
 let user={id:"11111111-1111-4111-8111-111111111111",email:"verified@example.com"},ready=true,dbCalls=[],apiCalls=[];
 const cookies={"next/headers":{cookies:async()=>({get:()=>user?{value:"test"}:null})}};
 const ownerIds=new Set(["00000000-0000-4000-8000-000000000001"]);
 let requestPrice=catalog.paddleOffers.personal;
 const db=async(path,init)=>{dbCalls.push({path,body:init?.body&&JSON.parse(init.body)});if(path.startsWith("rpc/orbit_begin"))return {id:"22222222-2222-4222-8222-222222222222"};return []};
 const api=async(path,body)=>{apiCalls.push({path,body});if(path.startsWith("/prices"))return {status:"active",billing_cycle:{interval:"month",frequency:1},unit_price:{currency_code:"USD",amount:Math.round(requestPrice.monthlyUsd*100)}};if(path.startsWith("/customers?"))return [{id:"ctm_test",email:user.email,status:"active"}];if(path==="/transactions")return {id:"txn_test"};throw Error("Unexpected API call")};
 const route=load("app/api/billing/checkout/route.ts",{...response,...cookies,"@/lib/auth":{getSession:async()=>user},"@/lib/plan-access":{ownerAccountIds:ownerIds},"@/lib/supabase":{db},"@/lib/paddle-plans":catalog,"@/lib/paddle":{billingReady:()=>ready,ORBIT_ORIGIN:paddle.ORBIT_ORIGIN,paddleApi:api}});
 const req=(body,origin=paddle.ORBIT_ORIGIN)=>({headers:new Headers({origin}),json:async()=>body});
 assert.equal((await route.POST(req({plan:"personal"},"https://attacker.test"))).status,403);
 const account=user;user=null;assert.equal((await route.POST(req({plan:"personal"}))).status,401);
 user={id:[...ownerIds][0]};assert.equal((await route.POST(req({plan:"personal"}))).status,409);
 user=account;ready=false;assert.equal((await route.POST(req({plan:"personal"}))).status,503);ready=true;
 assert.equal((await route.POST(req({plan:"business_customization"}))).status,400);
 for(const plan of ["personal","small_business","big_business"]){
  requestPrice=catalog.paddleOffers[plan];dbCalls=[];apiCalls=[];
  assert.equal((await route.POST(req({plan,user_id:"victim",priceId:catalog.paddleOffers.big_business.priceId}))).status,200);
  const start=dbCalls.find(c=>c.path.startsWith("rpc/"));assert.equal(start.body.p_user,account.id);assert.equal(start.body.p_price,requestPrice.priceId);
  const tx=apiCalls.find(c=>c.path==="/transactions");assert.equal(tx.body.items[0].price_id,requestPrice.priceId);assert.equal(tx.body.customer_id,"ctm_test");
 }
 let binding=[],intent=[{id:"intent",user_id:account.id,plan:"personal",customer_id:"ctm_test"}],written;
 let transaction={id:"txn_test",status:"completed",subscription_id:"sub_test",customer_id:"ctm_test",items:[{price:{id:catalog.paddleOffers.personal.priceId},quantity:1}],billing_period:{ends_at:"2099-01-01T00:00:00Z"}};
 let sub={id:"sub_test",status:"active",customer_id:"ctm_test",items:transaction.items};
 const processor=load("lib/paddle-webhook.ts",{"@/lib/paddle-plans":catalog,"@/lib/supabase":{db:async(path,init)=>{if(path.startsWith("orbit_paddle_subscriptions"))return binding;if(path.startsWith("orbit_paddle_checkouts"))return intent;written=JSON.parse(init.body);return {received:true}}},"@/lib/paddle":{paddleApi:async path=>path.startsWith("/transactions")?transaction:sub}});
 const event={event_id:"evt_test",event_type:"transaction.completed",occurred_at:new Date().toISOString(),data:{id:"txn_test",custom_data:{user_id:"victim"}}};
 await processor.processPaddleEvent(event);assert.equal(written.p_user,account.id);assert.equal(written.p_plan,"personal");
 intent=[];written=null;assert.ok((await processor.processPaddleEvent(event)).ignored);assert.equal(written,null);
 intent=[{id:"intent",user_id:account.id,plan:"big_business",customer_id:"ctm_test"}];await assert.rejects(()=>processor.processPaddleEvent(event),/MISMATCH/);
 binding=[{user_id:account.id,customer_id:"ctm_test"}];sub.status="canceled";await processor.processPaddleEvent({...event,event_type:"subscription.canceled",data:{id:"sub_test"}});assert.equal(written.p_status,"canceled");assert.equal(written.p_paid_until,null);
 sub.items=[{price:{id:catalog.paddleOffers.invite_friend.priceId},quantity:1}];assert.ok((await processor.processPaddleEvent(event)).ignored);
 console.log("PASS: catalog, signatures, account binding, owner protection, checkout guards and webhook routing");
 if(!process.env.PGLITE_MODULE){console.log("SQL tests skipped: set PGLITE_MODULE to an installed @electric-sql/pglite.");return}
 const {PGlite}=require(process.env.PGLITE_MODULE),pg=new PGlite();
 try{
  await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE app_users(id uuid PRIMARY KEY);CREATE TABLE account_subscriptions(user_id uuid PRIMARY KEY,plan text,status text,access_until timestamptz,updated_at timestamptz DEFAULT now());");
  const migration=fs.readFileSync("supabase/orbit-paddle-billing.sql","utf8");
  await pg.exec(migration);await pg.exec(migration);
  const uid=account.id;await pg.query("INSERT INTO app_users VALUES($1)",[uid]);
  const begin=async(plan="personal",price=catalog.paddleOffers.personal.priceId)=>(await pg.query("SELECT orbit_begin_paddle_checkout($1,$2,$3) AS item",[uid,plan,price])).rows[0].item;
  const checkout=await begin();await assert.rejects(()=>begin(),/BUSY/);
  await pg.query("UPDATE orbit_paddle_checkouts SET transaction_id='txn_first',customer_id='ctm_test' WHERE id=$1",[checkout.id]);
  assert.equal((await begin()).transaction_id,"txn_first");
  await assert.rejects(()=>begin("owner","bad"),/INVALID_PLAN/);
  let sequence=0,clock=Date.now();
  const apply=async(overrides={})=>{
   const data={event:"evt_"+ ++sequence,observed:new Date(clock+=100).toISOString(),sub:"sub_test",user:uid,customer:"ctm_test",plan:"personal",status:"active",paid:null,checkout:null,transaction:null,refund:false,...overrides};
   return (await pg.query("SELECT orbit_apply_paddle_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS item",Object.values(data))).rows[0].item;
  };
  const until=new Date(Date.now()+30*86400000).toISOString(),later=new Date(Date.now()+60*86400000).toISOString();
  await assert.rejects(()=>apply(),/UNBOUND/);
  await apply({event:"evt_paid",paid:until,checkout:checkout.id,transaction:"txn_first"});
  const access=async()=>(await pg.query("SELECT * FROM account_subscriptions WHERE user_id=$1",[uid])).rows[0];
  assert.equal((await access()).status,"active");assert.equal((await access()).plan,"personal");
  assert.ok((await apply({event:"evt_paid",status:"canceled"})).duplicate);assert.equal((await access()).status,"active");
  await assert.rejects(()=>begin(),/SUBSCRIPTION_EXISTS/);
  await apply({plan:"big_business"});assert.equal((await access()).plan,"personal"); // no unpaid upgrade
  await apply({status:"past_due"});assert.equal((await access()).status,"past_due");
  await apply({paid:later,transaction:"txn_renewal"});assert.equal((await access()).status,"active");
  await apply({refund:true,transaction:"txn_first"});assert.equal((await access()).status,"active"); // old refund does not remove new period
  await apply({refund:true,transaction:"txn_renewal"});assert.equal((await access()).status,"inactive");
  await apply();assert.equal((await access()).status,"inactive"); // status replay cannot restore refunded access
  await apply({status:"canceled"});assert.equal((await access()).status,"canceled");
  await assert.rejects(()=>apply({observed:"2000-01-01T00:00:00Z"}),/STALE/);
  await pg.exec("SET ROLE anon");
  await assert.rejects(()=>pg.query("SELECT * FROM orbit_paddle_subscriptions"),/permission denied/);
  await assert.rejects(()=>begin(),/permission denied/);
  await pg.exec("RESET ROLE");
  assert.ok((await apply({user:[...ownerIds][0]})).ignored);
  console.log("PASS: SQL migration rerun, atomic checkout, event deduplication, paid periods, no unpaid upgrade, refunds, cancellation, owner and database ACL protections");
 }finally{await pg.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
