import {STANDARD,ROMAN,payout,goldRushWindows,nextRush,formatRange,countdown,haulTotals,isBonusEligible,escapeHTML as e} from './core.js';
const $=s=>document.querySelector(s);
const state={data:null,calendar:null,tab:'treasure',quick:'all',limit:24,favorites:new Set(Array.isArray(readStored('gilded-favorites',[]))?readStored('gilded-favorites',[]):[]),haul:readStored('gilded-haul',{}),zone:readStored('gilded-zone',Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')};
if(!state.haul || typeof state.haul!=='object' || Array.isArray(state.haul)) state.haul={};
for(const [id,count] of Object.entries(state.haul)) if(!Number.isSafeInteger(count)||count<1||count>9999) delete state.haul[id];
try { new Intl.DateTimeFormat('en',{timeZone:state.zone}); } catch { state.zone='UTC'; }
const categoryNames={chest:'Chests',skull:'Skulls',artefact:'Artefacts & gems',crate:'Crates',cargo:'Cargo',smugglers:'Smuggled goods',key:'Keys',weapon:'Weapons',tome:'Ashen tomes',manifest:'Manifests',log:'Lighthouse logs',gift:'Gifts',cosmetic:'Cosmetics',other:'Other discoveries'};
const eventNotes={
 'fort-of-fortune':['Red-eyed skull with a forehead scar','A coveted fortress vault with mixed-company and Athena treasure.'],
 'fort-of-the-damned':['Red-eyed skull over the fort','A crew-activated encounter with a vault of valuable spoils.'],
 'ashen-winds':['A towering red tornado','Defeat an Ashen Lord to uncover its skull and a scattered treasure haul.'],
 'burning-blade':['Flameheart’s burning flagship','Sink the flagship or pledge your crew. Rewards depend on how you resolve the encounter.'],
 'ghost-fleet':['A spectral fleet on the horizon','Fight through ghost ships to recover treasure from the Sea of the Damned.'],
 'skeleton-fleet':['A ship-shaped cloud','Survive a series of skeletal ships and salvage the spoils of each sinking.'],
 'skeleton-fort':['A green-eyed skull cloud','Clear the fortress and open its vault for a mixed-company loot haul.'],
 'reaper-fortress':['A Reaper-held fortress','Assault a contested fortress for its source-reported treasure pool.']
};
function readStored(key,fallback){try {const value=JSON.parse(localStorage.getItem(key));return value??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function safeURL(url){if(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url||''))return url;try{const u=new URL(url,location.href);return (u.origin===location.origin || ['https://sotdb.gg','https://seaofthieves.wiki.gg','https://www.seaofthieves.com'].includes(u.origin))?u.href:'';}catch{return '';}}
function img(item,cls=''){return item.image ? `<img class="${cls}" src="${e(safeURL(window.GILDED_IMAGES?.[item.image]||item.image))}" alt="${e(item.name)}" loading="lazy" data-treasure-image>` : '<span class="image-missing">Image not yet catalogued</span>';}
function money(price){return `${e(formatRange(price))}${price?` <small>${price.currency==='gold'?'GOLD':'DOUBLOONS'}</small>`:''}`;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2100);}
function itemBy(id){return state.data.items.find(x=>x.id===id);}
function addHaul(id,amount=1){state.haul[id]=Math.max(0,Math.min(9999,(state.haul[id]||0)+amount));if(!state.haul[id])delete state.haul[id];save('gilded-haul',state.haul);updateHaulCount();if(state.tab==='haul')renderHaul();if(amount>0)toast('Added to your ship’s manifest.');}
function updateHaulCount(){$('#haul-count').textContent=Object.values(state.haul).reduce((a,b)=>a+b,0);}
function favorite(id){if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);save('gilded-favorites',[...state.favorites]);renderTreasure();}
function dateText(date,options={}){return new Intl.DateTimeFormat('en-US',{timeZone:state.zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',...options}).format(new Date(date));}
function setupFilters(){
 const companies=[...new Set(state.data.items.map(x=>x.company).filter(Boolean))].sort();
 $('#company').innerHTML='<option value="">All companies</option>'+companies.map(c=>`<option>${e(c)}</option>`).join('');
 $('#category').innerHTML='<option value="">All treasure</option>'+Object.entries(categoryNames).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 const zones=[...new Set([state.zone,'UTC','America/Chicago','America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Australia/Sydney'])];
 $('#timezone').innerHTML=zones.map(z=>`<option value="${e(z)}">${e(z.replaceAll('_',' '))}</option>`).join('');$('#timezone').value=state.zone;
 const priced=state.data.items.filter(x=>x.price).length;
 $('#coverage').textContent=`${state.data.items.length} catalog entries · ${priced} researched values\nCatalog fetched ${new Date(state.data.catalogFetchedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}`;
}
function renderTreasure(){
 if(!state.data)return;
 const query=$('#search').value.trim().toLowerCase(),company=$('#company').value,category=$('#category').value,grade=Number($('#grade').value);
 let list=state.data.items.filter(x=>(!query||`${x.name} ${x.company} ${categoryNames[x.category]}`.toLowerCase().includes(query))&&(!company||x.company===company)&&(!category||x.category===category));
 if(state.quick==='priced')list=list.filter(x=>x.price);
 if(state.quick==='unpriced')list=list.filter(x=>!x.price);
 if(state.quick==='favorites')list=list.filter(x=>state.favorites.has(x.id));
 const notable=['chest-of-fortune','chest-of-legends','ashen-winds-skull','reapers-bounty','stronghold-chest','stronghold-skull','kings-chest','ruby-mermaid-gem'];
 const sort=$('#sort').value;
 list.sort((a,b)=>{
  if(sort==='name')return a.name.localeCompare(b.name);
  if(sort==='high'||sort==='low') {if(!a.price)return b.price?1:a.name.localeCompare(b.name);if(!b.price)return -1;return(sort==='high'?-1:1)*(a.price.max-b.price.max)||a.name.localeCompare(b.name);}
  const ai=notable.indexOf(a.id),bi=notable.indexOf(b.id);
  return (ai<0?999:ai)-(bi<0?999:bi)||Number(Boolean(b.price))-Number(Boolean(a.price))||a.name.localeCompare(b.name);
 });
 $('#treasure-grid').innerHTML=list.slice(0,state.limit).map((x,index)=>{
  const eligible=isBonusEligible(x),value=payout(x.price,grade,eligible);
  return `<article class="treasure-card"><button class="bookmark" data-favorite="${e(x.id)}" aria-label="${state.favorites.has(x.id)?'Remove bookmark for':'Bookmark'} ${e(x.name)}" aria-pressed="${state.favorites.has(x.id)}">${state.favorites.has(x.id)?'★':'☆'}</button><button class="item-open" data-item="${e(x.id)}"><div class="item-art"><span class="item-index">${String(index+1).padStart(3,'0')}</span>${img(x)}</div><div class="item-info"><span class="company-label">${e(x.company||categoryNames[x.category])}</span><h3>${e(x.name)}</h3><span class="item-value">${money(value)}</span></div></button><div class="card-bottom"><span>${!x.price?'Awaiting value research':grade>1&&eligible?`Grade ${ROMAN[grade-1]} · estimated payout`:'Base sale value'}</span><button class="add-haul" data-add="${e(x.id)}" aria-label="Add ${e(x.name)} to haul">+</button></div></article>`;
 }).join('')||'<div class="empty">No treasure matches this chart.<br>Try another name, company or filter.</div>';
 $('#load-more').hidden=list.length<=state.limit;
 $('#load-more').textContent=`Unroll more of the ledger · ${Math.max(0,list.length-state.limit)} remaining ↓`;
 $('#results-status').textContent=`${list.length} matching entries. Showing ${Math.min(state.limit,list.length)}.`;
 $('#quick-filters').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.quick===state.quick);b.setAttribute('aria-pressed',b.dataset.quick===state.quick?'true':'false');});
}
function renderEvents(){
 $('#event-grid').innerHTML=state.data.events.map(x=>`<button class="event-card" data-event="${e(x.id)}">${img(x)}<div><p class="eyebrow">${e(eventNotes[x.id]?.[0]||'World encounter')}</p><h3>${e(x.name)}</h3><p>${e(eventNotes[x.id]?.[1]||'Explore the expected loot pool.')}</p><span class="text-link">Inspect ${new Set(x.drops.map(d=>d.itemId)).size} possible discoveries →</span></div></button>`).join('');
}
function showDialog(content){$('#detail-content').innerHTML=`<div class="detail-inner">${content}</div>`;if(!$('#detail-dialog').open)$('#detail-dialog').showModal();$('#detail-dialog').scrollTop=0;}
function showItem(id,backEvent=null){
 const x=itemBy(id);if(!x)return;
 const eligible=isBonusEligible(x);
 const dates=x.price?`Value source reviewed ${e(x.price.checkedAt.slice(0,10))}.`:'A confirmed sale value has not yet been added. This can also be a quest, cosmetic or unsellable object; unknown does not mean zero.';
 const sources=state.data.events.filter(ev=>ev.drops.some(d=>d.itemId===id));
 showDialog(`${backEvent?`<button class="quiet" data-event="${e(backEvent)}">← Back to encounter</button>`:''}<div class="detail-top">${img(x)}<div><p class="eyebrow">${e(x.company||'AN UNCHARTED DISCOVERY')}</p><h2>${e(x.name)}</h2><p>${e(categoryNames[x.category])} ${x.limited?'· Limited-time catalog entry':''}</p><span class="item-value">${money(x.price)}</span></div></div><p>${e(dates)}</p>${x.price?.note?`<p class="notice">${e(x.price.note)}</p>`:''}${x.price?`<table class="price-table"><caption>Emissary sale estimates</caption><thead><tr><th scope="col">Grade</th><th scope="col">Bonus</th><th scope="col">${x.price.currency==='gold'?'Gold':'Doubloons'} received</th></tr></thead><tbody>${STANDARD.map((mult,i)=>`<tr><td>${ROMAN[i]} ${i===0?'· Base':''}</td><td>${eligible?`+${Math.round((mult-1)*100)}%`:'Not applied'}</td><td>${e(formatRange(payout(x.price,i+1,eligible)))}</td></tr>`).join('')}</tbody></table><p>${eligible?'For an eligible matching-company sale. Standard company multipliers are 1×, 1.33×, 1.67×, 2× and 2.5×. Guild emissary rates differ.':'A standard emissary bonus is not confirmed for this item, or this is a special turn-in. All rows show the base value.'} Estimates round to the nearest whole currency unit. Gold Rush and other event bonuses are excluded.</p>`:'<div class="notice">Price unconfirmed. This item stays in the catalog so you can identify it and inspect its source.</div>'}${x.price?.variants?`<div class="variant-prices"><table class="price-table"><caption>Sale condition · all grades</caption><thead><tr><th>Condition</th>${ROMAN.map(r=>`<th>${r}</th>`).join('')}</tr></thead><tbody>${x.price.variants.map(v=>`<tr><td>${e(v.condition)}</td>${STANDARD.map((_,i)=>`<td>${e(formatRange(payout(v,i+1,eligible)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}<div class="detail-actions"><button class="gold-button" data-add="${e(id)}">Add to my haul +</button><a href="${e(safeURL(x.source))}" target="_blank" rel="noopener">Item &amp; acquisition source ↗</a>${x.price?`<a href="${e(safeURL(x.price.source))}" target="_blank" rel="noopener">Value source ↗</a>`:''}</div>${sources.length?`<p class="eyebrow">REPORTED AT THESE WORLD EVENTS</p>${sources.map(ev=>`<button class="outline-button" data-event="${e(ev.id)}">${e(ev.name)} →</button>`).join(' ')}`:''}`);
}
function showEvent(id){
 const ev=state.data.events.find(x=>x.id===id);if(!ev)return;
 const seen=new Set();const drops=ev.drops.filter(d=>{const key=d.itemId+'|'+d.stage+'|'+(d.group?.id||'');if(seen.has(key))return false;seen.add(key);return true;});
 showDialog(`<div class="detail-top">${img(ev)}<div><p class="eyebrow">${e(eventNotes[id]?.[0]||'WORLD EVENT')}</p><h2>${e(ev.name)}</h2><p>${e(eventNotes[id]?.[1]||'')}</p><a href="${e(safeURL(ev.source))}" target="_blank" rel="noopener">Inspect source evidence ↗</a></div></div><div class="notice">Expected loot pool, not a guaranteed manifest. Reported quantities are observations, not fixed promises. Shared slots contain a mix from the group. Bonus Chest of Fortune: 1 or 3 possible; none guaranteed.</div>${drops.map(d=>{const item=itemBy(d.itemId);if(!item)return '';const label=d.group?`Shared pool: ${d.group.group} · ${d.group.quantity??'?'} total items`:d.chance?'Chance drop':d.quantity?`${d.quantity} reported · ${d.verified?'source verified':'community reported'}`:'Quantity varies · reported';return `<div class="drop-row">${img(item)}<div><button data-item="${e(item.id)}" data-back-event="${e(id)}">${e(item.name)} ↗</button><small>${e(label)}${d.stage?` · ${e(d.stage)}`:''}</small>${d.notes?`<small>${e(d.notes)}</small>`:''}</div><span>${money(item.price)}</span></div>`;}).join('')}<p>World-event rules reviewed ${e(state.data.eventRulesReviewedAt)}. <a href="https://www.seaofthieves.com/release-notes/3.9.0" target="_blank" rel="noopener">Official Chest of Fortune update ↗</a></p>`);
}
function scheduledEvents(now=new Date()){
 const output=state.calendar.announcements.filter(x=>new Date(x.end)>now).map(x=>({...x}));
 for(const rule of state.calendar.recurring){
  const startOfDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  for(let d=-1;d<14;d++){
   const start=new Date(startOfDay+d*86400000+rule.hourUTC*3600000),end=new Date(start.getTime()+rule.durationHours*3600000);
   if(start.getUTCDay()===rule.dayUTC&&end>now&&start>=new Date(rule.validFrom)&&start<new Date(rule.validUntil))output.push({...rule,start:start.toISOString(),end:end.toISOString(),dateOnly:false});
  }
 }
 return output.sort((a,b)=>new Date(a.start)-new Date(b.start));
}
function renderCalendar(){
 const now=new Date(),rush=nextRush(now),stale=now-new Date(state.calendar.reviewedAt)>7*86400000;
 const events=scheduledEvents(now);
 $('#calendar-content').innerHTML=`<div class="calendar-hero"><div><p class="eyebrow">TWICE DAILY · ONE HOUR · 1.5× GOLD</p><h3>Gold Rush</h3><p>01:00–02:00 UTC &amp; 17:00–18:00 UTC<br>Next window: <strong>${e(dateText(rush.start))}–${e(dateText(rush.end,{month:undefined,day:undefined}))}</strong></p><a class="text-link" href="https://www.seaofthieves.com/event-hub" target="_blank" rel="noopener">Official recurring schedule ↗</a></div><div class="calendar-timer"><p class="eyebrow" id="calendar-rush-state">${rush.active?'SCHEDULED WINDOW ENDS IN':'NEXT SCHEDULED WINDOW IN'}</p><span class="big-countdown" id="calendar-timer"></span><p>Time zone: ${e(state.zone)}<br>Daylight saving changes are handled automatically.</p><button class="outline-button" id="download-calendar">Save the next 7 days to my calendar ↓</button></div></div><div class="notice">${e(state.calendar.goldRush.note)} The timer follows the published schedule; it cannot confirm server-side activation.</div><div class="section-heading"><h3>Announced &amp; recurring events</h3><span class="meta">Reviewed ${e(state.calendar.reviewedAt)}${stale?' · Review overdue':''}</span></div>${stale?'<div class="notice">Announcements need a fresh review. Expired entries are hidden; visit the official hub for newly announced events.</div>':''}<div class="calendar-list">${events.map(x=>`<article class="calendar-row"><div class="date-tile"><small>${e(new Intl.DateTimeFormat('en-US',{timeZone:x.dateOnly?'UTC':state.zone,month:'short'}).format(new Date(x.start))).toUpperCase()}</small>${e(new Intl.DateTimeFormat('en-US',{timeZone:x.dateOnly?'UTC':state.zone,day:'numeric'}).format(new Date(x.start)))}</div><div><span class="status-tag">${x.dateOnly?'DATE ANNOUNCED':new Date(x.start)<=now?'SCHEDULED NOW':'UPCOMING'}</span><h3>${e(x.name)}</h3><p>${e(x.dateOnly?x.displayDates:`${dateText(x.start)} → ${dateText(x.end)}`)}</p><p>${e(x.description)}</p></div><a href="${e(safeURL(x.source))}" target="_blank" rel="noopener">Official announcement ↗</a></article>`).join('')||'<div class="empty">No unexpired announcements in the local calendar. Check the official hub for newly announced events.</div>'}</div><div class="notice">${state.calendar.notes.map(e).join('<br><br>')}<br><br><a href="https://www.seaofthieves.com/event-hub" target="_blank" rel="noopener">Open the official Events Hub ↗</a></div>`;
 updateClock();
}
function updateClock(){
 const now=new Date(),rush=nextRush(now),remaining=(rush.active?rush.end:rush.start)-now;
 $('#rush-title').textContent=rush.active?'A Gold Rush window is scheduled now.':`Next Gold Rush · ${dateText(rush.start,{month:undefined,day:undefined})}`;
 $('#rush-countdown').textContent=`${rush.active?'Window ends':'Sets sail'} in ${countdown(remaining)} →`;
 if($('#calendar-timer'))$('#calendar-timer').textContent=countdown(remaining);
 if($('#calendar-rush-state'))$('#calendar-rush-state').textContent=rush.active?'SCHEDULED WINDOW ENDS IN':'NEXT SCHEDULED WINDOW IN';
 // Re-render dates when the clock crosses an event boundary or a local UTC day changes.
 const calendarKey=now.toISOString().slice(0,10)+'|'+scheduledEvents(now).map(x=>x.id+String(new Date(x.start)<=now)).join(',');
 if(state.calendarKey && state.calendarKey!==calendarKey && state.tab==='calendar'){state.calendarKey=calendarKey;renderCalendar();}else state.calendarKey=calendarKey;
}
function downloadCalendar(){
 const stamp=date=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const events=goldRushWindows(new Date(),7).filter(x=>x.start.getTime()<Date.now()+7*86400000).map(x=>`BEGIN:VEVENT\r\nUID:gilded-rush-${x.start.getTime()}@gilded-ledger\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(x.start)}\r\nDTEND:${stamp(x.end)}\r\nSUMMARY:Sea of Thieves Gold Rush (scheduled)\r\nDESCRIPTION:1.5x gold. May be suspended during special multiplier events. Verify in game.\r\nURL:https://www.seaofthieves.com/event-hub\r\nEND:VEVENT`).join('\r\n');
 const blob=new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gilded Ledger//Gold Rush//EN\r\n${events}\r\nEND:VCALENDAR\r\n`],{type:'text/calendar'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gold-rush-next-7-days.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderHaul(){
 const entries=Object.entries(state.haul),totals=haulTotals(state.data.items,state.haul);
 $('#haul-content').innerHTML=entries.length?entries.map(([id,count])=>{const item=itemBy(id);return item?`<div class="haul-row">${img(item)}<button data-item="${e(id)}"><h3>${e(item.name)}</h3></button><div class="quantity-control"><button data-remove="${e(id)}" aria-label="Remove one ${e(item.name)}">−</button><span>${count}</span><button data-add="${e(id)}" aria-label="Add one ${e(item.name)}">+</button></div><span class="item-value">${money(item.price?{...item.price,min:item.price.min*count,max:item.price.max*count}:null)}</span></div>`:'';}).join('')+`<div class="haul-total">${money(totals.gold)}${totals.doubloons.max?`<br>${money(totals.doubloons)}`:''}</div>${totals.unknown?`<p class="notice">${totals.unknown} unpriced item(s) excluded from this total.</p>`:''}`:'<div class="empty">An empty hold is the start of a good story.<br>Add treasure with the + button in the ledger.</div>';
}
function renderSources(){
 const priced=state.data.items.filter(x=>x.price).length;
 const oldest=state.data.items.filter(x=>x.price).map(x=>x.price.checkedAt).sort()[0];
 showDialog(`<p class="eyebrow">THE SMALL PRINT ON THE CHART</p><h2>Sources &amp; ship’s notes</h2><p>This is a fan-made reference, with live clock calculations and a periodically refreshed, bundled catalog. It is not connected to your game session and does not detect world events on your server.</p><div class="notice">Coverage: ${state.data.items.length} catalog entries, ${priced} researched sale values, ${state.data.items.length-priced} unpriced entries. Unpriced includes quest objects and cosmetics as well as research gaps. Fish, meat, animal variants and every buyer-specific exception are not exhaustively covered.</div><p>Catalog retrieved: ${e(state.data.catalogFetchedAt.slice(0,10))}. Oldest included price review: ${e(oldest?.slice(0,10)||'unknown')}. Calendar reviewed: ${e(state.calendar.reviewedAt)}. A catalog refresh does not certify that every value or calendar event was rechecked.</p><div class="source-links"><a href="https://sotdb.gg/loot/" target="_blank" rel="noopener">SoTDB loot catalog · item images &amp; source-reported event drops ↗</a><a href="https://seaofthieves.wiki.gg/wiki/Treasure" target="_blank" rel="noopener">Sea of Thieves Wiki · base values &amp; treasure types ↗</a><a href="https://www.seaofthieves.com/event-hub" target="_blank" rel="noopener">Official Events Hub · Gold Rush &amp; announcements ↗</a><a href="https://www.seaofthieves.com/release-notes/3.9.0" target="_blank" rel="noopener">Official Season 21 event rules ↗</a></div><h3>Credits &amp; reuse</h3><p>Loot relationships: SoTDB / PhuzzyBond, incorporating Sea of Thieves Wiki data. Wiki-derived data is attributed under CC BY-NC-SA 4.0. Item images are screenshots of Sea of Thieves, © Microsoft / Rare, used for this noncommercial fan reference under Microsoft’s Game Content Usage Rules. Not endorsed by Microsoft or Rare. See THIRD_PARTY.md in the source for full notices and font licenses.</p><h3>Value calculations</h3><p>Base values are reported ranges. Grade estimates use standard company multipliers and round to whole units. They assume an eligible sale; Guild rates, buyer-specific adjustments, cargo damage, item charge, alliance shares, event multipliers and special turn-in exceptions may differ. Unknown eligibility keeps the base price.</p>${state.data.warnings?.length?`<div class="notice">The latest refresh could not recheck every price source. Last-known researched values were preserved. Open an item to see its value source and review date.</div>`:''}`);
}
function route(){
 const tab=location.hash.slice(1)||'treasure';state.tab=['treasure','world-events','calendar','haul'].includes(tab)?tab:'treasure';
 document.querySelectorAll('.page-panel').forEach(p=>p.hidden=p.id!==state.tab);
 document.querySelectorAll('[data-tab]').forEach(a=>{if(a.dataset.tab===state.tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(state.data){if(state.tab==='treasure')renderTreasure();if(state.tab==='world-events')renderEvents();if(state.tab==='calendar')renderCalendar();if(state.tab==='haul')renderHaul();}
}
document.addEventListener('click',ev=>{
 const button=ev.target.closest('button');if(!button)return;
 if(button.dataset.item)showItem(button.dataset.item,button.dataset.backEvent);
 if(button.dataset.event)showEvent(button.dataset.event);
 if(button.dataset.add)addHaul(button.dataset.add);
 if(button.dataset.remove)addHaul(button.dataset.remove,-1);
 if(button.dataset.favorite)favorite(button.dataset.favorite);
 if(button.dataset.quick){state.quick=button.dataset.quick;state.limit=24;renderTreasure();}
 if(button.id==='download-calendar')downloadCalendar();
});
document.addEventListener('error',ev=>{if(ev.target.matches?.('[data-treasure-image]')){const label=document.createElement('span');label.className='image-missing';label.textContent='Image unavailable';ev.target.replaceWith(label);}},true);
$('#detail-dialog .close-dialog').addEventListener('click',()=>$('#detail-dialog').close());
$('#detail-dialog').addEventListener('click',ev=>{if(ev.target===$('#detail-dialog')){const r=ev.target.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)ev.target.close();}});
$('#search').addEventListener('input',()=>{state.limit=24;renderTreasure();});
for(const id of ['company','category','grade','sort'])$('#'+id).addEventListener('change',()=>{state.limit=24;renderTreasure();});
$('#load-more').addEventListener('click',()=>{state.limit+=24;renderTreasure();});
$('#timezone').addEventListener('change',()=>{state.zone=$('#timezone').value;save('gilded-zone',state.zone);renderCalendar();});
$('#clear-haul').addEventListener('click',()=>{state.previousHaul={...state.haul};state.haul={};save('gilded-haul',{});updateHaulCount();renderHaul();$('#haul-content').insertAdjacentHTML('afterbegin','<button class="outline-button" id="undo-clear">Undo clear ↶</button>');});
document.addEventListener('click',ev=>{if(ev.target.closest('#undo-clear')&&state.previousHaul){state.haul=state.previousHaul;save('gilded-haul',state.haul);updateHaulCount();renderHaul();}});
$('#sources-button').addEventListener('click',()=>state.data&&renderSources());$('#footer-sources').addEventListener('click',()=>state.data&&renderSources());
document.addEventListener('keydown',ev=>{if(ev.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!$('#detail-dialog').open){ev.preventDefault();location.hash='treasure';$('#search').focus();}});
window.addEventListener('hashchange',route);
async function loadData(){
 try{
  if(window.GILDED_CATALOG && window.GILDED_CALENDAR){
   state.data=JSON.parse(JSON.stringify(window.GILDED_CATALOG));
   state.calendar=JSON.parse(JSON.stringify(window.GILDED_CALENDAR));
  }else{
   const responses=await Promise.all([fetch('data/catalog.json',{cache:'no-cache'}),fetch('data/calendar.json',{cache:'no-cache'})]);
   if(responses.some(r=>!r.ok))throw new Error('Catalog request failed');
   [state.data,state.calendar]=await Promise.all(responses.map(r=>r.json()));
  }
  if(!Array.isArray(state.data.items)||!Array.isArray(state.data.events))throw new Error('Invalid catalog');
  setupFilters();route();updateHaulCount();updateClock();
  $('#hero-chest').src='assets/hero-chest.png';
 }catch(err){$('#coverage').textContent='The ledger could not be loaded.';$('#treasure-grid').innerHTML='<div class="empty">Unable to load the catalog. Serve this folder using a local web server, or try refreshing the page.<br><button id="retry-load" class="outline-button">Try again</button></div>';$('#retry-load').onclick=loadData;console.error(err);}
}
await loadData();setInterval(()=>{if(state.data&&state.calendar)updateClock();},1000);
// Revalidate the deployed data periodically; the GitHub workflow publishes upstream refreshes.
setInterval(async()=>{if(!/^https?:$/.test(location.protocol))return;try{const r=await fetch('data/catalog.json',{cache:'no-cache'});if(r.ok){const d=await r.json();if(d.catalogFetchedAt!==state.data?.catalogFetchedAt){state.data=d;setupFilters();route();toast('Fresh pages have arrived in the ledger.');}}}catch{}},15*60*1000);
