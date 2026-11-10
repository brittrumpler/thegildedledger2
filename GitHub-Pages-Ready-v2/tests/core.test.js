import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {payout,goldRushWindows,nextRush,haulTotals,isBonusEligible,escapeHTML} from '../core.js';
test('Chest of Fortune grade I–V payouts, including +33% and +67%',()=>{
 const price={min:20000,max:20000,currency:'gold'};
 assert.deepEqual([1,2,3,4,5].map(g=>payout(price,g).min),[20000,26600,33400,40000,50000]);
});
test('Ranges, rounding, currency separation and special item exemption',()=>{
 assert.deepEqual(payout({min:60,max:130,currency:'gold'},2),{min:80,max:173,currency:'gold'});
 assert.equal(payout(null),null);
 assert.equal(payout({min:50000,max:50000,currency:'gold'},5,false).min,50000);
 assert.equal(isBonusEligible({id:'skull-of-siren-song',company:'Order of Souls'}),false);
 assert.equal(isBonusEligible({id:'captains-chest',company:'Gold Hoarders'}),true);
});
test('Gold Rush uses UTC, starts inclusively and ends exclusively across midnight',()=>{
 assert.equal(nextRush(new Date('2026-11-10T00:59:59Z')).active,false);
 assert.equal(nextRush(new Date('2026-11-10T01:00:00Z')).active,true);
 assert.equal(nextRush(new Date('2026-11-10T02:00:00Z')).active,false);
 assert.equal(nextRush(new Date('2026-11-10T18:00:00Z')).start.toISOString(),'2026-11-11T01:00:00.000Z');
 assert.equal(nextRush(new Date('2026-11-10T23:59:59Z')).start.toISOString(),'2026-11-11T01:00:00.000Z');
 assert.ok(goldRushWindows(new Date('2026-11-10T01:30:00Z')).every(w=>w.end>w.start));
});
test('UTC schedule stays fixed through daylight saving changes',()=>{
 const fmt=new Intl.DateTimeFormat('en-US',{hour:'numeric',timeZone:'America/Chicago'});
 assert.equal(fmt.format(nextRush(new Date('2026-10-31T16:00:00Z')).start),'12 PM');
 assert.equal(fmt.format(nextRush(new Date('2026-11-02T16:00:00Z')).start),'11 AM');
});
test('Haul excludes unknowns and never combines currencies',()=>{
 const items=[{id:'a',price:{min:60,max:130,currency:'gold'}},{id:'b',price:{min:25,max:25,currency:'doubloons'}},{id:'c',price:null}];
 const total=haulTotals(items,{a:2,b:1,c:3});
 assert.equal(total.gold.min,120);assert.equal(total.gold.max,260);assert.equal(total.doubloons.min,25);assert.equal(total.unknown,3);
});
test('Source strings are escaped before rendering',()=>assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;'));
test('Catalog IDs are unique and event drops resolve to real items',()=>{
 const data=JSON.parse(readFileSync(new URL('../data/catalog.json',import.meta.url)));
 const ids=new Set(data.items.map(x=>x.id));assert.equal(ids.size,data.items.length);
 assert.equal(data.events.length,8);
 for(const event of data.events)for(const drop of event.drops)assert.ok(ids.has(drop.itemId),`Unresolved drop ${drop.itemId}`);
 for(const item of data.items)if(item.price){assert.ok(item.price.min<=item.price.max);assert.match(item.price.source,/^https:\/\/seaofthieves\.wiki\.gg\//);}
});
