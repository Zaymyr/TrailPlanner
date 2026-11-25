import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import {
  formatCourseWeatherFetchedAt,
  usesDeviceTimeFallback,
  type CourseWeatherIconName,
} from '../../lib/courseWeather';
import type { CourseWeatherAlert, CourseWeatherForecast, CourseWeatherHour } from '../../lib/courseWeatherShared';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';

const ALERT_TONE: Record<CourseWeatherAlert, 'info' | 'warning' | 'danger'> = {
  storm: 'danger',
  wind: 'danger',
  snow: 'warning',
  cold: 'warning',
  heat: 'warning',
  rain: 'info',
};

export function CourseWeatherGlyph({ name, size = 22 }: { name: CourseWeatherIconName; size?: number }) {
  return <Ionicons accessible={false} color={Colors.brandPrimary} name={name} size={size} />;
}

export function CourseWeatherAlertPills({ alerts }: { alerts: CourseWeatherAlert[] }) {
  const { t } = useI18n();
  if (alerts.length === 0) return null;
  return (
    <View style={styles.alerts}>
      {alerts.map((alert) => (
        <StatusPill key={alert} label={t.courseWeather.alerts[alert]} tone={ALERT_TONE[alert]} />
      ))}
    </View>
  );
}

/** `ressenti 5° · vent 20 km/h · rafales 45 km/h · 1.2 mm · pluie 60 %`; missing values are omitted. */
export function useCourseWeatherHourDetails() {
  const { t } = useI18n();
  return (hour: Pick<CourseWeatherHour, 'windGustKph' | 'windSpeedKph' | 'precipitationMm' | 'precipitationProbability'>, feelsLike: string | null) => {
    const parts: string[] = [];
    if (feelsLike) parts.push(t.courseWeather.feelsLike.replace('{value}', feelsLike));
    // MET Norway often has no gusts (e.g. France): show the sustained wind, then gusts when known.
    const isKnown = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
    if (isKnown(hour.windSpeedKph)) parts.push(t.courseWeather.wind.replace('{value}', String(Math.round(hour.windSpeedKph))));
    if (isKnown(hour.windGustKph)) parts.push(t.courseWeather.windGust.replace('{value}', String(Math.round(hour.windGustKph))));
    if (typeof hour.precipitationMm === 'number' && hour.precipitationMm > 0) {
      parts.push(t.courseWeather.precipitation.replace('{value}', String(Math.round(hour.precipitationMm * 10) / 10)));
    }
    if (typeof hour.precipitationProbability === 'number' && hour.precipitationProbability >= 20) {
      parts.push(t.courseWeather.precipitationProbability.replace('{value}', String(Math.round(hour.precipitationProbability))));
    }
    return parts.join(' · ');
  };
}

/**
 * Fetch time, stale/estimated-start/device-time notes and the MET Norway attribution (CC BY 4.0
 * license requirement: shown wherever weather is shown).
 */
export function CourseWeatherMeta({
  forecast,
  stale,
  showEstimatedStart = true,
}: {
  forecast: Pick<CourseWeatherForecast, 'fetchedAt' | 'source' | 'timeZone' | 'startTimeIsEstimated'>;
  stale: boolean;
  showEstimatedStart?: boolean;
}) {
  const { locale, t } = useI18n();
  const fetchedAt = formatCourseWeatherFetchedAt(forecast.fetchedAt, locale);
  return (
    <View style={styles.meta}>
      {showEstimatedStart && forecast.startTimeIsEstimated ? <Text size="xs" tone="secondary">{t.courseWeather.estimatedStart}</Text> : null}
      {usesDeviceTimeFallback(forecast.timeZone) ? <Text size="xs" tone="secondary">{t.courseWeather.deviceTimeNote}</Text> : null}
      {stale ? <Text size="xs" tone="secondary">{t.courseWeather.staleCopy}</Text> : null}
      <DataText size="xs" tone="tertiary">
        {fetchedAt ? `${t.courseWeather.fetchedAt.replace('{date}', fetchedAt)} · ` : ''}{forecast.source.attribution}
      </DataText>
    </View>
  );
}

const styles = StyleSheet.create({
  alerts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { gap: 2 },
});
