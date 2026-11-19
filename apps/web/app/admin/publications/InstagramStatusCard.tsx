"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import type { InstagramStatus } from "./publications-api";

/** Read-only state of the Instagram setup: credentials, account, quota and publishing mode. */
export function InstagramStatusCard({
  status,
  isLoading,
  error,
}: {
  status: InstagramStatus | undefined;
  isLoading: boolean;
  error: string | null;
}) {
  const profile = status?.profile ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compte Instagram</CardTitle>
        <CardDescription>
          Publication via l’API Instagram (connexion Facebook, page liée) avec un jeton d’utilisateur système configuré côté serveur.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {isLoading ? <p className="text-muted-foreground">Chargement…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {status ? (
          <>
            <p className={status.dryRun ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"}>
              {status.dryRun
                ? "Mode : Simulation. Aucune publication n’est envoyée à Instagram ; les publications sont marquées « Simulation »."
                : "Mode : Publication réelle. « Publier maintenant » et les programmations publient sur Instagram."}
            </p>
            <dl className="grid gap-1 sm:grid-cols-[220px_1fr]">
              <dt className="text-muted-foreground">Identifiants configurés</dt>
              <dd>{status.credentialsConfigured ? "Oui" : "Non (IG_SYSTEM_USER_TOKEN et IG_USER_ID requis)"}</dd>
              <dt className="text-muted-foreground">Compte</dt>
              <dd className="flex items-center gap-2">
                {profile?.profilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profilePictureUrl} alt="" className="h-6 w-6 rounded-full" />
                ) : null}
                <span>{profile?.username ? `@${profile.username}` : "—"}</span>
                {profile?.name ? <span className="text-muted-foreground">· {profile.name}</span> : null}
              </dd>
              <dt className="text-muted-foreground">Compte Instagram (IG_USER_ID)</dt>
              <dd>{status.igUserId ?? "—"}</dd>
              <dt className="text-muted-foreground">Page Facebook (FB_PAGE_ID)</dt>
              <dd>{status.pageId ?? "—"}</dd>
              <dt className="text-muted-foreground">Quota de publication</dt>
              <dd>{status.quota ? `${status.quota.usage} / ${status.quota.total} sur 24 h` : "—"}</dd>
              <dt className="text-muted-foreground">Version de l’API</dt>
              <dd>{status.graphVersion}</dd>
            </dl>
            {status.profileError ? <p className="text-amber-700 dark:text-amber-200">{status.profileError}</p> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
