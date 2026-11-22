"use client";

import { useEffect } from "react";

import { reportClientError } from "../lib/error-reporting";

// Replaces the root layout when it crashes, so it must render its own <html>/<body>
// and cannot rely on providers, Tailwind classes or translations.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "global");
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1rem", textAlign: "center" }}>
        <main role="alert" style={{ maxWidth: "40rem", margin: "0 auto" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Une erreur est survenue</h1>
          <p style={{ marginBottom: "1.5rem", color: "#555" }}>
            Quelque chose s&apos;est mal passé de notre côté. Vous pouvez réessayer ou revenir à l&apos;accueil.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ minHeight: "2.75rem", padding: "0 1rem", borderRadius: "0.375rem", border: "none", background: "#16a34a", color: "#fff", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
          >
            Réessayer
          </button>{" "}
          <a href="/" style={{ marginLeft: "0.75rem", color: "#16a34a" }}>
            Retour à l&apos;accueil
          </a>
        </main>
      </body>
    </html>
  );
}
