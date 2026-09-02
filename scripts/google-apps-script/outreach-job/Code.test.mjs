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
  SCRAPER_WEBHOOK,
  addBusinessDays_,
  appendUnsubscribeFooter_,
  asBoolean_,
  asDate_,
  buildThreadedDraftRaw_,
  encodeMimeHeader_,
  gmailHeaderValue_,
  headerIncludesEmail_,
  followupTemplateKeyForMessage_,
  followupTemplateKeyForAttempt_,
  followupAttemptFromStatus_,
  followupDraftStatus_,
  followupSentStatus_,
  findNextFollowupAction_,
  isAnyDraftStatus_,
  isAnySentStatus_,
  outreachMode_,
  followupSubject_,
  originalMessageIncludesCourseTest_,
  isFollowupEligible_,
  markdownBodyToHtml_,
  parseEventWeek_,
  parseIsoDate_,
  positiveInteger_,
  readHistory_,
  resolveGmailDraftId_,
  replaceOrganizationName_,
  sanitizeSignatureHtml_,
  stripMarkdown_,
  subjectIncludesOrganization_,
  timeToMinutes_,
};`, context);

const api = context.__testApi;

test('publishes the scraper webhook schema expected by the local client', () => {
  assert.equal(api.SCRAPER_WEBHOOK.schemaVersion, 2);
});

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
  assert.equal(api.outreachMode_('Brouillons'), 'drafts');
  assert.equal(api.outreachMode_('Envoi automatique'), 'automatic');
  assert.throws(() => api.outreachMode_('Test'), /Mode refusé/);
});

test('selects a follow-up only after ten business days and without a blocking state', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  const prospect = {
    uuid: 'prospect-1',
    email: 'organizer@example.com',
    organizationName: 'Trail des Anges',
    lastSentAt: new Date('2026-08-20T12:00:00Z'),
    repliedAt: null,
    hardBouncedAt: null,
    excluded: false,
    optedOut: false,
  };

  assert.equal(api.addBusinessDays_(prospect.lastSentAt, 10).toISOString(), '2026-09-03T12:00:00.000Z');
  assert.equal(api.isFollowupEligible_(prospect, null, now, 10, 3), true);
  assert.equal(api.isFollowupEligible_({ ...prospect, repliedAt: new Date('2026-08-21T12:00:00Z') }, null, now, 10, 3), false);
  assert.equal(api.isFollowupEligible_(prospect, { highestSentAttempt: 3, pendingDraft: null, noResponse: true }, now, 10, 3), false);
  assert.equal(api.isFollowupEligible_({ ...prospect, lastSentAt: new Date('2026-08-21T12:00:00Z') }, null, now, 10, 3), false);
  assert.equal(api.isFollowupEligible_({ ...prospect, organizationName: '' }, null, now, 10, 3), false);
});

test('numbers the three follow-ups while keeping legacy history compatible', () => {
  assert.equal(api.followupAttemptFromStatus_('RELANCE_BROUILLON_CREE'), 1);
  assert.equal(api.followupAttemptFromStatus_('RELANCE_ENVOYEE'), 1);
  assert.equal(api.followupAttemptFromStatus_('RELANCE_2_BROUILLON_CREE'), 2);
  assert.equal(api.followupAttemptFromStatus_('RELANCE_3_ENVOYEE'), 3);
  assert.equal(api.followupAttemptFromStatus_('ENVOI_CONFIRME'), null);
  assert.equal(api.followupDraftStatus_(2), 'RELANCE_2_BROUILLON_CREE');
  assert.equal(api.followupSentStatus_(3), 'RELANCE_3_ENVOYEE');
  assert.equal(api.isAnyDraftStatus_('RELANCE_3_BROUILLON_CREE'), true);
});

test('derives the next follow-up attempt from sent history and pending drafts', () => {
  const rows = [
    ['created_at', 'run_date', 'uuid', 'email', 'organization_name', 'event_date', 'status', 'gmail_draft_id', 'details'],
    [new Date('2026-08-20T10:00:00Z'), '2026-08-20', 'prospect-1', 'one@example.com', 'Course 1', '', 'RELANCE_BROUILLON_CREE', 'draft-1', ''],
    [new Date('2026-08-21T10:00:00Z'), '2026-08-21', 'prospect-1', 'one@example.com', 'Course 1', '', 'RELANCE_ENVOYEE', '', ''],
    [new Date('2026-09-01T10:00:00Z'), '2026-09-01', 'prospect-1', 'one@example.com', 'Course 1', '', 'RELANCE_2_BROUILLON_CREE', 'draft-2', ''],
    [new Date('2026-08-22T10:00:00Z'), '2026-08-22', 'prospect-2', 'two@example.com', 'Course 2', '', 'RELANCE_3_ENVOYEE', '', ''],
    [new Date('2026-09-01T10:00:00Z'), '2026-09-01', 'prospect-2', 'two@example.com', 'Course 2', '', 'PROSPECT_SANS_REPONSE', '', ''],
  ];
  const history = api.readHistory_({ getDataRange: () => ({ getValues: () => rows }) });

  assert.equal(history.followupStatesByUuid['prospect-1'].highestSentAttempt, 1);
  assert.equal(history.followupStatesByUuid['prospect-1'].pendingDraft.followupAttempt, 2);
  assert.equal(history.followupStatesByUuid['prospect-2'].highestSentAttempt, 3);
  assert.equal(history.followupStatesByUuid['prospect-2'].noResponse, true);
  assert.deepEqual(Array.from(history.pendingDrafts, row => row.draftId), ['draft-2']);
  assert.equal(api.isAnySentStatus_('RELANCE_3_ENVOYEE'), true);
  assert.equal(api.isAnySentStatus_('BROUILLON_CREE'), false);
});

test('removes cancelled and confirmed messages from the automatic-send backlog', () => {
  const rows = [
    ['created_at', 'run_date', 'uuid', 'email', 'organization_name', 'event_date', 'status', 'gmail_draft_id', 'details'],
    [new Date('2026-09-01T10:00:00Z'), '2026-09-01', 'prospect-1', 'one@example.com', 'Course 1', '', 'BROUILLON_CREE', 'draft-1', ''],
    [new Date('2026-09-01T10:01:00Z'), '2026-09-01', 'prospect-1', 'one@example.com', 'Course 1', '', 'ENVOI_CONFIRME', '', ''],
    [new Date('2026-09-01T10:02:00Z'), '2026-09-01', 'prospect-2', 'two@example.com', 'Course 2', '', 'RELANCE_2_BROUILLON_CREE', 'draft-2', ''],
    [new Date('2026-09-01T10:03:00Z'), '2026-09-01', 'prospect-2', 'two@example.com', 'Course 2', '', 'ENVOI_ANNULE', 'draft-2', ''],
  ];
  const history = api.readHistory_({ getDataRange: () => ({ getValues: () => rows }) });

  assert.equal(history.pendingDrafts.length, 0);
  assert.equal(history.followupStatesByUuid['prospect-2'].pendingDraft, null);
});

test('resolves tracked Gmail message IDs to API draft IDs across pages', () => {
  const calls = [];
  context.Gmail = {
    Users: {
      Drafts: {
        list: (_userId, options) => {
          calls.push(options);
          if (!options.pageToken) {
            return { drafts: [{ id: 'api-draft-1', message: { id: 'message-1' } }], nextPageToken: 'next' };
          }
          return { drafts: [{ id: 'api-draft-2', message: { id: 'message-2' } }] };
        },
      },
    },
  };

  assert.equal(api.resolveGmailDraftId_('message-2'), 'api-draft-2');
  assert.equal(calls.length, 2);
  assert.equal(api.resolveGmailDraftId_('api-draft-1'), 'api-draft-1');
});

test('resolves private GmailApp draft IDs through their message ID', () => {
  context.GmailApp = {
    getDraft: id => {
      assert.equal(id, 'r-7091178298676085040');
      return { getMessageId: () => 'message-from-gmail-app' };
    },
  };
  context.Gmail = {
    Users: {
      Drafts: {
        list: () => ({ drafts: [{ id: 'api-draft-id', message: { id: 'message-from-gmail-app' } }] }),
      },
    },
  };

  assert.equal(api.resolveGmailDraftId_('r-7091178298676085040'), 'api-draft-id');
});

test('rejects a tracked ID that no longer belongs to a Gmail draft', () => {
  context.GmailApp = { getDraft: () => null };
  context.Gmail = { Users: { Drafts: { list: () => ({ drafts: [] }) } } };
  assert.throws(() => api.resolveGmailDraftId_('missing'), /Brouillon Gmail introuvable/);
});

test('creates the next numbered draft then marks no response after the final delay', () => {
  const values = [
    ['uuid', 'email', 'Organization name', 'outreach_event_date', 'last_sent_email_at', 'replied_at', 'hard_bounced_at', 'excluded', 'opted-out'],
    ['prospect-1', 'one@example.com', 'Course 1', '', new Date('2026-08-20T12:00:00Z'), '', '', false, false],
  ];
  const spreadsheet = {
    getSheetByName: () => ({ getDataRange: () => ({ getValues: () => values }) }),
  };
  const now = new Date('2026-09-03T12:00:00Z');

  const second = api.findNextFollowupAction_(spreadsheet, {
    'prospect-1': { highestSentAttempt: 1, pendingDraft: null, noResponse: false },
  }, now, 10, 3);
  assert.equal(second.type, 'draft');
  assert.equal(second.attempt, 2);

  const final = api.findNextFollowupAction_(spreadsheet, {
    'prospect-1': { highestSentAttempt: 3, pendingDraft: null, noResponse: false },
  }, now, 10, 3);
  assert.equal(final.type, 'mark_no_response');
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

test('chooses the follow-up copy from the actual first sent message', () => {
  const legacyMessage = {
    getSubject: () => 'Racebook mobile pour course et trail',
    getPlainBody: () => 'Je cherche des organisations pilotes. Seriez-vous ouverts à un échange de 15 à 20 minutes ?',
  };
  const testCourseMessage = {
    getSubject: () => 'Un Race Book mobile',
    getPlainBody: () => 'Téléchargez l’application puis recherchez la course « TST ».',
  };

  assert.equal(api.followupTemplateKeyForMessage_(legacyMessage), 'corps_relance_premier_contact');
  assert.equal(api.followupTemplateKeyForMessage_(testCourseMessage), 'corps_relance');
  assert.equal(api.followupTemplateKeyForAttempt_(1, legacyMessage), 'corps_relance_premier_contact');
  assert.equal(api.followupTemplateKeyForAttempt_(2, legacyMessage), 'corps_relance_2');
  assert.equal(api.followupTemplateKeyForAttempt_(3, testCourseMessage), 'corps_relance_3');
  assert.equal(api.originalMessageIncludesCourseTest_('tester ce format sur un événement réel'), false);
  assert.equal(api.originalMessageIncludesCourseTest_('ouvrir la course test'), true);
});

test('builds a standalone follow-up subject when the original Gmail thread is unavailable', () => {
  assert.equal(
    api.followupSubject_({ objet_relance: 'Suite pour {{organization_name}}' }, 'Trail des Anges'),
    'Suite pour Trail des Anges',
  );
  assert.equal(api.followupSubject_({}, 'Trail des Anges'), 'Re: Un Race Book mobile pour Trail des Anges');
});

test('keeps a follow-up threaded only when the subject already identifies the organization', () => {
  assert.equal(
    api.subjectIncludesOrganization_('Re: Un Race Book mobile pour Trail de Trévarez', 'Trail de Trévarez'),
    true,
  );
  assert.equal(
    api.subjectIncludesOrganization_('Racebook mobile pour course et trail', 'Trail de Trévarez'),
    false,
  );
});

test('adds a visible unsubscribe link to plain-text and HTML drafts', () => {
  const content = api.appendUnsubscribeFooter_(
    'Bonjour',
    '<p>Bonjour</p>',
    'https://example.com/unsubscribe?token=a&uuid=b',
    'Me désinscrire',
  );
  assert.match(content.plainBody, /Me désinscrire : https:\/\/example\.com\/unsubscribe\?token=a&uuid=b/);
  assert.match(content.htmlBody, /href="https:\/\/example\.com\/unsubscribe\?token=a&amp;uuid=b"/);
  assert.match(content.htmlBody, />Me désinscrire<\/a>/);
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
