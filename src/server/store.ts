const values = new Map<string,{ value: unknown; expires: number }>();
const counters = new Map<string,{ count: number; expires: number }>();
const pending = new Map<string,Promise<unknown>>();
function prune() {
 const now = Date.now();
 for (const [k,v] of values) if (v.expires < now) values.delete(k);
 for (const [k,v] of counters) if (v.expires < now) counters.delete(k);
 while (values.size > 300) values.delete(values.keys().next().value!);
}
export async function takeQuota(key: string, limit: number, seconds: number): Promise<boolean> {
 prune();
 // Never evict active counters to make room: doing so would reset their limits.
 if (!counters.has(key) && counters.size >= 3000) return false;
 const current = counters.get(key) || { count: 0, expires: Date.now()+seconds*1000 };
 if (current.count >= limit) return false;
 current.count++; counters.set(key,current); return true;
}
async function cachedWork<T>(key: string, ttl: number, work: () => Promise<T>): Promise<T> {
 prune();
 const local = values.get(key); if (local && local.expires > Date.now()) return local.value as T;
 const value = await work(); values.set(key,{ value, expires: Date.now()+ttl*1000 }); prune(); return value;
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
