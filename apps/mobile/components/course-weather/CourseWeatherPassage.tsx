import { StyleSheet, View } from 'react-native';

import {
  formatCourseWeatherDay,
  formatCourseWeatherTemperature,
  type CourseWeatherDisplayState,
  type CourseWeatherPassageLine,
} from '../../lib/courseWeather';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { CourseWeatherAlertPills, CourseWeatherGlyph, CourseWeatherMeta, useCourseWeatherHourDetails } from './CourseWeatherParts';

/** Weather expected at one planned passage (plan recap checkpoint, whose header already shows the
 * planned clock). Nothing when the passage is outside the forecast. */
export function CourseWeatherPassageRow({ line }: { line: CourseWeatherPassageLine | undefined }) {
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

/**
 * Status line under the plan's passages: availability date, out-of-range note, then fetch time and
 * MET Norway attribution. The runner's own departure is used, so no "estimated start" note.
 */
export function CourseWeatherPlanNote({
  display,
  stale,
  hasPassageWeather,
}: {
  display: CourseWeatherDisplayState;
  stale: boolean;
  hasPassageWeather: boolean;
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
      {!hasPassageWeather ? <Text size="xs" tone="secondary">{t.courseWeather.planOutOfRange}</Text> : null}
      <CourseWeatherMeta forecast={display.forecast} showEstimatedStart={false} stale={stale} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  note: { gap: 4 },
});
