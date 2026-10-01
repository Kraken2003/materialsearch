import { providers } from '@/server/providers';
export const dynamic = 'force-dynamic';
export async function GET() {
 const configured = process.env.NODE_ENV !== 'production' || (!!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN && (process.env.CURSOR_SECRET?.length ?? 0) >= 32);
 return Response.json({providers:providers(),searchReady:configured,literature:[{id:'crossref',name:'Crossref',enabled:true},{id:'openalex',name:'OpenAlex',enabled:!!process.env.OPENALEX_API_KEY}]},{headers:{'Cache-Control':'no-store'}});
}
