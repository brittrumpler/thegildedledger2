#!/usr/bin/env python3
"""Create a browser-upload-friendly release with bundled, validated image bytes."""
import base64,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
PREFIX='window.GILDED_IMAGES = Object.assign(window.GILDED_IMAGES || {}, '

def mime(data):
 if data.startswith(b'\x89PNG\r\n\x1a\n'):return 'image/png'
 if data.startswith(b'\xff\xd8\xff'):return 'image/jpeg'
 if data.startswith(b'RIFF') and data[8:12]==b'WEBP':return 'image/webp'
 if data.startswith((b'GIF87a',b'GIF89a')):return 'image/gif'
 raise ValueError('Unsupported or corrupt image signature')

def prepare():
 directory=ROOT/'assets/image-packs';directory.mkdir(exist_ok=True)
 images={}
 for path in sorted(directory.glob('pack-*.js')):
  text=path.read_text();assert text.startswith(PREFIX) and text.endswith(');\n'),path
  images.update(json.loads(text[len(PREFIX):-3]))
 item_dir=ROOT/'assets/items'
 if item_dir.exists():
  for path in sorted(item_dir.iterdir()):
   if path.is_file():
    data=path.read_bytes();images[path.relative_to(ROOT).as_posix()]='data:'+mime(data)+';base64,'+base64.b64encode(data).decode()
 # Validate every existing packed payload, not just new files.
 for key,url in images.items():
  header,encoded=url.split(',',1);data=base64.b64decode(encoded,validate=True)
  assert header=='data:'+mime(data)+';base64',key
 for path in directory.glob('pack-*.js'):path.unlink()
 packs=[];current={};size=0
 for key,value in sorted(images.items()):
  if size+len(value)>4*1024*1024 and current:packs.append(current);current={};size=0
  current[key]=value;size+=len(key)+len(value)+10
 if current:packs.append(current)
 files=[]
 for i,pack in enumerate(packs,1):
  file=directory/f'pack-{i:02}.js';file.write_text(PREFIX+json.dumps(pack,separators=(',',':'))+');\n');files.append(file.relative_to(ROOT).as_posix())
 for name,global_name in [('catalog','GILDED_CATALOG'),('calendar','GILDED_CALENDAR')]:
  payload=json.loads((ROOT/f'data/{name}.json').read_text())
  (ROOT/f'data/{name}.js').write_text('window.'+global_name+' = '+json.dumps(payload,ensure_ascii=True,separators=(',',':'))+';\n')
 core=(ROOT/'core.js').read_text();app=(ROOT/'app.js').read_text()
 core=re.sub(r'^export ', '',core,flags=re.M)
 app=re.sub(r'^import .*?;\n','',app,count=1)
 (ROOT/'app.bundle.js').write_text('// Generated from core.js and app.js by scripts/prepare_release.py\n(async function(){\n'+core+'\nconst e = escapeHTML;\n'+app+'\n})();\n')
 index=ROOT/'index.html';html=index.read_text()
 html=re.sub(r'<!-- BUNDLED SCRIPTS -->.*?<!-- END BUNDLED SCRIPTS -->','',html,flags=re.S)
 html=html.replace('<script type="module" src="app.js"></script>','')
 scripts='\n'.join('<script defer src="'+file+'"></script>' for file in [*files,'data/catalog.js','data/calendar.js','app.bundle.js'])
 html=html.replace('</body>','<!-- BUNDLED SCRIPTS -->\n'+scripts+'\n<!-- END BUNDLED SCRIPTS -->\n</body>');index.write_text(html)
 (ROOT/'.nojekyll').touch()
 catalog=json.loads((ROOT/'data/catalog.json').read_text())
 for item in catalog['items']+catalog['events']:
  image=item.get('image','')
  if image.startswith('assets/items/'):assert image in images,('Missing packed image',image)
 print(f'Prepared {len(images)} validated images in {len(packs)} packs; classic JavaScript and local data included.')

if __name__=='__main__':prepare()
