import { expect, it } from 'vitest';
import { referenceLink } from '../src/lib/papers';
it('uses a supplied DOI as a direct publication link',()=>{
 expect(referenceLink({title:'Spinel composite',doi:'https://doi.org/10.123/ABC',kind:'record'})).toEqual({url:'https://doi.org/10.123/abc',kind:'direct'});
});
it('makes a reference without a DOI or URL searchable by its full title',()=>{
 const link=referenceLink({title:'A new metal–spinel composite',kind:'record'});
 expect(link.kind).toBe('search');
 expect(new URL(link.url).hostname).toBe('scholar.google.com');
 expect(new URL(link.url).searchParams.get('q')).toBe('"A new metal–spinel composite"');
});
it('keeps supplied safe URLs and replaces unsafe URLs with a search link',()=>{
 expect(referenceLink({title:'Paper',url:'https://example.org/paper',kind:'record'})).toEqual({url:'https://example.org/paper',kind:'direct'});
 expect(referenceLink({title:'Paper',url:'javascript:alert(1)',kind:'record'}).kind).toBe('search');
});
