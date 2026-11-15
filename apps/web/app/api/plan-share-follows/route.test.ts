import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/http', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/http')>('../../../lib/http');
  return {
    ...actual,
    checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

import { GET as getFollowedPlan } from './[id]/route';
import { POST } from './route';

const userId = '11111111-1111-4111-8111-111111111111';
const linkId = '22222222-2222-4222-8222-222222222222';
const followId = '33333333-3333-4333-8333-333333333333';
const token = 'abcdefghijklmnopqrstuvwx';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('plan-share follow routes', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('rejects unauthenticated follow attempts', async () => {
    const response = await POST(new Request('https://app.test/api/plan-share-follows', {
      method: 'POST', body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(401);
  });

  it('rejects anonymous Supabase sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      id: userId,
      is_anonymous: true,
      app_metadata: { provider: 'anonymous' },
    })));
    const response = await POST(new Request('https://app.test/api/plan-share-follows', {
      method: 'POST', headers: { Authorization: 'Bearer guest' }, body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(401);
  });

  it('rejects following your own plan', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: userId, app_metadata: {} }))
      .mockResolvedValueOnce(jsonResponse([{ id: linkId, user_id: userId }]));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(new Request('https://app.test/api/plan-share-follows', {
      method: 'POST', headers: { Authorization: 'Bearer access' }, body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not follow a revoked or expired link', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: userId, app_metadata: {} }))
      .mockResolvedValueOnce(jsonResponse([])));
    const response = await POST(new Request('https://app.test/api/plan-share-follows', {
      method: 'POST', headers: { Authorization: 'Bearer access' }, body: JSON.stringify({ token }),
    }));
    expect(response.status).toBe(404);
  });

  it('cuts detailed access after owner removal', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: userId, app_metadata: {} }))
      .mockResolvedValueOnce(jsonResponse([{
        id: followId,
        share_link_id: linkId,
        nickname: null,
        created_at: '2026-11-15T10:00:00.000Z',
        archived_at: null,
        removed_at: '2026-11-15T11:00:00.000Z',
        plan_share_links: {
          id: linkId,
          user_id: '44444444-4444-4444-8444-444444444444',
          snapshot: { name: 'Plan', distanceKm: 42, elevationGainM: 1200 },
          crew_state: { passages: [] },
          departure_time: '08:00',
          locale: 'fr',
          expires_at: null,
          revoked_at: null,
        },
      }])));
    const response = await getFollowedPlan(
      new Request(`https://app.test/api/plan-share-follows/${followId}`, { headers: { Authorization: 'Bearer access' } }),
      { params: { id: followId } },
    );
    expect(response.status).toBe(410);
  });
});
