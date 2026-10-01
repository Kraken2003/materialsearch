import { guard, readBody, apiError } from '@/server/api';
import { searchPapers, validatePaperQuery } from '@/server/literature';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
 try {await guard(request);return Response.json(await searchPapers(validatePaperQuery(await readBody(request))),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return apiError(error);}
}
