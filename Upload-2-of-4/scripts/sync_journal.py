#!/usr/bin/env python3
"""Manually refresh the complete public source catalog. No account data is requested."""
import argparse,datetime as dt,json,pathlib,re,urllib.parse,shutil
from source_journal import ROOT as CACHE,BASE,Tree,fetch,cosmetic_detail,scrape_commendations,scrape_cosmetics,join,save
PROJECT=pathlib.Path(__file__).resolve().parents[1]
def normalize(s):return re.sub('[^a-z0-9]','',s.lower())
def run(fresh=False):
 if fresh:
  raw=CACHE/'cache'
  if raw.exists():shutil.rmtree(raw)
  raw.mkdir()
 scrape_commendations();scrape_cosmetics()
 a=json.loads((CACHE/'cosmetics.json').read_text());b=json.loads((CACHE/'commendations.json').read_text())
 if not a['complete'] or not b['complete']:raise ValueError('Partial upstream scrape: last published catalog was not replaced')
 xml=fetch('/sitemap.xml');urls=re.findall(r'<loc>(.*?)</loc>',xml)
 expected={re.search(r'/cosmetic/(\d+)/',url)[1]:url for url in urls if re.match(r'https://sotdb\.gg/cosmetic/\d+/',url)}
 if not expected:raise ValueError('Sitemap coverage could not be verified')
 old=json.loads((PROJECT/'data/journal.json').read_text());previous={x['id']:x for x in old['cosmetics']};items={x['id']:x for x in a['items']}
 for ident,url in expected.items():
  if ident in items:continue
  detail=cosmetic_detail(fetch(url),url)
  items[ident]={**detail,'id':ident,'sourceId':int(ident),'category':'unclassified','unlockSources':[],'unlockCommendationIds':detail.get('unlockCommendationIds',[]),'detailsStatus':'source-detail'}
 for ident,item in items.items():
  slug=urllib.parse.unquote(urllib.parse.urlparse(item['source']).path.rstrip('/').split('/')[-1]);alias=slug.replace('-',' ')
  original=item['name'];canonical=item.get('canonicalName') or previous.get(ident,{}).get('canonicalName')
  if item.get('detailsStatus')=='source-detail':canonical=original
  display=canonical or (original if normalize(original)==normalize(alias) else alias.title())
  item.update(name=display,originalDisplayLabel=original,canonicalSlug=slug,matchingAlias=alias,aliases=[alias],displayName=display,displayNameSource='source-jsonld' if canonical else 'source-card' if display==original else 'canonical-slug')
  if canonical:item['canonicalName']=canonical
  item.setdefault('unlockCommendationIds',[])
 for commendation in b['items']:
  for reward in commendation.get('rewards',[]):
   cosmetic=items.get(str(reward['id']))
   if cosmetic and commendation['id'] not in cosmetic['unlockCommendationIds']:cosmetic['unlockCommendationIds'].append(commendation['id'])
 if len(items)<len(old['cosmetics'])*.95 or len(b['items'])<len(old['commendations'])*.95:raise ValueError('Catalog shrank unexpectedly; inspect source changes before replacing it')
 output={'metadata':{'source':BASE+'/', 'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'cosmeticsCompleteForSource':set(expected)<=set(items),'commendationsCompleteForSource':True,'cosmeticCount':len(items),'commendationCount':len(b['items']),'coverageNote':'Complete for the public source snapshot, not a guarantee of all game items or future updates.'},'cosmetics':sorted(items.values(),key=lambda x:x['name']),'commendations':b['items']}
 target=PROJECT/'data/journal.json';temp=target.with_suffix('.tmp');temp.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')));temp.replace(target)
 print('Published',len(items),'cosmetics and',len(b['items']),'commendation/title records. Run npm run build next.')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--fresh',action='store_true');run(p.parse_args().fresh)
