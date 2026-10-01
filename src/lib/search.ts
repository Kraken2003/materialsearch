import { ELEMENT_MAP } from './elements';
import { MATERIAL_SOURCES, type CompositionQuery, type Material, type MaterialSource } from './types';
export class InputError extends Error {}
export function validateQuery(value: unknown): CompositionQuery {
 if (!value || typeof value !== 'object') throw new InputError('Provide a composition query.');
 const v = value as Record<string, unknown>;
 const list = (input: unknown, label: string): string[] => {
   if (!Array.isArray(input) || input.length > 118 || input.some(x => typeof x !== 'string' || !ELEMENT_MAP.has(x))) throw new InputError('Invalid '+label+' elements.');
   return [...new Set(input as string[])].sort((a,b) => ELEMENT_MAP.get(a)!.number - ELEMENT_MAP.get(b)!.number);
 };
 const include = list(v.include, 'included'); const exclude = list(v.exclude ?? [], 'excluded');
 if (!include.length) throw new InputError('Select at least one included element.');
 if (include.some(e => exclude.includes(e))) throw new InputError('An element cannot be included and excluded.');
 if (v.mode !== 'contains' && v.mode !== 'exact') throw new InputError('Choose a valid composition mode.');
 if (!Array.isArray(v.sources) || !v.sources.length || v.sources.length > 3 || v.sources.some(s => !MATERIAL_SOURCES.includes(s as MaterialSource))) throw new InputError('Choose at least one valid database.');
 return { include, exclude, mode: v.mode, sources: MATERIAL_SOURCES.filter(s => (v.sources as string[]).includes(s)) };
}
export function optimadeFilter(q: CompositionQuery): string {
 const quoted = (e: string[]) => e.map(s => '"'+s+'"').join(',');
 return ['elements HAS ALL '+quoted(q.include), q.mode === 'exact' ? 'nelements='+q.include.length : '', q.exclude.length ? 'NOT (elements HAS ANY '+quoted(q.exclude)+')' : ''].filter(Boolean).join(' AND ');
}
export function matchesComposition(elements: string[], q: CompositionQuery): boolean {
 return q.include.every(e => elements.includes(e)) && !q.exclude.some(e => elements.includes(e)) && (q.mode !== 'exact' || new Set(elements).size === q.include.length);
}
export function queryToUrl(q: CompositionQuery): string {
 const params = new URLSearchParams({ include: q.include.join(','), mode: q.mode, sources: q.sources.join(',') });
 if (q.exclude.length) params.set('exclude', q.exclude.join(','));
 return '?'+params.toString();
}
export function queryFromUrl(search: string): CompositionQuery {
 const params = new URLSearchParams(search);
 return validateQuery({ include: (params.get('include') || '').split(',').filter(Boolean), exclude: (params.get('exclude') || '').split(',').filter(Boolean), mode: params.get('mode') || 'contains', sources: (params.get('sources') || 'cod,mcloud').split(',') });
}
export function toCsv(records: Material[]): string {
 const cell = (value: unknown) => {
   let s = value == null ? '' : String(value);
   if (/^[\s]*[=+@-]/.test(s)) s = "'"+s;
   return '"'+s.replaceAll('"','""')+'"';
 };
 const header = ['formula','source','record_id','dataset_id','elements','space_group','sites','dimensions','volume_A3','band_gap_eV','energy_above_hull_eV_atom','source_url','source_references','license','attribution','retrieved_at'];
 const rows = records.map(m => [m.formula,m.sourceName,m.id,m.datasetId,m.elements.join(' '),m.properties.spaceGroup,m.properties.sites,m.properties.dimensions,m.properties.volume,m.properties.bandGap,m.properties.energyAboveHull,m.sourceUrl,m.references.map(r=>r.doi || r.title).join('; '),m.license,m.attribution,m.retrievedAt]);
 return '\uFEFF'+[header,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
}
