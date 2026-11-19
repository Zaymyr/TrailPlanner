"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { formatParisDateTime } from "../../../lib/social-posts";
import { adminFetch, type InstagramStatus } from "./publications-api";

const CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Compte Instagram connecté.",
  denied: "Connexion annulée sur Instagram.",
  invalid_state: "Lien de connexion expiré ou invalide : recommence.",
  forbidden: "Session administrateur absente au retour d’Instagram : reconnecte-toi puis recommence.",
  not_configured: "Application Meta ou clé de chiffrement non configurée.",
  error: "Instagram a refusé la connexion. Vérifie l’application Meta et l’URI de redirection.",
};

export function InstagramConnectionCard({
  accessToken,
  status,
  isLoading,
  error,
  callbackResult,
}: {
  accessToken: string;
  status: InstagramStatus | undefined;
  isLoading: boolean;
  error: string | null;
  callbackResult: string | null;
}) {
  const connect = useMutation({
    mutationFn: () => adminFetch(accessToken, "/api/admin/instagram/connect", z.object({ url: z.string().url() }), { method: "POST" }, "Connexion impossible."),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const account = status?.account ?? null;
  const needsReconnect = account?.status === "needs_reconnect";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compte Instagram</CardTitle>
        <CardDescription>
          Publication des reels via l’API Instagram. Le jeton est conservé chiffré côté serveur et renouvelé automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {callbackResult && CALLBACK_MESSAGES[callbackResult] ? (
          <p className={callbackResult === "connected" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-200"}>
            {CALLBACK_MESSAGES[callbackResult]}
          </p>
        ) : null}
        {isLoading ? <p className="text-muted-foreground">Chargement…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {status ? (
          <>
            <p className={status.dryRun ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"}>
              {status.dryRun
                ? "Mode simulation : aucune publication n’est envoyée à Instagram. Les publications sont marquées « Simulation »."
                : "Publication réelle activée : « Publier maintenant » et les programmations publient sur Instagram."}
            </p>
            {account ? (
              <dl className="grid gap-1 sm:grid-cols-[180px_1fr]">
                <dt className="text-muted-foreground">Compte</dt>
                <dd>{account.username ? `@${account.username}` : account.igUserId}</dd>
                <dt className="text-muted-foreground">État</dt>
                <dd className={needsReconnect ? "text-amber-700 dark:text-amber-200" : ""}>
                  {needsReconnect ? "À reconnecter" : "Connecté"}
                  {account.statusMessage ? ` · ${account.statusMessage}` : ""}
                </dd>
                <dt className="text-muted-foreground">Jeton valable jusqu’au</dt>
                <dd>{formatParisDateTime(account.tokenExpiresAt)}</dd>
                <dt className="text-muted-foreground">Dernier renouvellement</dt>
                <dd>{formatParisDateTime(account.tokenRefreshedAt)}</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">Aucun compte connecté.</p>
            )}
            {!status.appConfigured || !status.encryptionConfigured ? (
              <p className="text-muted-foreground">
                Connexion indisponible : {[!status.appConfigured && "application Meta", !status.encryptionConfigured && "clé de chiffrement"].filter(Boolean).join(" et ")} non configurée(s) côté serveur.
              </p>
            ) : null}
            <div>
              <Button
                type="button"
                variant={account && !needsReconnect ? "outline" : "default"}
                disabled={!status.appConfigured || !status.encryptionConfigured || connect.isPending}
                onClick={() => connect.mutate()}
              >
                {connect.isPending ? "Redirection…" : account ? "Reconnecter Instagram" : "Connecter Instagram"}
              </Button>
              {connect.error instanceof Error ? <p className="mt-2 text-red-600 dark:text-red-300">{connect.error.message}</p> : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
