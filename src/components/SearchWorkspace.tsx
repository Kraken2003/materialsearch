'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ELEMENT_MAP } from '@/lib/elements';
import { queryFromUrl, queryToUrl, toCsv, validateQuery } from '@/lib/search';
import type { CompositionQuery, Material, MaterialSource, MaterialsResponse, ProviderInfo, SourceStatus } from '@/lib/types';
import PeriodicTable from './PeriodicTable';
import Formula from './Formula';
import MaterialDetails from './MaterialDetails';
const FALLBACK: ProviderInfo[] = [
 {id:'cod',name:'Crystallography Open Database',description:'Experimental structures',enabled:true,homepage:'https://www.crystallography.net/cod/',license:'CC0 1.0',attribution:'COD and original structural-data authors.',termsUrl:'https://www.crystallography.net/cod/'},
 {id:'mcloud',name:'Materials Cloud',description:'MC3D PBE-v1 computed structures',enabled:true,homepage:'https://www.materialscloud.org/discover/mc3d',license:'CC BY 4.0',attribution:'Huber et al., MC3D, doi:10.24435/materialscloud:jn-ac.',termsUrl:'https://archive.materialscloud.org/records/szjaf-cfv74'},
 {id:'mp',name:'Materials Project',description:'Computed materials & properties',enabled:false,reason:'Checking availability…',homepage:'https://materialsproject.org',license:'Source terms',attribution:'Materials Project',termsUrl:'https://next-gen.materialsproject.org/terms'},
];
export default function SearchWorkspace({contactEmail}:{contactEmail?:string}) {
 const [include,setInclude]=useState<string[]>([]);const [exclude,setExclude]=useState<string[]>([]);
 const [mode,setMode]=useState<'contains'|'exact'>('contains');const [selection,setSelection]=useState<'include'|'exclude'>('include');
 const [providerInfo,setProviderInfo]=useState(FALLBACK);
 const availableProviders=useRef(FALLBACK);
 const sources=providerInfo.filter(p=>p.enabled).map(p=>p.id);
 const [ready,setReady]=useState(false);const [providerNotice,setProviderNotice]=useState('');
 const [checkingProviders,setCheckingProviders]=useState(true);
 const [records,setRecords]=useState<Material[]>([]);const [statuses,setStatuses]=useState<SourceStatus[]>([]);
 const [pending,setPending]=useState<string[]>([]);const [activeQuery,setActiveQuery]=useState<CompositionQuery|null>(null);
 const [formError,setFormError]=useState('');const [notice,setNotice]=useState('');const [selected,setSelected]=useState<Material|null>(null);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
 const resultsSection=useRef<HTMLElement>(null);const scrolledGeneration=useRef(-1);
 useEffect(()=>{
   if(!activeQuery || scrolledGeneration.current===generation.current) return;
   const hasResults=records.length>0;
   const completedWithoutMatches=!pending.length && statuses.some(s=>s.state==='ok' || s.state==='empty');
   if(!hasResults && !completedWithoutMatches) return;
   if(!resultsSection.current) return;
   scrolledGeneration.current=generation.current;
   resultsSection.current.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 },[activeQuery,records.length,pending.length,statuses]);
 const load = useCallback(async(q:CompositionQuery,cursors:Partial<Record<MaterialSource,string>>={},append=false)=>{
   if(!append) {
     controller.current?.abort();controller.current=new AbortController();generation.current++;
     setRecords([]);setStatuses([]);setActiveQuery(q);setSelected(null);setNotice('');
     setPending([]);
   }
   const run=generation.current;const signal=controller.current?.signal;
   setPending(ids=>[...new Set([...ids,...q.sources])]);
   await Promise.all(q.sources.map(async(source)=>{
     try {
       const r=await fetch('/api/materials/search',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({...q,sources:[source],cursors:cursors[source]?{[source]:cursors[source]}:{}})});
       const data=await r.json();if(!r.ok) throw Object.assign(new Error(data.error || 'Database search failed.'),{status:r.status});
       if(run!==generation.current || signal?.aborted) return;
       const response=data as MaterialsResponse;
       setRecords(existing=>{
         const combined=[...existing,...response.records];const seen=new Set<string>();
         return combined.filter(m=>{const id=m.source+':'+m.id;if(seen.has(id))return false;seen.add(id);return true;});
       });
       setStatuses(existing=>{
         const update=response.sources[0];const previous=existing.find(s=>s.id===source);
         const next={...update,loaded:(previous?.loaded || 0)+update.loaded,nextCursor:update.nextCursor || ((update.state==='unavailable' || update.state==='quota-limited')?cursors[source]:undefined)};
         return [...existing.filter(s=>s.id!==source),next];
       });
     } catch(e) {
       if(run!==generation.current || signal?.aborted) return;
       const error=e as Error & {status?:number};
       setStatuses(existing=>[...existing.filter(s=>s.id!==source),{id:source,name:FALLBACK.find(p=>p.id===source)!.name,state:error.status===429?'quota-limited':'unavailable',loaded:existing.find(s=>s.id===source)?.loaded || 0,message:error.message || 'Database search unavailable.',nextCursor:cursors[source]}]);
     } finally {if(run===generation.current) setPending(ids=>ids.filter(id=>id!==source));}
   }));
 },[]);
 useEffect(()=>{
   const c=new AbortController();
   const restore=()=>{
     if(!new URLSearchParams(window.location.search).has('include')) {
       controller.current?.abort();generation.current++;
       setInclude([]);setExclude([]);setMode('contains');setRecords([]);setStatuses([]);setPending([]);setActiveQuery(null);setSelected(null);
       return;
     }
     try {const restored=queryFromUrl(window.location.search);const q=validateQuery({...restored,sources:availableProviders.current.filter(p=>p.enabled).map(p=>p.id)});setInclude(q.include);setExclude(q.exclude);setMode(q.mode);setFormError('');void load(q);}catch(e){setFormError(e instanceof Error?e.message:'Invalid search URL.');}
   };
   fetch('/api/providers',{signal:c.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
     if(c.signal.aborted) return;
     availableProviders.current=data.providers;setProviderInfo(data.providers);setReady(data.searchReady);
   }).catch(()=>{
     if(!c.signal.aborted) {setReady(true);setProviderNotice('Database availability could not be checked. Search will try the public databases.');}
   }).finally(()=>{if(!c.signal.aborted) {setCheckingProviders(false);restore();}});
   window.addEventListener('popstate',restore);
   return ()=>{c.abort();controller.current?.abort();window.removeEventListener('popstate',restore);};
 },[load]);
 function toggle(symbol:string) {
   setFormError('');
   if(selection==='include') {setInclude(items=>items.includes(symbol)?items.filter(s=>s!==symbol):[...items,symbol]);setExclude(items=>items.filter(s=>s!==symbol));}
   else {setExclude(items=>items.includes(symbol)?items.filter(s=>s!==symbol):[...items,symbol]);setInclude(items=>items.filter(s=>s!==symbol));}
 }
 function submit(event:React.FormEvent) {
   event.preventDefault();
   if(!sources.length) {setFormError('No databases are available. Try again later.');return;}
   try {const q=validateQuery({include,exclude,mode,sources});setFormError('');history.pushState(null,'',queryToUrl(q));void load(q);}
   catch(e) {setFormError(e instanceof Error?e.message:'Check your element selection.');}
 }
 function reset() {
   controller.current?.abort();generation.current++;setInclude([]);setExclude([]);setMode('contains');setSelection('include');
   setRecords([]);setStatuses([]);setPending([]);setActiveQuery(null);setFormError('');setNotice('');setSelected(null);history.pushState(null,'','/');
 }
 function exportCsv() {
   const url=URL.createObjectURL(new Blob([toCsv(records)],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='material-atlas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function share() {
   if(!activeQuery) return;
   const url=window.location.origin+window.location.pathname+queryToUrl(activeQuery);
   try {await navigator.clipboard.writeText(url);setNotice('Search link copied.');}catch{setNotice('Copy the search URL from your browser’s address bar.');}
 }
 const groups=new Map<string,Material[]>();for(const m of records){groups.set(m.formula,[...(groups.get(m.formula)||[]),m]);}
 const completed=statuses.filter(s=>s.state==='ok' || s.state==='empty').length;
 return <>
   <a className="skip-link" href="#search">Skip to material search</a>
   <header className="site-header">
     <a className="brand" href="/" aria-label="Material Atlas home"><img className="brand-mark" src="/brand-mark.svg" width="36" height="36" alt=""/><span>Material<span className="brand-light">Atlas</span></span></a>
     <nav aria-label="Main navigation"><a className="nav-active" href="#search">Explore materials</a></nav>
   </header>
   <main>
     <section className="intro" id="search" tabIndex={-1}><div><h1>Start with the elements.</h1><p>Select elements to search material databases.<br className="mobile-break"/> Open a result to view its properties and look for related papers.</p></div></section>
     <form className="search-workspace" onSubmit={submit}>
       <div className="example-bar" role="group" aria-label="Example compositions"><span>Try a composition</span><button type="button" aria-pressed={mode==='exact' && !exclude.length && include.length===2 && ['Fe','O'].every(s=>include.includes(s))} onClick={()=>{setInclude(['Fe','O']);setExclude([]);setMode('exact');setSelection('include');setFormError('');}}>Iron oxides <span>Fe + O</span></button><button type="button" aria-pressed={mode==='exact' && !exclude.length && include.length===4 && ['Li','Fe','P','O'].every(s=>include.includes(s))} onClick={()=>{setInclude(['Li','Fe','P','O']);setExclude([]);setMode('exact');setSelection('include');setFormError('');}}>Battery materials <span>Li + Fe + P + O</span></button><button type="button" aria-pressed={mode==='exact' && !exclude.length && include.length===2 && ['Si','O'].every(s=>include.includes(s))} onClick={()=>{setInclude(['Si','O']);setExclude([]);setMode('exact');setSelection('include');setFormError('');}}>Silicon oxides <span>Si + O</span></button></div>
       <div className="workspace-toolbar"><div className="selection-toggle" role="group" aria-label="Element selection action"><button type="button" aria-pressed={selection==='include'} className={selection==='include'?'active':''} onClick={()=>setSelection('include')}><span aria-hidden="true">＋</span> Include elements</button><button type="button" aria-pressed={selection==='exclude'} className={selection==='exclude'?'active exclude-active':''} onClick={()=>setSelection('exclude')}><span aria-hidden="true">−</span> Exclude elements</button></div><button type="button" className="text-button reset-button" onClick={reset}>Reset selection <span aria-hidden="true">↺</span></button></div>
       <PeriodicTable include={include} exclude={exclude} selection={selection} onToggle={toggle}/>
       <div className="table-legend"><span><i className="legend-dot nonmetal"/>Nonmetals</span><span><i className="legend-dot transition"/>Transition metals</span><span><i className="legend-dot alkali"/>Alkali metals</span><span><i className="legend-dot alkaline"/>Alkaline earth</span><span><i className="legend-dot metalloid"/>Metalloids</span><span><i className="legend-dot postmetal"/>Other metals</span><span><i className="legend-dot halogen"/>Halogens</span><span><i className="legend-dot noble"/>Noble gases</span><span><i className="legend-dot lanthanide"/>Lanthanides</span><span><i className="legend-dot actinide"/>Actinides</span></div>
       <div className="query-builder">
         <div className="composition-selection"><span className="field-label" id="composition-label">Selected composition</span><div className="selection-chips" role="group" aria-labelledby="composition-label" aria-live="polite">{!include.length && <span className="selection-placeholder">Select elements above or try a composition</span>}{[...include].sort((a,b)=>ELEMENT_MAP.get(a)!.number-ELEMENT_MAP.get(b)!.number).map(s=><button className="element-chip" type="button" key={s} aria-label={'Remove '+ELEMENT_MAP.get(s)!.name} onClick={()=>setInclude(items=>items.filter(e=>e!==s))}>{s}<span aria-hidden="true">×</span></button>)}{exclude.map(s=><button className="element-chip excluded-chip" type="button" key={s} aria-label={'Remove exclusion of '+ELEMENT_MAP.get(s)!.name} onClick={()=>setExclude(items=>items.filter(e=>e!==s))}>Exclude {s}<span aria-hidden="true">×</span></button>)}</div></div>
         <fieldset className="match-mode"><legend>Match mode</legend><label><input type="radio" name="mode" checked={mode==='contains'} onChange={()=>setMode('contains')}/>Contains all selected elements</label><label><input type="radio" name="mode" checked={mode==='exact'} onChange={()=>setMode('exact')}/>Only these elements</label></fieldset>
         <button className="search-button" type="submit" disabled={checkingProviders || !ready || !!pending.length}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>{checkingProviders?'Checking databases…':pending.length?'Searching…':'Search materials'}</button>
       </div>
       {!checkingProviders && !ready && <div className="error-notice" role="alert">Search is not available yet. The site owner needs to finish setting it up.</div>}
       {providerNotice && <p className="error-notice">{providerNotice}</p>}
       {formError && <p className="error-notice" role="alert">{formError}</p>}
     </form>
     {activeQuery && <section ref={resultsSection} className="results" aria-labelledby="results-heading">
       <div className="results-header"><div><h2 id="results-heading">Materials <span className="result-count">{records.length}</span></h2><p>Results for {activeQuery.include.join(' + ')}{activeQuery.exclude.length?' · excluding '+activeQuery.exclude.join(', '):''} · {activeQuery.mode==='exact'?'Only these elements':'Additional elements allowed'}</p></div><div className="result-actions"><button className="secondary-button" onClick={()=>void share()}>Copy search link</button><button className="secondary-button" onClick={exportCsv} disabled={!records.length}>Export CSV <span aria-hidden="true">↓</span></button></div></div>
       {notice && <p role="status" className="success-notice">{notice}</p>}
       <div className="source-statuses">{activeQuery.sources.map(id=>{
         const s=statuses.find(s=>s.id===id);const busy=pending.includes(id);
         return <div key={id} className={'source-status '+(s?.state || '')}><span className={busy?'spinner':'status-dot'}/><strong>{FALLBACK.find(p=>p.id===id)!.name}</strong><span>{busy?'Searching…':s?.state==='ok'?s.loaded+' loaded'+(s.total != null?' / '+s.total+' source matches':''):s?.state==='empty'?'No matches':s?.state==='disabled'?'Not configured':s?.state==='quota-limited'?'Allowance reached':'Unavailable'}</span>{!busy && s?.message && <p>{s.message}</p>}{!busy && (s?.state==='unavailable' || s?.state==='quota-limited') && <button className="text-button" onClick={()=>void load({...activeQuery,sources:[id]},s.nextCursor?{[id]:s.nextCursor}:{},true)}>Retry source</button>}</div>;
       })}</div>
       <p className="result-explainer">Materials with the same formula can have different crystal structures. Each database record is listed separately.</p>
       <div aria-live="polite" className="sr-only">{records.length} material records loaded. {pending.length?'Some sources are still searching.':'Search complete.'}</div>
       {[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([formula,materials])=><section className="formula-group" key={formula}>
         <div className="formula-heading"><h3><Formula value={formula}/></h3><span>{materials.length} {materials.length===1?'record':'records'}</span></div>
         <div className="record-list">{materials.map(m=><article key={m.source+':'+m.id} className="material-record" data-testid="material-record">
           <div className="record-source"><span className={'database-icon '+m.source} aria-hidden="true">{m.source==='cod'?'C':m.source==='mcloud'?'M':'P'}</span><div><strong>{m.sourceName}</strong><span>{m.datasetId || m.id}</span></div></div>
           <div className="record-property"><span>Space group</span><strong>{m.properties.spaceGroup || 'Unavailable'}</strong></div>
           <div className="record-property"><span>Cell volume</span><strong>{m.properties.volume != null?m.properties.volume.toFixed(2)+' Å³':'Unavailable'}</strong></div>
           <div className="record-evidence">{m.references.filter(r=>r.kind==='record').length ? <span className="reference-badge">Source reference available</span>:<span className="no-reference-badge">No references supplied</span>}</div>
           <button className="explore-button" onClick={()=>setSelected(m)} aria-label={'Explore '+m.id}>Explore <span aria-hidden="true">↗</span></button>
         </article>)}</div>
       </section>)}
       {!records.length && !pending.length && <div className="empty-results"><strong>{completed?'No matching materials returned.':'The selected databases could not return results.'}</strong><p>{completed?'Try allowing additional elements or searching another database. Check the status of each database above for search failures.':'Check the database messages above and retry any failed searches.'}</p></div>}
       <div className="pagination">{statuses.filter(s=>s.nextCursor).map(s=><button className="secondary-button" key={s.id} disabled={pending.includes(s.id)} onClick={()=>void load({...activeQuery,sources:[s.id as MaterialSource]},{[s.id]:s.nextCursor!},true)}>{pending.includes(s.id)?'Loading…':'Load more from '+s.name}</button>)}</div>
       {records.length>0 && <p className="fine-print">CSV exports include only loaded records. Database totals may include records skipped because their element data is incomplete.</p>}
     </section>}
   </main>
   <footer className="site-footer"><div className="footer-credit"><a className="footer-brand" href="/" aria-label="Material Atlas home"><img className="brand-mark" src="/brand-mark.svg" width="28" height="28" alt=""/><span>MaterialAtlas</span></a><p>Powered by <strong>Prithvi Singh Chohan</strong></p></div><p className="footer-note">A starting point for research. Always verify the original sources.</p><nav aria-label="Footer navigation"><a href="https://github.com/Kraken2003" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>{contactEmail && <a href={'mailto:'+contactEmail}>Contact me</a>}</nav></footer>
   {selected && <MaterialDetails key={selected.source+selected.id} material={selected} onClose={()=>setSelected(null)}/>}
 </>;
}
