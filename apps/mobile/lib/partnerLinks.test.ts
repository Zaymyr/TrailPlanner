import { describe, expect, it } from 'vitest';

import { normalizeResolvedPartnerLinks } from './partnerLinks';

describe('normalizeResolvedPartnerLinks', () => {
  it('keeps one valid HTTPS destination per supported partner', () => {
    expect(normalizeResolvedPartnerLinks({
      links: [
        { partnerKey: 'booking', url: 'https://www.booking.com/', isAffiliate: false },
        { partnerKey: 'booking', url: 'https://duplicate.example/', isAffiliate: true },
        { partnerKey: 'decathlon', url: 'https://www.decathlon.fr/', isAffiliate: true },
      ],
    })).toEqual([
      { partnerKey: 'booking', url: 'https://www.booking.com/', isAffiliate: false },
      { partnerKey: 'decathlon', url: 'https://www.decathlon.fr/', isAffiliate: true },
    ]);
  });

  it('rejects malformed, unsupported, and non-HTTPS destinations', () => {
    expect(normalizeResolvedPartnerLinks({
      links: [
        { partnerKey: 'booking', url: 'http://www.booking.com/', isAffiliate: false },
        { partnerKey: 'other', url: 'https://example.com/', isAffiliate: false },
        { partnerKey: 'decathlon', url: 'not-a-url', isAffiliate: false },
      ],
    })).toEqual([]);
  });
});
