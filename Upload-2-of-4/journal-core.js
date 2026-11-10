export function normalizeName(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/<[^>]*>/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function numeric(value){if(value===null||value===''||typeof value==='boolean')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
function text(value){return typeof value==='string'?value.replace(/<[^>]*>/g,'').trim():'';}
export function rejectCredentials(input){
 const forbidden=/^(?:(?:xbox|xsts|user)?token|access.?token|refresh.?token|id.?token|session(?:id)?|authorization|cookie|client.?secret|password|rat|rare.?authentication.?token)$/i;
 let count=0;
 function visit(node,depth=0){if(++count>250000||depth>20)throw new Error('The profile file is too large or deeply nested.');if(Array.isArray(node)){for(const x of node)visit(x,depth+1);}else if(node&&typeof node==='object'){for(const [key,value] of Object.entries(node)){if(forbidden.test(key)||['__proto__','prototype','constructor'].includes(key))throw new Error('This file contains credential fields. Use the Ledger profile exporter instead.');visit(value,depth+1);}}}
 visit(input);return input;
}
export function nameIndex(rows){const index=new Map();for(const row of rows){const keys=new Set([row.name,...(row.aliases||[]),row.canonicalName,row.matchingAlias].filter(Boolean).map(normalizeName));for(const key of keys){if(!index.has(key))index.set(key,[]);index.get(key).push(row);}}return index;}
function uniqueMatch(record,index,context){
 const name=text(record.DisplayName||record.displayName||record.title||record.name||record.Name);if(!name)return null;
 const candidates=index.get(normalizeName(name))||[];if(candidates.length===1)return candidates[0];
 if(candidates.length>1){const keys=normalizeName(context+' '+String(record['#Type']||''));const narrowed=candidates.filter(x=>[x.category,x.company,x.type].some(v=>v&&keys.includes(normalizeName(v))));if(narrowed.length===1)return narrowed[0];}
 return null;
}
export function normalizeProfileImport(raw,catalog){
 rejectCredentials(raw);
 if(raw?.schemaVersion===1&&raw?.journalVersion===1){
  if(!raw.manual||typeof raw.manual!=='object'||(!raw.imported&&raw.imported!==null))throw new Error('Journal backup is incomplete.');
  if(raw.imported&&(typeof raw.imported!=='object'||!Number.isFinite(Date.parse(raw.imported.importedAt))||!raw.imported.commendations||!raw.imported.cosmetics))throw new Error('The saved snapshot is incomplete or has an invalid date.');
  const journal=emptyJournal();journal.imported=raw.imported;
  for(const [id,value] of Object.entries(raw.manual.cosmetics||{}))if(typeof value==='boolean')journal.manual.cosmetics[id]=value;
  for(const [id,value] of Object.entries(raw.manual.commendations||{}))if(value&&typeof value==='object'&&(typeof value.completed==='boolean'||value.completed===null))journal.manual.commendations[id]={completed:value.completed,current:numeric(value.current)};
  journal.manual.goals=Array.isArray(raw.manual.goals)?[...new Set(raw.manual.goals.filter(x=>typeof x==='string'&&/^(?:cosmetic|commendation):[0-9]+$/.test(x)))]:[];
  return {journal,report:{backup:true}};
 }
 const sections=raw.sections||raw;
 const section=name=>{const value=sections[name];return value?.data!==undefined?value.data:value;};
 const reputation=section('reputation'),chest=section('chest');
 if(!reputation&&!chest)throw new Error('No reputation or Chest data found. Export from your official Sea of Thieves profile first.');
 const result={schemaVersion:1,source:'official-profile-export',importedAt:new Date().toISOString(),capturedAt:raw.exportedAt||raw.capturedAt||null,identity:{gamertag:text(raw.gamertag||raw.identity?.gamertag),xuid:text(raw.xuid||raw.identity?.xuid)},commendations:{},cosmetics:{},inventoryComplete:false,sections:{reputation:Boolean(reputation),chest:false},sectionDates:{}};
 const commendationIndex=nameIndex(catalog.commendations||[]),cosmeticIndex=nameIndex(catalog.cosmetics||[]);
 const report={matchedCommendations:0,unmatchedCommendations:0,matchedCosmetics:0,unmatchedCosmetics:0,unmatchedNames:[],partialSections:raw.errors||[]};
 const remember=(name)=>{if(name&&report.unmatchedNames.length<40&&!report.unmatchedNames.includes(name))report.unmatchedNames.push(name);};
 const seenRecords=new Set();
 function visitReputation(node,context='',depth=0){
  if(depth>18||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const x of node)visitReputation(x,context,depth+1);return;}
  const hasProgress=['Completed','completed','IsComplete','Value','Threshold','MaxGrade'].some(key=>Object.hasOwn(node,key));
  const display=text(node.DisplayName||node.displayName||node.title||node.name);
  if(display&&hasProgress){
   const key=display+'|'+String(node['#Name']||'');
   if(!seenRecords.has(key)){
    seenRecords.add(key);const match=uniqueMatch(node,commendationIndex,context);
    if(match){
     let completed=typeof node.Completed==='boolean'?node.Completed:typeof node.completed==='boolean'?node.completed:typeof node.IsComplete==='boolean'?node.IsComplete:null;
     const current=numeric(node.Value??node.value??node.current),grade=numeric(node.Grade??node.grade),maxGrade=numeric(node.MaxGrade??node.maxGrade);
     if(completed===null&&grade!==null&&maxGrade>0)completed=grade>=maxGrade;
     result.commendations[match.id]={completed,current,grade,maxGrade,threshold:numeric(node.Threshold??node.threshold),name:match.name};report.matchedCommendations++;
    }else{report.unmatchedCommendations++;remember(display);}
   }
  }
  for(const [key,value] of Object.entries(node))if(value&&typeof value==='object')visitReputation(value,context+' '+key+' '+text(node.Title),depth+1);
 }
 visitReputation(reputation);
 if(reputation)result.sectionDates.reputation=result.importedAt;
 const chestData=chest?.chestData||chest?.ChestData||chest?.data?.chestData;
 if(chestData&&typeof chestData==='object'){
  result.inventoryComplete=true;result.sections.chest=true;result.sectionDates.chest=result.importedAt;
  for(const [category,records] of Object.entries(chestData))if(Array.isArray(records))for(const record of records){
   if(!record||typeof record!=='object')continue;
   const match=uniqueMatch(record,cosmeticIndex,category);
   if(match){result.cosmetics[match.id]={owned:true,name:match.name};report.matchedCosmetics++;}
   else{report.unmatchedCosmetics++;remember(text(record.title||record.name));}
  }
 }else if(chest){report.partialSections=[...report.partialSections,'Chest response shape not recognized; missing items were not marked unowned.'];}
 // Without complete matching, absence from the imported map is not proof of non-ownership.
 if(report.unmatchedCosmetics>0)result.inventoryComplete=false;
 if(!report.matchedCommendations&&!report.matchedCosmetics)throw new Error('No catalog entries matched this export. Check that your official profile is in English and that this is a profile export, not a login response.');
 result.report=report;return {imported:result,report};
}
export function emptyJournal(){return {schemaVersion:1,journalVersion:1,imported:null,manual:{commendations:{},cosmetics:{},goals:[]},updatedAt:new Date().toISOString()};}
export function commendationProgress(item,journal){
 const manual=journal?.manual?.commendations?.[item.id];
 if(manual!==undefined)return {status:manual.completed===true?'completed':manual.completed===false?'incomplete':'unknown',current:manual.current??null,grade:null,source:'manual'};
 const record=journal?.imported?.commendations?.[item.id];
 if(!record)return {status:'unknown',current:null,grade:null,source:'none'};
 return {...record,status:record.completed===true?'completed':record.completed===false?'incomplete':'unknown',source:'import'};
}
export function cosmeticProgress(item,journal){
 const manual=journal?.manual?.cosmetics?.[item.id];if(typeof manual==='boolean')return {status:manual?'owned':'not-owned',source:'manual'};
 if(journal?.imported?.cosmetics?.[item.id]?.owned)return {status:'owned',source:'import'};
 return {status:journal?.imported?.inventoryComplete?'not-owned':'unknown',source:journal?.imported?.inventoryComplete?'import':'none'};
}
export function journalSummary(catalog,journal){
 return {completed:(catalog.commendations||[]).filter(x=>commendationProgress(x,journal).status==='completed').length,owned:(catalog.cosmetics||[]).filter(x=>cosmeticProgress(x,journal).status==='owned').length,goals:journal?.manual?.goals?.length||0};
}

export function mergeImportedProgress(previous,next){
 if(!previous)return next;
 const a=normalizeName(previous.identity?.gamertag),b=normalizeName(next.identity?.gamertag);
 if(a&&b&&a!==b)return next;
 const merged={...next,sectionDates:{...(previous.sectionDates||{}),...(next.sectionDates||{})}};
 if(!next.sections?.reputation)merged.commendations=previous.commendations||{};
 if(!next.sections?.chest){merged.cosmetics=previous.cosmetics||{};merged.inventoryComplete=Boolean(previous.inventoryComplete);}
 return merged;
}
