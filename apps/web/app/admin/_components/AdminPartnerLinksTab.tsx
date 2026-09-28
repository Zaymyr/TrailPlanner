"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  type PartnerKey,
  type PartnerLinkSetting,
  partnerLinkSettingsResponseSchema,
  resolvePartnerLinkUrl,
} from "../../../lib/partner-links";
import { useI18n } from "../../i18n-provider";

type EditableSetting = Omit<PartnerLinkSetting, "updatedAt">;

const PARTNER_KEYS: PartnerKey[] = ["booking", "decathlon"];

export function AdminPartnerLinksTab({ accessToken }: { accessToken: string | null }) {
  const { t } = useI18n();
  const copy = t.admin.partnerLinks;
  const [drafts, setDrafts] = useState<Partial<Record<PartnerKey, EditableSetting>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["admin", "partner-links", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      if (!accessToken) throw new Error(copy.loadError);
      const response = await fetch("/api/admin/partner-links", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? copy.loadError);
      const parsed = partnerLinkSettingsResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error(copy.loadError);
      return parsed.data.settings;
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDrafts(Object.fromEntries(settingsQuery.data.map(({ updatedAt: _updatedAt, ...setting }) => [setting.partnerKey, setting])));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (settings: EditableSetting[]) => {
      if (!accessToken) throw new Error(copy.saveError);
      const response = await fetch("/api/admin/partner-links", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? copy.saveError);
      const parsed = partnerLinkSettingsResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error(copy.saveError);
      return parsed.data.settings;
    },
    onSuccess: (settings) => {
      setError(null);
      setMessage(copy.saved);
      setDrafts(Object.fromEntries(settings.map(({ updatedAt: _updatedAt, ...setting }) => [setting.partnerKey, setting])));
      void settingsQuery.refetch();
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof Error ? caught.message : copy.saveError);
    },
  });

  function updateDraft(partnerKey: PartnerKey, patch: Partial<EditableSetting>) {
    setMessage(null);
    setError(null);
    setDrafts((current) => ({
      ...current,
      [partnerKey]: current[partnerKey] ? { ...current[partnerKey], ...patch } : current[partnerKey],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const settings = PARTNER_KEYS.map((key) => drafts[key]).filter((setting): setting is EditableSetting => Boolean(setting));
    if (settings.length !== PARTNER_KEYS.length) return;
    saveMutation.mutate(settings);
  }

  if (settingsQuery.isLoading) return <p className="text-sm text-muted-foreground">{copy.loading}</p>;
  if (settingsQuery.isError) {
    const queryError = settingsQuery.error instanceof Error ? settingsQuery.error.message : copy.loadError;
    return <p className="text-sm text-red-600 dark:text-red-300">{queryError}</p>;
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{copy.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PARTNER_KEYS.map((partnerKey) => {
          const setting = drafts[partnerKey];
          if (!setting) return null;
          const partnerCopy = copy.partners[partnerKey];
          const activeUrl = resolvePartnerLinkUrl({ ...setting, updatedAt: "" });

          return (
            <Card key={partnerKey}>
              <CardHeader>
                <CardTitle>{partnerCopy.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{partnerCopy.description}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="flex items-start gap-3 rounded-md border border-border p-3">
                  <input
                    className="mt-1 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={setting.isEnabled}
                    onChange={(event) => updateDraft(partnerKey, { isEnabled: event.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{copy.enabledLabel}</span>
                    <span className="block text-xs text-muted-foreground">{copy.enabledHint}</span>
                  </span>
                </label>

                <div className="space-y-2">
                  <Label htmlFor={`${partnerKey}-standard-url`}>{copy.standardUrlLabel}</Label>
                  <Input
                    id={`${partnerKey}-standard-url`}
                    type="url"
                    required
                    value={setting.standardUrl}
                    onChange={(event) => updateDraft(partnerKey, { standardUrl: event.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{copy.standardUrlHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${partnerKey}-affiliate-url`}>{copy.affiliateUrlLabel}</Label>
                  <Input
                    id={`${partnerKey}-affiliate-url`}
                    type="url"
                    value={setting.affiliateUrl ?? ""}
                    placeholder={copy.affiliateUrlPlaceholder}
                    onChange={(event) => {
                      const affiliateUrl = event.target.value || null;
                      updateDraft(partnerKey, {
                        affiliateUrl,
                        ...(affiliateUrl ? {} : { affiliateEnabled: false }),
                      });
                    }}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-md border border-border p-3">
                  <input
                    className="mt-1 h-4 w-4 accent-brand"
                    type="checkbox"
                    checked={setting.affiliateEnabled}
                    disabled={!setting.affiliateUrl}
                    onChange={(event) => updateDraft(partnerKey, { affiliateEnabled: event.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{copy.affiliateEnabledLabel}</span>
                    <span className="block text-xs text-muted-foreground">{copy.affiliateEnabledHint}</span>
                  </span>
                </label>

                <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{copy.activeUrlLabel}</span>{" "}
                  {activeUrl ? (
                    <a className="break-all text-brand underline-offset-4 hover:underline" href={activeUrl} target="_blank" rel="noreferrer">
                      {activeUrl}
                    </a>
                  ) : copy.disabledStatus}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <Button type="submit" disabled={saveMutation.isPending || Object.keys(drafts).length !== PARTNER_KEYS.length}>
        {saveMutation.isPending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
