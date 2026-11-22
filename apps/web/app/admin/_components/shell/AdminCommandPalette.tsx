"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { CommandPalette, type CommandItem } from "../../../../components/ui/CommandPalette";
import { ADMIN_NAV, ADMIN_SUBPAGES } from "../../admin-routes";

const usersSchema = z.object({ users: z.array(z.object({ id: z.string(), email: z.string().optional() }).passthrough()) });
const racesSchema = z.object({
  races: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        distance_km: z.number().nullable().optional(),
        race_events: z.object({ name: z.string() }).passthrough().nullable().optional(),
      })
      .passthrough(),
  ),
});

const SEARCH_DEBOUNCE_MS = 250;
const MIN_USER_QUERY = 2;
const kmFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const DESTINATIONS: CommandItem[] = [
  ...ADMIN_NAV.flatMap((group) =>
    group.items.map((item) => ({
      id: `nav:${item.href}`,
      group: "Aller à",
      label: item.label,
      hint: group.label ?? undefined,
      href: item.href,
      keywords: item.keywords,
    })),
  ),
  ...ADMIN_SUBPAGES.map((page) => ({ id: `nav:${page.href}`, group: "Aller à", label: page.label, hint: "Organisateurs", href: page.href, keywords: page.keywords })),
];

async function fetchJson<T>(url: string, accessToken: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Recherche indisponible.");
  return schema.parse(await response.json());
}

/** ⌘K of the console: destinations, runners (`/api/admin/users?search=`) and catalog races (`/api/admin/race-catalog`). */
export function AdminCommandPalette({ accessToken, open, onOpenChange }: { accessToken: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const usersQuery = useQuery({
    queryKey: ["admin", "palette-users", debounced, accessToken],
    enabled: open && debounced.length >= MIN_USER_QUERY,
    staleTime: 60_000,
    queryFn: () => fetchJson(`/api/admin/users?${new URLSearchParams({ search: debounced }).toString()}`, accessToken, usersSchema),
  });

  // Loaded the first time the palette opens; the catalog changes slowly.
  const racesQuery = useQuery({
    queryKey: ["admin", "palette-races", accessToken],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: () => fetchJson("/api/admin/race-catalog", accessToken, racesSchema),
  });

  const items = useMemo<CommandItem[]>(() => {
    // An empty query lists the destinations only.
    if (!query.trim()) return DESTINATIONS;
    const races: CommandItem[] = (racesQuery.data?.races ?? []).map((race) => ({
      id: `race:${race.id}`,
      group: "Courses",
      label: race.race_events?.name && race.race_events.name !== race.name ? `${race.race_events.name} · ${race.name}` : race.name,
      hint: typeof race.distance_km === "number" ? `${kmFormat.format(race.distance_km)} km` : undefined,
      href: `/admin/catalog/races?${new URLSearchParams({ course: race.id }).toString()}`,
    }));
    const users: CommandItem[] =
      debounced.length >= MIN_USER_QUERY && query.trim() === debounced
        ? (usersQuery.data?.users ?? []).slice(0, 6).flatMap((user) =>
            user.email
              ? [{ id: `user:${user.id}`, group: "Coureurs", label: user.email, href: `/admin/runners?${new URLSearchParams({ recherche: user.email }).toString()}`, prefiltered: true }]
              : [],
          )
        : [];
    return [...DESTINATIONS, ...races, ...users];
  }, [racesQuery.data, usersQuery.data, debounced, query]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      query={query}
      onQueryChange={setQuery}
      limitPerGroup={query.trim() ? 8 : DESTINATIONS.length}
      loading={(usersQuery.isLoading && debounced.length >= MIN_USER_QUERY) || (racesQuery.isLoading && query.length > 0)}
      placeholder="Aller à une page, une course, un coureur…"
      emptyText="Aucun résultat. Pour un coureur, tape au moins 2 caractères de son e-mail."
      onSelect={(item) => {
        if (item.href) router.push(item.href as Route);
      }}
    />
  );
}
