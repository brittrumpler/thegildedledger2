#!/usr/bin/env python3
"""Bundle public SoTDB acquisition facts for every treasure; never authenticates."""
import datetime as dt,json,pathlib,time,urllib.error,urllib.parse,urllib.request
PROJECT=pathlib.Path(__file__).resolve().parents[1];ROOT=PROJECT/'.cache/acquisition';ROOT.mkdir(parents=True,exist_ok=True);CACHE=ROOT/'raw';CACHE.mkdir(exist_ok=True)
CATALOG=PROJECT/'data/catalog.json'
OUTPUT=ROOT/'checkpoint.json';BASE='https://sotdb.gg';LAST=0

def now():return dt.datetime.now(dt.timezone.utc).isoformat()
def save(data):
 temp=OUTPUT.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(OUTPUT)

def active_sources(payload):
 result=[];seen=set()
 def walk(value):
  if isinstance(value,list):
   for child in value:walk(child)
   return
  if not isinstance(value,dict):return
  if value.get('kind')=='source' and value.get('active',True):
   edges=value.get('edges') or [value.get('edge') or {}]
   for edge in edges:
    if not edge.get('active',True):continue
    key=(value.get('slug') or value.get('id'),edge.get('id'),edge.get('stage'),edge.get('season_span'))
    if key in seen:continue
    seen.add(key)
    notes='\n'.join(dict.fromkeys(str(t).strip() for t in [value.get('notes',''),edge.get('notes','')] if str(t).strip()))
    result.append({'id':value.get('slug') or value.get('id'),'sourceId':value.get('pk'),'name':value.get('name',''),'type':value.get('type',''),'typeLabel':value.get('type_label',''),'url':urllib.parse.urljoin(BASE,value.get('url','')),'notes':notes,'chance':bool(edge.get('chance',False)),'verified':bool(edge.get('verified',False)),'confidence':edge.get('confidence','reported'),'stage':edge.get('stage',''),'quantity':edge.get('quantity'),'season':edge.get('season_span',''),'seasonAdded':edge.get('season_added'),'seasonRemoved':edge.get('season_removed')})
  for key in ['ring','ungrouped','groups','children','items']:
   if key in value:walk(value[key])
 walk({k:payload.get(k,[]) for k in ['ring','ungrouped','groups']})
 return result

def fetch(slug):
 global LAST
 path=CACHE/(slug+'.json')
 if path.exists() and time.time()-path.stat().st_mtime<7*86400:
  payload=json.loads(path.read_text())
  return payload,dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat(),True
 time.sleep(max(0,1.15-(time.monotonic()-LAST)));LAST=time.monotonic()
 url=BASE+'/api/loot/node/?kind=item&slug='+urllib.parse.quote(slug,safe='')
 req=urllib.request.Request(url,headers={'User-Agent':'GildedLedger/1.0 (noncommercial fan companion; acquisition-source export)'})
 with urllib.request.urlopen(req,timeout=35) as response:payload=json.load(response)
 if not payload.get('ok') or payload.get('center',{}).get('slug')!=slug:raise ValueError('Invalid item-node response')
 path.write_text(json.dumps(payload,ensure_ascii=False))
 return payload,now(),False

def run():
 catalog=json.loads(CATALOG.read_text());items=catalog['items'];previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {};done={x['itemId']:x for x in previous.get('items',[]) if x.get('complete') and (dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(x['sourceFetchedAt'])).total_seconds()<7*86400};errors=[]
 snapshot={'schemaVersion':1,'source':BASE+'/loot/','startedAt':previous.get('startedAt',now()),'fetchedAt':now(),'complete':False,'expectedCount':len(items),'completedCount':len(done),'items':list(done.values()),'errors':errors}
 stopped=False
 for index,item in enumerate(items,1):
  slug=item['id']
  if slug in done:continue
  try:
   payload,fetched,cached=fetch(slug);center=payload.get('center',{});sources=active_sources(payload)
   done[slug]={'itemId':slug,'name':item['name'],'checkedAt':now(),'sourceFetchedAt':fetched,'source':BASE+'/loot/'+slug+'/','sources':sources,'notes':center.get('notes',''),'needsReview':bool(center.get('needs_review',False)),'complete':True,'status':'available' if sources else 'no-published-sources'}
   print('ACQUISITION',index,'/',len(items),slug,'sources',len(sources),'cached' if cached else '',flush=True)
  except Exception as error:
   entry={'itemId':slug,'error':str(error),'checkedAt':now()};errors.append(entry);print('ERROR',entry,flush=True)
   if getattr(error,'code',None)==429:stopped=True
  snapshot.update(fetchedAt=now(),completedCount=len(done),items=[done[x['id']] for x in items if x['id'] in done],errors=errors)
  save(snapshot)
  if stopped:print('STOPPED: source rate limit; all completed records preserved.',flush=True);break
 snapshot['complete']=len(done)==len(items);save(snapshot)
 if snapshot['complete']:
  final={x['itemId']:x for x in snapshot['items']}
  final['chest-of-fortune']={'itemId':'chest-of-fortune','checkedAt':catalog['eventRulesReviewedAt'],'sources':[{'id':ev['id'],'name':ev['name'],'typeLabel':'World event','url':ev['source'],'chance':True,'verified':False,'notes':'Possible bonus of one or three Chests of Fortune under official Season 21 rules; not guaranteed.'} for ev in catalog['events']]}
  target=PROJECT/'data/acquisition.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(final,ensure_ascii=False,separators=(',',':')));temp.replace(target)
 print('FINAL',snapshot['completedCount'],'/',len(items),'complete',snapshot['complete'],flush=True)

if __name__=='__main__':run()
