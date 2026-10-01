import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from '../src/server/transport';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('does not contact unapproved upstream hosts',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://unapproved.example/structures','cod')).rejects.toThrow('Invalid source endpoint');
 expect(fetch).not.toHaveBeenCalled();
});
it('shows upstream quota failures without retrying or falling back',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockResolvedValue(new Response('quota',{status:429}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://api.crossref.org/works?quota-test=1','crossref')).rejects.toMatchObject({state:'quota-limited'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('enforces an upstream daily cap across different uncached searches',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('OPENALEX_DAILY_LIMIT','1');
 const fetch=vi.fn().mockResolvedValue(Response.json({results:[]}));vi.stubGlobal('fetch',fetch);
 await requestJson('https://api.openalex.org/works?daily-test=1','openalex');
 await expect(requestJson('https://api.openalex.org/works?daily-test=2','openalex')).rejects.toMatchObject({state:'quota-limited'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('contacts only the source in production without external cache storage',async()=>{
 vi.stubEnv('NODE_ENV','production');
 const fetch=vi.fn().mockResolvedValue(Response.json({message:{items:[]}}));vi.stubGlobal('fetch',fetch);
 const url='https://api.crossref.org/works?production-test=1';
 expect(await requestJson(url,'crossref')).toMatchObject({message:{items:[]}});
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0][0]).toBe(url);
});
