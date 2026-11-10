#!/usr/bin/env python3
"""Prepare upload files and build the same site for GitHub Actions deployment."""
import pathlib,shutil,json
from prepare_release import prepare
root=pathlib.Path(__file__).resolve().parents[1];out=root/'dist'
prepare()
data=json.loads((root/'data/catalog.json').read_text())
assert len(data['items'])>=300 and len(data['events'])>=8,'Catalog coverage regressed'
for item in data['items']:
 price=item.get('price');assert price is None or (0<=price['min']<=price['max'] and price['currency'] in ('gold','doubloons'))
if out.exists():shutil.rmtree(out)
out.mkdir()
for name in ['index.html','app.bundle.js','styles.css','THIRD_PARTY.md','.nojekyll']:shutil.copy2(root/name,out/name)
shutil.copytree(root/'assets',out/'assets',ignore=shutil.ignore_patterns('items'))
shutil.copytree(root/'data',out/'data')
print(f'Built {out}; no package install required.')
