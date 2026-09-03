const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript");
function load(file,mocks={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>mocks[n]||(n.includes("payment-status")?load("components/payment-status.ts"):{}),Date,Intl,Set,Map,URL,AbortSignal,process:{env:{ALPHA_VANTAGE_API_KEY:"test"}},fetch:mocks.fetch});return exports;
}
async function main(){
 const {overviewMonthTotals,yearlyReceivedTotal}=load("components/overview-month-totals.ts");
 const payments=[{amount:100,currency:"USD",received_at:"2026-09-05",status:"Payment received"},{amount:250,currency:"BRL",received_at:"2026-09-06",status:"Awaiting payment"},{amount:999,received_at:"2026-09-07",status:"Cancelled"},{amount:30,currency:"USD",received_at:"2025-10-01"},{amount:999,received_at:"2025-09-30"}];
 const convert=(amount,row)=>Number(amount)*(row.currency==="USD"?5:1);
 const totals=overviewMonthTotals({payments,projects:[{id:"p",stage:"Awaiting payment",budget:200,cost:20,currency:"USD",deadline:"2026-09-03"}],expenses:[{amount:12,expense_date:"2026-09-01"},{amount:999,expense_date:"2026-08-01"}],groceries:[{actual_cost:20,month:"2026-09"},{actual_cost:999,month:"2026-08"}],leads:[{status:"New",estimated_value:25,created_at:"2026-09-01"},{status:"New",estimated_value:999,created_at:"2026-08-01"}]},convert,"2026-09");
 assert.equal(totals.payments,500);assert.equal(totals.awaiting,1150);assert.equal(totals.expenses,12);assert.equal(totals.groceries,20);assert.equal(totals.pipeline,25);assert.equal(yearlyReceivedTotal(payments,convert,"2026-09"),650);
 const {paymentPayload,filterLedgerPayments}=load("components/payment-ledger.tsx");
 const form=new FormData();for(const [k,v]of Object.entries({project_name:"Invoice",amount:"100",currency:"USD",received_at:"2026-09-10",status:"Awaiting payment"}))form.set(k,v);
 assert.equal(paymentPayload(form).status,"Awaiting payment");
 form.delete("project_name");assert.equal(paymentPayload(form).project_name,"Payment");assert.equal(paymentPayload(form,{project_name:"Existing linked project"}).project_name,"Existing linked project");
 form.set("status","Aguardando pagamento");assert.throws(()=>paymentPayload(form),/status/);
 const filters={status:"Awaiting payment",month:"2026-09",client:"ana",name:"video",order:"oldest"};
 assert.equal(filterLedgerPayments([{client_name:"Ana",project_name:"Video",status:"Awaiting payment",received_at:"2026-09-02"}],[],filters).length,1);
 const ledger=fs.readFileSync("components/payment-ledger.tsx","utf8");assert.ok(ledger.includes('value={status}'));
 assert.ok(!ledger.includes('name="project_name"')); // no payment-name field in add/edit forms
 const clients=load("lib/client-import.ts");
 const parsed=clients.parseClientCsv('Name,Email,Phone\r\n"Ana, Maria",ANA@example.com,+00123\r\nDuplicate,ana@example.com,0123');
 assert.equal(parsed.clients.length,1);assert.equal(parsed.clients[0].name,"Ana, Maria");assert.equal(parsed.clients[0].phone,"+00123");
 let called;const api=load("app/api/clients/import/route.ts",{"@/lib/plan-access":{requestFeature:async()=>null,planWriteError:()=>null},"next/server":{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},"next/headers":{cookies:async()=>({get:()=>({value:"session"})})},"@/lib/auth":{getSession:async()=>({id:"owner"})},"@/lib/client-import":clients,"@/lib/supabase":{db:async(path,request)=>{called={path,...JSON.parse(request.body)};return [{}]}}});
 const result=await api.POST({text:async()=>JSON.stringify({clients:[{name:"Ana",email:"ana@example.com",phone:"+001",user_id:"someone-else",service_amount:999}]})});
 assert.equal(result.status,200);assert.equal(called.p_owner,"owner");assert.equal(Object.keys(called.p_clients[0]).length,3);assert.equal(called.path,"rpc/orbit_import_clients");
 let providerCalls=0;const provider=load("lib/alpha-market-data.ts",{"next/cache":{unstable_cache:fn=>fn},"node:crypto":require("node:crypto"),fetch:async()=>{providerCalls++;return{ok:true,status:200,headers:{get:()=>null},json:async()=>({"Global Quote":{"05. price":"10"}})}}});
 await Promise.all([provider.alphaMarketData("GLOBAL_QUOTE","IBM"),provider.alphaMarketData("GLOBAL_QUOTE","ibm")]);await provider.alphaMarketData("GLOBAL_QUOTE","IBM");assert.equal(providerCalls,1);
 const source=fs.readFileSync("components/operations-dashboard.tsx","utf8");assert.ok(source.includes("Orbit LM"));assert.ok(!source.includes("I Wanna Be a Millionaire"));assert.equal((source.match(/<BillingReminders/g)||[]).length,1);
 const reports=source.slice(source.indexOf('function Reports('));assert.ok(reports.includes('value={money(monthlyReceivedTotal)}'));assert.ok(reports.includes('annualIncome=yearlyReceivedTotal(payments,convert,month)'));assert.ok(reports.indexOf('title="Annual income"')>reports.indexOf('title="Payments received"'));assert.ok(reports.indexOf('title="Annual income"')<reports.indexOf('title="Net tracked"'));assert.ok(reports.includes(')+receivedTotal)')); // Net tracked remains all-time
 for(const name of ["Add client","Add lead","Create project"])assert.ok(source.includes('collapsible label="'+name+'"'));
 assert.ok(source.includes('directory_hidden:true'));assert.ok(source.includes('addPayment={(x:R)=>add("payment_records",x)}'));
 const sql=fs.readFileSync("supabase/orbit-payments-import-update.sql","utf8");assert.ok(sql.includes("::date+10"));assert.ok(sql.includes("pg_trigger_depth()>1"));assert.ok(sql.includes("FROM public,anon,authenticated"));assert.ok(sql.includes("pg_advisory_xact_lock"));assert.ok(sql.includes("on conflict(user_id,client_id,due_date) do nothing"));
 console.log("PASS: Orbit payment statuses, month/year totals, CSV import, owner isolation, provider caching, dropdowns and migration guards.");
}
main().catch(error=>{console.error(error);process.exitCode=1});

