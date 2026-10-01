import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import { validateQuery, matchesComposition, toCsv } from '../src/lib/search';
import { searchMaterials } from '../src/server/materials';
import { ENDPOINTS } from '../src/server/providers';
import { searchPapers, validatePaperQuery } from '../src/server/literature';
nextEnv.loadEnvConfig(process.cwd());
const query=validateQuery({include:['Si','O'],exclude:['Li'],mode:'exact',sources:['cod','mcloud']});
const result=await searchMaterials(query);
let failures=0;
for(const status of result.sources) {
 console.log(status.name+': '+status.state+', '+status.loaded+' records, '+(status.total ?? 'unknown')+' source matches');
 const record=result.records.find(r=>r.source===status.id);
 if(!record) {failures++;continue;}
 assert(matchesComposition(record.elements,query));
 assert(toCsv([record]).includes(record.id));
 const url=record.source==='cod' ? ENDPOINTS.cod+'/'+encodeURIComponent(record.id) : record.sourceUrl;
 try {
   const response=await fetch(url,{signal:AbortSignal.timeout(18000)});
   assert(response.ok);const original=await response.json();
   assert.equal(original.data.id,record.id);
   assert.equal(original.data.attributes.chemical_formula_reduced,record.formula);
   console.log('  Original record agrees: '+record.id+', '+record.formula);
 }catch(e) {failures++;console.log('  Original record verification failed: '+(e instanceof Error?e.message:'unknown error'));}
 if(status.nextCursor) {
   const next=await searchMaterials({...query,sources:[record.source]},{[record.source]:status.nextCursor});
   assert(next.records.every(m=>matchesComposition(m.elements,query)));
   if(next.sources[0].state!=='ok') failures++;
   console.log('  Next page: '+next.sources[0].state+', '+next.records.length+' matching records');
 }
}
const material=result.records[0];
if(material) {
 const papers=await searchPapers(validatePaperQuery({formula:material.formula,elements:material.elements,keywords:'crystal'}));
 console.log('Literature: '+papers.papers.length+' candidates; '+papers.sources.map(s=>s.name+': '+s.state).join(', '));
 if(!papers.sources.some(s=>s.state==='ok' || s.state==='empty')) failures++;
 assert(result.records.length>0,'Literature must not affect material records.');
}
if(failures) process.exitCode=1;
