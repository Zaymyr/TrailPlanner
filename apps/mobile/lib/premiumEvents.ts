import type { CustomerInfo } from 'react-native-purchases';

type PremiumStatusChangeEvent = {
  customerInfo?: CustomerInfo | null;
};

const premiumStatusChangeListeners = new Set<(event: PremiumStatusChangeEvent) => void>();

export function emitPremiumStatusChange(event: PremiumStatusChangeEvent = {}) {
  for (const listener of premiumStatusChangeListeners) {
    listener(event);
  }
}

export function addPremiumStatusChangeListener(listener: (event: PremiumStatusChangeEvent) => void) {
  premiumStatusChangeListeners.add(listener);

  return () => {
    premiumStatusChangeListeners.delete(listener);
  };
}
