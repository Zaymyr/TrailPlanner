import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./Code.gs', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(`${source}\n;globalThis.__testApi = {
  asBoolean_,
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
