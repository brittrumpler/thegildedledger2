export const STANDARD = [1, 1.33, 1.67, 2, 2.5];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export function payout(price, grade=1, eligible=true, goldRush=false) {
  if (!price) return null;
  const multiplier=(eligible ? STANDARD[grade-1] : 1)*(goldRush && price.currency==='gold' ? 1.5 : 1);
  return {min:Math.round(price.min*multiplier), max:Math.round(price.max*multiplier),currency:price.currency};
}
export function goldRushWindows(now=new Date(),days=7) {
  const start=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const windows=[];
  for(let day=0;day<=days;day++) for(const hour of [1,17]) {
    const from=start+day*86400000+hour*3600000;
    if(from+3600000>now.getTime()) windows.push({start:new Date(from),end:new Date(from+3600000)});
  }
  return windows;
}
export function nextRush(now=new Date()) {
  const window=goldRushWindows(now,1)[0];
  return {...window,active:now>=window.start && now<window.end};
}
export function formatRange(price) {
  if(!price) return 'Value unconfirmed';
  const fmt=n=>n.toLocaleString('en-US');
  return price.min===price.max ? fmt(price.min) : `${fmt(price.min)}–${fmt(price.max)}`;
}
export function countdown(ms) {
  const seconds=Math.max(0,Math.floor(ms/1000));
  return `${String(Math.floor(seconds/3600)).padStart(2,'0')}h ${String(Math.floor(seconds/60)%60).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;
}
export function haulTotals(items,haul) {
  const totals={gold:{min:0,max:0,currency:'gold'},doubloons:{min:0,max:0,currency:'doubloons'},unknown:0};
  for(const [id,count] of Object.entries(haul)) {
    const item=items.find(x=>x.id===id);
    if(!item?.price) { totals.unknown+=count;continue; }
    const total=totals[item.price.currency];
    if(total) {total.min+=item.price.min*count;total.max+=item.price.max*count;}
  }
  return totals;
}
export function isBonusEligible(item) {
  if(typeof item.emissaryEligible==='boolean')return item.emissaryEligible;
  if(/(?:mermaid-gem|siren-gem|breath-of-the-sea|orb-of-secrets|orb-of-the-banished)/.test(item.id))return true;
  // Sale-specific exceptions: do not invent emissary bonuses for special turn-ins.
  if(['skull-of-siren-song','gold-hoarders-skull','chest-of-everlasting-sorrow'].includes(item.id)) return false;
  return Boolean(item.company && ['Gold Hoarders','Order of Souls','Merchant Alliance',"Athena's Fortune","Reaper's Bones","The Hunter's Call","Hunter's Call","Smugglers' League","Smuggler's League"].some(x=>item.company.includes(x)));
}
export function escapeHTML(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
