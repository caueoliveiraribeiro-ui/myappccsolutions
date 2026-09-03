const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript')
const login=fs.readFileSync('components/login-form.tsx','utf8')
for(const price of ['29.99','99.99','189.99'])assert.ok(login.includes('usd: '+price))
assert.ok(login.includes('hidden={!SHOW_LOGIN_PLANS}'))
assert.ok(login.includes('https://orbit-landing-page-rose.vercel.app/#plans'))
assert.ok(login.includes('Subscription management'))
const subscriptions=fs.readFileSync('components/subscription-expenses.tsx','utf8')
for(const field of ['item_name','custom_provider','amount','expense_date'])assert.ok(subscriptions.includes('name="'+field+'"'))
assert.ok(subscriptions.includes('category:"Subscriptions"'))
assert.ok(subscriptions.includes('if(await add('))
class FakeInput {get value(){return this._value||''}set value(v){this._value=v}focus(){}}
global.HTMLInputElement=FakeInput
let input,state=[]
const react={useRef:()=>({current:input}),useState:value=>[value,next=>state.push(next)],useImperativeHandle:()=>{},createElement:(type,props,...children)=>({type,props:{...props,children}})}
const moduleMock={exports:{}}
const compiled=ts.transpileModule(fs.readFileSync('components/ui/date-input.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText
new Function('require','module','exports',compiled)(id=>id==='react'?react:id==='date-fns'?require(id):id.endsWith('/calendar')?{Calendar:'Calendar'}:{Popover:'Popover',PopoverAnchor:'PopoverAnchor',PopoverContent:'PopoverContent'},moduleMock,moduleMock.exports)
function find(tree,type){if(tree?.type===type)return tree;for(const child of tree?.props?.children||[]){const match=find(child,type);if(match)return match}}
let changed;input=new FakeInput();input.value='2026-09-03'
let tree=moduleMock.exports.DateInput({name:'due_date',onChange:e=>changed=e.target.value,min:'2026-09-01',max:'2026-09-30'})
find(tree,'input').props.onClick({defaultPrevented:false,preventDefault(){}})
assert.ok(state.includes(true),'Whole date input opens the popover')
find(tree,'Calendar').props.onSelect(new Date(2026,8,12))
assert.equal(input.value,'2026-09-12');assert.equal(changed,'2026-09-12')
assert.equal(find(tree,'Calendar').props.disabled(new Date(2026,7,31)),true)
assert.equal(find(tree,'Calendar').props.disabled(new Date(2026,8,15)),false)
find(tree,'Calendar').props.onSelect(undefined);assert.equal(changed,'')
state=[];tree=moduleMock.exports.DateInput({disabled:true});find(tree,'input').props.onClick({defaultPrevented:false,preventDefault(){}});assert.ok(!state.includes(true))
console.log('PASS: plan links/prices, subscription fields, whole-pill calendar, change values, bounds, clear and disabled behavior')
