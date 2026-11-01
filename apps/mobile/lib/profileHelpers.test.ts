import { describe, expect, it } from 'vitest';

import {
  birthDateInputToDate,
  formatBirthDateFromDate,
  resolvePremiumGrantReason,
} from '../components/profile/profileHelpers';

const grantReasonLabels = {
  fallback: 'fallback',
  marketing: 'marketing label',
  other: 'other label',
  partner: 'partner label',
  support: 'support label',
  trialExtension: 'trial extension label',
};

describe('profile date helpers', () => {
  it('converts a stored birth date without shifting the local calendar day', () => {
    const date = birthDateInputToDate('31/12/1990');

    expect(date).not.toBeNull();
    expect(formatBirthDateFromDate(date!)).toBe('31/12/1990');
  });
});

describe('resolvePremiumGrantReason', () => {
  it.each([
    ['trial_extension', 'trial extension label'],
    ['support', 'support label'],
    ['marketing', 'marketing label'],
    ['partner', 'partner label'],
    ['other', 'other label'],
  ])('maps %s to translated copy', (reason, expected) => {
    expect(resolvePremiumGrantReason(reason, grantReasonLabels)).toBe(expected);
  });

  it('never exposes an unknown technical key', () => {
    expect(resolvePremiumGrantReason('internal_unknown_key', grantReasonLabels)).toBe('fallback');
  });
});
