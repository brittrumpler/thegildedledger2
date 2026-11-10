#!/usr/bin/env python3
"""Polite, cacheable public SoTDB journal catalog extraction; never authenticates."""
import argparse,datetime as dt,hashlib,html,json,pathlib,re,time,urllib.parse,urllib.request
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]/'.cache/journal-source';ROOT.mkdir(parents=True,exist_ok=True);CACHE=ROOT/'cache';CACHE.mkdir(exist_ok=True)
BASE='https://sotdb.gg';VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
LAST=0
class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 @property
 def text(self):return ' '.join(' '.join(c.text if isinstance(c,Node) else c for c in self.children).split())
 def has(self,cls):return cls in self.attrs.get('class','').split()
 def all(self,predicate):
  out=[]
  for child in self.children:
   if isinstance(child,Node):
    if predicate(child):out.append(child)
    out.extend(child.all(predicate))
  return out
 def one(self,predicate):return next(iter(self.all(predicate)),None)
class Tree(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=True);self.root=Node('root');self.stack=[self.root];self.feed(text)
 def handle_starttag(self,tag,attrs):
  n=Node(tag,attrs);self.stack[-1].children.append(n)
  if tag not in VOID:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,text):self.stack[-1].children.append(text)
def fetch(path,ajax=False):
 global LAST
 url=urllib.parse.urljoin(BASE,path);key=hashlib.sha256((url+str(ajax)).encode()).hexdigest();p=CACHE/(key+'.txt')
 if p.exists():return p.read_text()
 time.sleep(max(0,1.1-(time.monotonic()-LAST)))
 req=urllib.request.Request(url,headers={'User-Agent':'GildedLedger/1.0 (noncommercial fan catalog; public pages only)',**({'X-Requested-With':'XMLHttpRequest'} if ajax else {})})
 LAST=time.monotonic()
 with urllib.request.urlopen(req,timeout=40) as r:text=r.read().decode()
 p.write_text(text);return text

def save(name,payload):
 p=ROOT/name;t=p.with_suffix('.tmp');t.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n');t.replace(p)
def image(node):
 img=node.one(lambda n:n.tag=='img');return urllib.parse.urljoin(BASE,img.attrs.get('src','')) if img else ''
def category_links(tree):
 return [n for n in tree.all(lambda n:n.tag=='a' and n.has('category-card') and re.match(r'/category/\d+/',n.attrs.get('href','')))]
def parse_cosmetic_cards(tree,group=None):
 out=[]
 for node in tree.all(lambda n:n.tag=='a' and n.has('cosmetic-card')):
  url=node.attrs.get('href','');m=re.match(r'/cosmetic/(\d+)/',url)
  if not m:continue
  title=node.one(lambda n:n.tag=='h3')
  if not title:continue
  badges=[x.text for x in node.all(lambda n:n.has('unlock-badge'))]
  out.append({'id':m[1],'sourceId':int(m[1]),'name':title.text,'category':group or 'unclassified','type':None,'image':image(node),'source':BASE+url,'unlockSources':badges,'unlockCommendationIds':[],'cost':None,'set':None,'detailsStatus':'listing-only'})
 return out

def parse_commendations(tree,cat):
 records=[]
 for card in tree.all(lambda n:n.has('commendation-card') and n.attrs.get('id','').startswith('commendation-')):
  raw=card.attrs['id'].split('-')[-1];title=card.one(lambda n:n.has('comm-title'));body=card.one(lambda n:n.has('card-body'))
  if not title or not body:continue
  link=title.one(lambda n:n.tag=='a' and n.has('comm-permalink'))
  name=' '.join(c.text if isinstance(c,Node) and not(c.tag=='a' and c.has('comm-permalink')) else c if isinstance(c,str) else '' for c in title.children).strip()
  requirement=body.one(lambda n:n.tag=='em');paras=body.all(lambda n:n.tag=='p')
  total=next((p.text.split(':',1)[-1].strip() for p in paras if p.text.startswith('Total Required:')),None)
  grades=[]
  for row in body.all(lambda n:n.has('grade-row')):
   text=row.text;m=re.search(r'Grade\s+(\d+):\s*(.*)',text)
   if m:
    value=re.match(r'([\d,]+)',m[2]);grades.append({'grade':int(m[1]),'requirement':m[2],'target':int(value[1].replace(',','')) if value else None})
  rewards=[]
  for a in card.all(lambda n:n.tag=='a' and n.has('cosmetic-item')):
   m=re.match(r'/cosmetic/(\d+)/',a.attrs.get('href',''))
   if m:
    p=a.one(lambda n:n.tag=='p');rewards.append({'id':m[1],'name':p.text if p else a.text,'image':image(a),'source':BASE+a.attrs['href']})
  tags=[n.text for n in card.all(lambda n:n.tag=='span' and ('tag' in n.attrs.get('class','').split() or any(k.startswith('tag-') for k in n.attrs.get('class','').split())))]
  records.append({'id':raw,'sourceId':int(raw),'name':name,'categoryId':cat['id'],'category':cat['name'],'company':cat.get('rootName',cat['name']),'requirement':requirement.text if requirement else next(iter(paras),Node()).text,'totalRequired':total,'grades':grades,'rewards':rewards,'image':image(card),'source':BASE+(link.attrs['href'] if link else '/category/'+cat['id']+'/#commendation-'+raw),'tags':tags})
 return records

def cosmetic_detail(raw,source):
 tree=Tree(raw).root;container=tree.one(lambda n:n.has('cosmetic-detail-container')) or tree
 canonical_name=None
 for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',raw,re.S):
  try:
   structured=json.loads(block)
   if structured.get('@type')=='Thing' and structured.get('name'):canonical_name=structured['name'];break
  except (ValueError,AttributeError):pass
 title=container.one(lambda n:n.tag=='h1');cost_node=container.one(lambda n:n.has('cost-display'));cost=None
 if cost_node:
  match=re.search(r'Cost:\s*([\d,]+)\s*(Gold|Doubloons|Ancient Coins)',cost_node.text,re.I)
  if match:cost={'amount':int(match[1].replace(',','')),'currency':match[2].lower().replace(' ','-')}
 unlock=container.one(lambda n:n.has('unlock-list'))
 instructions=[n.text for n in unlock.all(lambda n:n.tag=='li')] if unlock else []
 ids=[]
 for a in container.all(lambda n:n.tag=='a'):
  m=re.search(r'#commendation-(\d+)',a.attrs.get('href',''))
  if m and m[1] not in ids:ids.append(m[1])
 set_link=title.one(lambda n:n.tag=='a' and '/cosmetic-set/' in n.attrs.get('href','')) if title else None
 return {'name':canonical_name or (title.text if title else None),'type':title.text[len(set_link.text):].strip() if title and set_link and title.text.startswith(set_link.text) else None,'typeNote':'Type is the title suffix following the source set link, when present; otherwise unknown.','set':{'name':set_link.text,'source':BASE+set_link.attrs['href']} if set_link else None,'cost':cost,'acquisition':instructions,'unlockCommendationIds':ids,'image':image(container),'source':source}

def scrape_cosmetics():
 root=Tree(fetch('/cosmetics/')).root
 groups=[n.attrs['data-type'] for n in root.all(lambda n:n.has('type-group') and 'data-type'in n.attrs)]
 records={};counts={};complete=False
 try:
  for group in groups:
   path='/cosmetics/?types='+group;page=0;seen=set()
   while path:
    if path in seen:raise RuntimeError('Repeated cosmetic pagination URL')
    seen.add(path);data=json.loads(fetch(path,True));tree=Tree(data['html']).root
    rows=parse_cosmetic_cards(tree,group);page+=1
    for row in rows:
     if row['id'] not in records:records[row['id']]=row
     elif records[row['id']]['category']!=group:records[row['id']].setdefault('additionalCategories',[]).append(group)
    counts[group]=counts.get(group,0)+len(rows)
    print('COSMETICS',group,page,'rows',len(rows),'unique',len(records),flush=True)
    path=data.get('next_url')
    save('cosmetics.json',{'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':BASE+'/cosmetics/','complete':False,'categoryCounts':counts,'items':list(records.values())})
   
  # Root first-page items not belonging to the advertised taxonomy remain represented explicitly.
  for row in parse_cosmetic_cards(root):records.setdefault(row['id'],row)
  complete=True
 finally:
  save('cosmetics.json',{'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':BASE+'/cosmetics/','complete':complete,'categoryCounts':counts,'items':sorted(records.values(),key=lambda x:x['name'].casefold())})

def scrape_commendations():
 root=Tree(fetch('/categories/')).root;queue=[]
 for a in category_links(root):
  name=a.one(lambda n:n.tag=='h3');m=re.match(r'/category/(\d+)/',a.attrs['href'])
  queue.append({'id':m[1],'name':name.text if name else a.text,'rootName':name.text if name else a.text,'path':a.attrs['href']})
 seen=set();categories=[];records={};complete=False
 try:
  while queue:
   cat=queue.pop(0)
   if cat['id'] in seen:continue
   seen.add(cat['id']);tree=Tree(fetch(cat['path'])).root;rows=parse_commendations(tree,cat)
   for row in rows:records[row['id']]=row
   categories.append({**cat,'count':len(rows)})
   for a in category_links(tree):
    m=re.match(r'/category/(\d+)/',a.attrs['href']);name=a.one(lambda n:n.tag=='h3')
    if m[1] not in seen:queue.append({'id':m[1],'name':name.text if name else a.text,'rootName':cat['rootName'],'path':a.attrs['href']})
   print('COMMENDATIONS',cat['name'],len(rows),'total',len(records),'queued',len(queue),flush=True)
   save('commendations.json',{'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':BASE+'/categories/','complete':False,'categories':categories,'items':list(records.values())})
  complete=True
 finally:
  save('commendations.json',{'fetchedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':BASE+'/categories/','complete':complete,'categories':categories,'items':sorted(records.values(),key=lambda x:x['name'].casefold())})

def join():
 a=json.loads((ROOT/'cosmetics.json').read_text());b=json.loads((ROOT/'commendations.json').read_text());cosmetics={x['id']:x for x in a['items']}
 for commendation in b['items']:
  for reward in commendation['rewards']:
   item=cosmetics.get(reward['id'])
   if item is not None and commendation['id'] not in item['unlockCommendationIds']:item['unlockCommendationIds'].append(commendation['id'])
 save('cosmetics.json',a)
 print('JOIN',sum(bool(x['unlockCommendationIds']) for x in a['items']),'cosmetics linked to commendations',flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',choices=['cosmetics','commendations','join']);args=parser.parse_args()
 try:
  if args.only in (None,'commendations'):scrape_commendations()
  if args.only in (None,'cosmetics'):scrape_cosmetics()
  if args.only in (None,'join'):join()
 except Exception as error:
  print('STOPPED:',str(error),flush=True);raise
