import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from '../src/server/transport';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('does not contact unapproved upstream hosts',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://unapproved.example/structures','cod')).rejects.toThrow('Invalid source endpoint');
 expect(fetch).not.toHaveBeenCalled();
});
it('shows upstream quota failures without retrying or falling back',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('UPSTASH_REDIS_REST_URL','');
 const fetch=vi.fn().mockResolvedValue(new Response('quota',{status:429}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://api.crossref.org/works?quota-test=1','crossref')).rejects.toMatchObject({state:'quota-limited'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('enforces an upstream daily cap across different uncached searches',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('OPENALEX_DAILY_LIMIT','1');
 const fetch=vi.fn().mockResolvedValue(Response.json({results:[]}));vi.stubGlobal('fetch',fetch);
 await requestJson('https://api.openalex.org/works?daily-test=1','openalex');
 await expect(requestJson('https://api.openalex.org/works?daily-test=2','openalex')).rejects.toMatchObject({state:'quota-limited'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('fails closed if the shared Redis service is unavailable',async()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('UPSTASH_REDIS_REST_URL','https://fake-redis.upstash.io');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','test-token');
 const fetch=vi.fn().mockResolvedValue(new Response('unavailable',{status:503}));vi.stubGlobal('fetch',fetch);
 await expect(requestJson('https://api.crossref.org/works?redis-failure=1','crossref')).rejects.toThrow('Shared quota storage is unavailable');
 expect(fetch.mock.calls.every(([url])=>url==='https://fake-redis.upstash.io')).toBe(true);
});
