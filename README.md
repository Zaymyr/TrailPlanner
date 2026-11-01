# TrailPlanner

## Documentation

Project documentation starts in [`docs/README.md`](docs/README.md).

AI assistants must start with the canonical [`AGENTS.md`](AGENTS.md), which then routes them to [`docs/AGENTS.md`](docs/AGENTS.md) and the minimum relevant domain documentation. Assistant-specific files such as `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` only redirect to it so the rules cannot drift between tools.

## Local Setup

Use Node.js 20 and the npm version pinned by the root `packageManager` field. From a fresh clone:

```bash
npm ci --legacy-peer-deps
npm run verify
```

The repository is an npm workspace. Start the web app with `npm run dev:web` and the Expo development-client flow with `npm run dev:mobile`. Mobile native features require the development client; Expo Go is not the primary runtime for this project.

Copy [`apps/web/.env.example`](apps/web/.env.example) to `apps/web/.env.local` for web development and [`apps/mobile/.env.example`](apps/mobile/.env.example) to `apps/mobile/.env` for mobile development. Consult [`docs/01-architecture/infrastructure.md`](docs/01-architecture/infrastructure.md#environment-variables) for environment ownership and deployment details. Never commit actual secret values. Server-only values such as service-role, Stripe, Resend, OpenAI, RevenueCat secret, PostHog private API, cron, and test credentials must never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.

## Environment

- `NEXT_PUBLIC_ROUTING_API_KEY`: optional API key for routing provider features.
- `NEXT_PUBLIC_ROUTING_API_URL`: optional override of the routing API base URL (defaults to OpenRouteService foot-hiking).

## Mobile Changelog

To add a new mobile changelog entry for an important release, generate a Supabase migration with:

```bash
npm run changelog:add -- --version 1.0.1 --title "Android polish update" --note "New app icon and splash screen" --note "Version history is now visible in the profile tab"
```

This creates a SQL migration in `supabase/migrations/` that inserts or updates the matching `app_changelog` entry.

After generating it:

1. Apply the migration to Supabase.
2. Publish your mobile update or build.
