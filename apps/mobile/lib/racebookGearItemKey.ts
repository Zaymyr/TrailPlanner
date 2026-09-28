export type RacebookGearGroupKey = 'required' | 'recommended' | 'weather';

export function getRacebookGearItemKey(
  group: RacebookGearGroupKey,
  item: { id: string | null; label: string },
) {
  if (item.id) return `${group}:id:${item.id}`;

  const normalizedLabel = item.label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr-FR')
    .replace(/\s+/g, ' ');

  let hash = 2166136261;
  for (let index = 0; index < normalizedLabel.length; index += 1) {
    hash ^= normalizedLabel.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${group}:label:${(hash >>> 0).toString(36)}:${normalizedLabel.slice(0, 220)}`;
}
