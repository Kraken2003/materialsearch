import { createHash } from 'node:crypto';
import { cached, configuredLimit, takeQuota } from './store';
export class UpstreamError extends Error { constructor(public state: 'unavailable' | 'quota-limited', message: string) { super(message); } }
const ALLOWED_HOSTS = new Set(['www.crystallography.net','optimade.materialscloud.org','api.materialsproject.org','api.crossref.org','api.openalex.org']);
const DEFAULT_LIMITS: Record<string,number> = { cod: 300, mcloud: 300, mp: 200, crossref: 400, openalex: 50 };
export async function requestJson(url: string, source = 'cod', headers: Record<string,string> = {}): Promise<any> {
 const parsed = new URL(url);
 if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname) || parsed.port || parsed.username || parsed.password) throw new UpstreamError('unavailable','Invalid source endpoint.');
 const key = createHash('sha256').update(url+JSON.stringify(headers)).digest('hex');
 return cached(key, source === 'crossref' || source === 'openalex' ? 3600 : 900, async () => {
   const day = new Date().toISOString().slice(0,10);
   const seconds = Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-Date.now())/1000);
   if (!await takeQuota(source+':'+day,configuredLimit(source.toUpperCase()+'_DAILY_LIMIT',DEFAULT_LIMITS[source] ?? 100),seconds)) throw new UpstreamError('quota-limited','Daily search allowance reached. Try again after midnight UTC.');
   try {
     const r = await fetch(url, { headers: { Accept:'application/json', 'User-Agent':'MaterialAtlas/0.1'+(process.env.CONTACT_EMAIL ? ' (mailto:'+process.env.CONTACT_EMAIL+')' : ''), ...headers }, signal: AbortSignal.timeout(12000), cache:'no-store', redirect:'error' });
     if (r.status === 429 || r.status === 402) throw new UpstreamError('quota-limited','The source has reached its usage allowance. Try again later.');
     if (!r.ok) throw new UpstreamError('unavailable',r.status === 401 || r.status === 403 ? 'Source access was refused. The site owner should check its API credentials.' : 'The source is temporarily unavailable.');
     if (Number(r.headers.get('content-length')) > 5000000) throw new UpstreamError('unavailable','Source response was too large.');
     const reader = r.body?.getReader(); if (!reader) throw new Error();
     const chunks: Uint8Array[] = []; let size = 0;
     while (true) { const { done,value } = await reader.read(); if (done) break; size += value.length; if (size > 5000000) { await reader.cancel(); throw new Error(); } chunks.push(value); }
     const data = JSON.parse(Buffer.concat(chunks).toString());
     if (!data || typeof data !== 'object') throw new Error();
     return { ...data, __retrievedAt: new Date().toISOString() };
   } catch (e) {
     if (e instanceof UpstreamError) throw e;
     throw new UpstreamError('unavailable','The source did not respond with usable data in time. Try again.');
   }
 });
}
