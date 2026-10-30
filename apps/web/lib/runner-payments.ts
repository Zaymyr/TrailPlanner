type RevenueCatPurchase = { id?: string; transaction_identifier?: string; purchase_date?: string; store_transaction_id?: string; store?: string };

export function findVerifiedCoursePurchase(
  subscriber: { non_subscriptions?: Record<string, RevenueCatPurchase[]> } | null | undefined,
  productId: string,
  transactionId: string | null,
  intentCreatedAt: string,
  provider?: 'google' | 'apple'
) {
  const purchases = subscriber?.non_subscriptions?.[productId] ?? [];
  const intentTime = Date.parse(intentCreatedAt);
  return purchases.filter((purchase) => {
    const matches = transactionId === null || purchase.transaction_identifier === transactionId || purchase.store_transaction_id === transactionId || purchase.id === transactionId;
    if (!matches) return false;
    const store = purchase.store?.trim().toUpperCase();
    if (provider && (!store || (provider === 'google' && store !== 'PLAY_STORE') || (provider === 'apple' && !['APP_STORE', 'MAC_APP_STORE'].includes(store)))) return false;
    if (!purchase.purchase_date || !Number.isFinite(intentTime)) return false;
    const purchaseTime = Date.parse(purchase.purchase_date);
    return Number.isFinite(purchaseTime) && purchaseTime >= intentTime;
  }).sort((a, b) => Date.parse(a.purchase_date ?? "") - Date.parse(b.purchase_date ?? ""))[0] ?? null;
}

export function getRevenueCatTransactionId(purchase: RevenueCatPurchase | null | undefined) {
  return purchase?.transaction_identifier ?? purchase?.store_transaction_id ?? purchase?.id ?? null;
}

export function canClaimUnlock(existing: { user_id: string; plan_id: string; status: string } | null, userId: string, planId: string) {
  if (!existing) return true;
  return existing.user_id === userId && existing.plan_id === planId && existing.status === 'active';
}
