import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchMaterials, normalizeOptimade, issueCursor, readCursor } from '../src/server/materials';
import { validateQuery } from '../src/lib/search';
import * as transport from '../src/server/transport';

const query = validateQuery({ include: ['Si','O'], exclude: [], mode: 'exact', sources: ['cod','mcloud'] });
const record = { id: '1010921', attributes: { elements: ['O','Si'], chemical_formula_reduced: 'O2Si', _cod_title: 'Crystal structures', _cod_year: '1932', _cod_sg: 'P 21 3', _cod_vol: 367.1 } };
afterEach(() => vi.restoreAllMocks());
describe('provider federation', () => {
 it('returns materials without references and preserves individual records', () => {
   const first = normalizeOptimade({ ...record, attributes: { elements: ['O','Si'], chemical_formula_reduced: 'O2Si' } }, 'cod');
   expect(first?.references).toEqual([]);
   expect(first?.formula).toBe('O2Si');
   expect(normalizeOptimade({ ...record, id: 'different-structure' }, 'cod')?.id).not.toBe(first?.id);
 });
 it('keeps successful material results when another source fails', async () => {
   vi.spyOn(transport, 'requestJson').mockImplementation(async (url) => {
     if (url.includes('materialscloud')) throw new transport.UpstreamError('unavailable', 'Source unavailable.');
     return { data: [record], meta: { data_returned: 1 }, links: {} };
   });
   const result = await searchMaterials(query);
   expect(result.records).toHaveLength(1);
   expect(result.sources.find(s => s.id === 'mcloud')?.state).toBe('unavailable');
   expect(result.sources.find(s => s.id === 'cod')?.state).toBe('ok');
 });
 it('filters mismatched upstream records and reports them', async () => {
   vi.spyOn(transport,'requestJson').mockResolvedValue({ data: [record, { ...record, id: 'bad', attributes: { elements: ['O','Si','Li'], chemical_formula_reduced: 'LiOSi' } }], meta: { data_returned: 2 }, links: {} });
   const result = await searchMaterials({ ...query, sources: ['cod'] });
   expect(result.records).toHaveLength(1); expect(result.sources[0].skipped).toBe(1);
 });
 it('rejects malformed upstream envelopes instead of calling them empty', async () => {
   vi.spyOn(transport,'requestJson').mockResolvedValue({ unexpected: [] });
   expect((await searchMaterials({ ...query, sources: ['cod'] })).sources[0].state).toBe('unavailable');
 });
 it('signs pagination cursors and binds them to composition and provider', () => {
   const url = 'https://www.crystallography.net/cod/optimade/v1.1.0/structures?page_offset=20';
   const cursor = issueCursor('cod', query, url);
   expect(readCursor(cursor,'cod',query)).toBe(url);
   expect(() => readCursor(cursor+'x','cod',query)).toThrow();
   expect(() => readCursor(cursor,'mcloud',query)).toThrow();
   expect(() => readCursor(cursor,'cod',{ ...query, mode: 'contains' })).toThrow();
   expect(() => issueCursor('cod',query,'https://evil.example/structures')).toThrow();
 });
 it('keeps valid records even when an upstream pagination link is invalid', async()=>{
   vi.spyOn(transport,'requestJson').mockResolvedValue({data:[record],meta:{data_returned:2},links:{next:'https://evil.example/structures'}});
   const result=await searchMaterials({...query,sources:['cod']});
   expect(result.records).toHaveLength(1);
   expect(result.sources[0].nextCursor).toBeUndefined();
   expect(result.sources[0].message).toContain('Pagination');
 });
});
