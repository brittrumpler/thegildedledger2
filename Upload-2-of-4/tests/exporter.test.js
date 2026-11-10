import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const script=await fs.readFile(new URL('../profile-exporter.js',import.meta.url),'utf8');
test('Exporter performs only official same-origin reads and strips credentials from its local download',async()=>{
 const calls=[];let exported;const nodes=[];
 const document={documentElement:{lang:'en'},querySelector:()=>({textContent:'Synthetic Pirate'}),body:{append:node=>nodes.push(node)},createElement:()=>({style:{},remove(){},click(){}})};
 const context={location:{protocol:'https:',hostname:'www.seaofthieves.com',pathname:'/profile/overview'},document,Date,Blob,URL:{createObjectURL:blob=>{exported=blob;return 'blob:synthetic';},revokeObjectURL(){}},setTimeout(){},alert:()=>assert.fail('Unexpected origin warning'),fetch:async(url,options)=>{calls.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({chestData:{Weapon:[{title:'Admiral Blowpipe'}]},accessToken:'synthetic-secret',nested:{token:'synthetic-secret',cookie:'synthetic-cookie',safe:'retained'}})};}};
 await vm.runInNewContext(script,context);
 assert.deepEqual(calls.map(x=>x.url),['overview','reputation','chest','balance','achievements'].map(x=>'/api/profilev2/'+x));
 assert.ok(calls.every(x=>x.options.credentials==='same-origin'&&!x.options.method));
 const result=JSON.parse(await exported.text());assert.equal(result.gamertag,'Synthetic Pirate');
 assert.equal(result.sections.chest.nested.safe,'retained');assert.ok(!JSON.stringify(result).includes('synthetic-secret'));assert.ok(!JSON.stringify(result).includes('synthetic-cookie'));
});
test('Exporter refuses to run away from the official signed-in profile origin',async()=>{
 let warned=false;
 await vm.runInNewContext(script,{location:{protocol:'https:',hostname:'gilded-ledger.us',pathname:'/profile/overview'},alert(){warned=true;},fetch:()=>assert.fail('Must not read any data')});
 assert.equal(warned,true);
});
