import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import type { AidStationFormItem } from '../PlanForm';
import type { GaugeMetric } from './GaugeArc';
import { styles } from './styles';

type EditingStation = {
  index: number;
  name: string;
  km: string;
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
  renderGauges: (
    target: 'start' | number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
    compact?: boolean,
  ) => JSX.Element;
  renderSupplies: (target: 'start' | number) => JSX.Element;
  getGaugeMetrics: (
    target: 'start' | number,
    sectionTarget?: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number },
  ) => GaugeMetric[];
  getGaugeColor: (key: GaugeMetric['key'], ratio: number) => string;
};

export function AidStationsSection({
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
}: Props) {
  function getCollapsedTint(target: 'start' | number, sectionTarget: { targetCarbsG: number; targetSodiumMg: number; targetWaterMl: number }) {
    const metrics = getGaugeMetrics(target, sectionTarget);
    const statuses = metrics.map((m) => getGaugeColor(m.key, m.ratio));
    const allGreen = statuses.every((c) => c === '#2D5016');
    const hasRed = statuses.some((c) => c === '#EF4444');
    if (allGreen) return styles.stationCardCollapsedGreen;
    if (hasRed) return styles.stationCardCollapsedRed;
    return styles.stationCardCollapsedOrange;
  }

  return (
    <>
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Ravitaillements</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.fillBtn} onPress={fillSuppliesAuto}>
            <Text style={styles.fillBtnText}>⭐ Remplir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={addAidStation}>
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {intermediateCount === 0 && (
        <Text style={styles.emptyText}>Pas de ravito intermédiaire. Utilise "+ Ajouter" pour en créer.</Text>
      )}

      {(() => {
        const elements: React.ReactElement[] = [];
        const speedKph =
          values.paceType === 'pace'
            ? 60 / Math.max(values.paceMinutes + values.paceSeconds / 60, 0.01)
            : Math.max(values.speedKph, 0.1);

        values.aidStations.forEach((station, index) => {
          const isDepart = station.id === departId;
          const isArrivee = station.id === arriveeId;
          const stationKey = station.id ?? String(index);
          const isExpanded = expandedStations.has(stationKey);

          const nextSt = index < values.aidStations.length - 1 ? values.aidStations[index + 1] : null;
          const sectionDistKm = nextSt ? Math.max(nextSt.distanceKm - station.distanceKm, 0) : 0;
          const sectionDurationH = sectionDistKm / speedKph;
          const sectionTarget = {
            targetCarbsG: values.targetIntakePerHour * sectionDurationH,
            targetSodiumMg: values.sodiumIntakePerHour * sectionDurationH,
            targetWaterMl: values.waterIntakePerHour * sectionDurationH,
          };

          let card: React.ReactElement;

          if (isDepart) {
            const collapsedTintStyle = getCollapsedTint('start', sectionTarget);
            card = (
              <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]}>
                <TouchableOpacity
                  onPress={() => toggleStation(stationKey)}
                  activeOpacity={0.7}
                  style={styles.stationHeaderRow}
                >
                  <Text style={styles.stationIcon}>🟢</Text>
                  <Text style={styles.stationName}>{station.name}</Text>
                  <Text style={styles.stationKm}>{station.distanceKm} km</Text>
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
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
                  <Text style={styles.stationIcon}>🏁</Text>
                  <Text style={styles.stationName}>{station.name}</Text>
                  <Text style={styles.stationKm}>{station.distanceKm} km</Text>
                </View>
              </View>
            );
          } else {
            const collapsedTintStyle = getCollapsedTint(index, sectionTarget);
            card = (
              <View key={stationKey} style={[styles.stationCard, !isExpanded && collapsedTintStyle]}>
                <TouchableOpacity
                  onPress={() => toggleStation(stationKey)}
                  activeOpacity={0.7}
                  style={styles.stationHeaderRow}
                >
                  <Text style={styles.stationIcon}>📍</Text>
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
                  <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
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
            const hours = Math.floor(durationMin / 60);
            const mins = Math.round(durationMin % 60);
            const timeLabel = hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}min`;
            elements.push(
              <View key={`sep-${index}`} style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>
                  {distKm.toFixed(1)} km · {timeLabel}
                </Text>
                <View style={styles.separatorLine} />
              </View>,
            );
          }
        });
        return elements;
      })()}
    </>
  );
}
