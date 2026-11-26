import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';

import {
  courseTerrainSectionShares,
  courseTerrainSummaryShares,
  formatCourseTerrainShares,
  type CourseTerrainShare,
} from '../../lib/courseTerrain';
import {
  COURSE_TERRAIN_ATTRIBUTION,
  type CourseTerrain,
  type CourseTerrainClass,
  type CourseTerrainSegment,
} from '../../lib/courseTerrainShared';
import { useI18n } from '../../lib/i18n';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { CourseTerrainBand, CourseTerrainBandShapes } from './CourseTerrainBand';

const SWATCH_SIZE = 10;

function CourseTerrainSwatch({ terrainClass }: { terrainClass: CourseTerrainClass }) {
  return (
    <Svg accessible={false} width={SWATCH_SIZE} height={SWATCH_SIZE}>
      <CourseTerrainBandShapes
        segments={[{ fromKm: 0, toKm: 1, class: terrainClass, surface: null, source: 'osm' }]}
        fromKm={0}
        toKm={1}
        x={0}
        width={SWATCH_SIZE}
        y={0}
        height={SWATCH_SIZE}
      />
    </Svg>
  );
}

/** `48 % sentier · 28 % piste…` in the active locale. */
export function useCourseTerrainShareText() {
  const { t } = useI18n();
  return (shares: CourseTerrainShare[]) => formatCourseTerrainShares(shares, t.courseTerrain.classes, t.courseTerrain.share);
}

/** OpenStreetMap attribution (ODbL): shown wherever terrain is shown. */
export function CourseTerrainAttribution() {
  return <DataText size="xs" tone="tertiary">{COURSE_TERRAIN_ATTRIBUTION}</DataText>;
}

/** Discreet line while the server computes the terrain; nothing for `unavailable`. */
export function CourseTerrainPendingNote() {
  const { t } = useI18n();
  return <Text size="xs" tone="tertiary">{t.courseTerrain.pending}</Text>;
}

/**
 * Compact course-wide summary under the Livret coureur profile: one swatch per class with its
 * share, the « Hors chemin » explanation when present, the organizer-corrected note and the
 * attribution.
 */
export function CourseTerrainSummary({ terrain }: { terrain: Pick<CourseTerrain, 'summary' | 'hasOrganizerOverrides'> }) {
  const { t } = useI18n();
  const shares = courseTerrainSummaryShares(terrain.summary);
  if (shares.length === 0) return null;
  const hasOffPath = shares.some((share) => share.class === 'off_path');
  return (
    <View style={styles.root}>
      <View style={styles.legend}>
        {shares.map((share) => (
          <View key={share.class} style={styles.legendItem}>
            <CourseTerrainSwatch terrainClass={share.class} />
            <DataText size="xs" tone="secondary">
              {t.courseTerrain.share.replace('{pct}', String(share.pct)).replace('{label}', t.courseTerrain.classes[share.class])}
            </DataText>
          </View>
        ))}
      </View>
      {hasOffPath ? <Text size="xs" tone="secondary">{t.courseTerrain.offPathNote}</Text> : null}
      {terrain.hasOrganizerOverrides ? <Text size="xs" tone="secondary">{t.courseTerrain.organizerCorrected}</Text> : null}
      <CourseTerrainAttribution />
    </View>
  );
}

/**
 * Terrain of one plan section, under its mini profile: a band over the section km range (insets
 * of `ProfileMiniChart`), then the class split and the attribution on one line.
 */
export function CourseTerrainSectionSplit({
  segments,
  fromKm,
  toKm,
  leftInset,
  rightInset,
}: {
  /** Segments already on the plan distance axis (`courseTerrainSegmentsOnAxis`). */
  segments: CourseTerrainSegment[];
  fromKm: number;
  toKm: number;
  leftInset?: number;
  rightInset?: number;
}) {
  const { t } = useI18n();
  const shareText = useCourseTerrainShareText();
  const shares = courseTerrainSectionShares(segments, fromKm, toKm);
  if (shares.length === 0) return null;
  const text = shareText(shares);
  return (
    <View style={styles.section}>
      <CourseTerrainBand
        segments={segments}
        fromKm={fromKm}
        toKm={toKm}
        leftInset={leftInset}
        rightInset={rightInset}
        accessibilityLabel={t.courseTerrain.bandLabel.replace('{summary}', text)}
      />
      <DataText size="xs" tone="tertiary">
        {`${text} · ${COURSE_TERRAIN_ATTRIBUTION}`}
      </DataText>
      {shares.some((share) => share.class === 'off_path') ? <Text size="xs" tone="tertiary">{t.courseTerrain.offPathNote}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  section: { gap: 4 },
});
