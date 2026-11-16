import { describe, expect, it } from 'vitest';
import { identity, parsePersonal, safeUrl } from '../src/personal';
describe('personal match boundaries',()=>{
it('rejects executable links and malformed imports',()=>{expect(safeUrl('javascript:alert(1)')).toBeUndefined();expect(()=>parsePersonal([{song:{title:'a',artist:'b'},anime:{title:'c',sourceUrl:'http://example.com'}}])).toThrow();expect(()=>parsePersonal(null)).toThrow();});
it('strips untrusted extra fields and source claims',()=>{const result=parsePersonal([{song:{title:' a ',artist:'b',apiKey:'private'},anime:{title:'c',sourceUrl:'https://example.com',evidence:'verified'}}]);expect(result[0]!.anime.evidence).toBe('Your saved match');expect(JSON.stringify(result)).not.toContain('private');});
it('normalizes width and whitespace for personal matching',()=>{expect(identity({title:' Ａ ',artist:'Artist'})).toBe(identity({title:'a',artist:'artist'}));});
});

