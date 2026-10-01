import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from '../src/server/transport';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('retries a transient COD connection failure',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(Response.json({data:[]}));vi.stubGlobal('fetch',fetch);
 expect(await requestJson('https://www.crystallography.net/cod/optimade/v1/structures?retry-test=1','cod')).toMatchObject({data:[]});
 expect(fetch).toHaveBeenCalledTimes(2);
});
it('follows COD version redirects without leaving the structures endpoint',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'/cod/optimade/v1.0.0/structures?redirect-test=1'}})).mockResolvedValueOnce(Response.json({data:[]}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?redirect-test=1','cod')).resolves.toMatchObject({data:[]});
 expect(fetch.mock.calls[1][0]).toBe('https://www.crystallography.net/cod/optimade/v1.0.0/structures?redirect-test=1');
});
it('rejects COD redirects to another host',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:'https://unapproved.example/structures'}}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?unsafe-redirect=1','cod')).rejects.toThrow('unsafe redirect');
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('reports malformed JSON separately from a timeout',async()=>{
 vi.stubEnv('NODE_ENV','development');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>maintenance</html>')));
 await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?invalid-json=1','cod')).rejects.toThrow('invalid JSON');
});
it('retries COD service failures once',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockResolvedValueOnce(new Response('busy',{status:503})).mockResolvedValueOnce(Response.json({data:[]}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?service-retry=1','cod')).resolves.toMatchObject({data:[]});
 expect(fetch).toHaveBeenCalledTimes(2);
});
it('reports a COD timeout after the bounded retry',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockRejectedValue(new DOMException('timed out','TimeoutError'));vi.stubGlobal('fetch',fetch);
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try {
   await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?timeout-test=1','cod')).rejects.toThrow('source timed out');
   expect(fetch).toHaveBeenCalledTimes(2);
   expect(log).toHaveBeenCalledWith('MaterialAtlas upstream request failed',expect.objectContaining({source:'cod',name:'TimeoutError'}));
 } finally { log.mockRestore(); }
});
it('does not retry COD quota errors',async()=>{
 vi.stubEnv('NODE_ENV','development');
 const fetch=vi.fn().mockResolvedValue(new Response('quota',{status:429}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://www.crystallography.net/cod/optimade/v1/structures?cod-quota=1','cod')).rejects.toMatchObject({state:'quota-limited'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
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
