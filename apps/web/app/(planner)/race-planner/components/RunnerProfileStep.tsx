"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { fetchUserProfile, updateUserProfile } from "../../../../lib/profile-client";
import type { UserProfile } from "../../../../lib/profile-types";

export function RunnerProfileStep({ token, locale, onComplete }: {
  token: string; locale: string; onComplete: (profile: UserProfile) => void;
}) {
  const fr = locale === "fr";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchUserProfile(token, controller.signal).then(setProfile).catch(() => {
      if (!controller.signal.aborted) setError(fr ? "Impossible de charger ton profil. Réessaie en rechargeant la page." : "Unable to load your profile. Reload to retry.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, fr]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optional = (key: string) => data.get(key) ? Number(data.get(key)) : null;
    setSaving(true);
    setError(null);
    try {
      const saved = await updateUserProfile(token, {
        fullName: String(data.get("fullName")), birthDate: String(data.get("birthDate") || "") || null,
        weightKg: optional("weightKg"), heightCm: optional("heightCm"), utmbIndex: optional("utmbIndex"),
        waterBagLiters: Number(data.get("waterBagLiters")),
        comfortableFlatPaceMinPerKm: Number(data.get("paceMinutes")) + Number(data.get("paceSeconds")) / 60,
        defaultCarbsGPerHour: Number(data.get("carbs")),
      });
      onComplete(saved);
    } catch {
      setError(fr ? "Vérifie les informations et réessaie." : "Check your details and try again.");
    } finally { setSaving(false); }
  }
  if (loading) return <p role="status">{fr ? "Chargement de ton profil…" : "Loading your profile…"}</p>;
  if (!profile) return <p role="alert">{error}</p>;
  const paceSeconds = Math.round((profile.comfortableFlatPaceMinPerKm ?? 7.5) * 60);
  const fields = [
    { name: "fullName", label: fr ? "Prénom" : "First name", type: "text", value: profile.fullName ?? "", required: true },
    { name: "birthDate", label: fr ? "Date de naissance (facultatif)" : "Birth date (optional)", type: "date", value: profile.birthDate ?? "" },
    { name: "heightCm", label: fr ? "Taille en cm (facultatif)" : "Height in cm (optional)", type: "number", value: profile.heightCm ?? "", min: 100, max: 250 },
    { name: "weightKg", label: fr ? "Poids en kg (facultatif)" : "Weight in kg (optional)", type: "number", value: profile.weightKg ?? "", min: 20, max: 250, step: "0.1" },
    { name: "waterBagLiters", label: fr ? "Capacité en eau (L)" : "Water capacity (L)", type: "number", value: profile.waterBagLiters ?? 1.5, min: 0, max: 20, step: "0.1", required: true },
    { name: "utmbIndex", label: fr ? "Indice UTMB (facultatif)" : "UTMB index (optional)", type: "number", value: profile.utmbIndex ?? "", min: 0, max: 2000 },
    { name: "paceMinutes", label: fr ? "Allure confortable sur plat : minutes/km" : "Comfortable flat pace: minutes/km", type: "number", value: Math.floor(paceSeconds / 60), min: 0, max: 59, required: true },
    { name: "paceSeconds", label: fr ? "Secondes" : "Seconds", type: "number", value: paceSeconds % 60, min: 0, max: 59, required: true },
    { name: "carbs", label: fr ? "Cible glucidique (g/h)" : "Carbohydrate target (g/h)", type: "number", value: profile.defaultCarbsGPerHour ?? 60, min: 0, max: 200, required: true },
  ];
  return <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6">
    <h1 className="text-2xl font-semibold">{fr ? "Ton profil de course" : "Your runner profile"}</h1>
    <p className="text-muted-foreground">{fr ? "Ton allure, ta capacité en eau et ta cible glucidique préparent ton estimation. Les autres informations sont facultatives." : "Your pace, water capacity and carbohydrate target prepare your estimate. Other details are optional."}</p>
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(({ name, label, value, ...props }) => <div key={name} className="space-y-1">
      <Label htmlFor={`runner-${name}`}>{label}</Label><Input id={`runner-${name}`} name={name} defaultValue={value} {...props} />
    </div>)}</div>
    {error ? <p role="alert" className="text-red-600">{error}</p> : null}
    <Button type="submit" disabled={saving}>{saving ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Découvrir mon estimation" : "See my estimate")}</Button>
  </form>;
}
