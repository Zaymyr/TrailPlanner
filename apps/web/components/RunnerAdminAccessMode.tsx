"use client";

import { useEffect, useState } from "react";
import { useVerifiedSession } from "../app/hooks/useVerifiedSession";
import { useI18n } from "../app/i18n-provider";
import { Label } from "./ui/label";

export function RunnerAdminAccessMode() {
  const { session, refreshEntitlements } = useVerifiedSession();
  const { locale } = useI18n();
  const admin = session?.role === "admin" || session?.roles?.includes("admin");
  const [mode, setMode] = useState("real");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!admin || !session?.accessToken) return;
    const controller = new AbortController();
    fetch("/api/admin/runner-access-mode", { headers: { Authorization: `Bearer ${session.accessToken}` }, signal: controller.signal }).then(async (response) => {
      if (response.ok) setMode((await response.json()).mode);
    }).catch(() => {});
    return () => controller.abort();
  }, [admin, session?.accessToken]);
  if (!admin) return null;
  return <section className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
    <Label htmlFor="runner-access-mode">{locale === "fr" ? "Mode de test des accès" : "Test access mode"}</Label>
    <select id="runner-access-mode" value={mode} disabled={saving} className="ml-3 rounded border p-2" onChange={async (event) => {
      const next = event.target.value;
      setSaving(true); setError(false);
      try {
        const response = await fetch("/api/admin/runner-access-mode", { method: "PUT", headers: { Authorization: `Bearer ${session!.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ mode: next }) });
        if (!response.ok) throw new Error("Simulation unavailable");
        setMode(next); await refreshEntitlements(session!.accessToken);
        window.dispatchEvent(new Event("runner-access-updated"));
      } catch { setError(true); } finally { setSaving(false); }
    }}><option value="real">{locale === "fr" ? "Réel" : "Real"}</option><option value="free">{locale === "fr" ? "Gratuit" : "Free"}</option><option value="premium">Premium</option></select>
    {mode !== "real" ? <p role="status">{locale === "fr" ? "Simulation active — paiements désactivés." : "Simulation active — payments disabled."}</p> : null}
    {error ? <p role="alert">{locale === "fr" ? "Impossible de changer le mode." : "Unable to change mode."}</p> : null}
  </section>;
}
