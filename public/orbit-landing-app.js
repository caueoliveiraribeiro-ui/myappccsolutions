const views = {
 life: {nav:'Overview', eyebrow:'YOUR DAY, WITH A LITTLE MORE ROOM', title:'Everything has its place.', metrics:[['This month’s income','$8,450','Received payments'],['Monthly spending','$2,180','Expenses + groceries'],['Your recorded result','$6,270','A clearer view of your month']], listTitle:'Today’s focus', items:[['Make progress on the big idea','One focused hour makes a difference'],['Review this month’s spending','Know where your money is going'],['Save a little room for life','It belongs in the plan']], insight:['A CONNECTED WORKSPACE','More clarity. Less mental clutter.','Keep the everyday details together and make your next move with a clearer head.']},
 business: {nav:'Projects',eyebrow:'FROM FIRST CONVERSATION TO FOLLOW-THROUGH',title:'Keep your business moving.',metrics:[['Active projects','06','Your work, organized'],['Awaiting payment','$2,450','A clear view of what’s due'],['Active leads','12','Conversations worth following']],listTitle:'Your next moves',items:[['Northstar Studio','Proposal sent · website project'],['Cedar & Co.','Project delivered · awaiting payment'],['Lumen Creative','Discovery call · follow up tomorrow']],insight:['LESS LOST IN THE SHUFFLE','Good relationships. Clear next steps.','Keep client details, projects, and payments connected as work moves forward.']},
 wealth: {nav:'Investments',eyebrow:'A CLEARER VIEW OF YOUR FINANCIAL PICTURE',title:'Give every number some context.',metrics:[['Amount invested','$12,000','Recorded purchase cost'],['Portfolio value','$13,240','Illustrative market value'],['Value difference','+$1,240','Market value minus cost']],listTitle:'Your sample portfolio',items:[['Stocks · diversified holdings','$8,600 illustrative value'],['Crypto · recorded holdings','$4,640 illustrative value'],['One financial picture','$13,240 combined illustrative value']],insight:['YOUR MONEY, UNDERSTOOD','Less scattered. More perspective.','Bring your recorded investments together. This is sample data—not live pricing or investment advice.']}
};
const tabs=[...document.querySelectorAll('[data-view]')];
function setView(key,focus=false){
 const view=views[key]; if(!view)return;
 tabs.forEach(tab=>{const selected=tab.dataset.view===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();});
 document.querySelector('#preview-panel').setAttribute('aria-labelledby',`tab-${key}`);
 const text=(id,value)=>{document.getElementById(id).textContent=value};
 text('preview-nav-label',view.nav);text('preview-eyebrow',view.eyebrow);text('preview-title',view.title);text('preview-list-title',view.listTitle);
 ['one','two','three'].forEach((name,i)=>{text(`metric-${name}-label`,view.metrics[i][0]);text(`metric-${name}`,view.metrics[i][1]);text(`metric-${name}-note`,view.metrics[i][2]);});
 const list=document.getElementById('preview-list');list.replaceChildren();
 view.items.forEach(([title,note],i)=>{const li=document.createElement('li'),check=document.createElement('span'),content=document.createElement('div'),small=document.createElement('small');check.className=i===0?'check-mark':'empty-check';check.textContent=i===0?'✓':'';content.textContent=title;small.textContent=note;content.append(small);li.append(check,content);list.append(li)});
 ['insight-label','insight-title','insight-copy'].forEach((id,i)=>text(id,view.insight[i]));
}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>setView(tab.dataset.view));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();setView(tabs[next].dataset.view,true)}})});
document.querySelectorAll('[data-view-link]').forEach(link=>link.addEventListener('click',()=>setView(link.dataset.viewLink)));
const menu=document.getElementById('menu-toggle'),nav=document.getElementById('navigation');
function closeMenu(){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation')}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('is-open')){closeMenu();menu.focus()}});
const dialog=document.getElementById('custom-dialog');
document.getElementById('custom-open').addEventListener('click',()=>dialog.showModal());
document.getElementById('custom-close').addEventListener('click',()=>dialog.close());
document.getElementById('custom-plans').addEventListener('click',()=>dialog.close());
document.getElementById('year').textContent=new Date().getFullYear();
const motionToggle=document.getElementById('motion-toggle');
const pointerMedia=matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const ambient=document.querySelector('.ambient');
const pointerGlows=[...ambient.querySelectorAll('.glow')];
let pointerFrame=0, pointerPosition=null;
const glowAnimations=new Map();
function stopPointerGlow(){cancelAnimationFrame(pointerFrame);pointerFrame=0;pointerPosition=null;glowAnimations.forEach(animation=>animation.cancel());glowAnimations.clear();ambient.classList.remove('pointer-follow');}
function renderPointerGlow(){pointerFrame=0;if(!pointerPosition||!pointerMedia.matches||document.documentElement.classList.contains('motion-paused')||document.hidden)return;
 ambient.classList.add('pointer-follow');
 pointerGlows.forEach((glow,index)=>{const start=getComputedStyle(glow).transform;glowAnimations.get(glow)?.cancel();const offset=index===0?-130:130;const x=pointerPosition.x-glow.offsetWidth/2+offset;const y=pointerPosition.y-glow.offsetHeight/2+(index===0?-70:70);glowAnimations.set(glow,glow.animate([{transform:start==='none'?'translate3d(0,0,0)':start},{transform:`translate3d(${x}px,${y}px,0)`}],{duration:index===0?850:1250,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'}));});}
window.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||!pointerMedia.matches||document.documentElement.classList.contains('motion-paused'))return;pointerPosition={x:event.clientX,y:event.clientY};if(!pointerFrame)pointerFrame=requestAnimationFrame(renderPointerGlow);},{passive:true});
pointerMedia.addEventListener('change',stopPointerGlow);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPointerGlow()});
motionToggle.addEventListener('click',stopPointerGlow);
motionToggle.addEventListener('click',()=>{const paused=document.documentElement.classList.toggle('motion-paused');motionToggle.setAttribute('aria-pressed',String(paused));motionToggle.textContent=paused?'Resume motion':'Pause motion'});
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.06});
 document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));document.documentElement.classList.add('motion-ready');
}

// Preserve campaign/affiliate query parameters when visitors move from the
// Plans page into Orbit's subscription confirmation page. The plan parameter
// already present on each card is kept intact.
(function preservePlanTrackingParams(){
 const currentParams=new URLSearchParams(window.location.search);
 if(!currentParams.size)return;
 document.querySelectorAll('a[href^="/subscribe?plan="]').forEach(link=>{
  const target=new URL(link.getAttribute('href'),window.location.origin);
  currentParams.forEach((value,key)=>{
   if(!target.searchParams.has(key))target.searchParams.append(key,value);
  });
  link.setAttribute('href',target.pathname+target.search);
 });
})();
