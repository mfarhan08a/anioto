import { describe, expect, it } from 'vitest';
import { resolveSupplemental } from '../src/providers/supplemental-songs';

describe('supplemental song associations', () => {
  it('confirms the exact title and registered compound artist credit', () => {
    expect(resolveSupplemental({
      title: 'I Really Want to Stay At Your House',
      artist: 'Rosa Walton & Hallie Coggins',
    })).toMatchObject([{
      id: -1001,
      title: 'Cyberpunk: Edgerunners',
      type: 'Featured song',
      matchKind: 'confirmed',
      sourceUrl: 'https://www.youtube.com/watch?v=h4VJGNNSQnw',
    }]);
  });

  it('confirms a reviewed individual artist alias', () => {
    expect(resolveSupplemental({
      title: 'I Really Want To Stay at Your House',
      artist: 'Rosa Walton',
    })).toMatchObject([{ title: 'Cyberpunk: Edgerunners', matchKind: 'confirmed' }]);
  });

  it('matches an explicit acoustic version only for a registered artist alias', () => {
    expect(resolveSupplemental({
      title: 'I Really Want to Stay At Your House (Acoustic Version)',
      artist: 'Rosa Walton',
    })).toMatchObject([{ title: 'Cyberpunk: Edgerunners', matchKind: 'version' }]);
  });

  it('labels an exact title by a different cover artist as possible', () => {
    expect(resolveSupplemental({
      title: 'I Really Want to Stay At Your House (Cover)',
      artist: 'Another Singer',
    })).toMatchObject([{ title: 'Cyberpunk: Edgerunners', matchKind: 'possible' }]);
  });

  it('does not resolve title fragments or unknown songs', () => {
    expect(resolveSupplemental({ title: 'Really Want to Stay At Your House', artist: 'Rosa Walton' })).toEqual([]);
    expect(resolveSupplemental({ title: 'Unlisted song', artist: 'Unknown artist' })).toEqual([]);
  });

  it('requires the credited artist for the shared title Ta ga Tame', () => {
    expect(resolveSupplemental({ title: 'Ta ga Tame', artist: 'Megatera Zero' })).toEqual([]);
  });
});

 it('resolves an acoustic cover title without treating its performer as the original', () => {
   expect(resolveSupplemental({ title: 'I Really Want to Stay At Your House (Acoustic Cover)', artist: 'saewool' }))
     .toMatchObject([{ title: 'Cyberpunk: Edgerunners', matchKind: 'possible', type: 'Featured song' }]);
 });
