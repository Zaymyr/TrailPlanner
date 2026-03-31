import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { AccordionSection, PlanFormValues } from './contracts';
import type { NumberInputProps } from './NumberInput';
import { styles } from './styles';

type Props = {
  values: PlanFormValues;
  expandedSections: Record<AccordionSection, boolean>;
  toggleSection: (section: AccordionSection) => void;
  update: (key: keyof PlanFormValues, value: PlanFormValues[keyof PlanFormValues]) => void;
  NumberInput: (props: NumberInputProps) => ReactElement;
  waterBagOptions: number[];
};

export function PlanBasicsSection({ values, expandedSections, toggleSection, update, NumberInput, waterBagOptions }: Props) {
  const paceSummary =
    values.paceType === 'pace'
      ? `${String(values.paceMinutes).padStart(2, '0')}:${String(values.paceSeconds).padStart(2, '0')} min/km`
      : `${values.speedKph.toFixed(1)} km/h`;

  return (
    <>
      <TouchableOpacity style={styles.sectionAccordionHeader} onPress={() => toggleSection('course')} activeOpacity={0.8}>
        <Text style={[styles.sectionTitle, styles.sectionAccordionTitle]}>Course</Text>
        <Ionicons
          name={expandedSections.course ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expandedSections.course && (
        <>
          <Text style={styles.label}>Nom du plan</Text>
          <TextInput
            style={styles.textInput}
            value={values.name}
            onChangeText={(t) => update('name', t)}
            placeholder="Ex : UTMB 2025"
            placeholderTextColor={Colors.textMuted}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Distance (km)</Text>
              <NumberInput
                value={values.raceDistanceKm}
                onChange={(v) => update('raceDistanceKm', v)}
                placeholder="50"
              />
            </View>
            <View style={[styles.rowItem, { marginLeft: 12 }]}>
              <Text style={styles.label}>D+ (m)</Text>
              <NumberInput value={values.elevationGain} onChange={(v) => update('elevationGain', v)} placeholder="3000" />
            </View>
          </View>
        </>
      )}
      {!expandedSections.course && (
        <View style={styles.sectionSummaryRow}>
          <Text style={styles.sectionSummaryChip}>{values.name?.trim() || 'Sans nom'}</Text>
          <Text style={styles.sectionSummaryChip}>{values.raceDistanceKm || 0} km</Text>
          <Text style={styles.sectionSummaryChip}>D+ {values.elevationGain || 0} m</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.sectionAccordionHeader, styles.sectionAccordionHeaderSpaced]}
        onPress={() => toggleSection('pace')}
        activeOpacity={0.8}
      >
        <Text style={[styles.sectionTitle, styles.sectionAccordionTitle]}>Allure</Text>
        <Ionicons
          name={expandedSections.pace ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expandedSections.pace && (
        <>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, values.paceType === 'pace' && styles.toggleBtnActive]}
              onPress={() => update('paceType', 'pace')}
            >
              <Text style={[styles.toggleBtnText, values.paceType === 'pace' && styles.toggleBtnTextActive]}>
                Allure (min/km)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, values.paceType === 'speed' && styles.toggleBtnActive]}
              onPress={() => update('paceType', 'speed')}
            >
              <Text style={[styles.toggleBtnText, values.paceType === 'speed' && styles.toggleBtnTextActive]}>
                Vitesse (km/h)
              </Text>
            </TouchableOpacity>
          </View>
          {values.paceType === 'pace' ? (
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Minutes</Text>
                <NumberInput value={values.paceMinutes} onChange={(v) => update('paceMinutes', Math.floor(v))} placeholder="6" />
              </View>
              <View style={[styles.rowItem, { marginLeft: 12 }]}>
                <Text style={styles.label}>Secondes</Text>
                <NumberInput
                  value={values.paceSeconds}
                  onChange={(v) => update('paceSeconds', Math.min(59, Math.floor(v)))}
                  placeholder="30"
                />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Vitesse (km/h)</Text>
              <NumberInput value={values.speedKph} onChange={(v) => update('speedKph', v)} placeholder="10" />
            </>
          )}
        </>
      )}
      {!expandedSections.pace && (
        <View style={styles.sectionSummaryRow}>
          <Text style={styles.sectionSummaryChip}>{paceSummary}</Text>
          <Text style={styles.sectionSummaryChip}>{values.paceType === 'pace' ? 'Mode allure' : 'Mode vitesse'}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.sectionAccordionHeader, styles.sectionAccordionHeaderSpaced]}
        onPress={() => toggleSection('nutrition')}
        activeOpacity={0.8}
      >
        <Text style={[styles.sectionTitle, styles.sectionAccordionTitle]}>Nutrition (cibles/heure)</Text>
        <Ionicons
          name={expandedSections.nutrition ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expandedSections.nutrition && (
        <>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Glucides (g/h)</Text>
              <NumberInput
                value={values.targetIntakePerHour}
                onChange={(v) => update('targetIntakePerHour', v)}
                placeholder="70"
              />
            </View>
            <View style={[styles.rowItem, { marginLeft: 12 }]}>
              <Text style={styles.label}>Eau (ml/h)</Text>
              <NumberInput
                value={values.waterIntakePerHour}
                onChange={(v) => update('waterIntakePerHour', v)}
                placeholder="500"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Sodium (mg/h)</Text>
              <NumberInput
                value={values.sodiumIntakePerHour}
                onChange={(v) => update('sodiumIntakePerHour', v)}
                placeholder="600"
              />
            </View>
            <View style={[styles.rowItem, { marginLeft: 12 }]} />
          </View>

          <Text style={styles.label}>Volume sac à eau</Text>
          <View style={styles.waterBagRow}>
            {waterBagOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.waterBagBtn, values.waterBagLiters === opt && styles.waterBagBtnActive]}
                onPress={() => update('waterBagLiters', opt)}
              >
                <Text style={[styles.waterBagBtnText, values.waterBagLiters === opt && styles.waterBagBtnTextActive]}>
                  {opt}L
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      {!expandedSections.nutrition && (
        <View style={styles.sectionSummaryRow}>
          <Text style={styles.sectionSummaryChip}>{values.targetIntakePerHour || 0} g/h</Text>
          <Text style={styles.sectionSummaryChip}>{values.waterIntakePerHour || 0} ml/h</Text>
          <Text style={styles.sectionSummaryChip}>{values.sodiumIntakePerHour || 0} mg/h</Text>
          <Text style={styles.sectionSummaryChip}>Sac {values.waterBagLiters} L</Text>
        </View>
      )}
    </>
  );
}
