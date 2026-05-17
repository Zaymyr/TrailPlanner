# Pace Yourself Signature Icons

These icons share the Pace Yourself logo DNA: a broken/dotted arc, an upward chevron, and a central dot. They are intentionally simple so they remain readable at 16px, 24px, and 48px.

## Icons

- `TrailIcon`: dotted-to-solid curving trace for mapped trail routes. Use in GPX previews, course cards, and route summaries.
- `AidStationIcon`: filled brand dot with integrated plus and partial dotted arc. Use for race timeline aid stations and plan detail refill points.
- `SummitIcon`: upward chevron with apex dot and ground line. Use for elevation gain, summits, and climb-focused stats.
- `PaceIcon`: repeated chevrons fading backward to suggest motion. Use for pace/allure settings and speed-derived metrics.
- `NutritionIcon`: abstract fuel leaf with a central dot. Use for product catalog, nutrition targets, and fueling cards.
- `HydrationIcon`: water drop with inner dot and wave line. Use for hydration targets, pocket water, and water availability.
- `DescentIcon`: inverted chevron with dotted trail behind it. Use for downhill segments, descent stats, and technical terrain notes.
- `CutoffIcon`: dotted circle with a solid interruption segment. Use for cutoff time, deadline, and timing risk states.
- `GpxImportIcon`: dotted spiral trace entering a bracket. Use for GPX import, file parsing, and route ingestion.
- `EmptyPlanIcon`: minimal dotted circle. Use for empty states before a plan, race, or timeline exists.

## Mobile Usage

```tsx
import { TrailIcon, colors } from "@pace-yourself/design-system";

export function RouteBadge() {
  return <TrailIcon size={24} color={colors.brand.forest} accessibilityLabel="Trail" />;
}
```

## Web Usage

```tsx
import { AidStationIcon } from "@pace-yourself/design-system";

export function AidStationLabel() {
  return <AidStationIcon size={20} className="text-brand" title="Aid station" />;
}
```
