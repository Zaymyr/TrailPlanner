type TimelineProduct = { name: string };
type TimelineItem = {
  detail: string;
  label: string;
  products?: TimelineProduct[];
  waterMl?: number;
};

function roundedWater(value: number) {
  return Math.max(10, Math.round(value / 10) * 10);
}

export function compactPlanTimeline<T extends TimelineItem>(items: T[]): T[] {
  let previousPlainWater: number | null = null;

  return items.flatMap((item) => {
    const isPlainWater = item.label.trim().toLocaleLowerCase() === 'eau' && !item.products?.length;
    if (!isPlainWater) return [item];

    const waterMl = roundedWater(item.waterMl ?? 0);
    if (previousPlainWater === waterMl) return [];
    previousPlainWater = waterMl;
    return [{
      ...item,
      detail: item.detail.replace(/\d+\s*ml/i, `${waterMl} ml`),
      waterMl,
    }];
  });
}
