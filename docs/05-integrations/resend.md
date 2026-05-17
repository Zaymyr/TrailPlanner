---
title: Resend Integration
scope: integration
last_verified: 2026-05-17
ai_priority: medium
related_files:
  - package.json
  - apps/web/package.json
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/coach/invite/route.ts
related_tables:
  - coach_invites
---

# Resend Integration

## Purpose

This document records the current status of Resend/email sending in the repo. No Resend implementation was found during the documentation audit.

## Key Concepts

- Resend: external email API provider.
- Supabase Auth email: email delivery managed by Supabase Auth configuration.
- Coach invite: app table and flow for connecting coach/coachee accounts.

## Current Status

No Resend package, import, API client, or `noreply@mail...` sender code was found in:

- root `package.json`;
- `apps/web/package.json`;
- application source searches for `resend`;
- application source searches for `noreply@mail`.

The app does have:

- Supabase Auth flows for login/signup/password-related behavior;
- coach invite records in `coach_invites`;
- UI/actions that can resend an invite conceptually.

<!-- TODO: verify with maintainer: confirm whether production email is handled fully by Supabase Auth/dashboard templates or by an external Resend setup not committed to this repo. -->

## Gotchas

- Do not document Resend API keys or sender domains until code exists.
- Do not add a Resend dependency without deciding which flows it owns.
- Coach invite table behavior is not proof that app-managed email sending exists.

## Related Docs

- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Session Management](../04-auth-and-security/session-management.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [RLS Policies](../02-database/rls-policies.md)
