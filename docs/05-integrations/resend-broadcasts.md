---
title: Resend Broadcasts
scope: integration
last_verified: 2026-05-20
ai_priority: high
related_files:
  - emails/resend/production-launch.html
  - emails/resend/production-launch.txt
  - apps/web/public/landing/mobile-app-plan-screen.jpeg
related_tables: []
---

# Resend Broadcasts

## Purpose

This playbook explains how to prepare and create Resend Broadcast drafts for Pace Yourself without accidentally sending, corrupting UTF-8 characters, leaking API keys, or using stale image assets.

Use this doc for product announcements, launch emails, and future marketing-style broadcasts. For contact sync routes and app integration status, read [Resend Integration](resend.md).

## Key Concepts

- Broadcast draft: a Resend broadcast created without `send: true`; it is not sent or scheduled.
- Segment: the Resend recipient group. REST API payloads use `segment_id`.
- Verified sender domain: Resend only accepts `from` addresses on verified domains.
- Public email image: a stable HTTPS PNG/JPG URL that email clients can fetch.
- UTF-8 safe upload: use Node `fs.readFileSync(..., "utf8")` plus `JSON.stringify`, not Windows PowerShell `ConvertTo-Json` for long accented strings.

## Current Production Launch Draft

The launch broadcast draft created on 2026-05-20 is:

- Broadcast id: `1fc16727-381d-43ca-b0e6-5728a9d5e27c`
- Subject: `Pace Yourself est disponible sur Google Play`
- Launch ask: leave a Google Play rating and follow `@pace_your.self` on Instagram.
- Sender used: `Pace Yourself <hello@mail.pace-yourself.com>`
- Status after verification: `draft`
- `scheduled_at`: empty
- `sent_at`: empty

The verified Resend domain observed in this account is:

- `mail.pace-yourself.com`

`pace-yourself.com` itself was not verified when the launch draft was created, so `RESEND_FROM` values on that domain were rejected by Resend.

## Required Setup

Keep Resend secrets server-side only:

- Prefer `apps/web/.env.local` for local admin/broadcast work.
- Do not put `RESEND_API_KEY` in Expo public variables.
- Remove `RESEND_API_KEY` from `apps/mobile/.env` after any temporary local use.

Expected local variables:

```env
RESEND_API_KEY=re_xxx
RESEND_SEGMENT_ID=seg_xxx_or_uuid
RESEND_FROM="Pace Yourself <hello@mail.pace-yourself.com>"
```

Before creating or updating a broadcast:

1. Confirm the sender domain is verified in Resend.
2. Confirm the target segment is correct.
3. Confirm the audience has consent for product/marketing email.
4. Deploy any referenced web images before sending.
5. Keep `{{{RESEND_UNSUBSCRIBE_URL}}}` in HTML and text bodies.

## Draft Creation Workflow

Use the REST API for direct dashboard draft creation. The REST payload uses snake_case:

```json
{
  "segment_id": "seg_or_uuid",
  "from": "Pace Yourself <hello@mail.pace-yourself.com>",
  "subject": "Pace Yourself est disponible sur Google Play",
  "name": "Pace Yourself - lancement production Google Play - 2026-05-20",
  "html": "<!doctype html>...",
  "text": "Plain text body..."
}
```

Do not include `send: true` when creating a draft. Omitting `send` keeps the broadcast as a draft.

If using the Resend SDK, the field name may be camelCase (`segmentId`). If using raw REST, use `segment_id`.

## UTF-8 Safe Update Script

For non-ASCII French copy, use Node for upload/update. This avoids mojibake such as `Ã©`, `Â`, or `â€™`.

```js
const fs = require("fs");

const apiKey = process.env.RESEND_API_KEY;
const broadcastId = "1fc16727-381d-43ca-b0e6-5728a9d5e27c";

const html = fs.readFileSync("emails/resend/production-launch.html", "utf8");
const text = fs.readFileSync("emails/resend/production-launch.txt", "utf8");

await fetch(`https://api.resend.com/broadcasts/${broadcastId}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({
    subject: "Pace Yourself est disponible sur Google Play",
    name: "Pace Yourself - lancement production Google Play - 2026-05-20",
    html,
    text,
  }),
});
```

Avoid Windows PowerShell `ConvertTo-Json` for long email strings. It can serialize long strings as objects with a `value` field and can also introduce encoding confusion when piped through `curl`.

## Validation

After creating or updating a draft, retrieve it and verify:

- `status` is `draft`;
- `scheduled_at` is empty;
- `sent_at` is empty;
- the subject is correct;
- HTML includes `RESEND_UNSUBSCRIBE_URL`;
- HTML includes expected image URLs;
- the stored HTML/text does not include mojibake markers like `Ã`, `Â`, `â`, or the replacement character.

For the launch email, expected image URLs are:

- `https://pace-yourself.com/landing/mobile-app-plan-screen.jpeg`

## Do Not

- Do not send or schedule a broadcast from automation unless the maintainer explicitly asks for send/schedule.
- Do not use unverified `from` domains.
- Do not embed large base64 images in Broadcast HTML.
- Do not use local file paths or SVG assets as email images.
- Do not store `RESEND_API_KEY` in mobile/Expo public env vars.
- Do not assume admin bulk contact sync proves marketing consent.

## Related Docs

- [Resend Integration](resend.md)
- [Infrastructure](../01-architecture/infrastructure.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
