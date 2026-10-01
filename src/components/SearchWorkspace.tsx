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
export default function SearchWorkspace() {
 const [include,setInclude]=useState<string[]>([]);const [exclude,setExclude]=useState<string[]>([]);
 const [mode,setMode]=useState<'contains'|'exact'>('contains');const [selection,setSelection]=useState<'include'|'exclude'>('include');
 const [sources,setSources]=useState<MaterialSource[]>(['cod','mcloud']);const [providerInfo,setProviderInfo]=useState(FALLBACK);
 const [ready,setReady]=useState(true);const [providerNotice,setProviderNotice]=useState('');
 const [records,setRecords]=useState<Material[]>([]);const [statuses,setStatuses]=useState<SourceStatus[]>([]);
 const [pending,setPending]=useState<string[]>([]);const [activeQuery,setActiveQuery]=useState<CompositionQuery|null>(null);
 const [formError,setFormError]=useState('');const [notice,setNotice]=useState('');const [selected,setSelected]=useState<Material|null>(null);
 const generation=useRef(0);const controller=useRef<AbortController|null>(null);
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
   fetch('/api/providers',{signal:c.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{setProviderInfo(data.providers);setReady(data.searchReady);}).catch(()=>{if(!c.signal.aborted)setProviderNotice('Source availability could not be checked. You can still try the public databases.');});
   const restore=()=>{
     if(!new URLSearchParams(window.location.search).has('include')) {
       controller.current?.abort();generation.current++;
       setInclude([]);setExclude([]);setMode('contains');setSources(['cod','mcloud']);setRecords([]);setStatuses([]);setPending([]);setActiveQuery(null);setSelected(null);
       return;
     }
     try {const q=queryFromUrl(window.location.search);setInclude(q.include);setExclude(q.exclude);setMode(q.mode);setSources(q.sources);setFormError('');void load(q);}catch(e){setFormError(e instanceof Error?e.message:'Invalid search URL.');}
   };
   restore();window.addEventListener('popstate',restore);
   return ()=>{c.abort();controller.current?.abort();window.removeEventListener('popstate',restore);};
 },[load]);
 function toggle(symbol:string) {
   setFormError('');
   if(selection==='include') {setInclude(items=>items.includes(symbol)?items.filter(s=>s!==symbol):[...items,symbol]);setExclude(items=>items.filter(s=>s!==symbol));}
   else {setExclude(items=>items.includes(symbol)?items.filter(s=>s!==symbol):[...items,symbol]);setInclude(items=>items.filter(s=>s!==symbol));}
 }
 function submit(event:React.FormEvent) {
   event.preventDefault();
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
   <header className="site-header">
     <a className="brand" href="/" aria-label="Material Atlas home"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M8 9L27 12L19 29Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="9" r="4"/><circle cx="27" cy="12" r="4"/><circle cx="19" cy="29" r="4"/></svg><span>Material<span className="brand-light">Atlas</span></span></a>
     <nav aria-label="Main navigation"><a className="nav-active" href="#search">Explore materials</a><a href="#sources">Data sources <span aria-hidden="true">↗</span></a></nav>
     <span className="header-note"><span className="live-dot"/>Open data. Connected.</span>
   </header>
   <main>
     <section className="intro" id="search"><div><h1>Start with the elements.</h1><p>Find materials across open databases.<br className="mobile-break"/> Follow the evidence into the literature.</p></div><div className="intro-side"><span className="intro-orbit" aria-hidden="true">⊕</span><p>Built for the<br/><strong>curious researcher.</strong></p></div></section>
     <form className="search-workspace" onSubmit={submit}>
       <div className="workspace-toolbar"><div className="selection-toggle" role="group" aria-label="Element selection action"><button type="button" aria-pressed={selection==='include'} className={selection==='include'?'active':''} onClick={()=>setSelection('include')}><span aria-hidden="true">＋</span> Include elements</button><button type="button" aria-pressed={selection==='exclude'} className={selection==='exclude'?'active exclude-active':''} onClick={()=>setSelection('exclude')}><span aria-hidden="true">−</span> Exclude elements</button></div><button type="button" className="text-button reset-button" onClick={reset}>Reset selection <span aria-hidden="true">↺</span></button></div>
       <PeriodicTable include={include} exclude={exclude} selection={selection} onToggle={toggle}/>
       <div className="table-legend"><span><i className="legend-dot nonmetal"/>Nonmetals</span><span><i className="legend-dot transition"/>Transition metals</span><span><i className="legend-dot alkali"/>Alkali metals</span><span><i className="legend-dot alkaline"/>Alkaline earth</span><span><i className="legend-dot metalloid"/>Metalloids</span><span><i className="legend-dot postmetal"/>Other metals</span><span><i className="legend-dot halogen"/>Halogens</span><span><i className="legend-dot noble"/>Noble gases</span><span><i className="legend-dot lanthanide"/>Lanthanides</span><span><i className="legend-dot actinide"/>Actinides</span></div>
       <div className="query-builder">
         <div className="composition-selection"><label>Selected composition</label><div className="selection-chips">{!include.length && <span className="selection-placeholder">Select elements from the table above</span>}{[...include].sort((a,b)=>ELEMENT_MAP.get(a)!.number-ELEMENT_MAP.get(b)!.number).map(s=><button className="element-chip" type="button" key={s} title={'Remove '+ELEMENT_MAP.get(s)!.name} onClick={()=>setInclude(items=>items.filter(e=>e!==s))}>{s}<span aria-hidden="true">×</span></button>)}{exclude.map(s=><button className="element-chip excluded-chip" type="button" key={s} title={'Remove exclusion of '+ELEMENT_MAP.get(s)!.name} onClick={()=>setExclude(items=>items.filter(e=>e!==s))}>Exclude {s}<span aria-hidden="true">×</span></button>)}</div></div>
         <fieldset className="match-mode"><legend>Match mode</legend><label><input type="radio" name="mode" checked={mode==='contains'} onChange={()=>setMode('contains')}/>Contains all selected elements</label><label><input type="radio" name="mode" checked={mode==='exact'} onChange={()=>setMode('exact')}/>Only these elements</label></fieldset>
         <button className="search-button" type="submit" disabled={!ready || !!pending.length}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>{pending.length?'Searching…':'Search materials'}</button>
       </div>
       <fieldset className="source-picker"><legend>Search databases</legend>{providerInfo.map(p=><label key={p.id} className={!p.enabled?'source-disabled':''} title={p.reason}><input type="checkbox" checked={sources.includes(p.id)} disabled={!p.enabled} onChange={()=>setSources(items=>items.includes(p.id)?items.filter(s=>s!==p.id):[...items,p.id])}/><span>{p.name}{!p.enabled && <small>{p.reason || 'Not configured'}</small>}</span></label>)}</fieldset>
       <div className="search-footnote"><span aria-hidden="true">ⓘ</span><p>Materials are shown whether or not related papers are found. Each database record keeps its original source.</p></div>
       {!ready && <div className="error-notice" role="alert">Public search is not configured yet. The site owner needs to enable shared quota storage and cursor signing.</div>}
       {providerNotice && <p className="error-notice">{providerNotice}</p>}
       {formError && <p className="error-notice" role="alert">{formError}</p>}
     </form>
     {!activeQuery && <div className="example-bar"><span>Try a composition</span><button onClick={()=>{setInclude(['Fe','O']);setExclude([]);setMode('exact');}}>Iron oxides <span>Fe + O</span></button><button onClick={()=>{setInclude(['Li','Fe','P','O']);setExclude([]);setMode('exact');}}>Battery materials <span>Li + Fe + P + O</span></button><button onClick={()=>{setInclude(['Si','O']);setExclude([]);setMode('exact');}}>Silicon oxides <span>Si + O</span></button></div>}
     {activeQuery && <section className="results" aria-labelledby="results-heading">
       <div className="results-header"><div><h2 id="results-heading">Materials <span className="result-count">{records.length}</span></h2><p>Results for {activeQuery.include.join(' + ')}{activeQuery.exclude.length?' · excluding '+activeQuery.exclude.join(', '):''} · {activeQuery.mode==='exact'?'Only these elements':'Additional elements allowed'}</p></div><div className="result-actions"><button className="secondary-button" onClick={()=>void share()}>Copy search link</button><button className="secondary-button" onClick={exportCsv} disabled={!records.length}>Export CSV <span aria-hidden="true">↓</span></button></div></div>
       {notice && <p role="status" className="success-notice">{notice}</p>}
       <div className="source-statuses">{activeQuery.sources.map(id=>{
         const s=statuses.find(s=>s.id===id);const busy=pending.includes(id);
         return <div key={id} className={'source-status '+(s?.state || '')}><span className={busy?'spinner':'status-dot'}/><strong>{FALLBACK.find(p=>p.id===id)!.name}</strong><span>{busy?'Searching…':s?.state==='ok'?s.loaded+' loaded'+(s.total != null?' / '+s.total+' source matches':''):s?.state==='empty'?'No matches':s?.state==='disabled'?'Not configured':s?.state==='quota-limited'?'Allowance reached':'Unavailable'}</span>{s?.message && <p>{s.message}</p>}{!busy && (s?.state==='unavailable' || s?.state==='quota-limited') && <button className="text-button" onClick={()=>void load({...activeQuery,sources:[id]},s.nextCursor?{[id]:s.nextCursor}:{},true)}>Retry source</button>}</div>;
       })}</div>
       <p className="result-explainer">Same formula can describe different structures. Records stay separate, including those without publication references.</p>
       <div aria-live="polite" className="sr-only">{records.length} material records loaded. {pending.length?'Some sources are still searching.':'Search complete.'}</div>
       {[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([formula,materials])=><section className="formula-group" key={formula}>
         <div className="formula-heading"><h3><Formula value={formula}/></h3><span>{materials.length} {materials.length===1?'record':'records'}</span></div>
         <div className="record-list">{materials.map(m=><article key={m.source+':'+m.id} className="material-record" data-testid="material-record">
           <div className="record-source"><span className={'database-icon '+m.source} aria-hidden="true">{m.source==='cod'?'C':m.source==='mcloud'?'M':'P'}</span><div><strong>{m.sourceName}</strong><span>{m.datasetId || m.id}</span></div></div>
           <div className="record-property"><span>Space group</span><strong>{m.properties.spaceGroup || 'Unavailable'}</strong></div>
           <div className="record-property"><span>Cell volume</span><strong>{m.properties.volume != null?m.properties.volume.toFixed(2)+' Å³':'Unavailable'}</strong></div>
           <div className="record-evidence">{m.references.filter(r=>r.kind==='record').length ? <span className="reference-badge">Source reference available</span>:<span className="no-reference-badge">Record kept · references not supplied</span>}</div>
           <button className="explore-button" onClick={()=>setSelected(m)} aria-label={'Explore '+m.id}>Explore <span aria-hidden="true">↗</span></button>
         </article>)}</div>
       </section>)}
       {!records.length && !pending.length && <div className="empty-results"><strong>{completed?'No matching materials returned.':'The selected databases could not return results.'}</strong><p>{completed?'Try allowing additional elements or searching another database. Check source statuses above for incomplete coverage.':'Check the source messages above and retry. An unavailable database does not mean no matching materials exist.'}</p></div>}
       <div className="pagination">{statuses.filter(s=>s.nextCursor).map(s=><button className="secondary-button" key={s.id} disabled={pending.includes(s.id)} onClick={()=>void load({...activeQuery,sources:[s.id as MaterialSource]},{[s.id]:s.nextCursor!},true)}>{pending.includes(s.id)?'Loading…':'Load more from '+s.name}</button>)}</div>
       {records.length>0 && <p className="fine-print">Export includes currently loaded records only. Source counts may include records omitted for incomplete composition metadata.</p>}
     </section>}
     <section id="sources" className="sources-section"><div className="sources-intro"><h2>Different databases.<br/>A connected search.</h2><p>Experimental and calculated records, with provenance intact. Open a record to explore properties, source references, and related literature.</p></div><div className="sources-list">{providerInfo.map(p=><div key={p.id}><a href={p.homepage} target="_blank" rel="noopener noreferrer">{p.name}<span aria-hidden="true">↗</span></a><p>{p.description}</p><a className="license-link" href={p.termsUrl} target="_blank" rel="noopener noreferrer">{p.license}</a><p className="fine-print">{p.attribution}</p></div>)}</div></section>
   </main>
   <footer className="site-footer"><span>MaterialAtlas</span><p>A starting point for research. Always verify the original sources.</p><span>Powered by open materials data</span></footer>
   {selected && <MaterialDetails key={selected.source+selected.id} material={selected} onClose={()=>setSelected(null)}/>}
 </>;
}
