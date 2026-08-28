import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./Code.gs', import.meta.url), 'utf8');
const context = vm.createContext({
  console,
  Utilities: {
    Charset: { UTF_8: 'UTF-8' },
    base64Encode: (value) => Buffer.from(value, 'utf8').toString('base64'),
    getUuid: () => '11111111-2222-3333-4444-555555555555',
  },
});
vm.runInContext(`${source}\n;globalThis.__testApi = {
  asBoolean_,
  asDate_,
  buildThreadedDraftRaw_,
  encodeMimeHeader_,
  gmailHeaderValue_,
  headerIncludesEmail_,
  isFollowupEligible_,
  markdownBodyToHtml_,
  parseEventWeek_,
  parseIsoDate_,
  positiveInteger_,
  replaceOrganizationName_,
  sanitizeSignatureHtml_,
  stripMarkdown_,
  timeToMinutes_,
};`, context);

const api = context.__testApi;

test('replaces the Liquid-style organization variable', () => {
  const template = "Un Race Book pour {{organization_name | default: ''}}";
  assert.equal(api.replaceOrganizationName_(template, 'Trail des Anges'), 'Un Race Book pour Trail des Anges');
});

test('converts the supported bold markers to safe HTML', () => {
  assert.equal(
    api.markdownBodyToHtml_('Bonjour **Pace Yourself** & bienvenue'),
    'Bonjour <strong>Pace Yourself</strong> &amp; bienvenue',
  );
  assert.equal(api.stripMarkdown_('Bonjour **Pace Yourself**'), 'Bonjour Pace Yourself');
  assert.equal(api.markdownBodyToHtml_('Ligne 1\n\nLigne 2'), 'Ligne 1<br><br>Ligne 2');
  assert.equal(api.markdownBodyToHtml_('Ligne 1\n\n\nLigne 2'), 'Ligne 1<br><br>Ligne 2');
});

test('accepts only valid exact ISO dates for sheet ingestion', () => {
  assert.equal(api.parseIsoDate_('2027-01-30').toISOString().slice(0, 10), '2027-01-30');
  assert.equal(api.parseIsoDate_('2027-02-30'), null);
  assert.equal(api.parseIsoDate_('janvier 2027'), null);
});

test('preserves Gmail signature icons as HTML entities', () => {
  assert.equal(
    api.sanitizeSignatureHtml_('📅&nbsp;<a href="tel:+336">Téléphone</a>'),
    '&#128197;&nbsp;<a href="tel:+336">Téléphone</a>',
  );
  assert.equal(
    api.sanitizeSignatureHtml_('������&nbsp;<a href="https://pace-yourself.com">Site</a>'),
    '&#127760;&nbsp;<a href="https://pace-yourself.com">Site</a>',
  );
});

test('parses scheduling values conservatively', () => {
  assert.equal(api.asBoolean_('VRAI'), true);
  assert.equal(api.timeToMinutes_('09:30'), 570);
  assert.equal(api.positiveInteger_('1', 150), 1);
  assert.equal(api.positiveInteger_('invalid', 150), 150);
  assert.equal(api.parseEventWeek_('36'), 36);
  assert.equal(api.parseEventWeek_('0'), null);
  assert.equal(api.parseEventWeek_('54'), null);
});

test('selects a follow-up only after the configured delay and without a blocking state', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  const prospect = {
    uuid: 'prospect-1',
    email: 'organizer@example.com',
    lastSentAt: new Date('2026-08-20T12:00:00Z'),
    repliedAt: null,
    hardBouncedAt: null,
    excluded: false,
    optedOut: false,
  };

  assert.equal(api.isFollowupEligible_(prospect, {}, now, 7 * 86400000), true);
  assert.equal(api.isFollowupEligible_({ ...prospect, repliedAt: new Date('2026-08-21T12:00:00Z') }, {}, now, 7 * 86400000), false);
  assert.equal(api.isFollowupEligible_(prospect, { 'prospect-1': true }, now, 7 * 86400000), false);
  assert.equal(api.isFollowupEligible_({ ...prospect, lastSentAt: new Date('2026-08-27T12:00:00Z') }, {}, now, 7 * 86400000), false);
});

test('normalizes spreadsheet date values used by reconciliation', () => {
  assert.equal(api.asDate_('2026-08-28T09:30:00Z').toISOString(), '2026-08-28T09:30:00.000Z');
  assert.equal(api.asDate_(''), null);
  assert.equal(api.asDate_('not-a-date'), null);
});

test('matches the exact prospect address in Gmail message headers', () => {
  assert.equal(api.headerIncludesEmail_('Trail Club <contact@example.com>, autre@example.org', 'contact@example.com'), true);
  assert.equal(api.headerIncludesEmail_('another-contact@example.com', 'contact@example.com'), false);
  assert.equal(api.headerIncludesEmail_('', 'contact@example.com'), false);
});

test('builds a threaded MIME draft without allowing header newlines', () => {
  const raw = api.buildThreadedDraftRaw_({
    recipient: 'contact@example.com\r\nBcc: attacker@example.com',
    sender: 'faustin@pace-yourself.com',
    subject: 'Re: Projet\nInjected',
    messageId: '<original@example.com>',
    references: '<older@example.com> <original@example.com>',
    plainBody: 'Bonjour',
    htmlBody: '<p>Bonjour</p>',
  });
  assert.match(raw, /To: contact@example\.comBcc: attacker@example\.com/);
  assert.doesNotMatch(raw, /\r\nBcc: attacker@example\.com/);
  assert.match(raw, /In-Reply-To: <original@example\.com>/);
  assert.match(raw, /Content-Type: multipart\/alternative/);
});

test('reads Gmail metadata headers case-insensitively', () => {
  assert.equal(api.gmailHeaderValue_([{ name: 'Message-ID', value: '<id@example.com>\r\n' }], 'message-id'), '<id@example.com>');
  assert.equal(api.gmailHeaderValue_([], 'Subject'), '');
});

test('encodes non-ASCII Gmail subjects as MIME headers', () => {
  assert.equal(api.encodeMimeHeader_('Relance'), 'Relance');
  assert.match(api.encodeMimeHeader_('Relance été'), /^=\?UTF-8\?B\?.+\?=$/);
});
