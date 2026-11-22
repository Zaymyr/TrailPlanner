"use client";

import { useId, useMemo, useState } from "react";

import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/Select";
import type { BillingEdition } from "../../../../lib/admin-billing";
import { billingTierLabel } from "../../../../lib/admin-billing";

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr");

export const editionOptionLabel = (edition: BillingEdition) =>
  [edition.eventName, edition.editionYear ? `édition ${edition.editionYear}` : null, edition.tier && edition.tier !== "visibility" ? billingTierLabel(edition.tier) : null]
    .filter(Boolean).join(" · ");

/** Search + native list of editions (at most 60 shown), for the invoice and bank-transfer dialogs. */
export function EditionPicker({ editions, value, onChange, loading, error }: {
  editions: BillingEdition[];
  value: string;
  onChange: (editionId: string) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const options = useMemo(() => {
    const needle = normalize(search.trim());
    const matching = needle ? editions.filter((edition) => normalize(editionOptionLabel(edition)).includes(needle)) : editions;
    const shown = matching.slice(0, 60);
    const selected = editions.find((edition) => edition.editionId === value);
    return selected && !shown.includes(selected) ? [selected, ...shown] : shown;
  }, [editions, search, value]);
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor={`${id}-edition`}>Édition</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Input
          type="search"
          aria-label="Rechercher une édition"
          placeholder="Rechercher une course…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select id={`${id}-edition`} value={value} onChange={(event) => onChange(event.target.value)} disabled={loading}>
          <option value="">{loading ? "Chargement des éditions…" : "Choisir une édition"}</option>
          {options.map((edition) => (
            <option key={edition.editionId} value={edition.editionId}>{editionOptionLabel(edition)}</option>
          ))}
        </Select>
      </div>
      {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
