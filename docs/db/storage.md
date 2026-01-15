# Supabase Storage Buckets

## race-gpx
- Bucket name: `race-gpx`
- Purpose: Store curated race GPX files for the race catalog.
- Recommended policy: private bucket with admin-only upload/update.
- Read access: server-side only (use service role for parsing and plan creation).

## plan-gpx
- Bucket name: `plan-gpx`
- Purpose: Store user plan GPX files.
- Access pattern: authenticated users via server routes.
