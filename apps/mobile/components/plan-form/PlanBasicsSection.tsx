import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { PanResponder, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import type { AccordionSection, PlanFormValues } from './contracts';
import type { NumberInputProps } from './NumberInput';
import { styles } from './styles';

type Props = {
  values: PlanFormValues;
  expandedSections: Record<AccordionSection, boolean>;
  toggleSection: (section: AccordionSection) => void;
  update: (key: keyof PlanFormValues, value: PlanFormValues[keyof PlanFormValues]) => void;
  hasSectionTimingOverrides: boolean;
  onResetSectionTimingOverrides: () => void;
  NumberInput: (props: NumberInputProps) => ReactElement;
  waterBagOptions: number[];
};

export function PlanBasicsSection({
  values,
  expandedSections,
  toggleSection,
  update,
  hasSectionTimingOverrides,
  onResetSectionTimingOverrides,
  NumberInput,
  waterBagOptions,
}: Props) {
  const { t } = useI18n();
  const [fatigueTrackWidth, setFatigueTrackWidth] = useState(0);
  const paceSummary =
    values.paceType === 'pace'
      ? `${String(values.paceMinutes).padStart(2, '0')}:${String(values.paceSeconds).padStart(2, '0')} min/km`
      : `${values.speedKph.toFixed(1)} km/h`;
  const fatigueLevel = Number.isFinite(values.fatigueLevel) ? Math.min(1, Math.max(0, values.fatigueLevel)) : 0.5;
  const [fatiguePreviewLevel, setFatiguePreviewLevel] = useState(fatigueLevel);
  const isDraggingFatigueRef = useRef(false);
  const dragStartFatigueLevelRef = useRef(fatigueLevel);

  useEffect(() => {
    if (!isDraggingFatigueRef.current) {
      setFatiguePreviewLevel(fatigueLevel);
    }
  }, [fatigueLevel]);

  const displayedFatigueLevel = isDraggingFatigueRef.current ? fatiguePreviewLevel : fatigueLevel;
  const fatigueDescriptor =
    displayedFatigueLevel <= 0.33
      ? t.plans.fatigueLow
      : displayedFatigueLevel >= 0.67
        ? t.plans.fatigueHigh
        : t.plans.fatigueMedium;
  const fatigueThumbOffset = fatigueTrackWidth > 0 ? displayedFatigueLevel * fatigueTrackWidth : 0;
  const fatigueThumbLeft = Math.min(Math.max(0, fatigueThumbOffset - 12), Math.max(0, fatigueTrackWidth - 24));

  const updateFatigueLevel = useCallback(
    (ratio: number, finalize = false) => {
      const bounded = Math.min(1, Math.max(0, ratio));
      setFatiguePreviewLevel(bounded);

      if (finalize) {
        const committedValue = Number(bounded.toFixed(2));
        if (Math.abs(committedValue - values.fatigueLevel) >= 0.009) {
          update('fatigueLevel', committedValue);
        }
      }
    },
    [update, values.fatigueLevel],
  );

  const getFatigueRatioFromLocation = useCallback(
    (locationX: number) => {
      if (fatigueTrackWidth <= 0) return 0;
      return Math.min(1, Math.max(0, locationX / fatigueTrackWidth));
    },
    [fatigueTrackWidth],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          isDraggingFatigueRef.current = true;
          const initialRatio = getFatigueRatioFromLocation(event.nativeEvent.locationX);
          dragStartFatigueLevelRef.current = initialRatio;
          updateFatigueLevel(initialRatio);
        },
        onPanResponderMove: (_event, gestureState) => {
          if (fatigueTrackWidth <= 0) return;
          const nextRatio = dragStartFatigueLevelRef.current + gestureState.dx / fatigueTrackWidth;
          updateFatigueLevel(nextRatio);
        },
        onPanResponderRelease: (event) => {
          isDraggingFatigueRef.current = false;
          updateFatigueLevel(getFatigueRatioFromLocation(event.nativeEvent.locationX), true);
        },
        onPanResponderTerminate: (event) => {
          isDraggingFatigueRef.current = false;
          updateFatigueLevel(getFatigueRatioFromLocation(event.nativeEvent.locationX), true);
        },
      }),
    [getFatigueRatioFromLocation, updateFatigueLevel],
  );

  const renderAccordionHeader = (
    section: AccordionSection,
    title: string,
    summaryChips: string[],
    spaced = false,
  ) => (
    <TouchableOpacity
      style={[
        styles.sectionAccordionHeader,
        spaced && styles.sectionAccordionHeaderSpaced,
        !expandedSections[section] && styles.sectionAccordionHeaderCollapsed,
      ]}
      onPress={() => toggleSection(section)}
      activeOpacity={0.8}
    >
      <View style={styles.sectionAccordionHeaderContent}>
        <View style={styles.sectionAccordionTitleRow}>
          <Text style={[styles.sectionTitle, styles.sectionAccordionTitle]}>{title}</Text>
          {!expandedSections[section] && (
            <View style={styles.sectionSummaryRowInline}>
              {summaryChips.map((chip) => (
                <Text key={`${section}-${chip}`} style={styles.sectionSummaryChipInline}>
                  {chip}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
      <Ionicons
        name={expandedSections[section] ? 'chevron-up' : 'chevron-down'}
        size={18}
        color={Colors.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <>
      {renderAccordionHeader('course', 'Course', [
        values.name?.trim() || 'Sans nom',
        `${values.raceDistanceKm || 0} km`,
        `D+ ${values.elevationGain || 0} m`,
      ])}
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

      {renderAccordionHeader(
        'pace',
        'Allure',
        [paceSummary, fatigueDescriptor],
        true,
      )}
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

          <Text style={styles.label}>{t.plans.fatigueLabel}</Text>
          <Text style={styles.waterBagHint}>{t.plans.fatigueHint}</Text>
          <View style={styles.fatigueSliderWrap}>
            <View style={styles.fatigueSliderTrack}>
              <View
                style={styles.fatigueSliderTouchArea}
                onLayout={(event) => setFatigueTrackWidth(event.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
              />
              <View style={[styles.fatigueSliderFill, { width: `${displayedFatigueLevel * 100}%` }]} />
              <View style={[styles.fatigueSliderThumb, { left: fatigueThumbLeft }]} />
            </View>
          </View>
          <View style={styles.fatigueSliderLabels}>
            {[
              { label: t.plans.fatigueLow, active: displayedFatigueLevel <= 0.33 },
              { label: t.plans.fatigueMedium, active: displayedFatigueLevel > 0.33 && displayedFatigueLevel < 0.67 },
              { label: t.plans.fatigueHigh, active: displayedFatigueLevel >= 0.67 },
            ].map((option) => (
              <Text
                key={option.label}
                style={[styles.fatigueSliderLabel, option.active && styles.fatigueSliderLabelActive]}
              >
                {option.label}
              </Text>
            ))}
          </View>
          {hasSectionTimingOverrides ? (
            <View style={styles.sectionTimingResetBox}>
              <Text style={styles.sectionTimingResetHint}>{t.plans.sectionTimingLockedHint}</Text>
              <TouchableOpacity style={styles.sectionTimingResetButton} onPress={onResetSectionTimingOverrides}>
                <Text style={styles.sectionTimingResetButtonText}>{t.plans.sectionTimingReset}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}

      {renderAccordionHeader(
        'nutrition',
        'Nutrition',
        [
          `${values.targetIntakePerHour || 0} g/h`,
          `${values.waterIntakePerHour || 0} ml/h`,
          `${values.sodiumIntakePerHour || 0} mg/h`,
          `Poche eau ${values.waterBagLiters} L`,
        ],
        true,
      )}
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

          <Text style={styles.label}>Volume de la poche à eau</Text>
          <Text style={styles.waterBagHint}>Capacité de ta poche à eau, pas le volume total du sac/gilet.</Text>
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
    </>
  );
}
