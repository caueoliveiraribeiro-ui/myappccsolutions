const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const source = fs.readFileSync('lib/invoice-delivery.ts','utf8');
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function scenario({duplicate=false, failures=0, failComplete=false}={}) {
  let claimed=false, sent=0, completed=0, flagged=0;
  const requests=[];
  const invoice={id:'test',invoice_number:'INV-TEST',client_name:'Test',client_email:'client@example.test',due_date:'2026-09-08',email_claim_token:'claim',issuer_logo_data:'test-logo'};
  const exports={};
  vm.runInNewContext(code,{exports,require(name){
    if(name==='@/lib/invoice-pdf')return{invoicePdf(row){assert.equal(row.issuer_logo_data,'test-logo');assert.equal(row.status,'awaiting_payment');return Buffer.from('%PDF-1.4 test')}};
    if(name==='@/lib/supabase')return{async db(path,options){
      if(path==='rpc/orbit_claim_invoice_email'){if(claimed||duplicate)return[];claimed=true;return[invoice]}
      if(path==='rpc/orbit_complete_invoice_email'){completed++;if(failComplete)throw Error('DB unavailable');return[{...invoice,status:'sent'}]}
      flagged++;return[];
    }};
    throw Error(name);
  },process:{env:{RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'test@example.test'}},AbortSignal,setTimeout(fn){fn()},async fetch(url,options){
    assert.equal(url,'https://api.resend.com/emails');requests.push(options);sent++;
    return{ok:sent>failures,status:sent>failures?200:503,async json(){return sent>failures?{id:'provider-id'}:{}}};
  }});
  return{exports,requests,stats:()=>({sent,completed,flagged})};
}
(async()=>{
  let s=await scenario();const result=await s.exports.deliverInvoice('test','owner','owner@example.test',true);
  assert.equal(result.emailId,'provider-id');
  let body=JSON.parse(s.requests[0].body);assert.equal(body.reply_to,'owner@example.test');
  assert.ok(Buffer.from(body.attachments[0].content,'base64').toString().startsWith('%PDF'));
  assert.equal((await s.exports.deliverInvoice('test','owner','owner@example.test')).skipped,true);
  assert.equal(s.stats().sent,1);
  s=await scenario({failures:1});await s.exports.deliverInvoice('test','owner','owner@example.test',true);
  assert.equal(s.requests[0].body,s.requests[1].body);
  assert.equal(s.requests[0].headers['Idempotency-Key'],s.requests[1].headers['Idempotency-Key']);
  s=await scenario({failures:9});await assert.rejects(()=>s.exports.deliverInvoice('test','owner','owner@example.test'));
  assert.deepEqual(s.stats(),{sent:3,completed:0,flagged:1});
  s=await scenario({failComplete:true});await assert.rejects(()=>s.exports.deliverInvoice('test','owner','owner@example.test'));
  assert.equal((await s.exports.deliverInvoice('test','owner','owner@example.test')).skipped,true);
  assert.equal(s.stats().sent,1);
  const cron=fs.readFileSync('app/api/cron/invoice-drafts/route.ts','utf8');
  assert.ok(cron.includes('accountAccess(candidate.user_id)'));
  assert.ok(cron.includes('!secret || request.headers.get("authorization")'));
  const sql=fs.readFileSync('docs/invoice-due-date-send.sql','utf8');
  assert.ok(sql.includes("i.due_date=(now() at time zone 'UTC')::date"));
  assert.ok(sql.includes('from public,anon,authenticated'));
  const cycle=fs.readFileSync('docs/invoice-billing-cycle.sql','utf8');
  assert.ok(cycle.includes("then 'awaiting_payment'"));
  assert.ok(cycle.includes('c.charge_date=inv.due_date'));
  assert.ok(cycle.includes('if inv.sent_at is not null'));
  assert.ok(fs.readFileSync('components/invoice-workspace.tsx','utf8').includes('value="awaiting_payment"'));
  console.log('PASS: awaiting-payment PDF, cycle completion guards, same-key retries, duplicate guard, uncertain-delivery hold, secured due-date cron');
})().catch(error=>{console.error(error);process.exitCode=1});
