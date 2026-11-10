#!/usr/bin/env python3
"""Resolve item infobox prices/images from the public wiki; preserve evidence and failures."""
import concurrent.futures,datetime as dt,json,pathlib,re,time,urllib.parse
from html.parser import HTMLParser
from sync_data import ROOT,fetch,norm,read_json,write_json,Tables

class Infobox(HTMLParser):
    def __init__(self):
        super().__init__();self.price=[];self.price_depth=0;self.image='';self.depth=0;self.title='';self.in_title=False;self.coins=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs);cls=attrs.get('class','')
        if tag=='div':
            self.depth+=1
            if 'druid-data-Sellprice' in cls:self.price_depth=self.depth
        if tag=='h1':self.in_title=True
        if self.price_depth and tag=='img':self.price.append(' '+attrs.get('alt','')+' ')
        if self.price_depth and attrs.get('title'):self.coins.append(attrs['title'])
        if tag=='img' and not self.image and ('druid-main-image' in cls or ('infobox' in cls)):
            self.image=attrs.get('src','')
    def handle_data(self,data):
        if self.price_depth:self.price.append(data)
        if self.in_title:self.title+=data
    def handle_endtag(self,tag):
        if tag=='div':
            if self.depth==self.price_depth:self.price_depth=0
            self.depth-=1
        if tag=='h1':self.in_title=False

def parse_price(text):
    text=' '.join(text.split()).replace(',','')
    m=re.fullmatch(r'(\d+)\s*(?:[-–]\s*(\d+))?\s*(Gold|Doubloons)',text,re.I)
    if not m:return None
    return {'min':int(m[1]),'max':int(m[2] or m[1]),'currency':'gold' if m[3].lower()=='gold' else 'doubloons'}

def composite_price(raw, source, checked_at):
    """Resolve explicit commodity demand variants or a shared standard selling chart."""
    box=Infobox();box.feed(raw)
    text=' '.join(''.join(box.price).split())
    if '(Normal)(Surplus)(Sought-after)' in text:
        amounts=re.findall(r'([\d,]+(?:\s*[-–]\s*[\d,]+)?)\s*Gold',text)
        if len(amounts)==1 and '??? Gold' in text:
            price=parse_price(amounts[0]+' Gold');price.update(source=source,checkedAt=checked_at,status='condition-specific',note='Normal-demand value only. Surplus and sought-after prices are unconfirmed in the source.');return price
        if len(amounts)==3:
            variants=[dict(parse_price(amount+' Gold'),condition=condition) for amount,condition in zip(amounts,['Normal','Surplus','Sought-after'])]
            price=dict(variants[0]);price.update(source=source,checkedAt=checked_at,status='condition-specific',variants=variants,note='Normal demand shown. Surplus and sought-after payouts differ by outpost; inspect the condition table below.')
            return price
    alternatives=re.fullmatch(r'([\d,]+) Gold or ([\d,]+) Doubloons',text)
    if alternatives:
        gold=int(alternatives[1].replace(',',''));dub=int(alternatives[2].replace(',',''))
        return {'min':gold,'max':gold,'currency':'gold','source':source,'checkedAt':checked_at,'status':'alternative-currency','note':'Alternative sale currencies, not cumulative. The main price and haul use the gold option; the table below shows both. Emissary eligibility depends on the buyer.','variants':[{'min':gold,'max':gold,'currency':'gold','condition':'Gold option'},{'min':dub,'max':dub,'currency':'doubloons','condition':'Doubloon option'}]}
    return None

def derive_variants(data, prices):
    """Apply only explicitly documented equivalent families, retaining the family source."""
    for item in data['items']:
        if item.get('price'):continue
        name=item['name'];parent=None
        note=''
        if name.startswith('Shipwrecked '):parent=name.replace('Shipwrecked ','',1)
        if name.startswith('Tome of '):parent='Ashen Tomes'
        if re.search(r"(?: Gold Key| Gold Totem)$",name):parent='Gold Treasure Vault Keys'
        if re.search(r"(?: Stone Key| Stone Totem)$",name):parent='Stone Treasure Vault Keys'
        for family in ['Classic','Refined','Exquisite',"Collector's"]:
            if name.startswith(family+" '"):
                parent=family+' Paintings'
                note='Category-level sale range. Specific artwork and sale conditions can affect value.'
                item['company']="Smugglers' League"
        if parent and norm(parent) in prices:
            price=dict(prices[norm(parent)]);price['status']='documented-family';price['note']=note or 'Value shared with the documented '+parent+' family.'
            item['price']=price;prices[norm(name)]=price
            if name.startswith('Shipwrecked ') or name.endswith((' Gold Key',' Stone Key',' Gold Totem',' Stone Totem')):item['company']='Gold Hoarders'
    return data

def enrich(refresh=False,images=False):
    data=read_json(ROOT/'data/catalog.json',{});prices=read_json(ROOT/'data/prices.json',{});now=dt.datetime.now(dt.timezone.utc).isoformat()
    stopped=[False]
    def one(item):
        if stopped[0]:return (item,None,'Skipped after source rate limit')
        # Match a page by its canonical item name. Group aliases are explicit, never fuzzy matched.
        aliases={"Crate of Devil's Cloths":"Crate of Devil's Cloth",'Gold Treasure Vault Keys':'Gold Treasure Vault Keys','Rag and Bone Crates':'Rag and Bone Crates'}
        name='Ashen Tomes' if item['category']=='tome' else aliases.get(item['name'],item['name'])
        source='https://seaofthieves.wiki.gg/wiki/'+urllib.parse.quote(name.replace(' ','_'),safe="_()")
        needs_price=refresh or not item.get('price')
        needs_image=images and not item.get('image')
        if not needs_price and not needs_image:return (item,None,None)
        try:
            cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
            cached=cache/(urllib.parse.quote(name,safe='')+'.html')
            if cached.exists() and not refresh:raw=cached.read_text()
            else:raw=fetch(source).decode();cached.write_text(raw)
            p=Infobox();p.feed(raw)
            table=Tables();table.feed(raw)
            for row in table.rows:
                if row and row[0] in ('V','Grade V','Grade 5') and len(row)>1:
                    grade_price=parse_price(row[1])
                    if grade_price:
                        base=parse_price(''.join(p.price))
                        if base and grade_price['currency']==base['currency']:
                            item['emissaryEligible']=grade_price['max']>base['max']
                            break
            price=parse_price(''.join(p.price)) or composite_price(raw,source,now)
            if not price and name=='Ashen Tomes':
                for row in table.rows:
                    if row and row[0]=='No Emissary' and len(row)>1:
                        price=parse_price(row[1]);break
            # Source prices can show both a primary and alternate buyer. Leave ambiguous fields unpriced.
            if price:price.update(source=source,checkedAt=now,status='source-infobox')
            # Current wiki infobox markup keeps the main image in a named container.
            if needs_image:
                match=re.search(r'class="druid-main-image[^\"]*"[^>]*>.*?<img[^>]+src="([^"]+)"',raw,re.S)
                image=p.image or (match[1] if match else '')
                if image:
                    image=urllib.parse.urljoin('https://seaofthieves.wiki.gg',image.replace('&amp;','&'))
                    target=ROOT/'assets/items'/f"{item['id']}.png"
                    try:target.write_bytes(fetch(image));item['image']='assets/items/'+target.name;item['imageSource']=source
                    except Exception:pass
            item['wikiSource']=source
            item['wikiCheckedAt']=now
            if not price:item['priceNote']='No simple base sale value in the source infobox. May be conditional, grouped, historical, or unsellable.'
            time.sleep(1.5)
            return (item,price,None)
        except Exception as exc:
            if getattr(exc,'code',None)==429:stopped[0]=True
            return (item,None,str(exc))
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        for item,price,error in pool.map(one,data['items']):
            if price:prices[norm(item['name'])]=price;item['price']=price;print('VALUE',item['name'],price['min'],price['max'],price['currency'],flush=True)
            if error:print('UNAVAILABLE',item['name'],error,flush=True)
    derive_variants(data,prices)
    write_json(ROOT/'data/prices.json',prices);write_json(ROOT/'data/catalog.json',data)
    print('Priced',sum(bool(x.get('price')) for x in data['items']),'of',len(data['items']))

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--refresh',action='store_true');p.add_argument('--images',action='store_true');a=p.parse_args();enrich(a.refresh,a.images)
