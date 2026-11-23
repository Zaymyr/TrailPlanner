import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  billingEditionsResponseSchema,
  billingResponseSchema,
  writeBillingQuery,
  type BillingQuery,
} from "../../../../lib/admin-billing";
import { adminFetch } from "../../publications/publications-api";

/** Register of « Ventes & facturation »; one cache entry per query (the URL of the page). */
export function useBillingRegister(accessToken: string, query: BillingQuery | null) {
  const search = query ? writeBillingQuery(query).toString() : "";
  return useQuery({
    enabled: query !== null,
    queryKey: ["admin", "billing", accessToken, search],
    staleTime: 30_000,
    queryFn: () => adminFetch(accessToken, `/api/admin/billing${search ? `?${search}` : ""}`, billingResponseSchema, {}, "Le registre n’a pas pu être lu."),
  });
}

/** Every matching line of the current view, for the CSV export. */
export const fetchBillingExport = (accessToken: string, query: BillingQuery) => {
  const params = writeBillingQuery({ ...query, page: 1 });
  params.set("export", "1");
  return adminFetch(accessToken, `/api/admin/billing?${params.toString()}`, billingResponseSchema, {}, "L’export n’a pas pu être préparé.");
};

/** Editions for the invoice and bank-transfer pickers (loaded when a dialog opens). */
export function useBillingEditions(accessToken: string, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "billing", "editions", accessToken],
    staleTime: 5 * 60_000,
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/billing/editions", billingEditionsResponseSchema, {}, "Les éditions n’ont pas pu être chargées."),
  });
}

export type ActionResult = { ok: true; data: Record<string, unknown> | null; status: number } | { ok: false; message: string };

/** Calls an existing admin route with the session token; JSON or multipart body. */
export const callAdminRoute = async (
  accessToken: string,
  url: string,
  { method = "POST", json, form }: { method?: string; json?: unknown; form?: FormData } = {},
  fallback = "L’action a échoué.",
): Promise<ActionResult> => {
  try {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, ...(json === undefined ? {} : { "Content-Type": "application/json" }) },
      body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) return { ok: false, message: typeof data?.message === "string" ? data.message : fallback };
    return { ok: true, data, status: response.status };
  } catch {
    return { ok: false, message: `${fallback} Vérifiez votre connexion puis réessayez.` };
  }
};

/** Opens the signed URL returned by an invoice download route (`{ url }`). */
export const openInvoiceDownload = async (accessToken: string, url: string): Promise<string | null> => {
  const result = await callAdminRoute(accessToken, url, { method: "GET" }, "Impossible de télécharger la facture.");
  if (!result.ok) return result.message;
  const target = typeof result.data?.url === "string" ? result.data.url : null;
  if (!target) return "Impossible de télécharger la facture.";
  window.open(target, "_blank", "noopener,noreferrer");
  return null;
};

/**
 * PDF preview of a dialog: POSTs the payload to a preview route (no number allocated, nothing
 * written) and keeps one object URL, revoked when replaced or on unmount.
 */
export function usePdfPreview(accessToken: string) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const replace = useCallback((next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setUrl(next);
  }, []);
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);
  const preview = useCallback(async (route: string, payload: unknown): Promise<string | null> => {
    try {
      const response = await fetch(route, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string } | null;
        return data?.message ?? "Impossible de prévisualiser la facture.";
      }
      replace(URL.createObjectURL(await response.blob()));
      return null;
    } catch {
      return "Impossible de prévisualiser la facture.";
    }
  }, [accessToken, replace]);
  return { url, preview, clear: useCallback(() => replace(null), [replace]) };
}

export const currentParisDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const dayPlusDays = (value: string, days: number) => {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
