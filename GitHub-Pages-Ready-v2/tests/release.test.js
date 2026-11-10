import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const prefix='window.GILDED_IMAGES = Object.assign(window.GILDED_IMAGES || {}, ';
const images={};
for(const file of readdirSync(path.join(root,'assets/image-packs'))){
 const raw=readFileSync(path.join(root,'assets/image-packs',file),'utf8');
 Object.assign(images,JSON.parse(raw.slice(prefix.length,-3)));
}
test('Every catalog and world-event image resolves to a packed payload',()=>{
 const data=JSON.parse(readFileSync(path.join(root,'data/catalog.json')));
 for(const item of [...data.items,...data.events])if(item.image){
  assert.ok(images[item.image],`Unbundled image: ${item.name}`);
  assert.match(images[item.image],/^data:image\/(png|jpeg|webp|gif);base64,/);
 }
 assert.ok(Object.keys(images).length>=387);
});
test('All bootstrap scripts exist and use paths compatible with a repository subdirectory',()=>{
 const html=readFileSync(path.join(root,'index.html'),'utf8');
 const sources=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(sources.includes('app.bundle.js'));
 for(const src of sources){assert.ok(!src.startsWith('/'));assert.ok(existsSync(path.join(root,src)),src);}
 assert.ok(!html.includes('type="module"'),'Local-file preview must not require ES-module imports');
});
test('Image packs remain under the GitHub browser per-file upload limit',()=>{
 for(const file of readdirSync(path.join(root,'assets/image-packs'))){
  assert.ok(readFileSync(path.join(root,'assets/image-packs',file)).length<25*1024*1024);
 }
});

test('Skeleton Fleet includes ship loot rather than only the seasonal bonus',()=>{
 const data=JSON.parse(readFileSync(path.join(root,'data/catalog.json')));
 const fleet=data.events.find(x=>x.id==='skeleton-fleet');
 assert.ok(new Set(fleet.drops.map(x=>x.itemId)).size>10);
});
