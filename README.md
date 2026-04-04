# TrailPlanner

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
