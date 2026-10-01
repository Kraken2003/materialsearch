import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const providers = [
 {id:'cod',name:'Crystallography Open Database',enabled:true,description:'Experimental crystal structures',license:'CC0',homepage:'https://www.crystallography.net/cod/',termsUrl:'https://www.crystallography.net/cod/'},
 {id:'mcloud',name:'Materials Cloud',enabled:true,description:'Calculated structures',license:'CC BY 4.0',homepage:'https://materialscloud.org',termsUrl:'https://materialscloud.org'},
 {id:'mp',name:'Materials Project',enabled:false,reason:'API key not configured.',description:'Computed properties',license:'Source terms',homepage:'https://materialsproject.org',termsUrl:'https://materialsproject.org'},
];
const material = {id:'test-no-paper',source:'cod',sourceName:'Crystallography Open Database',formula:'Fe2O3',elements:['Fe','O'],sourceUrl:'https://www.crystallography.net/cod/9015965.html',references:[],properties:{spaceGroup:'R -3 c'},license:'CC0',retrievedAt:'2026-10-01'};
test.beforeEach(async({page})=>{
 // These interaction tests must not wait on a third-party font service.
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.route('https://fonts.gstatic.com/**',route=>route.abort());
 await page.route('**/api/providers',route=>route.fulfill({json:{providers,searchReady:true}}));
 await page.route('**/api/materials/search',route=>{
   const q = route.request().postDataJSON();
   return route.fulfill({json:{query:q,records:q.sources.includes('cod') ? [material,{...material,id:'second-structure'}] : [],sources:[{id:q.sources[0],name:providers.find(p=>p.id===q.sources[0])!.name,state:q.sources[0]==='cod' ? 'ok':'empty',loaded:q.sources[0]==='cod' ? 2:0}]}});
 });
});
test('automatically searches every enabled database without a source chooser',async({page})=>{
 await page.route('**/api/providers',route=>route.fulfill({json:{providers:providers.map(p=>({...p,enabled:true})),searchReady:true}}));
 const searched:string[]=[];
 page.on('request',request=>{if(request.url().includes('/api/materials/search')) searched.push(...request.postDataJSON().sources);});
 await page.goto('/');
 await expect(page.getByRole('group',{name:'Search databases'})).toHaveCount(0);
 await expect(page.getByRole('checkbox')).toHaveCount(0);
 await page.getByRole('button',{name:/^Iron oxides/}).click();
 await page.getByRole('button',{name:'Search materials',exact:true}).click();
 await expect.poll(()=>[...searched].sort()).toEqual(['cod','mcloud','mp']);
});
test('selects elements, preserves records without papers, and exports both structures',async({page})=>{
 await page.route('**/api/papers/search',route=>route.fulfill({json:{papers:[],sources:[{id:'crossref',name:'Crossref',state:'empty',loaded:0}],query:'Fe2O3 iron oxygen'}}));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Start with the elements.'})).toBeVisible();
 await page.getByRole('button',{name:/^Iron \(Fe\)/}).click();
 await page.getByRole('button',{name:/^Oxygen \(O\)/}).click();
 await page.getByRole('button',{name:'Search materials',exact:true}).click();
 await expect(page.getByTestId('material-record')).toHaveCount(2);
 await expect(page.locator('#results-heading')).toBeInViewport();
 await page.getByRole('button',{name:'Explore test-no-paper'}).click();
 await expect(page.getByText('No related papers found in the searched sources.')).toBeVisible();
 await expect(page.getByRole('link',{name:'Open original record'})).toBeVisible();
 await page.getByRole('button',{name:'Close material details'}).click();
 const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Export CSV'}).click();
 const file=await download;
 expect(file.suggestedFilename()).toBe('material-atlas.csv');
 const csv=await readFile((await file.path())!,'utf8');
 expect(csv).toContain('test-no-paper');expect(csv).toContain('second-structure');
 await expect(page).toHaveURL(/include=O%2CFe/);
 await expect(page.getByTestId('material-record')).toHaveCount(2);
});
test('literature errors never remove database materials',async({page})=>{
 await page.route('**/api/papers/search',route=>route.fulfill({status:429,json:{error:'Literature allowance reached.'}}));
 await page.goto('/?include=Fe,O&mode=exact&sources=cod');
 await expect(page.getByTestId('material-record')).toHaveCount(2);
 await page.getByRole('button',{name:'Explore test-no-paper'}).click();
 await expect(page.getByText('Literature allowance reached.')).toBeVisible();
 await page.getByRole('button',{name:'Close material details'}).click();
 await expect(page.getByTestId('material-record')).toHaveCount(2);
});
test('supports keyboard selection and arrow navigation',async({page})=>{
 await page.goto('/');
 const hydrogen=page.getByRole('button',{name:/^Hydrogen \(H\)/});
 await hydrogen.focus(); await page.keyboard.press('Enter');
 await expect(hydrogen).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('button',{name:/^Helium \(He\)/})).toBeFocused();
});
test('fits a mobile screen while the periodic table scrolls internally',async({page})=>{
 await page.goto('/');
 const width = await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 expect(width.content).toBeLessThanOrEqual(width.viewport);
 await expect(page.getByRole('button',{name:'Search materials',exact:true})).toBeVisible();
});
test('keeps partial database results and restores the empty state with browser back',async({page})=>{
 await page.route('**/api/materials/search',route=>{
   const q=route.request().postDataJSON();const source=q.sources[0];
   return route.fulfill({json:{query:q,records:source==='cod'?[material]:[],sources:[{id:source,name:source,state:source==='cod'?'ok':'unavailable',loaded:source==='cod'?1:0,message:source==='mcloud'?'Materials Cloud temporarily unavailable.':undefined}]}});
 });
 await page.goto('/');
 await page.getByRole('button',{name:/^Iron \(Fe\)/}).click();
 await page.getByRole('button',{name:/^Oxygen \(O\)/}).click();
 await page.getByRole('button',{name:'Search materials',exact:true}).click();
 await expect(page.getByTestId('material-record')).toHaveCount(1);
 await expect(page.getByText('Materials Cloud temporarily unavailable.')).toBeVisible();
 await page.goBack();
 await expect(page.getByTestId('material-record')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Iron \(Fe\)/})).toHaveAttribute('aria-pressed','false');
});
test('moves an element between include and exclude and submits exact composition',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/^Iron \(Fe\)/}).click();
 await page.getByRole('button',{name:/^Oxygen \(O\)/}).click();
 await page.getByRole('button',{name:'Exclude elements',exact:true}).click();
 await page.getByRole('button',{name:/^Lead \(Pb\)/}).click();
 await page.getByRole('radio',{name:'Only these elements',exact:true}).check();
 const request=page.waitForRequest(r=>r.url().includes('/api/materials/search'));
 await page.getByRole('button',{name:'Search materials',exact:true}).click();
 const body=(await request).postDataJSON();
 expect(body.include).toEqual(['O','Fe']);expect(body.exclude).toEqual(['Pb']);expect(body.mode).toBe('exact');
});
test('reference titles without a DOI are clickable and clearly labeled as searches',async({page})=>{
 await page.route('**/api/materials/search',route=>{
   const q=route.request().postDataJSON();
   return route.fulfill({json:{query:q,records:[{...material,references:[{title:'A new metal-spinel composite',authors:'A. Scientist',year:1993,kind:'record'},{title:'A paper with a DOI',doi:'10.123/direct',kind:'record'}]}],sources:[{id:'cod',name:'COD',state:'ok',loaded:1}]}});
 });
 await page.route('**/api/papers/search',route=>route.fulfill({json:{papers:[],sources:[{id:'crossref',name:'Crossref',state:'empty',loaded:0}],query:'Fe2O3'}}));
 await page.goto('/?include=Fe,O&mode=exact&sources=cod');
 await page.getByRole('button',{name:'Explore test-no-paper'}).click();
 const fallback=page.getByRole('link',{name:'A new metal-spinel composite'});
 await expect(fallback).toBeVisible();
 expect(new URL((await fallback.getAttribute('href'))!).searchParams.get('q')).toBe('"A new metal-spinel composite"');
 await expect(page.getByText('Search by title on Google Scholar · no DOI or direct URL supplied')).toBeVisible();
 await expect(page.getByRole('link',{name:'A paper with a DOI'})).toHaveAttribute('href','https://doi.org/10.123/direct');
});
