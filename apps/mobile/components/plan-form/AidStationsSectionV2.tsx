import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { AidStationFormItem } from '../PlanForm';
import type { GaugeMetric } from './GaugeArc';
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

type Props = {
  values: {
    paceType: 'pace' | 'speed';
    paceMinutes: number;
    paceSeconds: number;
    speedKph: number;
    targetIntakePerHour: number;
    sodiumIntakePerHour: number;
    waterIntakePerHour: number;
    aidStations: AidStationFormItem[];
  };
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
  getSectionIntakeTimeline: (
    target: 'start' | number,
    sectionDurationMin: number,
    sectionTarget?: SectionTarget,
  ) => TimelineItem[];
};

export function AidStationsSectionV2({
  values,
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
  getSectionIntakeTimeline,
}: Props) {
  const [viewMode, setViewMode] = useState<'stations' | 'sections'>('stations');

  function formatTimelineMinute(minute: number) {
    if (minute <= 0) return 'Depart';
    return `${minute} min`;
  }

  function getCollapsedTint(target: 'start' | number, sectionTarget: SectionTarget) {
    const metrics = getGaugeMetrics(target, sectionTarget);
    const statuses = metrics.map((m) => getGaugeColor(m.key, m.ratio));
    const allGreen = statuses.every((c) => c === '#2D5016');
    const hasRed = statuses.some((c) => c === '#EF4444');
    if (allGreen) return styles.stationCardCollapsedGreen;
    if (hasRed) return styles.stationCardCollapsedRed;
    return styles.stationCardCollapsedOrange;
  }

  function getSpeedKph() {
    return values.paceType === 'pace'
      ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
      : Math.max(values.speedKph, 0.1);
  }

  function getSectionTarget(station: AidStationFormItem, nextStation: AidStationFormItem | null): SectionTarget {
    const speedKph = getSpeedKph();
    const sectionDistKm = nextStation ? Math.max(nextStation.distanceKm - station.distanceKm, 0) : 0;
    const sectionDurationH = sectionDistKm / speedKph;
    return {
      targetCarbsG: values.targetIntakePerHour * sectionDurationH,
      targetSodiumMg: values.sodiumIntakePerHour * sectionDurationH,
      targetWaterMl: values.waterIntakePerHour * sectionDurationH,
    };
  }

  function formatSectionDuration(durationMin: number) {
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
  }

  function renderStationsView() {
    const elements: JSX.Element[] = [];
    const speedKph = getSpeedKph();

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const stationKey = station.id ?? String(index);
      const isExpanded = expandedStations.has(stationKey);

      const nextSt = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const sectionTarget = getSectionTarget(station, nextSt);

      let card: JSX.Element;

      if (isDepart) {
        const collapsedTintStyle = getCollapsedTint('start', sectionTarget);
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
                {renderGauges('start', sectionTarget)}
                {renderSupplies('start')}
              </>
            )}
            {!isExpanded && (
              <View style={styles.collapsedGaugeRow}>
                {renderGauges('start', sectionTarget, true)}
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
        const collapsedTintStyle = getCollapsedTint(index, sectionTarget);
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
                {renderGauges(index, sectionTarget)}
                {renderSupplies(index)}
              </>
            )}
            {!isExpanded && (
              <View style={styles.collapsedGaugeRow}>
                {renderGauges(index, sectionTarget, true)}
              </View>
            )}
          </View>
        );
      }

      elements.push(card);

      if (index < values.aidStations.length - 1) {
        const distKm = nextSt ? nextSt.distanceKm - station.distanceKm : 0;
        const durationMin = (distKm / speedKph) * 60;
        elements.push(
          <View key={`sep-${index}`} style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>
              {distKm.toFixed(1)} km - {formatSectionDuration(durationMin)}
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
    const speedKph = getSpeedKph();

    values.aidStations.forEach((station, index) => {
      const isDepart = station.id === departId;
      const isArrivee = station.id === arriveeId;
      const nextSt = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
      const stationTargetKey: 'start' | number = isDepart ? 'start' : index;
      const sectionTarget = getSectionTarget(station, nextSt);

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

      if (!nextSt || isArrivee) return;

      const distKm = Math.max(nextSt.distanceKm - station.distanceKm, 0);
      const durationMin = (distKm / speedKph) * 60;
      const sectionTimeline = getSectionIntakeTimeline(stationTargetKey, Math.max(0, durationMin), sectionTarget);

      elements.push(
        <View key={`section-card-${station.id ?? index}`} style={styles.sectionViewCard}>
          <View style={styles.sectionViewHeader}>
            <Text style={styles.sectionViewTitle} numberOfLines={1}>
              {station.name} vers {nextSt.name}
            </Text>
            <Text style={styles.sectionViewMeta}>
              {distKm.toFixed(1)} km - {formatSectionDuration(durationMin)}
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
          style={[styles.toggleBtn, viewMode === 'stations' && styles.toggleBtnActive]}
          onPress={() => setViewMode('stations')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'stations' && styles.toggleBtnTextActive]}>Ravitos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'sections' && styles.toggleBtnActive]}
          onPress={() => setViewMode('sections')}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleBtnText, viewMode === 'sections' && styles.toggleBtnTextActive]}>Sections</Text>
        </TouchableOpacity>
      </View>

      {intermediateCount === 0 && viewMode === 'stations' && (
        <Text style={styles.emptyText}>Pas de ravito intermediaire. Utilise "+ Ajouter" pour en creer.</Text>
      )}

      {viewMode === 'stations' ? renderStationsView() : renderSectionsView()}
    </>
  );
}
