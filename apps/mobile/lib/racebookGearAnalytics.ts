import { getRacebookGearItemKey, type RacebookGearGroupKey } from './racebookGearItemKey';

export type RacebookGearAnalyticsItem = {
  id: string | null;
  label: string;
  required: boolean;
  cold: boolean;
  heat: boolean;
  active: boolean;
};

function getGearGroup(item: RacebookGearAnalyticsItem): RacebookGearGroupKey {
  if (!item.active) return 'weather';
  return item.required ? 'required' : 'recommended';
}

function getWeatherContext(item: RacebookGearAnalyticsItem) {
  if (item.cold && item.heat) return 'cold_and_heat';
  if (item.cold) return 'cold';
  if (item.heat) return 'heat';
  return 'none';
}

function buildRacebookGearItemProperties(item: RacebookGearAnalyticsItem) {
  const gearGroup = getGearGroup(item);
  const itemKey = getRacebookGearItemKey(gearGroup, item);
  const analyticsFallback = itemKey.split(':').slice(0, 3).join(':');

  return {
    gear_group: gearGroup,
    item_analytics_id: item.id ? `${gearGroup}:id:${item.id}` : analyticsFallback,
    item_id: item.id,
    item_label: item.label.trim().slice(0, 160),
    item_required: item.required,
    weather_context: getWeatherContext(item),
  };
}

export function buildRacebookGearToggleProperties(
  items: RacebookGearAnalyticsItem[],
  itemKey: string,
  checked: boolean,
) {
  const item = items.find((candidate) => {
    const group = getGearGroup(candidate);
    return getRacebookGearItemKey(group, candidate) === itemKey;
  });
  if (!item) return null;

  return {
    action: checked ? 'checked' : 'unchecked',
    checked,
    ...buildRacebookGearItemProperties(item),
  };
}

export function buildRacebookGearStateProperties(
  items: RacebookGearAnalyticsItem[],
  checkedItemKeys: ReadonlySet<string>,
) {
  return items.map((item) => {
    const properties = buildRacebookGearItemProperties(item);
    const checked = checkedItemKeys.has(getRacebookGearItemKey(properties.gear_group, item));

    return {
      checked,
      state: checked ? 'checked' : 'missing',
      ...properties,
    };
  });
}
