import { describe, expect, it } from 'vitest';

import { resolveRacebookTheme } from '@pace-yourself/design-system';

function luminance(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left: string, right: string) {
  const leftLuminance = luminance(left);
  const rightLuminance = luminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
}

describe('RaceBook branding theme', () => {
  it('keeps a valid published edition logo available to the mobile presentation', () => {
    expect(resolveRacebookTheme({ logoUrl: ' https://example.com/tst-logo.png ' }).logoUrl).toBe(
      'https://example.com/tst-logo.png',
    );
  });

  it('derives readable text and graphic variants from a bright organizer accent', () => {
    const theme = resolveRacebookTheme({ primaryColor: '#0000FF', accentColor: '#FFFF00' });

    expect(theme.accentColor).toBe('#FFFF00');
    expect(contrast(theme.accentForegroundColor, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accentGraphicColor, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(theme.onAccentColor).toBe('#1A1A1A');
  });
});
