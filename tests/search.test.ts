import { describe, it, expect } from 'vitest';
import { validateQuery, optimadeFilter, matchesComposition, toCsv, queryFromUrl, queryToUrl } from '../src/lib/search';
import { deduplicatePapers } from '../src/lib/papers';

const query = { include: ['Fe', 'O'], exclude: ['Pb'], mode: 'contains', sources: ['cod', 'mcloud'] };
describe('composition search', () => {
  it('builds inclusive and exact composition filters', () => {
    const q = validateQuery(query);
    expect(optimadeFilter(q)).toContain('elements HAS ALL "O","Fe"');
    expect(optimadeFilter(q)).toContain('NOT (elements HAS ANY "Pb")');
    expect(optimadeFilter({ ...q, mode: 'exact' })).toContain('nelements=2');
  });
  it('rejects invalid symbols, empty selections, and conflicting elements', () => {
    expect(() => validateQuery({ ...query, include: [] })).toThrow();
    expect(() => validateQuery({ ...query, include: ['Fe" OR nelements>0'] })).toThrow();
    expect(() => validateQuery({ ...query, exclude: ['Fe'] })).toThrow();
    expect(() => validateQuery({ ...query, sources: ['arbitrary-host'] })).toThrow();
  });
  it('keeps only records matching the requested element set', () => {
    const q = validateQuery(query);
    expect(matchesComposition(['Fe', 'O', 'Li'], q)).toBe(true);
    expect(matchesComposition(['Fe', 'O', 'Pb'], q)).toBe(false);
    expect(matchesComposition(['Fe'], q)).toBe(false);
    expect(matchesComposition(['Fe', 'O', 'Li'], { ...q, mode: 'exact' })).toBe(false);
    expect(matchesComposition(['O', 'Fe'], { ...q, mode: 'exact' })).toBe(true);
  });
  it('restores all query controls from a shareable URL', () => {
    const q = validateQuery({ ...query, mode: 'exact' });
    expect(queryFromUrl(queryToUrl(q))).toEqual(q);
  });
});
describe('research records', () => {
  it('exports distinct records without references and escapes spreadsheet formulas', () => {
    const records = ['record-1', 'record-2'].map(id => ({ id, source: 'cod' as const, sourceName: 'COD', formula: 'Fe2O3', elements: ['Fe','O'], sourceUrl: 'https://www.crystallography.net/cod/'+id+'.html', references: [], properties: {}, license: 'CC0', retrievedAt: '2026-10-01' }));
    const csv = toCsv(records);
    expect(csv).toContain('record-1'); expect(csv).toContain('record-2'); expect(csv).toContain('Fe2O3');
    expect(toCsv([{ ...records[0], formula: '=HYPERLINK("evil")' }])).toContain("'=HYPERLINK");
  });
  it('merges DOI and title/year duplicates while retaining discovery sources', () => {
    const base = { id: '1', title: 'Iron oxides', year: 2024, authors: ['A. Scientist'], url: 'https://doi.org/10.123/example', doi: '10.123/EXAMPLE', sources: ['crossref'], openAccessUrl: null };
    const papers = deduplicatePapers([base, { ...base, id: '2', doi: 'https://doi.org/10.123/example', sources: ['openalex'] }, { ...base, id: '3', doi: null }]);
    expect(papers).toHaveLength(1);
    expect(papers[0].sources).toEqual(['crossref', 'openalex']);
  });
});
