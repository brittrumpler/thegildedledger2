import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{seal,unseal,beginLogin,finishLogin,extractCosmeticDetail,validateSavedProfile} from '../server/worker.mjs';
const secret='fixture-only-secret-for-unit-tests-000000000';
const env={SITE_URL:'https://gilded-ledger.us',MICROSOFT_CLIENT_ID:'fixture-public-client-id',MICROSOFT_CLIENT_SECRET:'fixture-only-client-secret',AUTH_SECRET:secret};
const request=(path,options={})=>new Request('https://gilded-ledger.us'+path,options);
async function userCookie(xuid='1234567890',csrf='fixture-csrf'){return '__Host-ledger-session='+await seal({xuid,gamertag:'FixturePirate',csrf,exp:Date.now()/1000+1000},secret);}
test('Encrypted sessions reject tampering and expiry',async()=>{
 const token=await seal({exp:Date.now()/1000+1000,xuid:'12345'},secret);assert.equal((await unseal(token,secret)).xuid,'12345');assert.equal(await unseal(token+'x',secret),null);
 assert.equal(await unseal(await seal({exp:1},secret),secret),null);
});
test('Login uses the deployed callback, state cookie, and PKCE challenge',async()=>{
 const r=await beginLogin(request('/api/auth/login'),env),url=new URL(r.headers.get('location'));
 assert.equal(url.hostname,'login.microsoftonline.com');assert.equal(url.searchParams.get('redirect_uri'),'https://gilded-ledger.us/api/auth/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'XboxLive.signin');
 assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);
});
test('Invalid callback state fails before any token exchange',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Not reached');};
 try{const r=await finishLogin(request('/api/auth/callback?code=fixture&state=bad'),env);assert.match(r.headers.get('location'),/expired-login/);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('Successful mocked OAuth flow creates identity-only cookie; service tokens are not returned',async()=>{
 const started=await beginLogin(request('/api/auth/login'),env),loginCookie=started.headers.get('set-cookie').split(';')[0],state=new URL(started.headers.get('location')).searchParams.get('state');
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=String(url);let value;
  if(u.includes('/oauth2/v2.0/token'))value={access_token:'fixture-access-token'};
  else if(u.includes('user.auth.xboxlive.com'))value={Token:'fixture-user-token'};
  else if(u.includes('xsts.auth.xboxlive.com'))value={Token:'fixture-xsts-token',DisplayClaims:{xui:[{xid:'1234567890',uhs:'fixture-uhs'}]}};
  else if(u.includes('profile.xboxlive.com'))value={profileUsers:[{settings:[{id:'Gamertag',value:'FixturePirate'}]}]};
  else throw new Error('Unexpected upstream');return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
 };
 try{
  const r=await finishLogin(request('/api/auth/callback?code=fixture&state='+state,{headers:{cookie:loginCookie}}),env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://gilded-ledger.us/#pirate');
  const cookies=r.headers.getSetCookie();const session=cookies.find(x=>x.startsWith('__Host-ledger-session='));assert.ok(session);
  const token=session.split(';')[0].split('=').slice(1).join('='),identity=await unseal(token,secret);assert.equal(identity.gamertag,'FixturePirate');assert.ok(!('access_token' in identity));assert.ok(!JSON.stringify(identity).includes('fixture-access-token'));
 }finally{globalThis.fetch=original;}
});
test('Cloud journals require authentication and enforce user isolation and CSRF',async()=>{
 const store=new Map();const e={...env,LEDGER_PROFILES:{get:async key=>store.has(key)?JSON.parse(store.get(key)):null,put:async(key,value)=>store.set(key,value),delete:async key=>store.delete(key)}};
 assert.equal((await worker.fetch(request('/api/profile'),e)).status,401);
 const cookie=await userCookie();const profile={schemaVersion:1,journalVersion:1,imported:null,manual:{commendations:{},cosmetics:{},goals:[]}};
 assert.equal((await worker.fetch(request('/api/profile',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(profile)}),e)).status,403);
 const good=await worker.fetch(request('/api/profile',{method:'PUT',headers:{cookie,origin:env.SITE_URL,'x-ledger-csrf':'fixture-csrf','content-type':'application/json'},body:JSON.stringify(profile)}),e);assert.equal(good.status,200);
 const a=await (await worker.fetch(request('/api/profile',{headers:{cookie}}),e)).json();assert.equal(a.profile.schemaVersion,1);
 const b=await (await worker.fetch(request('/api/profile',{headers:{cookie:await userCookie('9999999999')}}),e)).json();assert.equal(b.profile,null);
});
test('Credential fields and cross-account snapshots are rejected',async()=>{
 assert.throws(()=>validateSavedProfile({schemaVersion:1,access_token:'fixture'}),/Credential/);
 const e={...env,LEDGER_PROFILES:{put:async()=>{throw new Error('Must not store');}}};
 const r=await worker.fetch(request('/api/profile',{method:'PUT',headers:{cookie:await userCookie(),origin:env.SITE_URL,'x-ledger-csrf':'fixture-csrf','content-type':'application/json'},body:JSON.stringify({schemaVersion:1,imported:{identity:{xuid:'9999999999'}}})}),e);assert.equal(r.status,409);
});
test('Public cosmetic guide parser extracts source instructions and exact JSON-LD title',()=>{
 const html='<div class="cosmetic-detail-container"><h1><a href="/cosmetic-set/1/">Admiral</a> Emote</h1><ul class="unlock-list"><li>Complete <a href="/category/1/#commendation-635">A Fine Deed</a>.</li></ul><div class="cost-display">Cost: 7,000 Gold</div><script type="application/ld+json">{"@type":"Thing","name":"Admiral Cheer","image":"https://sotdb.gg/media/a.png"}</script></div>';
 const value=extractCosmeticDetail(html,'2042');assert.equal(value.name,'Admiral Cheer');assert.equal(value.cost.amount,7000);assert.deepEqual(value.unlockCommendationIds,['635']);assert.equal(value.acquisition[0],'Complete A Fine Deed .');
});
test('Image proxy does not fetch arbitrary hosts',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Not allowed');};
 try{const r=await worker.fetch(request('/api/image?url='+encodeURIComponent('https://127.0.0.1/private')),env);assert.equal(r.status,400);assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
