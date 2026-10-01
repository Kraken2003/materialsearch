import { randomUUID } from 'node:crypto';
export class StorageError extends Error {}
const values = new Map<string,{ value: unknown; expires: number }>();
const counters = new Map<string,{ count: number; expires: number }>();
const pending = new Map<string,Promise<unknown>>();
function shared() {
 const url = process.env.UPSTASH_REDIS_REST_URL;
 const token = process.env.UPSTASH_REDIS_REST_TOKEN;
 if (url && token) return { url, token };
 if (process.env.NODE_ENV === 'production') throw new StorageError('Shared quota storage is not configured. Search is temporarily unavailable.');
 return null;
}
async function redis(command: (string | number)[]): Promise<any> {
 const config = shared();
 if (!config) throw new StorageError('Shared quota storage is not configured.');
 try {
   const r = await fetch(config.url, { method: 'POST', headers: { Authorization: 'Bearer '+config.token, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(4000), cache: 'no-store', redirect: 'error' });
   if (!r.ok) throw new Error();
   const data = await r.json(); if (data.error) throw new Error();
   return data.result;
 } catch { throw new StorageError('Shared quota storage is unavailable. Search is temporarily unavailable.'); }
}
function prune() {
 const now = Date.now();
 for (const [k,v] of values) if (v.expires < now) values.delete(k);
 for (const [k,v] of counters) if (v.expires < now) counters.delete(k);
 while (values.size > 300) values.delete(values.keys().next().value!);
 while (counters.size > 3000) counters.delete(counters.keys().next().value!);
}
export async function takeQuota(key: string, limit: number, seconds: number): Promise<boolean> {
 if (shared()) {
   const result = await redis(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return 0 end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]) end; return 1",1,'atlas:quota:'+key,limit,seconds]);
   return result === 1;
 }
 prune();
 const current = counters.get(key) || { count: 0, expires: Date.now()+seconds*1000 };
 if (current.count >= limit) return false;
 current.count++; counters.set(key,current); return true;
}
async function cachedWork<T>(key: string, ttl: number, work: () => Promise<T>): Promise<T> {
 const config = shared(); prune();
 const local = values.get(key); if (local && local.expires > Date.now()) return local.value as T;
 if (!config) {
   const value = await work(); values.set(key,{ value, expires: Date.now()+ttl*1000 }); return value;
 }
 const cacheKey = 'atlas:cache:'+key; const lockKey = 'atlas:lock:'+key;
 const found = await redis(['GET',cacheKey]); if (found !== null) return JSON.parse(found) as T;
 const token = randomUUID();
 const acquired = await redis(['SET',lockKey,token,'NX','EX',30]);
 if (!acquired) {
   for (let i=0; i<30; i++) {
     await new Promise(r=>setTimeout(r,400));
     const value = await redis(['GET',cacheKey]); if (value !== null) return JSON.parse(value) as T;
   }
   throw new StorageError('This search is still running. Please try again shortly.');
 }
 try {
   const value = await work();
   await redis(['SET',cacheKey,JSON.stringify(value),'EX',ttl]);
   values.set(key,{ value, expires: Date.now()+ttl*1000 });
   return value;
 } finally {
   // Delete only our own lease. Another instance may acquire it after expiry.
   await redis(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,lockKey,token]);
 }
}
export async function cached<T>(key: string, ttl: number, work: () => Promise<T>): Promise<T> {
 const existing = pending.get(key); if (existing) return existing as Promise<T>;
 const task = cachedWork(key,ttl,work); pending.set(key,task);
 try { return await task; } finally { pending.delete(key); }
}
export function configuredLimit(name: string, fallback: number, max = 10000): number {
 const value = Number(process.env[name] ?? fallback);
 return Number.isSafeInteger(value) && value >= 1 && value <= max ? value : fallback;
}
