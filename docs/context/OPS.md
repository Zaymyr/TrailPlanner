# Ops

## Infrastructure et services

- **Supabase** — projet `pxkupuqtqmkguorajmaa` (Postgres, Auth, Storage, Edge Functions, pg_cron).
- **Hébergement web** — Vercel. Détails : [docs/01-architecture/infrastructure.md](../01-architecture/infrastructure.md).
- **E-mail** — Resend, expéditeur `noreply@mail.pace-yourself.com`. Voir [docs/05-integrations/resend.md](../05-integrations/resend.md).
- **Analytics** — PostHog (web + mobile) et GA4 (web). Voir [docs/05-integrations/analytics.md](../05-integrations/analytics.md).
- **Paiements** — voir [docs/05-integrations/stripe.md](../05-integrations/stripe.md).

## Tâches planifiées de l’application (pg_cron)

Les crons déclarés dans `vercel.json` ne sont jamais appelés par Vercel en production (voir [DECISIONS](DECISIONS.md), 2026-11-21) : les tâches qui tournent passent par pg_cron, et pg_net pour appeler les routes `/api/cron/*` avec `CRON_SECRET` (secrets Vault `web_app_url` et `cron_secret`). Horaires en UTC.

| Tâche pg_cron | Planification | Rôle |
| --- | --- | --- |
| `social-posts-publish` | toutes les 5 min | Publications Instagram programmées |
| `flyover-orders` | toutes les 10 min | Commandes de vidéos de survol |
| `demo-race-refresh` | toutes les heures à :05 | Démo Trail TST à la date du jour |
| `reel-automation` | toutes les heures à :17 | Reels automatiques |
| `organizer-import-cleanup-hourly` | toutes les heures à :17 | Nettoyage des imports organisateurs |
| `carousel-automation` | toutes les heures à :47 | Carrousels automatiques |
| `push-reminders-daily` | 09:00 | Rappels push (Edge Function) |
| `transactional-email-log-purge` | 04:23 | Purge du journal des e-mails (> 90 j, SQL seul) |
| `cron-job-run-details-purge` | 04:41 | Purge de l’historique pg_cron (`cron.job_run_details` > 7 j, SQL seul) |

Non exécutées (Vercel) : `revenuecat-reconciliation` (03:17), `tracedetrail-catalog-enrichment` (03:47).

Suivi : `/admin/system/automation` (dernier passage, durée, statut, échecs 24 h, message) ; relance manuelle d’une tâche pg_net : `/admin/system/maintenance`. Détail : [Admin system health functions](../02-database/admin-system-health-functions.md).

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
