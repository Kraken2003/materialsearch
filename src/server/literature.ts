import { ELEMENT_MAP } from '../lib/elements';
import { deduplicatePapers, normalizedDoi, safeUrl } from '../lib/papers';
import { InputError } from '../lib/search';
import type { Paper, PapersResponse, SourceStatus } from '../lib/types';
import { requestJson, UpstreamError } from './transport';
export interface PaperQuery { formula: string; elements: string[]; keywords: string }
export function validatePaperQuery(value: unknown): PaperQuery {
 const v = value as Record<string,unknown> | null;
 if (!v || typeof v.formula !== 'string' || !/^[A-Za-z0-9().+\-\s]{1,100}$/.test(v.formula)) throw new InputError('Provide a valid material formula.');
 if (!Array.isArray(v.elements) || !v.elements.length || v.elements.length > 118 || v.elements.some(e=>typeof e !== 'string' || !ELEMENT_MAP.has(e))) throw new InputError('Provide valid material elements.');
 if (v.keywords != null && (typeof v.keywords !== 'string' || v.keywords.length > 160 || /[\x00-\x1f]/.test(v.keywords))) throw new InputError('Literature keywords must be at most 160 characters.');
 return {formula:v.formula.trim(),elements:[...new Set(v.elements as string[])].sort(),keywords:((v.keywords as string) || '').trim()};
}
function clean(value: unknown): string { return typeof value === 'string' ? value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim() : ''; }
export async function searchPapers(q: PaperQuery): Promise<PapersResponse> {
 const names = q.elements.map(e=>ELEMENT_MAP.get(e)!.name.toLowerCase()).join(' ');
 // Reverse element tokens as an additional alias for alphabetical OPTIMADE formulas (O2Si -> SiO2).
 const tokens = q.formula.match(/[A-Z][a-z]?(?:\d+(?:\.\d+)?)?/g) || [];
 const alias = tokens.length && tokens.join('') === q.formula ? [...tokens].reverse().join('') : q.formula;
 const query = [...new Set([q.formula,alias]),names,q.keywords].filter(Boolean).join(' ');
 const results = await Promise.all(['crossref','openalex'].map(async source=>{
   const status: SourceStatus = {id:source,name:source === 'crossref' ? 'Crossref' : 'OpenAlex',state:'disabled',loaded:0};
   if (source === 'openalex' && !process.env.OPENALEX_API_KEY) return {papers:[] as Paper[],status:{...status,message:'Site owner has not configured a free OpenAlex key.'}};
   try {
     const url = new URL(source === 'crossref' ? 'https://api.crossref.org/works' : 'https://api.openalex.org/works');
     if (source === 'crossref') {
       url.searchParams.set('query.bibliographic',query); url.searchParams.set('rows','12');
       if (process.env.CONTACT_EMAIL) url.searchParams.set('mailto',process.env.CONTACT_EMAIL);
     } else {
       url.searchParams.set('search',query); url.searchParams.set('per_page','12');
       url.searchParams.set('select','id,doi,title,publication_year,authorships,primary_location,best_oa_location');
     }
     const data = await requestJson(url.href,source,source === 'openalex' ? {Authorization:'Bearer '+process.env.OPENALEX_API_KEY!} : {});
     const items = source === 'crossref' ? data.message?.items : data.results;
     if (!Array.isArray(items)) throw new UpstreamError('unavailable','The literature source returned invalid data.');
     const papers: Paper[] = items.map((p: any): Paper | null=>{
       const title = clean(source === 'crossref' ? p.title?.[0] : p.title);
       if (!title) return null;
       const doi = normalizedDoi(source === 'crossref' ? p.DOI : p.doi);
       const url = doi ? 'https://doi.org/'+encodeURI(doi) : safeUrl(source === 'crossref' ? p.URL : p.primary_location?.landing_page_url) || safeUrl(p.id);
       if (!url) return null;
       const year = source === 'crossref' ? (p.published?.['date-parts']?.[0]?.[0] ?? p['published-print']?.['date-parts']?.[0]?.[0] ?? p.created?.['date-parts']?.[0]?.[0]) : p.publication_year;
       return {id:doi || url,title,doi,url,year:typeof year === 'number' ? year : null,authors:source === 'crossref' ? (p.author || []).slice(0,8).map((a: any)=>[clean(a.given),clean(a.family)].filter(Boolean).join(' ')) : (p.authorships || []).slice(0,8).map((a: any)=>clean(a.author?.display_name)),sources:[source],openAccessUrl:source === 'openalex' ? safeUrl(p.best_oa_location?.pdf_url) || safeUrl(p.best_oa_location?.landing_page_url) || null : null};
     }).filter((p: Paper | null): p is Paper=>!!p);
     return {papers,status:{...status,state:papers.length ? 'ok' as const : 'empty' as const,loaded:papers.length}};
   } catch(e) {
     return {papers:[] as Paper[],status:{...status,state:e instanceof UpstreamError ? e.state : 'unavailable' as const,message:e instanceof UpstreamError ? e.message : 'Literature search is temporarily unavailable.'}};
   }
 }));
 return {query,papers:deduplicatePapers(results.flatMap(r=>r.papers)),sources:results.map(r=>r.status)};
}
