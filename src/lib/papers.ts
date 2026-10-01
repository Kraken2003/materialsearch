import type { Paper } from './types';
export function normalizedDoi(doi: string | null): string | null {
 return doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase() || null;
}
export function safeUrl(value: unknown): string | undefined {
 if (typeof value !== 'string') return;
 try { const url = new URL(value); if (url.protocol === 'https:' || url.protocol === 'http:') return url.href; } catch {}
}
export function deduplicatePapers(papers: Paper[]): Paper[] {
 const result: Paper[] = [];
 for (const paper of papers) {
   const doi = normalizedDoi(paper.doi);
   const titleKey = paper.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')+':'+paper.year;
   const existing = result.find(p => (doi && normalizedDoi(p.doi) === doi) || ((!doi || !p.doi) && p.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')+':'+p.year === titleKey));
   if (existing) { existing.sources = [...new Set([...existing.sources,...paper.sources])]; existing.doi ||= doi; existing.openAccessUrl ||= paper.openAccessUrl; }
   else result.push({ ...paper, doi, sources: [...paper.sources] });
 }
 return result;
}
