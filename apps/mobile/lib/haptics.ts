import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';
import { shouldUseHaptics } from './hapticsPolicy';

async function run(effect: () => Promise<void>) {
  try {
    const reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
    if (!shouldUseHaptics(Platform.OS, reduceMotionEnabled)) return;
    await effect();
  } catch {
    // Haptics are decorative. Unsupported devices and unavailable native modules
    // must never block the user action.
  }
}

export function selectionHaptic() {
  return run(() => Haptics.selectionAsync());
}

export function lightHaptic() {
  return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function successHaptic() {
  return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningHaptic() {
  return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
