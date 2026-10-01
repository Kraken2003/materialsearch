import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ELEMENT_MAP } from '../lib/elements';
import { InputError, matchesComposition, optimadeFilter } from '../lib/search';
import type { CompositionQuery, Material, MaterialSource, MaterialsResponse, Reference, SourceStatus } from '../lib/types';
import { ENDPOINTS, providers } from './providers';
import { requestJson, UpstreamError } from './transport';
const PAGE_SIZE = 20;
function secret(): string {
 if (process.env.CURSOR_SECRET && process.env.CURSOR_SECRET.length >= 32) return process.env.CURSOR_SECRET;
 if (process.env.NODE_ENV === 'production') throw new Error('Cursor signing must be configured.');
 return 'local-development-only-cursor-signing-key';
}
function queryHash(q: CompositionQuery) { return createHash('sha256').update(JSON.stringify({include:q.include,exclude:q.exclude,mode:q.mode})).digest('hex'); }
function allowedPage(source: MaterialSource, value: string): string {
 const url = new URL(value); const base = new URL(ENDPOINTS[source]);
 const validPath = source === 'cod' ? /^\/cod\/optimade\/v1(?:\.\d+(?:\.\d+)?)?\/structures\/?$/.test(url.pathname) : url.pathname === base.pathname;
 if (url.protocol !== 'https:' || url.host !== base.host || url.username || url.password || !validPath || url.hash) throw new InputError('Invalid pagination endpoint.');
 return url.href;
}
export function issueCursor(source: MaterialSource, q: CompositionQuery, url: string): string {
 const payload = Buffer.from(JSON.stringify({ source, hash:queryHash(q), url:allowedPage(source,url), expires:Date.now()+3600000 })).toString('base64url');
 return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url');
}
export function readCursor(cursor: string, source: MaterialSource, q: CompositionQuery): string {
 try {
   if (cursor.length > 6000) throw new Error();
   const [payload,signature,...rest] = cursor.split('.'); if (rest.length || !payload || !signature) throw new Error();
   const expected = createHmac('sha256',secret()).update(payload).digest(); const actual = Buffer.from(signature,'base64url');
   if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) throw new Error();
   const data = JSON.parse(Buffer.from(payload,'base64url').toString());
   if (data.source !== source || data.hash !== queryHash(q) || data.expires < Date.now()) throw new Error();
   return allowedPage(source,data.url);
 } catch { throw new InputError('Pagination expired or is invalid. Run the search again.'); }
}
const text = (v: unknown): string | undefined => typeof v === 'string' && v.length > 0 ? v : undefined;
const numeric = (v: unknown): number | undefined => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
export function normalizeOptimade(row: any, source: MaterialSource, retrievedAt = new Date().toISOString()): Material | null {
 const a = row?.attributes;
 if (!a || typeof row.id !== 'string' || !Array.isArray(a.elements) || !a.elements.length || a.elements.some((e: unknown)=> typeof e !== 'string' || !ELEMENT_MAP.has(e))) return null;
 const formula = text(a.chemical_formula_reduced) || text(a.chemical_formula_descriptive);
 if (!formula) return null;
 const info = providers().find(p=>p.id===source)!;
 const refs: Reference[] = [];
 if (source === 'cod' && text(a._cod_title)) refs.push({title:a._cod_title,authors:text(a._cod_authors),year:numeric(a._cod_year),doi:text(a._cod_doi),kind:'record'});
 if (source === 'mcloud') refs.push({title:'MC3D dataset citation (not evidence for this individual material)',doi:'10.24435/materialscloud:jn-ac',url:'https://doi.org/10.24435/materialscloud:jn-ac',kind:'dataset'});
 return {
   id:row.id,source,sourceName:info.name,formula,elements:a.elements,license:info.license,attribution:info.attribution,retrievedAt,
   sourceUrl:source === 'cod' ? 'https://www.crystallography.net/cod/'+encodeURIComponent(row.id)+'.html' : ENDPOINTS.mcloud+'/'+encodeURIComponent(row.id),
   name:text(a._cod_mineral) || text(a._cod_chemname),datasetId:text(a._mcloud_mc3d_id),origin:source === 'cod' ? 'Experimental structural record' : 'DFT-relaxed structure; PBE-v1',
   properties:{spaceGroup:text(a.space_group_symbol_hermann_mauguin) || text(a._cod_sg),sites:numeric(a.nsites),dimensions:numeric(a.nperiodic_dimensions),volume:numeric(a._cod_vol) ?? numeric(a._mcloud_cell_volume)},references:refs,
 };
}
function normalizeMp(row: any, retrievedAt: string): Material | null {
 if (typeof row?.material_id !== 'string' || !Array.isArray(row.elements) || row.elements.some((e: unknown)=>typeof e !== 'string' || !ELEMENT_MAP.has(e)) || !text(row.formula_pretty)) return null;
 const info = providers().find(p=>p.id==='mp')!;
 return { id:row.material_id,source:'mp',sourceName:info.name,formula:row.formula_pretty,elements:row.elements,sourceUrl:'https://materialsproject.org/materials/'+encodeURIComponent(row.material_id),properties:{spaceGroup:text(row.symmetry?.symbol),sites:numeric(row.nsites),volume:numeric(row.volume),bandGap:numeric(row.band_gap),energyAboveHull:numeric(row.energy_above_hull)},references:[],license:info.license,attribution:info.attribution,retrievedAt,origin:row.theoretical === true ? 'Computed; theoretical structure' : 'Computed material record' };
}
function firstUrl(source: MaterialSource, q: CompositionQuery): string {
 const url = new URL(ENDPOINTS[source]);
 if (source !== 'mp') { url.searchParams.set('filter',optimadeFilter(q)); url.searchParams.set('page_limit',String(PAGE_SIZE)); }
 else {
   url.searchParams.set('elements',q.include.join(',')); if (q.exclude.length) url.searchParams.set('exclude_elements',q.exclude.join(','));
   if (q.mode === 'exact') { url.searchParams.set('nelements_min',String(q.include.length)); url.searchParams.set('nelements_max',String(q.include.length)); }
   url.searchParams.set('_limit',String(PAGE_SIZE)); url.searchParams.set('_skip','0');
   url.searchParams.set('batch_id_not_eq','gnome_r2scan_statics');
   url.searchParams.set('_fields','material_id,formula_pretty,elements,nsites,volume,symmetry,band_gap,energy_above_hull,theoretical');
 }
 return url.href;
}
function nextLink(value: unknown): string | undefined {
 return typeof value === 'string' ? value : text((value as {href?:unknown})?.href);
}
export async function searchMaterials(q: CompositionQuery, cursors: Partial<Record<MaterialSource,string>> = {}): Promise<MaterialsResponse> {
 // Validate all cursors before starting any network work.
 const urls = new Map(q.sources.map(source=>[source,cursors[source] ? readCursor(cursors[source]!,source,q) : firstUrl(source,q)]));
 const results = await Promise.all(q.sources.map(async source => {
   const info = providers().find(p=>p.id===source)!;
   const status: SourceStatus = { id:source,name:info.name,state:'disabled',loaded:0 };
   if (!info.enabled) return {records:[] as Material[],status:{...status,message:info.reason}};
   try {
     const url = urls.get(source)!;
     const data = await requestJson(url,source,source === 'mp' ? {'X-API-KEY':process.env.MP_API_KEY!} : {});
     if (!Array.isArray(data.data)) throw new UpstreamError('unavailable','The source returned an invalid result envelope.');
     const at = data.__retrievedAt || new Date().toISOString();
     const records: Material[] = data.data.map((r: any)=>source === 'mp' ? normalizeMp(r,at) : normalizeOptimade(r,source,at)).filter((r: Material | null): r is Material=>!!r && matchesComposition(r.elements,q));
     const total = numeric(source === 'mp' ? data.meta?.total_doc : data.meta?.data_returned);
     let next = nextLink(data.links?.next);
     if (source === 'mp') {
       const page = new URL(url); const skip = Number(page.searchParams.get('_skip') || 0)+data.data.length;
       if (data.data.length && (total != null ? skip < total : data.data.length === PAGE_SIZE)) {page.searchParams.set('_skip',String(skip)); next=page.href;}
     }
     let nextCursor: string | undefined;
     let paginationMessage: string | undefined;
     if (next) {
       try { nextCursor = issueCursor(source,q,next); }
       catch { paginationMessage='Pagination is unavailable because the source returned an invalid next-page link.'; }
     }
     const skipped = data.data.length-records.length;
     const message=[skipped ? skipped+' records omitted because composition metadata was missing or did not match. Continue to the next page if available.' : '',paginationMessage].filter(Boolean).join(' ') || undefined;
     return { records, status:{...status,state:(records.length ? 'ok' : (data.data.length || nextCursor) ? 'unavailable' : 'empty') as SourceStatus['state'],loaded:records.length,total,nextCursor,skipped,message} };
   } catch (e) {
     return {records:[] as Material[],status:{...status,state:e instanceof UpstreamError ? e.state : 'unavailable' as const,message:e instanceof UpstreamError ? e.message : 'Source data could not be loaded. Try again later.'}};
   }
 }));
 return {query:q,records:results.flatMap(r=>r.records),sources:results.map(r=>r.status)};
}
