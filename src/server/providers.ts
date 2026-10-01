import type { ProviderInfo, MaterialSource } from '../lib/types';
export const ENDPOINTS: Record<MaterialSource,string> = {
 cod: 'https://www.crystallography.net/cod/optimade/v1/structures',
 mcloud: 'https://optimade.materialscloud.org/main/mc3d-pbe-v1/v1/structures',
 mp: 'https://api.materialsproject.org/materials/summary/',
};
export function providers(): ProviderInfo[] {
 const mpAllowed = process.env.NODE_ENV !== 'production' || process.env.MP_PUBLIC_USE_CONFIRMED === 'true';
 return [
 { id:'cod',name:'Crystallography Open Database', description:'Experimental crystal structures',enabled:true,homepage:'https://www.crystallography.net/cod/',license:'CC0 1.0',attribution:'Crystallography Open Database and the original structural-data authors.',termsUrl:'https://www.crystallography.net/cod/' },
 { id:'mcloud',name:'Materials Cloud', description:'MC3D PBE-v1 calculated structures',enabled:true,homepage:'https://www.materialscloud.org/discover/mc3d',license:'CC BY 4.0',attribution:'Huber et al., MC3D, Materials Cloud Archive 2025.139, doi:10.24435/materialscloud:jn-ac. Normalized metadata from the PBE-v1 OPTIMADE dataset.',termsUrl:'https://archive.materialscloud.org/records/szjaf-cfv74' },
 { id:'mp',name:'Materials Project',description:'Computed materials and properties',enabled:!!process.env.MP_API_KEY && mpAllowed,reason:!process.env.MP_API_KEY ? 'API key not configured by site owner.' : !mpAllowed ? 'Public use of this account must be confirmed by the site owner.' : undefined,homepage:'https://materialsproject.org',license:'Materials Project terms; dataset-specific restrictions may apply',attribution:'Materials Project. See the original record for citations and dataset restrictions.',termsUrl:'https://next-gen.materialsproject.org/terms' },
 ];
}
