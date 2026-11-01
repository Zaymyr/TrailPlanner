export function shouldUseHaptics(platform: string, reduceMotionEnabled: boolean) {
  return platform !== 'web' && !reduceMotionEnabled;
}
