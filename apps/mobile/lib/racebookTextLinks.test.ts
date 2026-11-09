import { describe, expect, it } from 'vitest';

import { buildMapsSearchUrl, extractTextLinks } from './racebookTextLinks';

describe('buildMapsSearchUrl', () => {
  it('encodes a plain address as a maps search', () => {
    expect(buildMapsSearchUrl('Musée de Bibracte, 71990 Saint-Léger')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Mus%C3%A9e%20de%20Bibracte%2C%2071990%20Saint-L%C3%A9ger',
    );
  });

  it('returns null for an empty address', () => {
    expect(buildMapsSearchUrl('  ')).toBeNull();
    expect(buildMapsSearchUrl(null)).toBeNull();
  });
});

describe('extractTextLinks', () => {
  it('replaces a URL with its host and returns it as a link', () => {
    const result = extractTextLinks('Payantes — 5 € à réserver sur https://www.helloasso.com/associations/x/paiements/navette.');
    expect(result.text).toBe('Payantes — 5 € à réserver sur helloasso.com.');
    expect(result.links).toEqual([{ url: 'https://www.helloasso.com/associations/x/paiements/navette', host: 'helloasso.com' }]);
  });

  it('keeps text without URLs unchanged', () => {
    expect(extractTextLinks('Parking gratuit au stade')).toEqual({ text: 'Parking gratuit au stade', links: [] });
  });

  it('deduplicates repeated URLs', () => {
    const result = extractTextLinks('Voir https://a.fr/x et https://a.fr/x');
    expect(result.links).toHaveLength(1);
  });
});
