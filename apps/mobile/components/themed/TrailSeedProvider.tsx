import { mobileComponents } from '@pace-yourself/design-system';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createTrailRandom, drawLaunchSeed, parseTrailSeed, type TrailRandom } from '../../lib/trailSignature';

type TrailSeed = { seed: number; amount: number };

/**
 * One seed per cold launch, drawn when the bundle loads (never during render).
 * `EXPO_PUBLIC_TRAIL_SEED` forces it for screenshots and manual checks.
 */
const LAUNCH_SEED = parseTrailSeed(process.env.EXPO_PUBLIC_TRAIL_SEED) ?? drawLaunchSeed();

const TrailSeedContext = createContext<TrailSeed>({
  seed: LAUNCH_SEED,
  amount: mobileComponents.trailVariation.amount,
});

type Props = {
  children: ReactNode;
  /** Forces the seed (tests, captures). Defaults to the launch seed. */
  seed?: number;
  /** Global variation multiplier, 0 (identical, upright) to 1 (full). */
  amount?: number;
};

/** Shares the session seed that drives every decorative trail variation. */
export function TrailSeedProvider({ children, seed, amount }: Props) {
  const value = useMemo<TrailSeed>(() => ({
    seed: parseTrailSeed(seed) ?? LAUNCH_SEED,
    amount: amount ?? mobileComponents.trailVariation.amount,
  }), [seed, amount]);
  return <TrailSeedContext.Provider value={value}>{children}</TrailSeedContext.Provider>;
}

export function useTrailSeed(): TrailSeed {
  return useContext(TrailSeedContext);
}

/**
 * Decorative randomness for one element, keyed by something stable (label,
 * id). `neutral` (disabled, destructive) returns an upright, unvaried element.
 */
export function useTrailRandom(key: string, options?: { neutral?: boolean }): TrailRandom {
  const { seed, amount } = useTrailSeed();
  const neutral = options?.neutral ?? false;
  return useMemo(() => createTrailRandom(seed, key, neutral ? 0 : amount), [seed, key, neutral, amount]);
}
