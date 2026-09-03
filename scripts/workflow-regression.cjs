const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, mocks = {}, extra = "") {
  const source = fs.readFileSync(file, "utf8") + extra;
  const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require:name=>mocks[name]||(name.includes("payment-status")?load("components/payment-status.ts"):{}), console, Date, Intl, Set, fetch:(...args)=>mocks.fetch(...args)});
  return exports;
}
async function main() {
  const {monthSeries} = load("components/history-calendar.tsx");
  const holdings = [];
  const now = new Date();
  for(let i=0;i<12;i++){
    const date = new Date(now.getFullYear(), now.getMonth()-i, 2).toISOString().slice(0,10);
    holdings.push({symbol:"BTC",asset_type:"Crypto",quantity:1,remaining_quantity:0,buy_price:100,quote_currency:"USD",purchased_at:date});
    holdings.push({symbol:"BTC",asset_type:"Crypto",quantity:1,remaining_quantity:1,buy_price:500,quote_currency:"BRL",purchased_at:date});
  }
  for(const target of ["USD","BRL"]){
    const convert=(n,row)=>Number(n)*(row.quote_currency===target?1:target==="USD"?.2:5);
    const months=monthSeries(12,[],[],[],holdings,[],convert,String,"en",[]);
    assert.equal(months.length,12);
    for(const month of months)assert.equal(month.investments,target==="USD"?100:500);
    for(const month of months)assert.equal(month.purchases,1);
  }
  const partial=[{symbol:"BTC",asset_type:"Crypto",quantity:4,remaining_quantity:1.5,buy_price:100,quote_currency:"USD",purchased_at:now.toISOString().slice(0,10)}];
  assert.equal(monthSeries(1,[],[],[],partial,[],Number,String,"en",[])[0].investments,150);
  const investmentSource=fs.readFileSync("components/investments-v2.tsx","utf8");
  assert.ok(investmentSource.includes("sourceCurrency(lot)===cg.currency"));
  assert.ok(investmentSource.includes("editHolding(lot.id,{remaining_quantity:Math.max(0,remaining-quantity)})"));
  assert.ok(!investmentSource.includes("async function adjustQuantity"));
  const overviewSource=fs.readFileSync("components/overview-v3.tsx","utf8");
  assert.ok(overviewSource.indexOf('title="Sales pipeline"') < overviewSource.indexOf('title="Awaiting payments"'));
  assert.ok(overviewSource.indexOf('title="Awaiting payments"') < overviewSource.indexOf('title="Project payments"'));
  assert.ok(overviewSource.indexOf(">This month result<") < overviewSource.indexOf('title="Investment market value"'));
  assert.ok(overviewSource.indexOf('title="Investment market value"') < overviewSource.indexOf(">Last month result<"));
  const payment={received_at:now.toISOString().slice(0,10),amount:250,currency:"USD"};
  assert.equal(monthSeries(1,[],[],[],[],[],Number,String,"en",[payment])[0].income,250);
  const month=now.toISOString().slice(0,7);
  const finances=monthSeries(1,[{amount:40,expense_date:month+"-02"}],[],[],[],
    [{actual_cost:25,month}],Number,String,"en",[payment])[0];
  assert.equal(finances.expenses,40,"Groceries must not be included in expenses");
  assert.equal(finances.groceries,25);
  assert.equal(finances.net,185,"Net income = paid projects - groceries - expenses");
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const {Pipeline}=load("components/operations-dashboard.tsx",{
    react:{useState:value=>[value,()=>{}]},
    "react/jsx-runtime":jsx,
    "@/components/currency-conversion":{useCurrencyRates:()=>Number}
  },"\nexport {Pipeline};");
  const leads=Array.from({length:350},(_,i)=>({id:String(i),status:"Lost",company:"Lead "+i}));
  leads.push({id:"archived",status:"New",company:"Archived",archived:true});
  const tree=Pipeline({items:leads,edit:()=>{},delLead:()=>{}});
  const nodes=[];
  function walk(node){if(!node)return;if(Array.isArray(node)){node.forEach(walk);return}
    if(typeof node==="object"){nodes.push(node);walk(node.props?.children)}}
  walk(tree);
  assert.equal(nodes.filter(node=>node.type==="details").length,300);
  assert.ok(nodes.some(node=>node.props?.value==="0 / 300"),"Archived leads excluded from active total");
  const sql=fs.readFileSync("supabase/orbit-workflow-update.sql","utf8");
  assert.ok(sql.includes("tasks_billing_occurrence_unique"));
  assert.ok(sql.includes("on conflict(user_id,billing_client_id,billing_due_date)"));
  assert.ok(sql.includes("from public,anon,authenticated"),"Reminder RPC is not public");
  assert.ok(investmentSource.includes('>')&&investmentSource.includes('sellAll(g)'));
  let state, effects=[];
  const pending=[];
  const hooks={
    useState:initial=>[state===undefined?(state=initial):state,value=>{state=value}],
    useEffect:effect=>effects.push(effect)
  };
  const {useCurrencyRates}=load("components/currency-conversion.ts",{
    react:hooks,fetch:()=>new Promise(resolve=>pending.push(resolve))
  });
  let convert=useCurrencyRates([{currency:"BRL"}],"USD");
  assert.ok(Number.isNaN(convert(100,{currency:"BRL"})));
  const cleanup=effects.pop()();
  cleanup();
  convert=useCurrencyRates([{currency:"USD"}],"BRL");
  effects.pop()();
  pending[1]({ok:true,json:async()=>({rate:5})});
  await new Promise(resolve=>setImmediate(resolve));
  pending[0]({ok:true,json:async()=>({rate:.2})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(state.target,"BRL");
  convert=useCurrencyRates([{currency:"USD"}],"BRL");
  assert.equal(convert(100,{currency:"USD"}),500);
  const {cleanFields}=load("app/api/data/[resource]/route.ts",{}, "\nexport {cleanFields};");
  const cleaned=cleanFields({deadline:"",start_time:"",budget:"",currency:"brl"});
  assert.equal(cleaned.deadline,null);
  assert.equal(cleaned.start_time,null);
  assert.equal(cleaned.budget,0);
  assert.equal(cleaned.currency,"BRL");
  console.log("PASS: 12-month mixed-currency purchases, sales history, independent payment income, stale FX responses and optional fields.");
}
main().catch(error=>{console.error(error);process.exitCode=1});

