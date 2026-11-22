"use client";

import { BillingRegister } from "../_components/billing/BillingRegister";
import { useAdminAccessToken } from "../_components/shell/AdminAccess";

/** Ventes & facturation (lot 4): the single register of every transaction and the billing actions. */
export default function AdminBillingPage() {
  const accessToken = useAdminAccessToken();
  return <BillingRegister accessToken={accessToken} />;
}
