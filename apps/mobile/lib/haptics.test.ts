import { describe, expect, it } from 'vitest';

import { shouldUseHaptics } from './hapticsPolicy';

describe('haptics availability', () => {
  it('disables decorative feedback on web and with reduced motion', () => {
    expect(shouldUseHaptics('web', false)).toBe(false);
    expect(shouldUseHaptics('ios', true)).toBe(false);
  });

  it('enables native feedback otherwise', () => {
    expect(shouldUseHaptics('android', false)).toBe(true);
  });
});
