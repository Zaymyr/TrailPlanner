# Pace Yourself Documentation

This directory is the LLM-optimized project documentation for the Pace Yourself codebase. It is organized for AI assistants and senior developers who need to make changes without guessing.

Numbered folders are the recommended reading order for new joiners:

1. `01-architecture`
2. `02-database`
3. `03-business-rules`
4. `04-auth-and-security`
5. `05-integrations`
6. `06-workflows`
7. `07-design-system`
8. `08-decisions`

Start here for high-priority work:

- [AGENTS.md](AGENTS.md): AI assistant routing and hard rules.
- [Schema Overview](02-database/schema-overview.md): current database map.
- [Nutrition Algorithm](03-business-rules/nutrition-algorithm.md): fueling allocation rules.
- [RLS Policies](02-database/rls-policies.md): security rules and forbidden patterns.
- [Plan Storage](03-business-rules/plan-storage.md): onboarding-to-saved-plan lifecycle.

Docs conventions are in [_conventions.md](_conventions.md).

## Table of Contents

### Root

- [AGENTS.md](AGENTS.md)
- [_conventions.md](_conventions.md)

### 01 Architecture

- [Overview](01-architecture/overview.md)
- [Web App](01-architecture/web-app.md)
- [Mobile App](01-architecture/mobile-app.md)
- [Packages](01-architecture/packages.md)
- [Infrastructure](01-architecture/infrastructure.md)

### 02 Database

- [Schema Overview](02-database/schema-overview.md)
- [RLS Policies](02-database/rls-policies.md)
- [Migrations](02-database/migrations.md)
- [Relationships](02-database/relationships.md)
- [race_plans](02-database/tables/race-plans.md)
- [plan_aid_stations](02-database/tables/plan-aid-stations.md)
- [plan_share_links](02-database/tables/plan-share-links.md)
- [race_aid_stations](02-database/tables/race-aid-stations.md)
- [race_aid_station_products](02-database/tables/race-aid-station-products.md)
- [race_events](02-database/tables/race-events.md)
- [race_event_claims](02-database/tables/race-event-claims.md)
- [race_event_organizers](02-database/tables/race-event-organizers.md)
- [products](02-database/tables/products.md)
- [user_profiles](02-database/tables/user-profiles.md)
- [subscriptions](02-database/tables/subscriptions.md)
- [premium_grants](02-database/tables/premium-grants.md)

### 03 Business Rules

- [Nutrition Algorithm](03-business-rules/nutrition-algorithm.md)
- [Pacing Algorithm](03-business-rules/pacing-algorithm.md)
- [GPX Import](03-business-rules/gpx-import.md)
- [Organizer Race Management](03-business-rules/organizer-race-management.md)
- [Premium Entitlement](03-business-rules/premium-entitlement.md)
- [Trial Lifecycle](03-business-rules/trial-lifecycle.md)
- [Plan Storage](03-business-rules/plan-storage.md)

### 04 Auth and Security

- [Auth Flows](04-auth-and-security/auth-flows.md)
- [Session Management](04-auth-and-security/session-management.md)
- [Duplicate Events Pattern](04-auth-and-security/duplicate-events-pattern.md)
- [RLS Checklist](04-auth-and-security/rls-checklist.md)

### 05 Integrations

- [Stripe](05-integrations/stripe.md)
- [Resend](05-integrations/resend.md)
- [Resend Broadcasts](05-integrations/resend-broadcasts.md)
- [Mulebar Product Scraping](05-integrations/mulebar-scraping.md)
- [Geocoding](05-integrations/geocoding.md)
- [Supabase Edge Functions](05-integrations/supabase-edge-functions.md)
- [Analytics](05-integrations/analytics.md)

### 06 Workflows

- [Add New Table](06-workflows/add-new-table.md)
- [Add RLS Policy](06-workflows/add-rls-policy.md)
- [Add New Mobile Screen](06-workflows/add-new-screen-mobile.md)
- [Ship a Feature](06-workflows/ship-a-feature.md)
- [Debug Supabase Auth](06-workflows/debug-supabase-auth.md)

### 07 Design System

- [Tokens](07-design-system/tokens.md)
- [Icons](07-design-system/icons.md)
- [Components](07-design-system/components.md)

### 08 Decisions

- [ADR Placeholder](08-decisions/README.md)

### Archive

Previous documentation was moved unchanged to `docs/_archive/`.
