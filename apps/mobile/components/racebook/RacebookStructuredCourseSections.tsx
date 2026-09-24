import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RacebookScreenData } from '../../lib/racebook';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type StructuredCourseTab = 'relay' | 'start-waves' | 'awards';

export type RacebookRelaySegment = {
  start: { name: string; km: number; handoverTime: string | null; cutoffTime: string | null; notes: string | null };
  end: { name: string; km: number; handoverTime: string | null; cutoffTime: string | null; notes: string | null };
  distanceKm: number;
};

type RacebookStructuredCourseSectionsProps = {
  activeTab: string;
  relaySegments: RacebookRelaySegment[];
  startWaves: RacebookScreenData['startWaves'];
  awardsByTime: [string, RacebookScreenData['awards']][];
  theme: ResolvedRacebookTheme;
  copy: {
    relayTitle: string;
    relayLeg: string;
    relayHandoverTime: string;
    aidCutoffTime: string;
    waveBibNumbers: string;
    waveAll: string;
    awardsTitle: string;
    awardWomen: string;
    awardMen: string;
    awardMixed: string;
  };
};

function formatDistance(distanceKm: number) {
  return distanceKm >= 100 ? distanceKm.toFixed(0) : distanceKm.toFixed(1);
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Card>
  );
}

export function RacebookStructuredCourseSections({
  activeTab,
  relaySegments,
  startWaves,
  awardsByTime,
  theme,
  copy,
}: RacebookStructuredCourseSectionsProps) {
  return (
    <>
      {activeTab === ('relay' satisfies StructuredCourseTab) && relaySegments.length > 0 ? (
        <SectionCard title={copy.relayTitle}>
          <View style={styles.list}>
            {relaySegments.map((segment, index) => (
              <View
                key={`${segment.start.name}-${segment.end.name}-${index}`}
                style={[styles.card, { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor }]}
              >
                <View style={styles.header}>
                  <Text style={[styles.kicker, { color: theme.accentForegroundColor }]}>
                    {copy.relayLeg.replace('{number}', String(index + 1))}
                  </Text>
                  <DataText style={styles.distance}>{`${formatDistance(segment.distanceKm)} km`}</DataText>
                </View>
                <Text style={styles.title}>{`${segment.start.name} → ${segment.end.name}`}</Text>
                {segment.end.handoverTime ? <Text style={styles.meta}>{`${copy.relayHandoverTime} · ${segment.end.handoverTime}`}</Text> : null}
                {segment.end.cutoffTime ? <Text style={styles.meta}>{`${copy.aidCutoffTime} · ${segment.end.cutoffTime}`}</Text> : null}
                {segment.end.notes ? <Text style={styles.note}>{segment.end.notes}</Text> : null}
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {activeTab === ('start-waves' satisfies StructuredCourseTab) ? (
        <View style={styles.list}>
          {startWaves.map((wave, index) => {
              const criterion = wave.eligibilityType === 'bib_range'
                ? `${copy.waveBibNumbers} ${wave.bibNumberMin}–${wave.bibNumberMax}`
                : wave.eligibilityType === 'estimated_finish_time'
                  ? `${wave.finishMinutesMin}–${wave.finishMinutesMax} min`
                  : wave.eligibilityType === 'pace'
                    ? `${wave.paceSecondsMin}–${wave.paceSecondsMax} s/km`
                    : wave.eligibilityType === 'custom'
                      ? wave.eligibilityNote
                      : copy.waveAll;
              return (
                <View
                  accessible
                  accessibilityLabel={[`S${index + 1}`, wave.name, wave.startTime, criterion]
                    .filter(Boolean)
                    .join(', ')}
                  key={wave.id}
                  style={styles.startWaveCard}
                >
                  <View style={styles.startWaveHeader}>
                    <View
                      style={[
                        styles.startWaveIndex,
                        { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor },
                      ]}
                    >
                      <DataText style={[styles.startWaveIndexText, { color: theme.accentForegroundColor }]}>
                        {`S${index + 1}`}
                      </DataText>
                    </View>
                    <Text numberOfLines={1} style={[styles.title, styles.startWaveTitle]}>
                      {wave.name}
                    </Text>
                    <DataText style={[styles.startWaveTime, { color: theme.accentForegroundColor }]}>
                      {wave.startTime}
                    </DataText>
                  </View>
                  {criterion ? <Text style={styles.startWaveCriterion}>{criterion}</Text> : null}
                </View>
              );
          })}
        </View>
      ) : null}

      {activeTab === ('awards' satisfies StructuredCourseTab) ? (
        <View style={styles.list}>
          {awardsByTime.map(([podiumTime, awards]) => (
            <SectionCard key={podiumTime} title={`${copy.awardsTitle} · ${podiumTime}`}>
              <View style={styles.list}>
                {awards.map((award) => (
                  <View key={award.id} style={[styles.card, { backgroundColor: theme.accentSurfaceColor, borderColor: theme.accentBorderColor }]}>
                    <Text style={styles.title}>{award.categoryLabel}</Text>
                    <Text style={styles.meta}>
                      {`${award.audience === 'women' ? copy.awardWomen : award.audience === 'men' ? copy.awardMen : copy.awardMixed} · ${award.placeFrom}–${award.placeTo}`}
                    </Text>
                    {award.podiumLocation ? <Text style={styles.note}>{award.podiumLocation}</Text> : null}
                    {award.rewardNote ? <Text style={styles.note}>{award.rewardNote}</Text> : null}
                  </View>
                ))}
              </View>
            </SectionCard>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: { gap: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  list: { gap: 10 },
  card: { gap: 6, padding: 14, borderRadius: 16, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  kicker: { color: Colors.brandPrimary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  distance: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  startWaveCard: {
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  startWaveHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  startWaveIndex: {
    minWidth: 36,
    height: 34,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  startWaveIndexText: { fontSize: 12, fontWeight: '800' },
  startWaveTitle: { flex: 1 },
  startWaveTime: { fontSize: 17, fontWeight: '800' },
  startWaveCriterion: {
    marginLeft: 46,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
