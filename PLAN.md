# TrailPlanner – Fix Plan

## Phase 1 — Critical Bug Fixes (low-risk, no migration needed)

### 1.1 Division by zero in `pacing.ts`
**File:** `app/(coach)/race-planner/utils/pacing.ts:5`

`minutesPerKm()` does `60 / values.speedKph` with no guard.
`speedToPace` and `paceToSpeedKph` already return `null` for invalid input — apply the same pattern.

**Change:**
```typescript
export function minutesPerKm(values: FormValues): number | null {
  if (values.paceType === "speed") {
    if (values.speedKph <= 0) return null;
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
}
```
Any caller that already handled `null` from `speedToPace` will handle this correctly.

---

### 1.2 Missing `withSecurityHeaders` on `/api/plans`
**File:** `app/api/plans/route.ts`

Every other API route wraps its response with `withSecurityHeaders(...)`.
`/api/plans` — all four handlers (GET, POST, PUT, DELETE) — returns raw `NextResponse.json(...)`.

**Change:** Add `import { withSecurityHeaders } from "../../../lib/http"` and wrap every
`NextResponse.json(...)` call in that file.

---

### 1.3 Redundant / over-permissive `canSavePlan` logic
**File:** `app/(coach)/race-planner/hooks/useRacePlan.ts:130-135`

```typescript
// Current — `Boolean(activePlanId)` allows saving whenever any plan is active,
// even if the limit is reached. Last condition is redundant.
return (
  entitlements.isPremium ||
  !planLimitReached ||
  Boolean(activePlanId) ||                                        // ← remove
  Boolean(savedPlans.find((plan) => plan.id === activePlanId))
);
```

**Fix:** keep only the three meaningful conditions:
```typescript
return (
  entitlements.isPremium ||
  !planLimitReached ||
  Boolean(savedPlans.find((plan) => plan.id === activePlanId))
);
```

---

### 1.4 Unescaped ILIKE wildcards in race catalog search
**File:** `app/api/race-catalog/route.ts:50-54`

User input containing `%`, `_`, or `*` is interpolated directly into the PostgREST
`ilike` filter. PostgreSQL treats `%`/`_` as wildcards; PostgREST translates `*` to `%`.
A search for `%` matches everything; a search for `_test` matches any single character
before "test".

**Fix:** strip wildcard characters from the search term before building the filter URL.
```typescript
const sanitizeSearch = (value: string): string => value.replace(/[%_*\\]/g, "");

const filter = search
  ? `&or=(name.ilike.*${encodeURIComponent(sanitizeSearch(search))}*,` +
    `location_text.ilike.*${encodeURIComponent(sanitizeSearch(search))}*,` +
    `location.ilike.*${encodeURIComponent(sanitizeSearch(search))}*)`
  : "";
```

---

## Phase 2 — DB-Backed Rate Limiting

### Context
`checkRateLimit` in `lib/http.ts` uses an in-memory `Map`. In a serverless/multi-instance
environment (Vercel) the Map resets on every cold start. 40+ routes call this function.

**Trade-off:** each rate-limited request will now incur one extra Supabase RPC call
(~50-150ms). For the most-called endpoints this is noticeable. The plan therefore:
1. Creates the DB infrastructure
2. Adds `checkRateLimitAsync` (non-breaking, runs alongside the old sync version)
3. Migrates only the highest-security-risk routes first; leaves the rest for a follow-up

### 2.1 Migration: `rate_limit_entries` table + atomic RPC
**New file:** `supabase/migrations/20260304120000_add_rate_limit_entries.sql`

```sql
create table if not exists public.rate_limit_entries (
  key        text        primary key,
  count      integer     not null default 1,
  reset_at   timestamptz not null
);

-- Only the service role may touch this table
alter table public.rate_limit_entries enable row level security;

create or replace function public.check_and_increment_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
) returns table(allowed boolean, remaining integer, retry_after_ms bigint)
language plpgsql security definer as $$
declare
  v_now          timestamptz := now();
  v_reset_at     timestamptz := v_now + (p_window_ms * '1 millisecond'::interval);
  v_count        integer;
  v_entry_reset  timestamptz;
begin
  insert into public.rate_limit_entries(key, count, reset_at)
    values (p_key, 1, v_reset_at)
  on conflict (key) do update
    set count    = case when rate_limit_entries.reset_at <= v_now then 1
                        else rate_limit_entries.count + 1 end,
        reset_at = case when rate_limit_entries.reset_at <= v_now then v_reset_at
                        else rate_limit_entries.reset_at end
  returning rate_limit_entries.count, rate_limit_entries.reset_at
  into v_count, v_entry_reset;

  return query select
    (v_count <= p_limit)                                                       as allowed,
    greatest(0, p_limit - v_count)                                             as remaining,
    case when v_count > p_limit
         then (extract(epoch from (v_entry_reset - v_now)) * 1000)::bigint
         else 0::bigint end                                                    as retry_after_ms;
end;
$$;

-- Clean up expired entries periodically (called manually or via pg_cron)
create or replace function public.purge_expired_rate_limit_entries()
returns void language sql security definer as $$
  delete from public.rate_limit_entries where reset_at < now();
$$;
```

### 2.2 Add `checkRateLimitAsync` to `lib/http.ts`

New exported async function. Falls back silently to the existing in-memory version if
the Supabase service config is missing or the RPC fails (so dev environments still work
without DB credentials).

```typescript
export const checkRateLimitAsync = async (
  key: string,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): Promise<{ allowed: boolean; retryAfter?: number; remaining: number }> => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return checkRateLimit(key, limit, windowMs);

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/rpc/check_and_increment_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_key: key, p_limit: limit, p_window_ms: windowMs }),
        cache: "no-store",
      }
    );

    if (!response.ok) return checkRateLimit(key, limit, windowMs);

    const [result] = (await response.json().catch(() => [null])) as
      [{ allowed: boolean; remaining: number; retry_after_ms: number } | null];
    if (!result) return checkRateLimit(key, limit, windowMs);

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retry_after_ms > 0 ? result.retry_after_ms : undefined,
    };
  } catch {
    return checkRateLimit(key, limit, windowMs);
  }
};
```

### 2.3 Migrate the highest-risk routes to `checkRateLimitAsync`

These routes protect authentication and payments — the most valuable targets for
distributed brute-force attacks:

| Route | Key |
|---|---|
| `app/api/auth/password-reset-request/route.ts` | `auth-reset:…` |
| `app/api/auth/password-update/route.ts` | `auth-update:…` |
| `app/api/stripe/checkout/route.ts` | `stripe:checkout:…` |
| `app/api/coach/invite/route.ts` | `coach-invite:…` |

In each: change `checkRateLimit(...)` to `await checkRateLimitAsync(...)` and add
`async` to the handler function where missing.

---

## Phase 3 — Supabase RLS Audit

### 3.1 Read remaining migrations before writing the migration
Before creating the migration, read:
- `20260220140000_add_coach_invites.sql` — check invite table policies
- `20250701100000_add_subscriptions_table.sql` — check subscription access

### 3.2 Known gap: coachees cannot SELECT their own coach relationships
**Table:** `coach_coachees`
Current policies only allow `coach_id = auth.uid()` for SELECT.
A coachee querying their own relationships directly (with JWT, not service key) gets 0 rows.

**New file:** `supabase/migrations/20260304130000_add_coachee_read_policy.sql`
```sql
drop policy if exists "Coachees can view their own coach relationships" on public.coach_coachees;
create policy "Coachees can view their own coach relationships" on public.coach_coachees
  for select using (coachee_id = auth.uid());
```

### 3.3 Additional policies to verify (after reading migrations in 3.1)
- `coach_invites`: Can invitees read invites addressed to their email?
- `subscriptions`: Can users read only their own row?
- If gaps are found: add policies in the same migration file as 3.2

---

## Phase 4 — Test Coverage

Framework: **vitest** (confirmed from existing tests).

### 4.1 New file: `app/(coach)/race-planner/utils/__tests__/pacing.test.ts`
```
minutesPerKm
  ✓ returns correct value in pace mode
  ✓ returns correct value in speed mode
  ✓ returns null when speedKph is 0
  ✓ returns null when speedKph is negative

paceToSpeedKph
  ✓ returns correct speed
  ✓ returns null when total minutes is 0
  ✓ returns null when total minutes is negative

speedToPace
  ✓ returns correct pace for 12 kph
  ✓ returns null when speed is 0
  ✓ handles seconds rollover (e.g. 59.6s → 1min 0s)
```

### 4.2 New file: `app/(coach)/race-planner/utils/__tests__/plan-sanitizers.test.ts`
```
sanitizeSegmentPlan
  ✓ strips negative numbers
  ✓ strips NaN / Infinity
  ✓ returns empty object for invalid input

dedupeAidStations
  ✓ removes duplicate name+distance pairs
  ✓ keeps stations with same name but different distance
  ✓ sorts by distance

sanitizeAidStations
  ✓ rejects stations missing name or distanceKm
  ✓ defaults waterRefill to true when missing
```

### 4.3 New file: `app/(coach)/race-planner/utils/__tests__/segmentation.test.ts`
Edge cases for `computeSegmentStats` / `recomputeSectionFromSubSections`:
```
  ✓ returns 0 eta when speedKph is 0 (after pacing.ts fix, minutesPerKm returns null)
  ✓ handles empty elevation profile
  ✓ handles single-point elevation profile
```

---

## Execution Order

1. Phase 1 fixes (no migration, no external deps — safe to ship independently)
2. Phase 2.1 — push migration to Supabase
3. Phase 2.2 + 2.3 — update `lib/http.ts` and 4 routes
4. Phase 3.1 — read remaining migrations, then write phase 3 migration
5. Phase 3.2/3.3 — push RLS migration
6. Phase 4 — add test files, run `vitest`

---

## Out of Scope (not in this update)
- Stripe webhook raw-body verification — requires reading `lib/stripe.ts` first; plan separately
- `.passthrough()` schema in `plans/route.ts` — low risk since data is user-owned
- Bearer token multi-space edge case in `lib/supabase.ts:46` — extremely low real-world impact
