const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
function load(file) {
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
 const module={exports:{}}
 new Function('exports','module','require',code)(module.exports,module,name=>load('components/'+name.replace('./','')+'.ts'))
 return module.exports
}
const ops=fs.readFileSync('components/operations-dashboard.tsx','utf8')
const ui=fs.readFileSync('components/invoice-workspace.tsx','utf8')
assert.ok(ops.includes('x.status === "Registered"'))
assert.ok(ops.includes('status: x.status || "Registered"'))
assert.ok(ops.includes('allStatuses = ["Registered", ...stages'))
assert.ok(ops.includes('address: lead.address || ""'))
assert.ok(!ops.includes('label: "Website / listing"'))
assert.ok(!ui.includes('Company / PDF brand'))
assert.ok(ui.includes('name="description"'))
assert.ok(ui.includes('services.map(service=>'))
const {overviewMonthTotals}=load('components/overview-month-totals.ts')
const lead={created_at:'2026-09-08',estimated_value:100}
assert.equal(overviewMonthTotals({leads:[{...lead,status:'Registered'},{...lead,status:'New'}]},Number,'2026-09').pipeline,100)
const {invoicePdf}=load('lib/invoice-pdf.ts')
const pdf=invoicePdf({client_name:'Example Client',client_address:'123 Example Street',service_name:'Website Development',description:'Build accessible landing pages and a contact form.',amount:100,currency:'USD',invoice_number:'INV-TEST',issue_date:'2026-09-08'})
assert.ok(pdf.toString().includes('Build accessible landing pages'))
assert.ok(pdf.toString().includes('123 Example Street'))
if(process.argv.includes('--render')) {fs.mkdirSync('tmp/pdfs',{recursive:true});fs.writeFileSync('tmp/pdfs/invoice-description.pdf',pdf)}
console.log('PASS: Registered routing, pipeline totals, shared services, invoice address and PDF description')
