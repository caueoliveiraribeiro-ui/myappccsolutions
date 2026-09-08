"use client"

import {FormEvent,useEffect,useMemo,useState} from "react"
import {Activity,Flame,HeartPulse,Plus,Trash2} from "lucide-react"
import {toast} from "sonner"
import {Button} from "@/components/ui/button"
import {Card} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {foodDayKey,foodTimestamp,groupFoodHistory} from "@/lib/food-history"

type Entry={id:string;category:string;food_name:string;grams:number;calories:number;consumed_at:string}
type Result={bmr:number;maintenance:number;target:number|null}
export const foodCatalog={
 Protein:{"Chicken breast":165,"Lean beef":250,Salmon:208,Tuna:132,Egg:155,"Turkey breast":135,Tofu:76,Lentils:116},
 Grains:{"White rice":130,"Brown rice":123,Oats:389,"Whole-wheat bread":247,Pasta:131,Quinoa:120},
 Fruit:{Apple:52,Banana:89,Orange:47,Strawberries:32,Blueberries:57,Mango:60,Avocado:160},
 Vegetables:{Broccoli:35,Carrot:41,Spinach:23,Tomato:18,Potato:77,"Sweet potato":86,"Bell pepper":31},
 Dairy:{"Whole milk":61,"Greek yogurt":97,"Cheddar cheese":403,"Cottage cheese":98,"Plain yogurt":61},
 Snacks:{Almonds:579,"Peanut butter":588,"Dark chocolate":598,Popcorn:387,"Potato chips":536},
} as const
const activityOptions=[{value:1.2,label:"Sedentary"},{value:1.375,label:"Lightly active"},{value:1.55,label:"Moderately active"},{value:1.725,label:"Very active"},{value:1.9,label:"Extra active"}]
const goalOptions=[{value:"maintain",label:"Maintain weight",adjustment:0},{value:"slow_loss",label:"Gradual weight loss",adjustment:-.1},{value:"moderate_loss",label:"Moderate weight loss",adjustment:-.15},{value:"gain",label:"Gradual weight gain",adjustment:.1}]

export function HealthPage(){
 const [foodDate,setFoodDate]=useState(""),[savingFood,setSavingFood]=useState(false)
 useEffect(()=>setFoodDate(foodDayKey(new Date())),[])
 const [entries,setEntries]=useState<Entry[]>([]),[category,setCategory]=useState<keyof typeof foodCatalog>("Protein"),[food,setFood]=useState("Chicken breast"),[grams,setGrams]=useState("100")
 const [sex,setSex]=useState("male"),[age,setAge]=useState("30"),[height,setHeight]=useState("175"),[weight,setWeight]=useState("75"),[activity,setActivity]=useState("1.55"),[goal,setGoal]=useState("maintain"),[result,setResult]=useState<Result|null>(null),[error,setError]=useState("")
 useEffect(()=>{fetch("/api/data/food_entries").then(r=>r.json()).then(d=>setEntries(d.items||[])).catch(()=>toast.error("We could not load your calorie history."))},[])
 useEffect(()=>setFood(Object.keys(foodCatalog[category])[0]),[category])
 const kcalPer100=Number((foodCatalog[category] as Record<string,number>)[food]||0),calories=Math.round(kcalPer100*Number(grams||0)/100)
 const history=useMemo(()=>groupFoodHistory(entries),[entries])
 const today=foodDayKey(new Date()),todayTotal=history.find(day=>day.day===today)?.calories||0
 const days=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const key=foodDayKey(d);return{key,label:d.toLocaleDateString(undefined,{weekday:"short"}),total:history.find(day=>day.day===key)?.calories||0}}),[history,today])
 async function addFood(e:FormEvent){
  e.preventDefault();if(savingFood)return
  const consumed_at=foodTimestamp(foodDate),portion=Number(grams)
  if(!consumed_at)return toast.error("Choose a valid date, today or earlier.")
  if(!food||!Number.isFinite(portion)||portion<=0)return toast.error("Choose a food and enter grams greater than zero.")
  setSavingFood(true)
  try{
   const r=await fetch("/api/data/food_entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,food_name:food,grams:portion,calories,consumed_at})}),d=await r.json()
   if(!r.ok||!d.items?.length)throw Error("Save failed")
   setEntries(v=>[...d.items,...v]);toast.success("Food added to the selected day's calories.")
  }catch{toast.error("We could not save this food. Please try again.")}finally{setSavingFood(false)}
 }
 async function remove(id:string){const r=await fetch("/api/data/food_entries",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id})});if(!r.ok)return toast.error("We could not remove this entry.");setEntries(v=>v.filter(x=>x.id!==id))}
 function calculate(e:FormEvent){e.preventDefault();setError("");const years=Number(age),cm=Number(height),kg=Number(weight),multiplier=Number(activity);if(years<18||years>100)return setError("This calculator is designed for adults ages 18–100.");if(cm<120||cm>230)return setError("Enter a height between 120 and 230 cm.");if(kg<35||kg>300)return setError("Enter a weight between 35 and 300 kg.");const selected=goalOptions.find(x=>x.value===goal)||goalOptions[0],bmr=10*kg+6.25*cm-5*years+(sex==="male"?5:-161),maintenance=bmr*multiplier,target=maintenance*(1+selected.adjustment);setResult({bmr:Math.round(bmr),maintenance:Math.round(maintenance),target:target<1200?null:Math.round(target)})}
 return <div className="space-y-4 text-white"><div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
  <Card className="border-cyan-300/20 bg-white/5 p-5 text-white"><div className="mb-5 flex items-center gap-3"><HeartPulse className="text-cyan-300"/><div><h2 className="font-semibold">Daily food tracker</h2><p className="text-sm text-slate-400">Choose a food, enter the portion and track today’s energy.</p></div></div><form onSubmit={addFood} className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-400 sm:col-span-2">Date consumed<Input type="date" className="mt-1" value={foodDate} max={today} onChange={e=>setFoodDate(e.target.value)} required disabled={savingFood}/></label><Select label="Food group" value={category} onChange={v=>setCategory(v as keyof typeof foodCatalog)} options={Object.keys(foodCatalog)}/><Select label="Food" value={food} onChange={setFood} options={Object.keys(foodCatalog[category])}/><label className="text-xs text-slate-400">Amount (grams)<Input className="mt-1" type="number" min="1" value={grams} onChange={e=>setGrams(e.target.value)}/></label><div className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3"><span className="text-xs text-cyan-100">This portion</span><b className="block text-2xl text-cyan-200">{calories.toLocaleString()} kcal</b><small className="text-slate-400">{kcalPer100} kcal per 100 g</small></div><Button disabled={savingFood||!foodDate} className="sm:col-span-2 bg-cyan-300 text-slate-950"><Plus size={16}/>{savingFood?"Saving…":"Add to selected day"}</Button></form></Card>
  <Card className="border-violet-300/20 bg-violet-300/[.06] p-5 text-white"><div className="flex items-center gap-2 text-violet-200"><Flame/><h2 className="font-semibold">Today consumed</h2></div><b className="mt-4 block text-4xl">{Math.round(todayTotal).toLocaleString()} <span className="text-lg text-slate-400">kcal</span></b><div className="mt-6 grid grid-cols-7 items-end gap-2">{days.map(d=><div key={d.key} className="text-center"><div className="mx-auto w-full rounded-t bg-gradient-to-t from-cyan-500 to-violet-400" style={{height:`${Math.max(5,Math.min(120,d.total/20))}px`}} title={`${d.total} kcal`}/><small className="mt-2 block text-slate-500">{d.label}</small></div>)}</div></Card>
 </div><Card className="border-white/10 bg-white/5 p-5 text-white"><details open><summary className="cursor-pointer font-semibold">Daily consumption history</summary><p className="mt-2 text-sm text-slate-400">Your foods grouped by day in your local time. Open a day to review and manage its entries.</p><div className="mt-4 space-y-3">{history.length===0?<p className="text-sm text-slate-400">No foods recorded yet.</p>:history.map(day=><details key={day.day} open={day.day===today} className="rounded-xl border border-cyan-300/20 bg-black/20"><summary className="cursor-pointer p-4"><span className="inline-flex w-[95%] flex-wrap items-center justify-between gap-3"><span><b>{day.day==="unknown"?"Date unavailable":new Date(day.day+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"})}{day.day===today?" · Today":""}</b><small className="mt-1 block text-slate-400">{day.entries.length} food entries · {day.grams.toLocaleString()} g</small></span><b className="text-lg text-cyan-200">{Math.round(day.calories).toLocaleString()} kcal</b></span></summary><div className="space-y-2 border-t border-white/10 p-3">{day.entries.map(e=><FoodHistoryEntry key={e.id} entry={e} onSaved={updated=>setEntries(v=>v.map(x=>x.id===updated.id?updated:x))} onDelete={()=>remove(e.id)}/>)}</div></details>)}</div></details></Card>
 <Card className="border-white/10 bg-white/5 p-5 text-white"><div className="mb-4 flex items-center gap-2"><Activity className="text-cyan-200"/><h2 className="font-semibold">Daily calorie calculator</h2></div><form onSubmit={calculate} className="grid gap-3 sm:grid-cols-3"><Select label="Sex" value={sex} onChange={setSex} options={["male","female"]}/><Input aria-label="Age" value={age} onChange={e=>setAge(e.target.value)} type="number" placeholder="Age"/><Input aria-label="Height in centimeters" value={height} onChange={e=>setHeight(e.target.value)} type="number" placeholder="Height (cm)"/><Input aria-label="Weight in kilograms" value={weight} onChange={e=>setWeight(e.target.value)} type="number" placeholder="Weight (kg)"/><Select label="Activity" value={activity} onChange={setActivity} options={activityOptions.map(x=>String(x.value))} labels={activityOptions.map(x=>x.label)}/><Select label="Goal" value={goal} onChange={setGoal} options={goalOptions.map(x=>x.value)} labels={goalOptions.map(x=>x.label)}/>{error&&<p role="alert" className="sm:col-span-3 text-sm text-red-300">{error}</p>}<Button className="sm:col-span-3 bg-cyan-300 text-slate-950">Calculate daily calories</Button></form>{result&&<div className="mt-4 grid gap-3 sm:grid-cols-3"><ResultRow label="BMR" value={`${result.bmr} kcal/day`}/><ResultRow label="Maintenance" value={`${result.maintenance} kcal/day`}/><ResultRow label="Goal target" value={result.target?`${result.target} kcal/day`:"Please consult a professional"}/></div>}<p className="mt-4 text-xs leading-5 text-slate-500">This estimate is not medical advice and does not replace a qualified clinician or dietitian.</p></Card></div>
}
export const OrbitHealthTab=HealthPage
function FoodHistoryEntry({entry,onSaved,onDelete}:{entry:Entry;onSaved:(entry:Entry)=>void;onDelete:()=>void}){
 const [editing,setEditing]=useState(false),[amount,setAmount]=useState(String(entry.grams)),[busy,setBusy]=useState(false)
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  const grams=Number(amount)
  if(!Number.isFinite(grams)||grams<=0||grams>99999999)return toast.error("Enter a valid portion greater than zero.")
  setBusy(true)
  try{
   const calories=Math.round(Number(entry.calories)/Number(entry.grams)*grams*100)/100
   const response=await fetch("/api/data/food_entries",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:entry.id,grams,calories})})
   const data=await response.json()
   if(!response.ok||!data.items?.[0])throw Error("We could not update this portion. Please try again.")
   onSaved(data.items[0]);setEditing(false);toast.success("Daily calories updated.")
  }catch{toast.error("We could not update this portion. Please try again.")}finally{setBusy(false)}
 }
 return <div className="rounded-lg border border-white/10 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-sm">{entry.food_name}</b><p className="text-xs text-slate-400">{new Date(entry.consumed_at).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})} · {entry.grams} g · {entry.category}</p></div><div className="flex items-center gap-2"><b className="text-cyan-200">{Math.round(entry.calories)} kcal</b><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setAmount(String(entry.grams));setEditing(!editing)}}>Edit portion</Button><Button type="button" variant="ghost" size="icon" disabled={busy} onClick={onDelete} aria-label={`Delete ${entry.food_name}`}><Trash2 size={16}/></Button></div></div>{editing&&<form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs text-slate-300">Portion (grams)<Input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy}/></label><Button type="submit" disabled={busy}>{busy?"Saving…":"Save portion"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setEditing(false)}>Cancel</Button></form>}</div>
}
function Select({label,value,onChange,options,labels}:{label:string;value:string;onChange:(value:string)=>void;options:string[];labels?:string[]}){return <label className="text-xs text-slate-400">{label}<select aria-label={label} value={value} onChange={e=>onChange(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#111827] px-3 text-sm text-white">{options.map((x:string,i:number)=><option key={x} value={x}>{labels?.[i]||x}</option>)}</select></label>}
function ResultRow({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.06] p-3"><span className="text-xs text-slate-400">{label}</span><b className="block text-lg">{value}</b></div>}
