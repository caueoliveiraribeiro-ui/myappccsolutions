const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript")
function load(path){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==="@/components/payment-status"?load("components/payment-status.ts"):require(name),m,m.exports);return m.exports}
const {createFinancialReport}=load("lib/financial-report.ts")
const input={title:'Company <script>alert("x")</script>',preparedFor:'A & B',start:"2026-09-01",end:"2026-09-30",currency:"BRL",now:new Date("2026-09-20T12:00:00Z"),convert:(n,r)=>Number(n||0)*((r.quote_currency||r.currency)==="USD"?5:1),
 payments:[{amount:100,currency:"USD",status:"Payment received",received_at:"2026-09-03",client_name:"Alpha"},{amount:999,currency:"BRL",status:"Payment received",received_at:"2026-08-03"},{amount:50,currency:"USD",status:"Awaiting payment",received_at:"2026-09-10",source_project_id:"p"},{amount:999,currency:"BRL",status:"Cancelled",received_at:"2026-09-04"}],
 expenses:[{amount:20,currency:"USD",expense_date:"2026-09-02",category:"Travel",paid:false},{amount:999,currency:"BRL",expense_date:"2026-08-02"}],groceries:[{estimated_cost:30,currency:"BRL",month:"2026-09",name:"Food"}],
 projects:[{id:"p",name:"Linked project",client:"Alpha",stage:"Awaiting payment",budget:999,cost:10,currency:"BRL",deadline:"2026-09-10"}],leads:[{status:"New",estimated_value:200,currency:"USD"},{status:"Client",estimated_value:999,currency:"BRL"},{archived:true,estimated_value:999,currency:"BRL"}],
 holdings:[{asset_type:"Crypto",symbol:"BTC",quantity:4,remaining_quantity:2,buy_price:10,current_price:15,quote_currency:"USD",purchased_at:"2026-09-02"},{asset_type:"Stock",symbol:"XYZ",quantity:3,remaining_quantity:0,buy_price:999,current_price:999,quote_currency:"BRL"}]}
const report=createFinancialReport(input)
assert.deepEqual(report.totals,{income:500,expense:100,grocery:30,net:370,outstanding:250,overdue:250,pipeline:1000,cost:100,periodCost:100,marketValue:150})
assert.equal(report.monthly.length,1);assert.equal(report.monthly[0].net,370)
assert.ok(report.html.includes("&lt;script&gt;"));assert.ok(!report.html.includes("<script>"));assert.ok(report.html.includes("A &amp; B"))
assert.ok(report.html.includes("@media print"));assert.ok(report.html.includes("CONFIDENTIAL"));assert.ok(!report.html.includes("src="))
assert.ok(report.html.includes("estimated costs"));assert.ok(report.html.includes("unpaid items"));assert.ok(report.html.includes("not a bank cash balance"))
assert.throws(()=>createFinancialReport({...input,convert:()=>NaN}),/conversion is not ready/)
assert.throws(()=>createFinancialReport({...input,start:"2026-02-30"}),/valid report/)
assert.throws(()=>createFinancialReport({...input,start:"2026-10-01"}),/valid report/)
const missing=createFinancialReport({...input,holdings:[{...input.holdings[0],current_price:null}]});assert.equal(missing.totals.marketValue,null);assert.ok(missing.html.includes("Unavailable"))
const empty=createFinancialReport({...input,payments:[],expenses:[],groceries:[],projects:[],leads:[],holdings:[]});assert.equal(empty.totals.net,0);assert.ok(empty.html.includes("No records for this section."))
const ui=fs.readFileSync("components/financial-report-export.tsx","utf8");assert.ok(ui.includes('fetch("/api/reports/export-data"'));assert.ok(ui.includes('sandbox="allow-same-origin allow-modals"'));assert.ok(!ui.includes("allow-scripts"))
console.log("PASS: report period/status filters, FX, net totals, receivable deduplication, remaining investments, missing valuations, escaping, print CSS and export entitlement.")
