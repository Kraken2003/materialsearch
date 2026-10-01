import { afterEach, expect, it, vi } from 'vitest';
import { searchPapers, validatePaperQuery } from '../src/server/literature';
import { requestJson, UpstreamError } from '../src/server/transport';
vi.mock('../src/server/transport',async importOriginal => ({...await importOriginal<typeof import('../src/server/transport')>(),requestJson:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
it('returns an explicit empty literature result without depending on material records',async()=>{
 vi.mocked(requestJson).mockResolvedValue({message:{items:[]},results:[]});
 const response = await searchPapers(validatePaperQuery({formula:'Fe2O3',elements:['Fe','O'],keywords:''}));
 expect(response.papers).toEqual([]); expect(response.sources.every(s=>s.state === 'empty' || s.state === 'disabled')).toBe(true);
});
it('reports literature quota failures independently',async()=>{
 vi.mocked(requestJson).mockRejectedValue(new UpstreamError('quota-limited','Daily limit reached.'));
 const response = await searchPapers(validatePaperQuery({formula:'Fe2O3',elements:['Fe','O']}));
 expect(response.papers).toEqual([]); expect(response.sources[0].state).toBe('quota-limited');
});
it('normalizes real Crossref metadata with safe links',async()=>{
 vi.mocked(requestJson).mockResolvedValue({message:{items:[{DOI:'10.100/example',title:['Properties of iron oxides'],author:[{given:'A',family:'Scientist'}],published:{'date-parts':[[2024]]},URL:'javascript:alert(1)'}]}});
 const response = await searchPapers(validatePaperQuery({formula:'Fe2O3',elements:['Fe','O']}));
 expect(response.papers[0].url).toBe('https://doi.org/10.100/example'); expect(response.papers[0].year).toBe(2024);
});
