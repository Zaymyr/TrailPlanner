import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  digestStringAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: mocks.digestStringAsync,
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: mocks.getItemAsync,
  setItemAsync: mocks.setItemAsync,
}));

vi.mock('./appSession', () => ({
  isAnonymousSession: () => false,
}));

vi.mock('./webApi', () => ({
  WEB_API_BASE_URL: 'https://pace-yourself.test',
}));

import { syncResendContactRegistration } from './resendContactSync';

function identifiedSession(): Session {
  return {
    access_token: 'test-access-token',
    user: {
      id: '9cc2575d-3a0c-4bee-81fc-99731875c66e',
      email: 'Runner+Mobile@Example.com',
    },
  } as Session;
}

describe('syncResendContactRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.digestStringAsync.mockResolvedValue('abc123');
    mocks.getItemAsync.mockResolvedValue(null);
    mocks.setItemAsync.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ synced: true }),
    }));
  });

  it('uses a SecureStore-compatible hashed email key and records a successful sync', async () => {
    await syncResendContactRegistration(identifiedSession());

    expect(mocks.digestStringAsync).toHaveBeenCalledWith(
      'SHA256',
      'runner+mobile@example.com',
    );
    expect(mocks.getItemAsync).toHaveBeenCalledWith(
      'resend-contact-synced.9cc2575d-3a0c-4bee-81fc-99731875c66e.abc123',
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://pace-yourself.test/api/resend/contact',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-access-token' },
        method: 'POST',
      }),
    );
    expect(mocks.setItemAsync).toHaveBeenCalledWith(
      'resend-contact-synced.9cc2575d-3a0c-4bee-81fc-99731875c66e.abc123',
      expect.any(String),
    );
  });

  it('does not call the API again when the user and email were already synced', async () => {
    mocks.getItemAsync.mockResolvedValue('2026-09-23T12:00:00.000Z');

    await syncResendContactRegistration(identifiedSession());

    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.setItemAsync).not.toHaveBeenCalled();
  });
});
