"use client";

import { createContext, useContext } from "react";

/**
 * Access token of the verified admin session, provided by `AdminShell` once the client session is
 * known to be an admin (the server layout already checked the cookie). Pages under `/admin` read it
 * instead of each repeating the session checks.
 */
const AdminAccessContext = createContext<string | null>(null);

export const AdminAccessProvider = AdminAccessContext.Provider;

export function useAdminAccessToken(): string {
  const token = useContext(AdminAccessContext);
  if (!token) throw new Error("useAdminAccessToken must be used inside AdminShell.");
  return token;
}
