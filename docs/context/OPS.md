# Ops

## Infrastructure et services

- **Supabase** — projet `pxkupuqtqmkguorajmaa` (Postgres, Auth, Storage, Edge Functions, pg_cron).
- **Hébergement web** — Vercel. Détails : [docs/01-architecture/infrastructure.md](../01-architecture/infrastructure.md).
- **E-mail** — Resend, expéditeur `noreply@mail.pace-yourself.com`. Voir [docs/05-integrations/resend.md](../05-integrations/resend.md).
- **Analytics** — PostHog (web + mobile) et GA4 (web). Voir [docs/05-integrations/analytics.md](../05-integrations/analytics.md).
- **Paiements** — voir [docs/05-integrations/stripe.md](../05-integrations/stripe.md).

## Tâches planifiées (Claude)

**Règle : les tâches planifiées n'écrivent jamais dans ce repo.**

### « Catalogue courses Pace Yourself »
- Quotidienne, 7h31 Europe/Paris.
- Enrichit le catalogue de courses dans Supabase pour un mois cible tournant.
- Importe au plus 2 GPX Trace de Trail par exécution, via une Edge Function à usage unique et vérifiée.
- Lecture seule sur ce repo.

### « Pace Yourself Follow-ups »
- Quotidienne, 7h38 Europe/Paris.
- Réconcilie Gmail avec la Google Sheet « Prospection organisateurs Trail ».
- Crée uniquement des BROUILLONS de réponse / relance ; n'envoie jamais rien.
