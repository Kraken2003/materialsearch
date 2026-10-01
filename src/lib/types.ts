export const MATERIAL_SOURCES = ['cod', 'mcloud', 'mp'] as const;
export type MaterialSource = typeof MATERIAL_SOURCES[number];
export type SourceState = 'ok' | 'empty' | 'unavailable' | 'quota-limited' | 'disabled';
export interface CompositionQuery { include: string[]; exclude: string[]; mode: 'contains' | 'exact'; sources: MaterialSource[] }
export interface Reference { title: string; authors?: string; year?: number; doi?: string; url?: string; kind: 'record' | 'dataset' }
export interface Material {
  id: string; source: MaterialSource; sourceName: string; formula: string; elements: string[];
  sourceUrl: string; name?: string; datasetId?: string; origin?: string;
  properties: { spaceGroup?: string; sites?: number; dimensions?: number; volume?: number; bandGap?: number; energyAboveHull?: number };
  references: Reference[]; license: string; attribution?: string; retrievedAt: string;
}
export interface ProviderInfo { id: MaterialSource; name: string; description: string; enabled: boolean; reason?: string; homepage: string; license: string; attribution: string; termsUrl: string }
export interface SourceStatus { id: string; name: string; state: SourceState; message?: string; total?: number; loaded: number; nextCursor?: string; skipped?: number }
export interface MaterialsResponse { query: CompositionQuery; records: Material[]; sources: SourceStatus[] }
export interface Paper { id: string; title: string; year: number | null; authors: string[]; doi: string | null; url: string; sources: string[]; openAccessUrl: string | null }
export interface PapersResponse { papers: Paper[]; sources: SourceStatus[]; query: string }
