import { StyleSheet, View } from 'react-native';

import {
  buildCourseWeatherPointRows,
  formatCourseWeatherClock,
  formatCourseWeatherDay,
  formatCourseWeatherRange,
  selectCourseWeatherDisplay,
  type CourseWeatherPointRow,
} from '../../lib/courseWeather';
import { useI18n } from '../../lib/i18n';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { RidgeDivider } from '../themed/Ridge';
import { Text } from '../themed/Text';
import { CourseWeatherAlertPills, CourseWeatherGlyph, CourseWeatherMeta, useCourseWeatherHourDetails } from './CourseWeatherParts';
import { useCourseWeather } from './useCourseWeather';

function usePointLabel() {
  const { t } = useI18n();
  return (row: Pick<CourseWeatherPointRow, 'kind' | 'name'>) => {
    if (row.kind === 'start') return t.courseWeather.start;
    if (row.kind === 'finish') return t.courseWeather.finish;
    if (row.kind === 'summit') return t.courseWeather.summit;
    return row.name?.trim() || t.courseWeather.aidStation;
  };
}

function PointRow({ row }: { row: CourseWeatherPointRow }) {
  const pointLabel = usePointLabel();
  const details = useCourseWeatherHourDetails();
  const temperature = formatCourseWeatherRange(row.summary.minTemperatureC, row.summary.maxTemperatureC);
  const feelsLike = formatCourseWeatherRange(row.minFeelsLikeC, row.maxFeelsLikeC);
  const detailLine = details(
    {
      windGustKph: row.maxWindGustKph,
      windSpeedKph: row.maxWindSpeedKph,
      precipitationMm: row.summary.totalPrecipitationMm,
      precipitationProbability: row.summary.maxPrecipitationProbability,
    },
    feelsLike && feelsLike !== temperature ? feelsLike : null,
  );
  return (
    <View style={styles.row}>
      <CourseWeatherGlyph name={row.icon} />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <View style={styles.rowTitle}>
            <Text numberOfLines={1} weight="semibold">{pointLabel(row)}</Text>
            <DataText size="xs" tone="secondary">{`${row.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`}</DataText>
          </View>
          {temperature ? <DataText tone="brand" weight="bold">{temperature}</DataText> : null}
        </View>
        {detailLine ? <Text size="xs" tone="secondary">{detailLine}</Text> : null}
        <CourseWeatherAlertPills alerts={row.alerts} />
      </View>
    </View>
  );
}

/**
 * "Météo" card of the Livret coureur: race-window summary per course point (start, aid stations,
 * highest point, finish), no runner ETA. Renders nothing when the API says `unavailable`.
 */
export function CourseWeatherSection({ raceId }: { raceId: string | null | undefined }) {
  const { locale, t } = useI18n();
  const { entry, stale } = useCourseWeather(raceId);
  const display = selectCourseWeatherDisplay(entry);
  if (display.kind === 'hidden') return null;

  if (display.kind === 'too_early') {
    return (
      <Card style={styles.card} variationKey="course-weather">
        <Text accessibilityRole="header" weight="bold" style={styles.title}>{t.courseWeather.title}</Text>
        <Text size="sm" tone="secondary">
          {t.courseWeather.tooEarly.replace('{date}', formatCourseWeatherDay(display.availableFrom, locale))}
        </Text>
      </Card>
    );
  }

  const { forecast } = display;
  const rows = buildCourseWeatherPointRows(forecast);
  const windowStart = formatCourseWeatherClock(forecast.windowStart, forecast.timeZone, locale);
  const windowEnd = formatCourseWeatherClock(forecast.windowEnd, forecast.timeZone, locale);
  return (
    <Card style={styles.card} variationKey="course-weather">
      <View style={styles.header}>
        <Text accessibilityRole="header" weight="bold" style={styles.title}>{t.courseWeather.title}</Text>
        {windowStart && windowEnd ? (
          <Text size="xs" tone="secondary">
            {t.courseWeather.raceWindow.replace('{start}', windowStart).replace('{end}', windowEnd)}
          </Text>
        ) : null}
      </View>
      {rows.map((row, index) => (
        <View key={row.id} style={styles.rowWrap}>
          {index > 0 ? <RidgeDivider /> : null}
          <PointRow row={row} />
        </View>
      ))}
      <CourseWeatherMeta forecast={forecast} stale={stale} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { gap: 2 },
  title: { fontSize: 15 },
  rowWrap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, minWidth: 0, gap: 1 },
});
