const encoder = new TextEncoder();
const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
const SESSION_COOKIE = '__Host-ledger-session';
const LOGIN_COOKIE = '__Host-ledger-login';
const SESSION_SECONDS = 12 * 60 * 60;
const IMAGE_HOSTS = new Set(['sotdb.gg','seaofthieves.wiki.gg','rare-assets.azureedge.net']);
const json = (body,status=200,headers={}) => new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const random = (bytes=32) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function decode64(value){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
function cookie(request,name){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name,value,seconds){return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;}
function configured(env){return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.AUTH_SECRET?.length>=32);}
function siteURL(env){const u=new URL(env.SITE_URL||'https://gilded-ledger.us');if(u.protocol!=='https:')throw new Error('SITE_URL must use HTTPS');return u.origin;}
async function cipherKey(secret){const hash=await crypto.subtle.digest('SHA-256',encoder.encode('gilded-ledger/session/v1/'+secret));return crypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(secret),encoder.encode(JSON.stringify(value)));return base64url(iv)+'.'+base64url(new Uint8Array(encrypted));}
export async function unseal(value,secret){try{if(!secret||!value)return null;const [iv,body]=value.split('.');const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(iv)},await cipherKey(secret),decode64(body));const data=JSON.parse(new TextDecoder().decode(clear));if(!Number.isFinite(data.exp)||data.exp<Date.now()/1000)return null;return data;}catch{return null;}}
async function session(request,env){return unseal(cookie(request,SESSION_COOKIE),env.AUTH_SECRET);}
function sameOrigin(request,env){return request.headers.get('origin')===siteURL(env);}
function constantEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function redirect(path,headers={}){return new Response(null,{status:302,headers:{location:path,'cache-control':'no-store',...headers}});}
async function limitedBytes(message,limit){
 const reader=message.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new Error('Request exceeds size limit');}chunks.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
async function checkedJSON(response,label){if(!response.ok)throw new Error(`${label} was rejected (${response.status})`);return response.json();}
function safeErrorCode(error){if(/xbox|xsts/i.test(error.message))return 'xbox-access';if(/state|expired/i.test(error.message))return 'expired-login';return 'sign-in-failed';}

export async function beginLogin(request,env){
 if(!configured(env))return json({error:'Microsoft sign-in is not configured by the site owner.'},503);
 const origin=siteURL(env);if(new URL(request.url).origin!==origin)return redirect(origin+'/api/auth/login');
 const state=random(),verifier=random(48),challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
 const login=await seal({state,verifier,exp:Date.now()/1000+600},env.AUTH_SECRET);
 const url=new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize');
 url.search=new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID,response_type:'code',redirect_uri:origin+'/api/auth/callback',scope:'XboxLive.signin',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 return redirect(url.href,{'set-cookie':setCookie(LOGIN_COOKIE,login,600)});
}
export async function finishLogin(request,env){
 const origin=siteURL(env);const headers=new Headers({'cache-control':'no-store'});headers.append('set-cookie',setCookie(LOGIN_COOKIE,'',0));
 try{
  if(!configured(env))throw new Error('Sign-in is not configured');
  const url=new URL(request.url),flow=await unseal(cookie(request,LOGIN_COOKIE),env.AUTH_SECRET);
  if(!flow||!constantEqual(url.searchParams.get('state'),flow.state))throw new Error('Login state expired or does not match');
  if(url.searchParams.has('error'))throw new Error('Microsoft sign-in cancelled');
  const code=url.searchParams.get('code');if(!code)throw new Error('No authorization code');
  const token=await checkedJSON(await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.MICROSOFT_CLIENT_ID,client_secret:env.MICROSOFT_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:origin+'/api/auth/callback',code_verifier:flow.verifier,scope:'XboxLive.signin'})}),'Microsoft authorization');
  const user=await checkedJSON(await fetch('https://user.auth.xboxlive.com/user/authenticate',{method:'POST',headers:{'content-type':'application/json','x-xbl-contract-version':'1'},body:JSON.stringify({Properties:{AuthMethod:'RPS',SiteName:'user.auth.xboxlive.com',RpsTicket:'d='+token.access_token},RelyingParty:'http://auth.xboxlive.com',TokenType:'JWT'})}),'Xbox authentication');
  const xsts=await checkedJSON(await fetch('https://xsts.auth.xboxlive.com/xsts/authorize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({Properties:{SandboxId:'RETAIL',UserTokens:[user.Token]},RelyingParty:'http://xboxlive.com',TokenType:'JWT'})}),'Xbox authorization');
  const claims=xsts.DisplayClaims?.xui?.[0];const xuid=claims?.xid;
  if(!/^\d{5,25}$/.test(xuid||''))throw new Error('Xbox identity was not returned');
  let gamertag=claims.gtg||'Connected Xbox pirate',picture='';
  // Microsoft tokens stay on the server and are discarded after identity lookup.
  const profileResponse=await fetch(`https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings?settings=Gamertag,GameDisplayPicRaw`,{headers:{authorization:`XBL3.0 x=${claims.uhs};${xsts.Token}`,'x-xbl-contract-version':'2'}});
  if(profileResponse.ok){const profile=await profileResponse.json();for(const setting of profile.profileUsers?.[0]?.settings||[]){if(setting.id==='Gamertag')gamertag=String(setting.value).slice(0,100);if(setting.id==='GameDisplayPicRaw'&&/^https:\/\//.test(setting.value))picture=setting.value;}}
  const identity={xuid,gamertag,picture,csrf:random(),exp:Date.now()/1000+SESSION_SECONDS};
  headers.append('set-cookie',setCookie(SESSION_COOKIE,await seal(identity,env.AUTH_SECRET),SESSION_SECONDS));headers.set('location',origin+'/#pirate');
  return new Response(null,{status:302,headers});
 }catch(error){headers.set('location',origin+'/?auth_error='+safeErrorCode(error)+'#pirate');return new Response(null,{status:302,headers});}
}
export function validateSavedProfile(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.schemaVersion!==1)throw new Error('Unsupported journal format');
 const serialized=JSON.stringify(data);if(encoder.encode(serialized).length>MAX_PROFILE_BYTES)throw new Error('Profile exceeds 2 MiB');
 const forbidden=/^(?:(?:xbox|xsts|user)?token|access.?token|refresh.?token|id.?token|session(?:id)?|authorization|cookie|client.?secret|password|rat|rare.?authentication.?token)$/i;
 const walk=(node,depth=0)=>{if(depth>12)throw new Error('Profile nesting is too deep');if(Array.isArray(node)){if(node.length>30000)throw new Error('Too many records');for(const x of node)walk(x,depth+1);}else if(node&&typeof node==='object'){for(const [key,value] of Object.entries(node)){if(forbidden.test(key)||['__proto__','constructor','prototype'].includes(key))throw new Error('Credential or unsafe field in profile');walk(value,depth+1);}}else if(typeof node==='string'&&node.length>10000)throw new Error('Profile text is too long');};walk(data);
 return data;
}
async function profileAPI(request,env){
 const identity=await session(request,env);if(!identity)return json({error:'Sign in before accessing a cloud journal.'},401);
 if(!env.LEDGER_PROFILES)return json({error:'Cloud journal storage is not enabled. Your local journal remains available.',storageConfigured:false},503);
 const key='journal:'+identity.xuid;
 if(request.method==='GET'){const data=await env.LEDGER_PROFILES.get(key,'json');return json({profile:data||null});}
 if(!sameOrigin(request,env)||!constantEqual(request.headers.get('x-ledger-csrf'),identity.csrf))return json({error:'Request origin or CSRF token does not match.'},403);
 if(request.method==='DELETE'){await env.LEDGER_PROFILES.delete(key);return json({ok:true});}
 if(request.method!=='PUT')return json({error:'Method not allowed'},405,{allow:'GET, PUT, DELETE'});
 const length=Number(request.headers.get('content-length')||0);if(length>MAX_PROFILE_BYTES)return json({error:'Profile exceeds 2 MiB'},413);
 let text;try{text=new TextDecoder().decode(await limitedBytes(request,MAX_PROFILE_BYTES));}catch{return json({error:'Profile exceeds 2 MiB'},413);}
 try{const profile=validateSavedProfile(JSON.parse(text));if(profile.imported?.identity?.xuid&&profile.imported.identity.xuid!==identity.xuid)return json({error:'The imported profile belongs to a different Xbox account.'},409);await env.LEDGER_PROFILES.put(key,JSON.stringify(profile));return json({ok:true,savedAt:new Date().toISOString()});}catch(error){return json({error:error.message},400);}
}
function plainHTML(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();}
export function extractCosmeticDetail(html,id){
 const container=html.slice(html.indexOf('cosmetic-detail-container'));
 const heading=container.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'';
 let semantic={};for(const match of container.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){try{const value=JSON.parse(match[1]);if(value['@type']==='Thing')semantic=value;}catch{}}
 const unlock=container.match(/<ul[^>]*class="[^"]*unlock-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/i)?.[1]||'';
 const acquisition=[...unlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m=>plainHTML(m[1])).filter(Boolean);
 const costText=plainHTML(container.match(/class="cost-display"[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
 const cost=costText.match(/Cost:\s*([\d,]+)\s*(Gold|Doubloons|Ancient Coins)/i);
 const set=heading.match(/<a[^>]+href="(\/cosmetic-set\/\d+\/)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
 return {id,name:plainHTML(semantic.name||heading),image:typeof semantic.image==='string'?semantic.image:null,type:set?plainHTML(heading.slice((set.index||0)+set[0].length))||null:null,set:set?{name:plainHTML(set[2]),source:'https://sotdb.gg'+set[1]}:null,cost:cost?{amount:Number(cost[1].replaceAll(',','')),currency:cost[2].toLowerCase()}:null,acquisition,unlockCommendationIds:[...new Set([...unlock.matchAll(/#commendation-(\d+)/g)].map(m=>m[1]))],source:'https://sotdb.gg/cosmetic/'+id+'/',checkedAt:new Date().toISOString()};
}
async function cosmeticGuideAPI(request){
 const id=new URL(request.url).searchParams.get('id')||'';if(!/^\d{1,8}$/.test(id))return json({error:'Invalid cosmetic ID'},400);
 const upstream=await fetch('https://sotdb.gg/cosmetic/'+id+'/',{headers:{accept:'text/html'},cf:{cacheEverything:true,cacheTtl:86400}});
 if(!upstream.ok)return json({error:'The cosmetic guide source is temporarily unavailable.'},502);
 const html=await upstream.text();if(html.length>2*1024*1024)return json({error:'Guide source is too large.'},502);
 const detail=extractCosmeticDetail(html,id);if(!detail.name)return json({error:'No cosmetic detail could be read.'},502);
 return json(detail,200,{'cache-control':'public, max-age=86400'});
}
async function acquisitionAPI(request,env){
 const slug=new URL(request.url).searchParams.get('id')||'';
 if(!/^[a-z0-9-]{1,120}$/.test(slug))return json({error:'Invalid treasure ID'},400);
 const catalogResponse=await env.ASSETS.fetch(new Request(new URL('/data/catalog.json',request.url)));
 if(!catalogResponse.ok)return json({error:'Treasure catalog unavailable'},503);
 const catalog=await catalogResponse.json();if(!catalog.items.some(x=>x.id===slug))return json({error:'Treasure not in catalog'},404);
 if(slug==='chest-of-fortune')return json({itemId:slug,checkedAt:catalog.eventRulesReviewedAt,sources:catalog.events.map(x=>({id:x.id,name:x.name,type:'world_event',typeLabel:'World event',url:x.source,chance:true,verified:false,notes:'Possible bonus of one or three Chests of Fortune under the official Season 21 rules; not guaranteed.'}))},200,{'cache-control':'public, max-age=3600'});
 const upstream=await fetch('https://sotdb.gg/api/loot/node/?kind=item&slug='+slug,{headers:{accept:'application/json'},cf:{cacheEverything:true,cacheTtl:3600}});
 if(!upstream.ok)return json({error:'Acquisition source is temporarily unavailable'},502);
 const data=await upstream.json();if(!data.ok)return json({error:'No acquisition entry found'},404);
 const sources=(data.ring||[]).filter(x=>x.kind==='source'&&x.active!==false).map(x=>({id:x.slug,name:x.name,type:x.type,typeLabel:x.type_label,url:'https://sotdb.gg'+x.url,notes:String(x.notes||'').slice(0,1500),chance:Boolean(x.edge?.chance),verified:Boolean(x.edge?.verified),stage:x.edge?.stage||'',quantity:x.edge?.quantity??null,season:x.edge?.season_span||''}));
 return json({itemId:slug,sources,checkedAt:new Date().toISOString()},200,{'cache-control':'public, max-age=3600'});
}
async function imageAPI(request){
 const url=new URL(new URL(request.url).searchParams.get('url')||'https://invalid.invalid');
 if(url.protocol!=='https:'||!IMAGE_HOSTS.has(url.hostname)||url.username||url.password)return json({error:'Image source is not allowed.'},400);
 const response=await fetch(url.href,{redirect:'manual',headers:{accept:'image/*'},cf:{cacheEverything:true,cacheTtl:86400}});
 if(response.status>=300&&response.status<400)return json({error:'Image redirects are not followed.'},502);
 if(!response.ok)return json({error:'Image is temporarily unavailable.'},502);
 const type=response.headers.get('content-type')||'';if(!/^image\/(png|jpeg|webp|gif|avif)(?:;|$)/i.test(type))return json({error:'Unsupported image type'},415);
 let body;try{body=await limitedBytes(response,4*1024*1024);}catch{return json({error:'Image exceeds 4 MiB'},413);}
 return new Response(body,{headers:{'content-type':type,'cache-control':'public, max-age=86400','x-content-type-options':'nosniff'}});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  try{
   if(url.pathname==='/api/auth/status'){
    const user=await session(request,env);
    return json({service:'gilded-ledger',configured:configured(env),storageConfigured:Boolean(env.LEDGER_PROFILES),user:user?{xuid:user.xuid,gamertag:user.gamertag,picture:user.picture}:null,csrf:user?.csrf||null});
   }
   if(url.pathname==='/api/auth/login'&&request.method==='GET')return beginLogin(request,env);
   if(url.pathname==='/api/auth/callback'&&request.method==='GET')return finishLogin(request,env);
   if(url.pathname==='/api/auth/logout'&&request.method==='POST'){
    const user=await session(request,env);if(!sameOrigin(request,env)||(user&&!constantEqual(request.headers.get('x-ledger-csrf'),user.csrf)))return json({error:'Request verification failed'},403);
    return json({ok:true},200,{'set-cookie':setCookie(SESSION_COOKIE,'',0)});
   }
   if(url.pathname==='/api/profile')return profileAPI(request,env);
   if(url.pathname==='/api/image'&&request.method==='GET')return imageAPI(request);
   if(url.pathname==='/api/acquisition'&&request.method==='GET')return acquisitionAPI(request,env);
   if(url.pathname==='/api/cosmetic-guide'&&request.method==='GET')return cosmeticGuideAPI(request);
   if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
   return env.ASSETS.fetch(request);
  }catch{return json({error:'The requested service is temporarily unavailable.'},500);}
 }
};
