/**
 * Filtering of the ⌘K command palette (pure). Matching ignores case and accents; every word of the
 * query must appear in the label, the hint or the keywords. Items found by a server search
 * (`prefiltered`) are kept as returned, after the local matches of their group.
 */

export type CommandItem = {
  id: string;
  label: string;
  /** Section title (« Aller à », « Coureurs », « Courses »…); groups keep their first-seen order. */
  group: string;
  href?: string;
  /** Secondary text on the right (distance, e-mail, section). */
  hint?: string;
  keywords?: string[];
  /** Already matched by a server search: shown for any non-empty query, hidden when the query is empty. */
  prefiltered?: boolean;
};

export type CommandGroup = { group: string; items: CommandItem[] };

export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** 0 = label starts with the query, 1 = a label word starts with it, 2 = label contains it, 3 = other fields; null = no match. */
export const scoreCommandItem = (item: CommandItem, query: string): number | null => {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;
  const label = normalizeSearchText(item.label);
  const haystack = normalizeSearchText([item.label, item.hint ?? "", ...(item.keywords ?? [])].join(" "));
  const words = needle.split(" ");
  if (!words.every((word) => haystack.includes(word))) return null;
  if (label.startsWith(needle)) return 0;
  if (label.split(" ").some((word) => word.startsWith(words[0]))) return 1;
  if (label.includes(needle)) return 2;
  return 3;
};

export const filterCommandItems = (items: CommandItem[], query: string, options: { limitPerGroup?: number } = {}): CommandItem[] => {
  const limit = options.limitPerGroup ?? 8;
  const hasQuery = normalizeSearchText(query).length > 0;
  const scored = items
    .map((item, index) => ({ item, index, score: item.prefiltered ? (hasQuery ? 4 : null) : scoreCommandItem(item, query) }))
    .filter((entry): entry is { item: CommandItem; index: number; score: number } => entry.score !== null);
  const groupOrder = new Map<string, number>();
  items.forEach((item) => {
    if (!groupOrder.has(item.group)) groupOrder.set(item.group, groupOrder.size);
  });
  scored.sort(
    (left, right) =>
      (groupOrder.get(left.item.group) ?? 0) - (groupOrder.get(right.item.group) ?? 0) || left.score - right.score || left.index - right.index,
  );
  const perGroup = new Map<string, number>();
  return scored
    .filter(({ item }) => {
      const count = perGroup.get(item.group) ?? 0;
      perGroup.set(item.group, count + 1);
      return count < limit;
    })
    .map(({ item }) => item);
};

/** Consecutive items of the same group, in order (the filtered list is already sorted by group). */
export const groupCommandItems = (items: CommandItem[]): CommandGroup[] =>
  items.reduce<CommandGroup[]>((groups, item) => {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
    return groups;
  }, []);

/** Next active index for ↑ / ↓ / Home / End, wrapping around; -1 when the list is empty. */
export const moveActiveIndex = (current: number, count: number, key: "ArrowDown" | "ArrowUp" | "Home" | "End"): number => {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % count;
  return current <= 0 ? count - 1 : current - 1;
};
