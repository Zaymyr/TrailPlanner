#!/usr/bin/env node

import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node ./scripts/generate-apple-client-secret.mjs --key <path-to-.p8> --team-id <APPLE_TEAM_ID> --client-id <APPLE_CLIENT_ID> [--key-id <APPLE_KEY_ID>] [--expires-in-days <1-180>]',
      '',
      'Notes:',
      '  - For Apple OAuth with Supabase, the client secret must be signed with ES256.',
      '  - Apple only allows a maximum lifetime of 180 days.',
      '  - If --key-id is omitted, the script tries to extract it from a filename like AuthKey_XXXXXXXXXX.p8.',
    ].join('\n')
  );
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireArg(flag) {
  const value = getArg(flag);
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function inferKeyId(keyPath) {
  const match = basename(keyPath).match(/^AuthKey_([A-Z0-9]+)\.p8$/i);
  return match?.[1];
}

function normalizeDays(rawValue) {
  const days = Number.parseInt(rawValue ?? '180', 10);
  if (!Number.isFinite(days) || days < 1 || days > 180) {
    throw new Error('--expires-in-days must be an integer between 1 and 180');
  }
  return days;
}

try {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const keyPath = requireArg('--key');
  const teamId = requireArg('--team-id');
  const clientId = requireArg('--client-id');
  const keyId = getArg('--key-id') ?? inferKeyId(keyPath);
  const expiresInDays = normalizeDays(getArg('--expires-in-days'));

  if (!keyId) {
    throw new Error(
      'Unable to infer the Apple key id from the filename. Pass it explicitly with --key-id.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInDays * 24 * 60 * 60;

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyPem = readFileSync(resolve(keyPath), 'utf8');
  const privateKey = createPrivateKey(privateKeyPem);
  const signature = sign('sha256', Buffer.from(signingInput), privateKey);
  const encodedSignature = base64UrlEncode(signature);
  const token = `${signingInput}.${encodedSignature}`;

  const publicKey = createPublicKey(privateKey);
  const verified = verify('sha256', Buffer.from(signingInput), publicKey, signature);
  if (!verified) {
    throw new Error('Generated signature could not be verified locally.');
  }

  console.error(
    JSON.stringify(
      {
        keyId,
        clientId,
        teamId,
        expiresAtIso: new Date(exp * 1000).toISOString(),
      },
      null,
      2
    )
  );
  process.stdout.write(`${token}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  printUsage();
  process.exit(1);
}
