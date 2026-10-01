import { guard, readBody, apiError } from '@/server/api';
import { InputError, validateQuery } from '@/lib/search';
import { searchMaterials } from '@/server/materials';
import { MATERIAL_SOURCES, type MaterialSource } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
 try {
   await guard(request);
   const body = await readBody(request); const query = validateQuery(body);
   const cursors = body.cursors ?? {};
   if (!cursors || typeof cursors !== 'object' || Array.isArray(cursors) || Object.entries(cursors).some(([id,c])=>!MATERIAL_SOURCES.includes(id as MaterialSource) || typeof c !== 'string' || c.length > 6000 || !query.sources.includes(id as MaterialSource))) throw new InputError('Invalid pagination cursors.');
   return Response.json(await searchMaterials(query,cursors as Partial<Record<MaterialSource,string>>),{headers:{'Cache-Control':'no-store'}});
 } catch (error) {return apiError(error);}
}
