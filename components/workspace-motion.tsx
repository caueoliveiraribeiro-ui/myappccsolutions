"use client"
import { ArrowUpRight, Sparkles, Users, Target, BriefcaseBusiness } from "lucide-react"
export function WorkspaceMotion({onNavigate}:{onNavigate:(page:string)=>void}) {
 return <section className="workspace-launch mb-4" aria-label="Your workspace at a glance">
  <div className="workspace-launch-copy"><span className="workspace-eyebrow"><Sparkles size={14}/> YOUR NEXT MOVE STARTS HERE</span><h2>Make progress.<br/><span>Keep life in orbit.</span></h2><p>Your people, projects and possibilities—moving together.</p><div className="workspace-shortcuts">{[["Clients","People"],["Projects","Projects"],["Pipeline","Opportunities"]].map(([page,label])=><button key={page} onClick={()=>onNavigate(page)}>{label}<ArrowUpRight size={15}/></button>)}</div></div>
  <div className="workspace-orbit" aria-hidden="true"><div className="orbit-track orbit-track-one"/><div className="orbit-track orbit-track-two"/><div className="orbit-satellite"/><div className="orbit-core"><Sparkles size={34}/></div><span className="orbit-node orbit-node-one"><Users size={19}/>Connect</span><span className="orbit-node orbit-node-two"><BriefcaseBusiness size={19}/>Create</span><span className="orbit-node orbit-node-three"><Target size={19}/>Grow</span></div>
 </section>
}
