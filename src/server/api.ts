import { createHash } from 'node:crypto';
import { InputError } from '../lib/search';
import { configuredLimit, takeQuota } from './store';
export class ConfigurationError extends Error {}
export class RequestLimitError extends Error {}
export async function guard(request: Request): Promise<void> {
 const client = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown' : 'shared-local';
 const hash = createHash('sha256').update(client).digest('hex').slice(0,24);
 const minute = Math.floor(Date.now()/60000);
 if (!await takeQuota('client:'+hash+':'+minute,configuredLimit('CLIENT_REQUESTS_PER_MINUTE',12,60),70)) throw new RequestLimitError('Too many searches. Wait a minute and try again.');
 const day = new Date().toISOString().slice(0,10);
 const seconds = Math.ceil((Date.parse(day+'T00:00:00Z')+86400000-Date.now())/1000);
 if (!await takeQuota('public:'+day,configuredLimit('PUBLIC_REQUESTS_PER_DAY',1000),seconds)) throw new RequestLimitError('The site has reached its daily search allowance. Try again after midnight UTC.');
 if (process.env.NODE_ENV === 'production' && (!process.env.CURSOR_SECRET || process.env.CURSOR_SECRET.length < 32)) throw new ConfigurationError('Search configuration is incomplete. Contact the site owner.');
}
export async function readBody(request: Request): Promise<Record<string,unknown>> {
 if (!request.headers.get('content-type')?.includes('application/json')) throw new InputError('Send a JSON request.');
 if (Number(request.headers.get('content-length')) > 16384) throw new InputError('Request is too large.');
 const reader = request.body?.getReader(); if (!reader) throw new InputError('Request body is missing.');
 const chunks: Uint8Array[] = []; let size = 0;
 while(true) {
   const {done,value}=await reader.read(); if(done) break;
   size += value.length; if(size>16384) {await reader.cancel();throw new InputError('Request is too large.');}
   chunks.push(value);
 }
 try {const body = JSON.parse(Buffer.concat(chunks).toString()); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body;} catch {throw new InputError('Provide a valid JSON object.');}
}
export function apiError(error: unknown): Response {
 const status = error instanceof InputError ? 400 : error instanceof RequestLimitError ? 429 : 503;
 const message = error instanceof InputError || error instanceof RequestLimitError || error instanceof ConfigurationError ? error.message : 'Search is temporarily unavailable. Try again later.';
 return Response.json({error:message},{status,headers:{'Cache-Control':'no-store',...(status === 429 ? {'Retry-After':'60'} : {})}});
}
