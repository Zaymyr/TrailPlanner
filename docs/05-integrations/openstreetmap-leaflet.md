---
title: OpenStreetMap and Leaflet
scope: integration
last_verified: 2026-06-30
ai_priority: medium
related_files:
  - apps/web/package.json
  - apps/web/app/layout.tsx
  - apps/web/components/gpx/GpxRouteMap.tsx
  - apps/web/components/gpx/GpxRouteMapClient.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
related_tables: []
---

# OpenStreetMap and Leaflet

## Purpose

This document records the lightweight mapping setup used for organizer GPX route previews in the web app.

## Stack

- `leaflet` provides the interactive map runtime.
- `react-leaflet` provides the React bindings and must stay on the React 18-compatible 4.x line while `apps/web` is still on React 18.
- `leaflet/dist/leaflet.css` is loaded from `apps/web/app/layout.tsx`.
- Base tiles come from `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`.

## Current Usage

`apps/web/components/gpx/GpxRouteMap.tsx` is the reusable wrapper for organizer-facing GPX route maps.

It:

- renders client-side only with `next/dynamic` and `ssr: false`;
- receives parsed GPX points and optional detected aid stations;
- fits the viewport to the route bounds;
- shows the route polyline plus start, finish, and ravito markers;
- is currently used by the organizer format editor GPX panel.

## Gotchas

- Keep the map client-only. `react-leaflet` should not be rendered through SSR.
- Do not upgrade `react-leaflet` to v5 in this app until the web runtime upgrades to React 19; v5 crashes the current GPX organizer map on mount under React 18.
- Preserve OpenStreetMap attribution when changing the tile layer.
- Avoid passing extremely dense GPX point sets without considering render cost; reuse the existing dashboard GPX preview payload when possible.
- If a future screen needs editing or advanced basemap controls, extend the shared component instead of creating another map stack.

## Related Docs

- [Web App](../01-architecture/web-app.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
