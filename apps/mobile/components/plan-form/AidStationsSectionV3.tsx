import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import type { AidStationFormItem, ElevationPoint, SectionSegment, SectionSubSegmentStats } from '../PlanForm';
import type { GaugeMetric } from './GaugeArc';
import { ProfileMiniChart } from './ProfileMiniChart';
import { getElevationSlice } from './profile-utils';
import { styles } from './styles';

type EditingStation = {
  index: number;
  name: string;
  km: string;
};

type SectionTarget = {
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
};

type TimelineItem = {
  minute: number;
  label: string;
  detail: string;
  immediate?: boolean;
};

type SectionSummary = {
  sectionIndex: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  durationMin: number;
  targetCarbsG: number;
  targetSodiumMg: number;
  targetWaterMl: number;
  profilePoints: ElevationPoint[];
  segments: SectionSegment[];
  segmentStats: SectionSubSegmentStats[];
  hasStoredSegments: boolean;
};

type Props = {
  values: {
    sectionSegments?: Record<string, SectionSegment[]>;
    aidStations: AidStationFormItem[];
  };
  basePaceMinutesPerKm: number;
  departId: string;
  arriveeId: string;
  expandedStations: Set<string>;
  toggleStation: (stationKey: string) => void;
  setEditingStation: (value: EditingStation) => void;
  removeAidStation: (index: number) => void;
  addAidStation: () => void;
  fillSuppliesAuto: () => void;
  intermediateCount: number;
  renderGauges: (target: 'start' | number, sectionTarget?: SectionTarget, compact?: boolean) => JSX.Element;
  renderSupplies: (target: 'start' | number) => JSX.Element;
  getGaugeMetrics: (target: 'start' | number, sectionTarget?: SectionTarget) => GaugeMetric[];
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
  getSectionSummary: (target: 'start' | number) => SectionSummary | null;
  getSectionIntakeTimeline: (
    target: 'start' | number,
    sectionDurationMin: number,
    sectionTarget?: SectionTarget,
  ) => TimelineItem[];
  onSplitSectionSegment: (target: 'start' | number, segmentIndex: number) => void;
  onRemoveSectionSegment: (target: 'start' | number, segmentIndex: number) => void;
  onUpdateSectionSegmentPaceAdjustment: (
    target: 'start' | number,
    segmentIndex: number,
    paceAdjustmentMinutesPerKm: number | undefined,
  ) => void;
};

export function AidStationsSectionV3({
  values,
  basePaceMinutesPerKm,
  departId,
  arriveeId,
  expandedStations,
  toggleStation,
  setEditingStation,
  removeAidStation,
  addAidStation,
  fillSuppliesAuto,
  intermediateCount,
  renderGauges,
  renderSupplies,
  getGaugeMetrics,
  getGaugeColor,
  getSectionSummary,
  getSectionIntakeTimeline,
  onSplitSectionSegment,
  onRemoveSectionSegment,
  onUpdateSectionSegmentPaceAdjustment,
}: Props) {
  const [selectedViewMode, setSelectedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [displayedViewMode, setDisplayedViewMode] = useState<'stations' | 'sections' | 'profile'>('stations');
  const [paceDrafts, setPaceDrafts] = useState<Record<string, string>>({});
  const paceStepMinutes = 5 / 60;
  const tabTransition = useRef(new Animated.Value(1)).current;
  const isSwitchingView = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  function formatTimelineMinute(minute: number) {
    if (minute <= 0) return 'Depart';
    return `${minute} min`;
  }

  function formatSectionDuration(durationMin: number) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
  }

  function formatPace(minutesPerKm: number) {
    const safeValue = Math.max(0.01, minutesPerKm);
    const minutes = Math.floor(safeValue);
    const seconds = Math.round((safeValue - minutes) * 60);
    if (seconds === 60) {
      return `${minutes + 1}:00`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function parsePaceInput(text: string) {
    const trimmed = text.trim().replace(',', '.');
    if (trimmed === '') return undefined;

    if (trimmed.includes(':')) {
      const [minutesPart, secondsPart = '0'] = trimmed.split(':');
      const minutes = Number(minutesPart);
      const seconds = Number(secondsPart);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0) {
        return null;
      }
      return minutes + seconds / 60;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function setPaceDraft(key: string, value: string) {
    setPaceDrafts((prev) => ({ ...prev, [key]: value }));
  }

  function clearPaceDraft(key: string) {
    setPaceDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function applyAbsolutePace(
    target: 'start' | number,
    segmentIndex: number,
    paceMinutesPerKm: number | undefined,
    draftKey?: string,
  ) {
    if (paceMinutesPerKm === undefined) {
      onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, undefined);
      if (draftKey) clearPaceDraft(draftKey);
      return;
    }

    const nextPace = Math.max(0.01, paceMinutesPerKm);
    onUpdateSectionSegmentPaceAdjustment(target, segmentIndex, nextPace - basePaceMinutesPerKm);
    if (draftKey) {
      setPaceDraft(draftKey, formatPace(nextPace));
    }
  }

  function switchViewMode(nextMode: 'stations' | 'sections' | 'profile') {
    if (nextMode === selectedViewMode || isSwitchingView.current) return;

    setSelectedViewMode(nextMode);
    isSwitchingView.current = true;

    Animated.timing(tabTransition, {
      toValue: 0,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext({
        duration: 190,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
          duration: 140,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
          springDamping: 0.88,
          duration: 190,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
          duration: 100,
        },
      });

      setDisplayedViewMode(nextMode);
      tabTransition.setValue(0);

      Animated.timing(tabTransition, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        isSwitchingView.current = false;
      });
    });
  }

  function formatSectionTarget(summary: SectionSummary | null): SectionTarget {
    return {
      targetCarbsG: summary?.targetCarbsG ?? 0,
      targetSodiumMg: summary?.targetSodiumMg ?? 0,
      targetWaterMl: summary?.targetWaterMl ?? 0,
    };
  }

  function getCollapsedTint(target: 'start' | number, summary: SectionSummary | null) {
    const metrics = getGaugeMetrics(target, formatSectionTarget(summary));
    const statuses = metrics.map((metric) => getGaugeColor(metric.key, metric.ratio));
    const allGreen = statuses.every((color) => color === '#2D5016');
    const hasRed = statuses.some((color) => color === '#EF4444');
    if (allGreen) return styles.stationCardCollapsedGreen;
    if (hasRed) return styles.stationCardCollapsedRed;
    return styles.stationCardCollapsedOrange;
  }

  function getSegmentLabel(label: string | undefined, index: number) {
    if (label === 'climb') return 'Montee';
    if (label === 'descent') return 'Descente';
    if (label === 'flat') return 'Plat';
    return `Segment ${index + 1}`;
  }

  function getSegmentCardTitle(label: string | undefined, index: number) {
    const baseLabel = getSegmentLabel(label, index);
    return baseLabel.startsWith('Segment') ? baseLabel : `${baseLabel} ${index + 1}`;
  }

  function renderStationsView() {
    const elements: JSX.Element[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const stationKey = station.id ?? String(index);
      const isExpanded = expandedStations.has(stationKey);
      const targetKey: 'start' | number = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      let card: JSX.Element;

      if (isDepart) {
        const collapsedTintStyle = getCollapsedTint('start', summary);
        card = (
          <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]}>
            <TouchableOpacity onPress={() => toggleStation(stationKey)} activeOpacity={0.7} style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>D</Text>
              <Text style={styles.stationName}>{station.name}</Text>
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </TouchableOpacity>
            {isExpanded && (
              <>
                <View style={styles.cardDivider} />
                {renderGauges('start', formatSectionTarget(summary))}
                {renderSupplies('start')}
              </>
            )}
            {!isExpanded && (
              <View style={styles.collapsedGaugeRow}>
                {renderGauges('start', formatSectionTarget(summary), true)}
              </View>
            )}
          </View>
        );
      } else if (isArrivee) {
        card = (
          <View key={stationKey} style={styles.stationCard}>
            <View style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>A</Text>
              <Text style={styles.stationName}>{station.name}</Text>
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
            </View>
          </View>
        );
      } else {
        const collapsedTintStyle = getCollapsedTint(index, summary);
        card = (
          <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]}>
            <TouchableOpacity onPress={() => toggleStation(stationKey)} activeOpacity={0.7} style={styles.stationHeaderRow}>
              <Text style={styles.stationIcon}>R</Text>
              <Text style={styles.stationName} numberOfLines={1}>
                {station.name}
              </Text>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setEditingStation({ index, name: station.name, km: String(station.distanceKm) })}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="create-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => removeAidStation(index)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons name="trash-outline" size={16} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.stationKm}>{station.distanceKm} km</Text>
              <Text style={styles.chevron}>{isExpanded ? '^' : 'v'}</Text>
            </TouchableOpacity>
            {isExpanded && (
              <>
                <View style={styles.cardDivider} />
                {renderGauges(index, formatSectionTarget(summary))}
                {renderSupplies(index)}
              </>
            )}
            {!isExpanded && (
              <View style={styles.collapsedGaugeRow}>
                {renderGauges(index, formatSectionTarget(summary), true)}
              </View>
            )}
          </View>
        );
      }

      elements.push(card);

      if (index < values.aidStations.length - 1 && summary) {
        elements.push(
          <View key={`sep-${index}`} style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
            <View style={styles.separatorLine} />
          </View>,
        );
      }
    });

    return elements;
  }

  function renderSectionsView() {
    const elements: JSX.Element[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const nextStation = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const targetKey: 'start' | number = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      elements.push(
        <View key={`station-line-${station.id ?? index}`} style={styles.sectionStationRow}>
          <View style={styles.sectionStationLine} />
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

      const sectionTimeline = getSectionIntakeTimeline(targetKey, Math.max(0, summary.durationMin), formatSectionTarget(summary));

      elements.push(
        <View key={`section-card-${station.id ?? index}`} style={styles.sectionViewCard}>
          <View style={styles.sectionViewHeader}>
            <Text style={styles.sectionViewTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Text>
            <Text style={styles.sectionViewMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
          </View>
          {sectionTimeline.length === 0 ? (
            <Text style={styles.sectionTimelineEmpty}>Aucune prise prevue</Text>
          ) : (
            sectionTimeline.map((item, timelineIndex) => (
              <View
                key={`timeline-${station.id ?? index}-${item.minute}-${item.label}-${timelineIndex}`}
                style={[
                  styles.sectionTimelineRow,
                  timelineIndex === sectionTimeline.length - 1 ? styles.sectionTimelineRowLast : null,
                ]}
              >
                <Text style={styles.sectionTimelineTime}>{formatTimelineMinute(item.minute)}</Text>
                <View style={styles.sectionTimelineInfo}>
                  <Text style={styles.sectionTimelineLabel}>{item.label}</Text>
                  <Text style={styles.sectionTimelineDetail}>{item.detail}</Text>
                </View>
              </View>
            ))
          )}
        </View>,
      );
    });

    return elements;
  }

  function renderProfileView() {
    const elements: JSX.Element[] = [];

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const nextStation = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const targetKey: 'start' | number = isDepart ? 'start' : index;
      const summary = !isArrivee ? getSectionSummary(targetKey) : null;

      elements.push(
        <View key={`profile-station-line-${station.id ?? index}`} style={styles.sectionStationRow}>
          <View style={styles.sectionStationLine} />
          <Text style={styles.sectionStationLabel} numberOfLines={1}>
            {station.name}
          </Text>
          <Text style={styles.sectionStationKm}>{station.distanceKm} km</Text>
          <View style={styles.sectionStationLine} />
        </View>,
      );

      if (!nextStation || isArrivee || !summary) return;

      elements.push(
        <View key={`profile-section-${station.id ?? index}`} style={styles.profileSectionBlock}>
          <View style={styles.profileSectionHeader}>
            <Text style={styles.profileTitle} numberOfLines={1}>
              {station.name} vers {nextStation.name}
            </Text>
            <Text style={styles.profileMeta}>
              {summary.distanceKm.toFixed(1)} km - {formatSectionDuration(summary.durationMin)}
            </Text>
          </View>

          {summary.segmentStats.length === 0 ? (
            <Text style={styles.profileEmptyText}>Aucun decoupage disponible pour cette section.</Text>
          ) : (
            <View style={styles.profileSegmentsList}>
              {summary.segmentStats.map((segmentStat, segmentIndex) => {
                const segment = summary.segments[segmentIndex];
                if (!segment) return null;

                const currentPaceMinutes =
                  Math.max(
                    0.01,
                    basePaceMinutesPerKm +
                      (typeof segment.paceAdjustmentMinutesPerKm === 'number' && Number.isFinite(segment.paceAdjustmentMinutesPerKm)
                        ? segment.paceAdjustmentMinutesPerKm
                        : 0),
                  );
                const paceDraftKey = `${summary.sectionIndex}-${segmentIndex}`;
                const adjustmentValue = paceDrafts[paceDraftKey] ?? formatPace(currentPaceMinutes);
                const segmentProfile = getElevationSlice(
                  summary.profilePoints,
                  segmentStat.startDistanceKm,
                  segmentStat.endDistanceKm,
                );
                const canSplit = segment.segmentKm > 0.02;
                const canRemove = segmentIndex > 0 && summary.segments.length > 1;

                return (
                  <View key={`sub-segment-${summary.sectionIndex}-${segmentIndex}`} style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                      <View style={styles.profileHeaderText}>
                        <Text style={styles.profileSegmentLabel}>{getSegmentCardTitle(segment.label, segmentIndex)}</Text>
                        <Text style={styles.profileSegmentTimeLabel}>Temps estime</Text>
                        <Text style={styles.profileSegmentTime}>{formatSectionDuration(segmentStat.etaSeconds / 60)}</Text>
                      </View>
                      <View style={styles.profilePaceWrap}>
                        <Text style={styles.profilePaceLabel}>Allure</Text>
                        <View style={styles.profilePaceControlRow}>
                          <TouchableOpacity
                            style={styles.profilePaceStepBtn}
                            onPress={() => applyAbsolutePace(targetKey, segmentIndex, currentPaceMinutes - paceStepMinutes, paceDraftKey)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profilePaceStepBtnText}>-</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={styles.profilePaceInput}
                            value={adjustmentValue}
                            onChangeText={(text) => {
                              setPaceDraft(paceDraftKey, text);
                              const parsed = parsePaceInput(text);
                              if (parsed === undefined) {
                                onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                                return;
                              }
                              if (parsed !== null) {
                                applyAbsolutePace(targetKey, segmentIndex, parsed);
                              }
                            }}
                            onBlur={() => {
                              const draft = paceDrafts[paceDraftKey];
                              const parsed = parsePaceInput(draft ?? adjustmentValue);
                              if (parsed === undefined) {
                                onUpdateSectionSegmentPaceAdjustment(targetKey, segmentIndex, undefined);
                              } else if (parsed !== null) {
                                applyAbsolutePace(targetKey, segmentIndex, parsed);
                              }
                              clearPaceDraft(paceDraftKey);
                            }}
                            keyboardType="numbers-and-punctuation"
                            placeholder="6:00"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            style={styles.profilePaceStepBtn}
                            onPress={() => applyAbsolutePace(targetKey, segmentIndex, currentPaceMinutes + paceStepMinutes, paceDraftKey)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profilePaceStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.profilePaceHint}>min/km</Text>
                      </View>
                    </View>

                    {segmentProfile.length > 1 ? (
                      <ProfileMiniChart points={segmentProfile} />
                    ) : (
                      <Text style={styles.profileEmptyText}>Profil indisponible pour ce segment.</Text>
                    )}

                    <View style={styles.profileMetricsRow}>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>{segmentStat.distKm.toFixed(2)} km</Text>
                      </View>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>D+ {Math.round(segmentStat.dPlus)} m</Text>
                      </View>
                      <View style={styles.profileMetricPill}>
                        <Text style={styles.profileMetricPillText}>D- {Math.round(segmentStat.dMinus)} m</Text>
                      </View>
                    </View>

                    <View style={styles.profileSegmentControls}>
                      <View style={styles.profileSegmentActions}>
                        <TouchableOpacity
                          style={[styles.profileActionBtn, !canSplit && styles.profileActionBtnDisabled]}
                          onPress={() => onSplitSectionSegment(targetKey, segmentIndex)}
                          activeOpacity={0.8}
                          disabled={!canSplit}
                        >
                          <Text style={styles.profileActionBtnText}>Decouper plus finement</Text>
                        </TouchableOpacity>

                        {canRemove ? (
                          <TouchableOpacity
                            style={[styles.profileActionBtn, styles.profileDeleteBtn]}
                            onPress={() => onRemoveSectionSegment(targetKey, segmentIndex)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.profileDeleteBtnText}>Supprimer et fusionner</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>,
      );
    });

    return elements;
  }

  function renderActiveView() {
    if (displayedViewMode === 'stations') {
      return (
        <>
          {intermediateCount === 0 && (
            <Text style={styles.emptyText}>Pas de ravito intermediaire. Utilise "+ Ajouter" pour en creer.</Text>
          )}
          {renderStationsView()}
        </>
      );
    }

    if (displayedViewMode === 'sections') {
      return renderSectionsView();
    }

    return renderProfileView();
  }

  const animatedContentStyle = {
    opacity: tabTransition,
    transform: [
      {
        scale: tabTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.975, 1],
        }),
      },
      {
        translateY: tabTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  return (
    <>
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Ravitaillements</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.fillBtn} onPress={fillSuppliesAuto}>
            <Text style={styles.fillBtnText}>Remplir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'stations' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('stations')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'stations' && styles.toggleBtnTextActive]}>Ravitos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'sections' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('sections')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'sections' && styles.toggleBtnTextActive]}>Sections</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, selectedViewMode === 'profile' && styles.toggleBtnActive]}
          onPress={() => switchViewMode('profile')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, selectedViewMode === 'profile' && styles.toggleBtnTextActive]}>Profil</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={animatedContentStyle}>{renderActiveView()}</Animated.View>
    </>
  );
}
