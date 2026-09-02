const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, mocks = {}, extra = "") {
  const source = fs.readFileSync(file, "utf8") + extra;
  const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require:name=>mocks[name]||{}, console, Date, Intl, Set, fetch:(...args)=>mocks.fetch(...args)});
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
