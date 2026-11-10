import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfileImport,emptyJournal,commendationProgress,cosmeticProgress,mergeImportedProgress} from '../journal-core.js';
const catalog={commendations:[{id:'1',name:'A Fine Deed',company:'Gold Hoarders'},{id:'2',name:'A Longer Voyage',company:'Gold Hoarders'}],cosmetics:[{id:'10',name:'Admiral Cheer',aliases:['admiral cheer'],category:'vanity'},{id:'11',name:'Admiral Clap',aliases:['admiral clap'],category:'vanity'}]};
const profile={gamertag:'FixturePirate',sections:{reputation:{GoldHoarders:{Emblems:{Emblems:[{DisplayName:'A Fine Deed',Completed:true,Grade:5,MaxGrade:5,Value:50,Threshold:50},{DisplayName:'A Longer Voyage',Completed:false,Grade:1,MaxGrade:5,Value:10,Threshold:10}]}}},chest:{chestData:{Emote:[{title:'Admiral Cheer'}]}}}};
test('Official profile shapes import completions and owned Chest entries independently',()=>{
 const {imported}=normalizeProfileImport(profile,catalog);const j=emptyJournal();j.imported=imported;
 assert.equal(commendationProgress(catalog.commendations[0],j).status,'completed');
 assert.equal(commendationProgress(catalog.commendations[1],j).status,'incomplete');
 assert.equal(cosmeticProgress(catalog.cosmetics[0],j).status,'owned');
 assert.equal(cosmeticProgress(catalog.cosmetics[1],j).status,'not-owned');
});
test('Reaching the current grade threshold is not final completion',()=>{
 const {imported}=normalizeProfileImport(profile,catalog);assert.equal(imported.commendations['2'].completed,false);
});
test('Partial or unmatched inventory never marks absent cosmetics as unowned',()=>{
 const p=structuredClone(profile);p.sections.chest.chestData.Emote.push({title:'A new unmapped emote'});
 const {imported,report}=normalizeProfileImport(p,catalog);const j=emptyJournal();j.imported=imported;
 assert.equal(imported.inventoryComplete,false);assert.equal(cosmeticProgress(catalog.cosmetics[1],j).status,'unknown');assert.equal(report.unmatchedCosmetics,1);
});
test('Slug aliases match exact original titles when listing names are generic',()=>{
 const c={...catalog,cosmetics:[{id:'10',name:'Admiral Emote',aliases:['admiral cheer']},{id:'11',name:'Admiral Emote',aliases:['admiral clap']}]};
 const {imported}=normalizeProfileImport(profile,c);assert.ok(imported.cosmetics['10']);assert.ok(!imported.cosmetics['11']);
});
test('An ambiguous duplicate display name is not applied to every cosmetic',()=>{
 const p=structuredClone(profile);p.sections.chest.chestData.Emote=[{title:'Admiral Emote'}];
 const c={...catalog,cosmetics:[{id:'10',name:'Admiral Emote'},{id:'11',name:'Admiral Emote'}]};
 const {imported,report}=normalizeProfileImport(p,c);assert.equal(Object.keys(imported.cosmetics).length,0);assert.equal(report.unmatchedCosmetics,1);
});
test('Manual notes override snapshots and can be reset without changing imported evidence',()=>{
 const j=emptyJournal();j.imported=normalizeProfileImport(profile,catalog).imported;j.manual.commendations['1']={completed:false};j.manual.cosmetics['10']=false;
 assert.equal(commendationProgress(catalog.commendations[0],j).source,'manual');assert.equal(cosmeticProgress(catalog.cosmetics[0],j).status,'not-owned');
 delete j.manual.commendations['1'];assert.equal(commendationProgress(catalog.commendations[0],j).status,'completed');
});
test('Credential-bearing imports are rejected, and malformed exports are not accepted',()=>{
 assert.throws(()=>normalizeProfileImport({...profile,accessToken:'not-a-real-token'},catalog),/credential/i);
 assert.throws(()=>normalizeProfileImport({gold:10},catalog),/No reputation/);
});
test('Empty local journal backups restore without requiring an official snapshot',()=>{
 const original=emptyJournal();original.manual.goals=['cosmetic:10'];const {journal}=normalizeProfileImport(original,catalog);assert.deepEqual(journal.manual.goals,['cosmetic:10']);assert.equal(journal.imported,null);
});
test('A failed section preserves its older snapshot and original date',()=>{
 const before=normalizeProfileImport(profile,catalog).imported;
 const p=structuredClone(profile);delete p.sections.chest;
 const next=normalizeProfileImport(p,catalog).imported;const merged=mergeImportedProgress(before,next);
 assert.ok(merged.cosmetics['10']);assert.equal(merged.sectionDates.chest,before.sectionDates.chest);
 const different={...next,identity:{gamertag:'OtherPirate'}};assert.equal(mergeImportedProgress(before,different).cosmetics['10'],undefined);
});
