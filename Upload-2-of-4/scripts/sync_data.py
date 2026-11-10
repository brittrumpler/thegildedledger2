#!/usr/bin/env python3
"""Refresh public source facts. Never discard last-known values after a failed fetch."""
import argparse, datetime as dt, html, json, pathlib, re, time, urllib.request
from html.parser import HTMLParser
ROOT = pathlib.Path(__file__).resolve().parents[1]
CATEGORIES = 'chest skull artefact crate cargo smugglers key weapon tome manifest log gift cosmetic other'.split()
BASE = 'https://sotdb.gg'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'GildedLedger/1.0 (noncommercial fan reference)'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()

def read_json(path, fallback):
    return json.loads(path.read_text()) if path.exists() else fallback

def write_json(path, data):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    temp.replace(path)

class Tables(HTMLParser):
    """Read table cells without third party dependencies or executing upstream HTML."""
    def __init__(self):
        super().__init__(); self.rows=[]; self.cells=None; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='tr': self.cells=[]
        if tag in ('td','th') and self.cells is not None: self.cell=[]
        if tag=='img' and self.cell is not None:
            self.cell.append(' '+dict(attrs).get('alt','')+' ')
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None and self.cells is not None:
            self.cells.append(' '.join(''.join(self.cell).split())); self.cell=None
        if tag=='tr' and self.cells is not None:
            self.rows.append(self.cells); self.cells=None

def norm(s):
    return re.sub(r'[^a-z0-9]', '', html.unescape(s).lower().replace('’',"'"))

def wiki_prices(page):
    parser=Tables(); parser.feed(fetch('https://seaofthieves.wiki.gg/wiki/'+page).decode())
    result={}; column=None
    for row in parser.rows:
        headers=[x.lower() for x in row]
        if any('base' in x and 'gold' in x for x in headers):
            column=next(i for i,x in enumerate(headers) if 'base' in x and 'gold' in x); continue
        if column is None or len(row)<=column or column<1: continue
        # Rowspans (e.g. Artefact tiers) shift body cells relative to headers.
        for index, cell in enumerate(row):
            raw=cell.replace(',','')
            match=re.fullmatch(r'(\d+)\s*(?:[-–]\s*(\d+))?\s*Gold',raw)
            if match and index>0 and re.search('[A-Za-z]',row[index-1]):
                name=row[index-1]
                result[norm(name)]={'min':int(match[1]),'max':int(match[2] or match[1]),'currency':'gold','source':'https://seaofthieves.wiki.gg/wiki/'+page,'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'status':'source-table'}
                break
    if len(result)<2: raise ValueError('No usable base-value table; retain previous prices')
    return result

def event_drops(payload, valid_ids=None):
    """Include nested enemy/category loot groups as well as direct event drops."""
    output=[];seen=set()
    def visit(nodes, context=''):
        for node in nodes:
            if node.get('kind')=='group':
                label=node.get('name','') if node.get('enemy') else context
                visit(node.get('items',[]),label);visit(node.get('children',[]),label)
            elif node.get('kind')=='item' and node.get('active',True):
                if valid_ids is not None and node['slug'] not in valid_ids:continue
                for edge in node.get('edges',[node.get('edge',{})]):
                    if not edge.get('active',True):continue
                    key=(node['slug'],edge.get('id'),context)
                    if key in seen:continue
                    seen.add(key)
                    output.append({'itemId':node['slug'],'quantity':edge.get('quantity'),'chance':edge.get('chance',False),'verified':edge.get('verified',False),'stage':edge.get('stage') or context,'group':edge.get('slot'),'notes':edge.get('notes','')})
    visit(payload.get('ring',[]));visit(payload.get('ungrouped',[]));visit(payload.get('groups',[]))
    return output

def sync(images=False):
    (ROOT/'assets/items').mkdir(parents=True,exist_ok=True)
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    old=read_json(ROOT/'data/catalog.json', {'items':[], 'events':[]})
    prices=read_json(ROOT/'data/prices.json', {})
    warnings=[]
    for page in ['Treasure_Chests','Bounty_Skulls','Artefacts','Trade_Good_Crates',"Athena%27s_Fortune_Treasure",'Cargo_Crates']:
        try: prices.update(wiki_prices(page)); print('Prices refreshed:',page)
        except Exception as e:
            warnings.append(f'{page}: {e}')
            if getattr(e, 'code', None)==429:
                warnings.append('Wiki rate limit: stopping price requests; retry on a later run.');break
        time.sleep(.2)
    items={}; events=[]
    for category in CATEGORIES:
        payload=json.loads(fetch(BASE+'/api/loot/browse/?kind=item&key='+category))
        if not payload.get('ok') or not isinstance(payload.get('results'),list): raise ValueError('Invalid catalog response')
        for x in payload['results']:
            items[x['slug']]={'id':x['slug'],'name':x['name'],'category':category,'company':x.get('sub','') if x.get('sub')!='no sources yet' else '', 'image':x.get('icon',''),'source':BASE+x['url'],'limited':x.get('limited',False)}
        time.sleep(.15)
    listing=json.loads(fetch(BASE+'/api/loot/browse/?kind=source&key=world_event'))
    for event in listing['results']:
        payload=json.loads(fetch(BASE+'/api/loot/node/?kind=source&slug='+event['slug']))
        if not payload.get('ok'): raise ValueError('Invalid event response')
        drops=event_drops(payload,set(items))
        events.append({'id':event['slug'],'name':event['name'],'image':event.get('icon',''),'source':BASE+event['url'],'drops':drops})
        time.sleep(.2)
    if len(items)<300 or len(events)<8: raise ValueError('Source coverage unexpectedly shrank; refusing partial update')
    if old['items'] and len(items)<len(old['items'])*.9: raise ValueError('Catalog shrank by >10%; review source')
    previous={x['id']:x for x in old['items']}
    for item in items.values():
        item['price']=prices.get(norm(item['name']))
        local=ROOT/'assets/items'/f"{item['id']}.png"
        if images and item['image'] and not local.exists():
            try: local.write_bytes(fetch(item['image']))
            except Exception as e: warnings.append(f"Image {item['id']}: {e}")
        if local.exists(): item['image']='assets/items/'+local.name
        elif not item['image']: item['image']=previous.get(item['id'],{}).get('image','')
        for key in ('imageSource','wikiSource','wikiCheckedAt','priceNote','priceVariants','emissaryEligible'):
            if key in previous.get(item['id'],{}):item[key]=previous[item['id']][key]
    # Latest official Season 21 rules override older community chest-of-fortune edges.
    for event in events:
        event['drops']=[x for x in event['drops'] if x['itemId']!='chest-of-fortune']
        event['drops'].append({'itemId':'chest-of-fortune','quantity':None,'chance':True,'verified':False,'stage':'Bonus haul','group':None,'notes':'Possible bonus of 1 or 3; not guaranteed. Official patch 3.9.0.'})
    write_json(ROOT/'data/prices.json',prices)
    write_json(ROOT/'data/catalog.json', {'schemaVersion':1,'catalogFetchedAt':now,'eventRulesReviewedAt':'2026-11-10','items':sorted(items.values(),key=lambda x:x['name']),'events':events,'warnings':warnings})
    print(f'{len(items)} catalog entries; {sum(bool(x["price"]) for x in items.values())} priced; {len(events)} events')
    for warning in warnings: print('WARNING:',warning)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--images',action='store_true');args=p.parse_args();sync(args.images)
