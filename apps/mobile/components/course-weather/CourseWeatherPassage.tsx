import { StyleSheet, View } from 'react-native';

import {
  formatCourseWeatherClock,
  formatCourseWeatherDay,
  formatCourseWeatherRange,
  formatCourseWeatherTemperature,
  type CourseWeatherDisplayState,
  type CourseWeatherInlineLine,
  type CourseWeatherPassageLine,
} from '../../lib/courseWeather';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { CourseWeatherAlertPills, CourseWeatherGlyph, CourseWeatherMeta, useCourseWeatherHourDetails } from './CourseWeatherParts';

/** Weather expected at one planned passage (plan recap checkpoint, Livret coureur row with a plan),
 * whose header already shows the planned clock. Nothing when the passage is outside the forecast. */
export function CourseWeatherPassageRow({
  line,
}: {
  line: Pick<CourseWeatherPassageLine, 'hour' | 'icon' | 'feelsLikeC' | 'alerts'> | undefined;
}) {
  const details = useCourseWeatherHourDetails();
  if (!line?.hour) return null;
  const temperature = formatCourseWeatherTemperature(line.hour.temperatureC);
  const feelsLike = formatCourseWeatherTemperature(line.feelsLikeC);
  const detailLine = details(line.hour, feelsLike && feelsLike !== temperature ? feelsLike : null);
  return (
    <View style={styles.row} testID="course-weather-passage">
      <CourseWeatherGlyph name={line.icon} size={20} />
      <View style={styles.body}>
        {temperature ? <DataText tone="brand" weight="bold">{temperature}</DataText> : null}
        {detailLine ? <Text size="xs" tone="secondary">{detailLine}</Text> : null}
        <CourseWeatherAlertPills alerts={line.alerts} />
      </View>
    </View>
  );
}

/** Summary over the window runners pass a point (Livret coureur without plan, Livret supporter stop). */
function CourseWeatherWindowRow({
  line,
  timeZone,
}: {
  line: Extract<CourseWeatherInlineLine, { kind: 'window' }>;
  timeZone: string;
}) {
  const { locale, t } = useI18n();
  const details = useCourseWeatherHourDetails();
  const temperature = formatCourseWeatherRange(line.summary.minTemperatureC, line.summary.maxTemperatureC);
  const feelsLike = formatCourseWeatherRange(line.minFeelsLikeC, line.maxFeelsLikeC);
  const detailLine = details(
    {
      windGustKph: line.maxWindGustKph,
      windSpeedKph: line.maxWindSpeedKph,
      precipitationMm: line.summary.totalPrecipitationMm,
      precipitationProbability: line.summary.maxPrecipitationProbability,
    },
    feelsLike && feelsLike !== temperature ? feelsLike : null,
  );
  const from = formatCourseWeatherClock(line.from, timeZone, locale);
  const to = formatCourseWeatherClock(line.to, timeZone, locale);
  return (
    <View style={styles.row} testID="course-weather-window">
      <CourseWeatherGlyph name={line.icon} size={20} />
      <View style={styles.body}>
        <View style={styles.header}>
          {temperature ? <DataText tone="brand" weight="bold">{temperature}</DataText> : null}
          {from && to ? (
            <Text numberOfLines={1} size="xs" style={styles.window} tone="tertiary">
              {t.courseWeather.passageWindow.replace('{start}', from).replace('{end}', to)}
            </Text>
          ) : null}
        </View>
        {detailLine ? <Text size="xs" tone="secondary">{detailLine}</Text> : null}
        <CourseWeatherAlertPills alerts={line.alerts} />
      </View>
    </View>
  );
}

/** Compact weather of one course row (aid station, start, finish, supporter stop); nothing without a line. */
export function CourseWeatherInlineRow({
  line,
  timeZone,
}: {
  line: CourseWeatherInlineLine | undefined;
  timeZone: string;
}) {
  if (!line) return null;
  if (line.kind === 'passage') return <CourseWeatherPassageRow line={line} />;
  return <CourseWeatherWindowRow line={line} timeZone={timeZone} />;
}

/**
 * Status line under a list of passages (plan recap, Livret coureur aid stations, Livret supporter
 * stops): availability date, out-of-range note, then fetch time and MET Norway attribution, once
 * per list. `showEstimatedStart` is off when the runner's own departure is used.
 */
export function CourseWeatherPlanNote({
  display,
  stale,
  hasPassageWeather,
  showEstimatedStart = false,
  outOfRangeMessage,
}: {
  display: CourseWeatherDisplayState;
  stale: boolean;
  hasPassageWeather: boolean;
  showEstimatedStart?: boolean;
  /** Shown when no row has weather; the plan wording by default. */
  outOfRangeMessage?: string;
}) {
  const { locale, t } = useI18n();
  if (display.kind === 'hidden') return null;
  if (display.kind === 'too_early') {
    return (
      <Text size="xs" tone="secondary">
        {`${t.courseWeather.title} · ${t.courseWeather.tooEarly.replace('{date}', formatCourseWeatherDay(display.availableFrom, locale))}`}
      </Text>
    );
  }
  return (
    <View style={styles.note}>
      {!hasPassageWeather ? <Text size="xs" tone="secondary">{outOfRangeMessage ?? t.courseWeather.planOutOfRange}</Text> : null}
      <CourseWeatherMeta forecast={display.forecast} showEstimatedStart={showEstimatedStart} stale={stale} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  window: { flexShrink: 1 },
  note: { gap: 4 },
});
