import { afterEach, expect, it, vi } from 'vitest';
import { cached, takeQuota } from '../src/server/store';
afterEach(() => vi.unstubAllEnvs());
it('atomically refuses requests beyond a limit', async () => {
 vi.stubEnv('NODE_ENV','development');
 expect(await Promise.all(Array.from({ length: 6 },()=>takeQuota('test-limit',3,60)))).toEqual([true,true,true,false,false,false]);
});
it('coalesces concurrent requests and caches the resulting value', async () => {
 vi.stubEnv('NODE_ENV','development');
 let requests = 0;
 const work = async () => { requests++; await new Promise(r=>setTimeout(r,10)); return { records: ['material-without-paper'] }; };
 const result = await Promise.all([cached('coalescing-test',60,work),cached('coalescing-test',60,work)]);
 expect(result[0]).toEqual(result[1]); expect(requests).toBe(1);
 expect(await cached('coalescing-test',60,work)).toEqual(result[0]); expect(requests).toBe(1);
});
it('fails closed in production without shared quota storage', async () => {
 vi.stubEnv('NODE_ENV','production'); vi.stubEnv('UPSTASH_REDIS_REST_URL',''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');
 await expect(takeQuota('production',1,60)).rejects.toThrow('Shared quota storage');
});
