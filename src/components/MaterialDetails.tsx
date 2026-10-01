'use client';
import { useEffect, useRef, useState } from 'react';
import type { Material, PapersResponse } from '@/lib/types';
import { safeUrl } from '@/lib/papers';
import Formula from './Formula';
export default function MaterialDetails({material,onClose}:{material:Material;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=dialog.current;d?.showModal();return ()=>d?.close();},[]);
 const properties = [
  ['Space group',material.properties.spaceGroup],['Sites in cell',material.properties.sites],
  ['Periodic dimensions',material.properties.dimensions],['Cell volume',material.properties.volume != null ? material.properties.volume.toFixed(2)+' Å³':undefined],
  ['Band gap',material.properties.bandGap != null ? material.properties.bandGap+' eV':undefined],
  ['Energy above hull',material.properties.energyAboveHull != null ? material.properties.energyAboveHull+' eV/atom':undefined],
 ];
 return <dialog ref={dialog} className="material-dialog" aria-labelledby="detail-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current) onClose();}}>
   <div className="detail-shell">
     <header className="detail-header"><span>Material record</span><button className="icon-button" onClick={onClose} aria-label="Close material details">✕</button></header>
     <div className="detail-content">
       <span className="source-tag">{material.sourceName}</span>
       <h2 id="detail-title" className="detail-formula"><Formula value={material.formula}/></h2>
       {material.name && <p className="material-name">{material.name}</p>}
       <p className="record-id">{material.datasetId || material.id}</p>
       <p className="muted">{material.origin || 'Database material record'}</p>
       <a className="primary-link" href={material.sourceUrl} target="_blank" rel="noopener noreferrer">Open original record <span aria-hidden="true">↗</span></a>
       <section className="detail-section"><h3>Available properties</h3><dl className="properties">{properties.map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value ?? <span className="unavailable">Unavailable</span>}</dd></div>)}</dl><p className="fine-print">Values come from this source. Calculated properties depend on the source’s methods and are not universally comparable.</p></section>
       <section className="detail-section"><h3>Source-provided references</h3>
         {material.references.length ? <ul className="reference-list">{material.references.map((r,i)=>{
           const url = r.doi ? 'https://doi.org/'+encodeURI(r.doi) : safeUrl(r.url);
           return <li key={i}><span className="reference-kind">{r.kind === 'dataset' ? 'Dataset citation':'Record reference'}</span>{url?<a href={url} target="_blank" rel="noopener noreferrer">{r.title}</a>:<strong>{r.title}</strong>}<p>{[r.authors,r.year].filter(Boolean).join(' · ')}</p></li>;
         })}</ul> : <p className="muted">No references were supplied in this database response. The original record may contain additional citations.</p>}
       </section>
       <PaperPanel key={material.source+material.id} material={material}/>
       <section className="detail-section attribution"><h3>Provenance & attribution</h3><p>{material.attribution || material.sourceName}</p><p>{material.license}</p><p>Record ID: {material.id}</p><p>Retrieved: {material.retrievedAt}</p></section>
     </div>
   </div>
 </dialog>;
}
function PaperPanel({material}:{material:Material}) {
 const [keywords,setKeywords]=useState('');
 const [result,setResult]=useState<PapersResponse|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const controller=useRef<AbortController|null>(null);
 async function search(keyword:string) {
   controller.current?.abort();const c=new AbortController();controller.current=c;
   setLoading(true);setError('');setResult(null);
   try {
     const r=await fetch('/api/papers/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({formula:material.formula,elements:material.elements,keywords:keyword}),signal:c.signal});
     const data=await r.json();if(!r.ok) throw new Error(data.error || 'Literature search is unavailable.');
     if(!c.signal.aborted) setResult(data);
   } catch(e) {if(!c.signal.aborted) setError(e instanceof Error?e.message:'Literature search is unavailable.');}
   finally {if(!c.signal.aborted) setLoading(false);}
 }
 useEffect(()=>{void search('');return ()=>controller.current?.abort();},[]); // A fresh panel is mounted for each material.
 const failed=result?.sources.filter(s=>s.state==='unavailable' || s.state==='quota-limited') || [];
 return <section className="detail-section paper-section" aria-labelledby="paper-heading">
   <div className="section-heading"><h3 id="paper-heading">Related papers</h3><span className="optional-tag">Additional context</span></div>
   <p className="muted">Search-discovered literature. A match does not verify this material’s composition, synthesis, or experimental validation.</p>
   <form className="paper-search" onSubmit={e=>{e.preventDefault();void search(keywords);}}>
     <label htmlFor="paper-keywords">Refine with keywords</label>
     <div><input id="paper-keywords" placeholder="e.g. battery, magnetic, synthesis" value={keywords} maxLength={160} onChange={e=>setKeywords(e.target.value)}/><button className="secondary-button" type="submit" disabled={loading}>Find papers</button></div>
   </form>
   {loading && <p role="status" className="loading-text">Searching literature… Your material record is already available.</p>}
   {error && <div className="error-notice" role="alert">{error}<button className="text-button" onClick={()=>void search(keywords)}>Retry literature search</button></div>}
   {result && <>
     <div className="literature-status">{result.sources.map(s=><p key={s.id}><strong>{s.name}</strong>: {s.state === 'ok'?s.loaded+' papers':s.state === 'empty'?'No matches':s.state === 'disabled'?'Not configured':s.message || 'Unavailable'}</p>)}</div>
     {!result.papers.length && <p className="paper-empty">{failed.length?'Literature coverage is incomplete. Try again later.':'No related papers found in the searched sources.'}</p>}
     <ul className="paper-list">{result.papers.map(p=><li key={p.id}>
       <div className="paper-meta">{p.year ?? 'Year unavailable'} <span>{p.sources.map(s=>s==='crossref'?'Crossref':'OpenAlex').join(' + ')}</span></div>
       <a className="paper-title" href={p.url} target="_blank" rel="noopener noreferrer">{p.title} <span aria-hidden="true">↗</span></a>
       <p>{p.authors.length ? p.authors.slice(0,3).join(', ')+(p.authors.length>3?' et al.':''):'Authors unavailable'}</p>
       {p.openAccessUrl && <a className="open-access" href={p.openAccessUrl} target="_blank" rel="noopener noreferrer">Open-access version</a>}
     </li>)}</ul>
     <p className="fine-print">Limited to results returned by the configured sources. No papers found does not mean no papers exist. Review the original paper before relying on a match.</p>
   </>}
 </section>;
}
