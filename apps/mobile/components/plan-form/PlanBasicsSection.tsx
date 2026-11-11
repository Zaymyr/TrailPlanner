import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { DataText } from '../themed/DataText';
import { Field } from '../themed/Field';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import type { AccordionSection, PlanFormValues } from './contracts';
import type { NumberInputProps } from './NumberInput';
import { styles } from './styles';
import { formatDistance } from '../../lib/displayFormat';

type Props = {
  values: PlanFormValues;
  expandedSections: Record<AccordionSection, boolean>;
  toggleSection: (section: AccordionSection) => void;
  settingsVisible: boolean;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  update: (key: keyof PlanFormValues, value: PlanFormValues[keyof PlanFormValues]) => void;
  hasSectionTimingOverrides: boolean;
  onResetSectionTimingOverrides: () => void;
  NumberInput: (props: NumberInputProps) => ReactElement;
  waterBagOptions: number[];
  onCustomWaterBagFocus?: (input: TextInput | null) => void;
  inline?: boolean;
  isLinkedRace?: boolean;
};

type WaterBagCapacitySelectorProps = {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  onCustomValueFocus?: (input: TextInput | null) => void;
};

function WaterBagCapacitySelector({ value, options, onChange, onCustomValueFocus }: WaterBagCapacitySelectorProps) {
  const isPresetValue = options.some((option) => option === value);
  const [isEditingCustomValue, setIsEditingCustomValue] = useState(false);
  const [customValueDraft, setCustomValueDraft] = useState(() => (isPresetValue ? '' : String(value)));
  const customValueInputRef = useRef<TextInput>(null);
  const skipCustomBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isEditingCustomValue) {
      setCustomValueDraft(isPresetValue ? '' : String(value));
    }
  }, [isEditingCustomValue, isPresetValue, value]);

  const parseCustomValue = (text: string) => {
    const normalized = text.trim().replace(',', '.');
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const handleCustomValueChange = (text: string) => {
    setCustomValueDraft(text);
    const parsed = parseCustomValue(text);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleCustomValueBlur = () => {
    setIsEditingCustomValue(false);
    if (skipCustomBlurCommitRef.current) {
      skipCustomBlurCommitRef.current = false;
      return;
    }
    const parsed = parseCustomValue(customValueDraft);
    if (parsed === null) {
      setCustomValueDraft(isPresetValue ? '' : String(value));
      return;
    }
    setCustomValueDraft(String(parsed));
    onChange(parsed);
  };

  return (
    <>
      <View style={styles.waterBagRow}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.waterBagBtn, value === option && styles.waterBagBtnActive]}
            onPress={() => {
              if (isEditingCustomValue) {
                skipCustomBlurCommitRef.current = true;
                customValueInputRef.current?.blur();
              }
              setIsEditingCustomValue(false);
              setCustomValueDraft('');
              onChange(option);
            }}
          >
            <Text style={[styles.waterBagBtnText, value === option && styles.waterBagBtnTextActive]}>{option}L</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.waterBagCustomField}>
        <Field
          ref={customValueInputRef}
          accessibilityLabel="Volume personnalisé de la poche à eau en litres"
          containerStyle={styles.formField}
          inputAccessoryViewID="pace-yourself-numeric-keyboard"
          keyboardType="decimal-pad"
          label="Valeur personnalisée"
          onBlur={handleCustomValueBlur}
          onChangeText={handleCustomValueChange}
          onFocus={() => {
            setIsEditingCustomValue(true);
            onCustomValueFocus?.(customValueInputRef.current);
          }}
          placeholder="Ex : 1,75"
          unit="L"
          value={customValueDraft}
        />
      </View>
    </>
  );
}

export function PlanBasicsSection({
  values,
  expandedSections,
  toggleSection,
  settingsVisible,
  onOpenSettings,
  onCloseSettings,
  update,
  hasSectionTimingOverrides,
  onResetSectionTimingOverrides,
  NumberInput,
  waterBagOptions,
  onCustomWaterBagFocus,
  inline = false,
  isLinkedRace = false,
}: Props) {
  const { locale, t } = useI18n();
  const [fatigueTrackWidth, setFatigueTrackWidth] = useState(0);
  const paceSummary =
    values.paceType === 'pace'
      ? `${String(values.paceMinutes).padStart(2, '0')}:${String(values.paceSeconds).padStart(2, '0')} min/km`
      : `${values.speedKph.toFixed(1)} km/h`;
  const settingsMetaSummary = [
    formatDistance(values.raceDistanceKm || 0, locale),
    `D+ ${values.elevationGain || 0} m`,
    `${values.targetIntakePerHour || 0} g/h`,
    `${values.waterIntakePerHour || 0} ml/h`,
    `${values.sodiumIntakePerHour || 0} mg/h`,
  ].join(' · ');
  const fatigueLevel = Number.isFinite(values.fatigueLevel) ? Math.min(1, Math.max(0, values.fatigueLevel)) : 0.5;
  const [fatiguePreviewLevel, setFatiguePreviewLevel] = useState(fatigueLevel);
  const isDraggingFatigueRef = useRef(false);
  const fatigueGestureDidDragRef = useRef(false);
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
        // Let the enclosing ScrollView keep vertical drags. The slider takes
        // ownership only once a deliberate horizontal gesture is established.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          return Math.abs(gestureState.dx) > 4 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderGrant: (event) => {
          isDraggingFatigueRef.current = true;
          fatigueGestureDidDragRef.current = true;
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
    [fatigueTrackWidth, getFatigueRatioFromLocation, updateFatigueLevel],
  );

  const handleFatigueTrackTouchStart = () => {
    fatigueGestureDidDragRef.current = false;
  };

  const handleFatigueTrackTouchEnd = (event: { nativeEvent: { locationX: number } }) => {
    if (fatigueGestureDidDragRef.current) return;
    updateFatigueLevel(getFatigueRatioFromLocation(event.nativeEvent.locationX), true);
  };

  const renderAccordionHeader = (
    section: AccordionSection,
    title: string,
    summaryChips: string[],
    spaced = false,
  ) => inline ? (
    <View style={styles.inlineSettingsHeader}>
      <View style={styles.inlineSettingsHeaderIcon}>
        <Ionicons
          name={section === 'course' ? 'flag-outline' : section === 'pace' ? 'speedometer-outline' : 'nutrition-outline'}
          size={20}
          color={Colors.brandPrimary}
        />
      </View>
      <View style={styles.inlineSettingsHeaderCopy}>
        <Text style={styles.inlineSettingsTitle}>{title}</Text>
        <View style={styles.inlineSettingsSummary}>
          {summaryChips.map((chip) => (
            <Text key={`${section}-${chip}`} style={styles.inlineSettingsSummaryText}>{chip}</Text>
          ))}
        </View>
      </View>
    </View>
  ) : (
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

  if (inline) {
    return (
      <View style={styles.inlineSettingsContent}>
        <View style={styles.inlineSettingsCard}>
        {renderAccordionHeader('course', 'Course', [
          values.name?.trim() || 'Sans nom',
          formatDistance(values.raceDistanceKm || 0, locale),
          `D+ ${values.elevationGain || 0} m`,
        ])}
          <>
            <Field
              containerStyle={styles.formField}
              label="Nom du plan"
              onChangeText={(text) => update('name', text)}
              placeholder="Ex : UTMB 2025"
              value={values.name}
            />
            {isLinkedRace ? (
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Distance</Text>
                  <DataText>{formatDistance(values.raceDistanceKm, locale)}</DataText>
                </View>
                <View style={[styles.rowItem, { marginLeft: 12 }]}>
                  <Text style={styles.label}>D+</Text>
                  <DataText>{values.elevationGain} m</DataText>
                </View>
              </View>
            ) : <View style={styles.row}>
              <View style={styles.rowItem}>
                <NumberInput label="Distance" unit="km" value={values.raceDistanceKm} onChange={(value) => update('raceDistanceKm', value)} placeholder="50" />
              </View>
              <View style={[styles.rowItem, { marginLeft: 12 }]}>
                <NumberInput label="D+" unit="m" value={values.elevationGain} onChange={(value) => update('elevationGain', value)} placeholder="3000" />
              </View>
            </View>}
          </>
        </View>

        <View style={styles.inlineSettingsCard}>
        {renderAccordionHeader('pace', 'Allure de base sur le plat', [paceSummary, fatigueDescriptor], true)}
          <>
            <Text style={styles.waterBagHint}>L'allure moyenne de course tient compte du dénivelé et de la fatigue.</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, values.paceType === 'pace' && styles.toggleBtnActive]} onPress={() => update('paceType', 'pace')}>
                <Text style={[styles.toggleBtnText, values.paceType === 'pace' && styles.toggleBtnTextActive]}>Allure (min/km)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, values.paceType === 'speed' && styles.toggleBtnActive]} onPress={() => update('paceType', 'speed')}>
                <Text style={[styles.toggleBtnText, values.paceType === 'speed' && styles.toggleBtnTextActive]}>Vitesse (km/h)</Text>
              </TouchableOpacity>
            </View>
            {values.paceType === 'pace' ? (
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <NumberInput label="Minutes" unit="min" value={values.paceMinutes} onChange={(value) => update('paceMinutes', Math.floor(value))} placeholder="6" />
                </View>
                <View style={[styles.rowItem, { marginLeft: 12 }]}>
                  <NumberInput label="Secondes" unit="s" value={values.paceSeconds} onChange={(value) => update('paceSeconds', Math.min(59, Math.floor(value)))} placeholder="30" />
                </View>
              </View>
            ) : (
              <>
                <NumberInput label="Vitesse" unit="km/h" value={values.speedKph} onChange={(value) => update('speedKph', value)} placeholder="10" />
              </>
            )}
            <Text style={styles.label}>{t.plans.fatigueLabel}</Text>
            <Text style={styles.waterBagHint}>{t.plans.fatigueHint}</Text>
            <View style={styles.fatigueSliderWrap}>
              <View style={styles.fatigueSliderTrack}>
                <View
                  style={styles.fatigueSliderTouchArea}
                  onLayout={(event) => setFatigueTrackWidth(event.nativeEvent.layout.width)}
                  onTouchStart={handleFatigueTrackTouchStart}
                  onTouchEnd={handleFatigueTrackTouchEnd}
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
                <Text key={option.label} style={[styles.fatigueSliderLabel, option.active && styles.fatigueSliderLabelActive]}>{option.label}</Text>
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
        </View>

        <View style={styles.inlineSettingsCard}>
        {renderAccordionHeader('nutrition', 'Nutrition', [
          `${values.targetIntakePerHour || 0} g/h`,
          `${values.waterIntakePerHour || 0} ml/h`,
          `${values.sodiumIntakePerHour || 0} mg/h`,
          `Poche eau ${values.waterBagLiters} L`,
        ], true)}
          <>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <NumberInput label="Glucides" unit="g/h" value={values.targetIntakePerHour} onChange={(value) => update('targetIntakePerHour', value)} placeholder="70" />
              </View>
              <View style={[styles.rowItem, { marginLeft: 12 }]}>
                <NumberInput label="Eau" unit="ml/h" value={values.waterIntakePerHour} onChange={(value) => update('waterIntakePerHour', value)} placeholder="500" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <NumberInput label="Sodium" unit="mg/h" value={values.sodiumIntakePerHour} onChange={(value) => update('sodiumIntakePerHour', value)} placeholder="600" />
              </View>
              <View style={[styles.rowItem, { marginLeft: 12 }]} />
            </View>
            <Text style={styles.label}>Volume de la poche à eau</Text>
            <Text style={styles.waterBagHint}>Capacité de ta poche à eau, pas le volume total du sac/gilet.</Text>
            <WaterBagCapacitySelector
              value={values.waterBagLiters}
              options={waterBagOptions}
              onChange={(value) => update('waterBagLiters', value)}
              onCustomValueFocus={onCustomWaterBagFocus}
            />
          </>
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        accessibilityLabel="Ouvrir les paramètres du plan"
        accessibilityRole="button"
        activeOpacity={0.84}
        onPress={onOpenSettings}
        style={styles.planOverviewHeader}
      >
        <View style={styles.planOverviewSettingsIcon}>
          <Ionicons name="options-outline" size={18} color={Colors.brandPrimary} />
        </View>
        <View style={styles.planOverviewCopy}>
          <Text style={styles.planOverviewTitle}>Paramètres du plan</Text>
          <DataText tone="secondary" size="xs" weight="medium" numberOfLines={1} style={styles.planOverviewMeta}>
            {settingsMetaSummary}
          </DataText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={settingsVisible} transparent animationType="slide" onRequestClose={onCloseSettings}>
        <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable accessible={false} style={styles.modalOverlay} onPress={onCloseSettings} />
          <View accessibilityViewIsModal style={styles.settingsSheet}>
            <View style={styles.settingsSheetHandle} />
            <View style={styles.settingsSheetHeader}>
              <View style={styles.settingsSheetHeaderCopy}>
                <Text accessibilityRole="header" style={styles.settingsSheetTitle}>Paramètres du plan</Text>
                <Text style={styles.settingsSheetSubtitle}>Course, allure et cibles nutritionnelles</Text>
              </View>
              <IconAction
                accessibilityLabel="Fermer les paramètres du plan"
                icon={<Ionicons name="close" size={20} color={Colors.textPrimary} />}
                onPress={onCloseSettings}
              />
            </View>

            <ScrollView
              contentContainerStyle={styles.settingsSheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {renderAccordionHeader('course', 'Course', [
                values.name?.trim() || 'Sans nom',
                formatDistance(values.raceDistanceKm || 0, locale),
                `D+ ${values.elevationGain || 0} m`,
              ])}
              {expandedSections.course && (
                <>
                  <Field
                    containerStyle={styles.formField}
                    label="Nom du plan"
                    onChangeText={(text) => update('name', text)}
                    placeholder="Ex : UTMB 2025"
                    value={values.name}
                  />

                  {isLinkedRace ? (
                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Text style={styles.label}>Distance</Text>
                        <DataText>{formatDistance(values.raceDistanceKm, locale)}</DataText>
                      </View>
                      <View style={[styles.rowItem, { marginLeft: 12 }]}>
                        <Text style={styles.label}>D+</Text>
                        <DataText>{values.elevationGain} m</DataText>
                      </View>
                    </View>
                  ) : <View style={styles.row}>
                    <View style={styles.rowItem}>
                      <NumberInput label="Distance" unit="km"
                        value={values.raceDistanceKm}
                        onChange={(v) => update('raceDistanceKm', v)}
                        placeholder="50"
                      />
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 12 }]}>
                      <NumberInput label="D+" unit="m" value={values.elevationGain} onChange={(v) => update('elevationGain', v)} placeholder="3000" />
                    </View>
                  </View>}
                </>
              )}

              {renderAccordionHeader(
                'pace',
                'Allure de base sur le plat',
                [paceSummary, fatigueDescriptor],
                true,
              )}
              {expandedSections.pace && (
                <>
                  <Text style={styles.waterBagHint}>L'allure moyenne de course tient compte du dénivelé et de la fatigue.</Text>
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
                        <NumberInput label="Minutes" unit="min" value={values.paceMinutes} onChange={(v) => update('paceMinutes', Math.floor(v))} placeholder="6" />
                      </View>
                      <View style={[styles.rowItem, { marginLeft: 12 }]}>
                        <NumberInput label="Secondes" unit="s"
                          value={values.paceSeconds}
                          onChange={(v) => update('paceSeconds', Math.min(59, Math.floor(v)))}
                          placeholder="30"
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      <NumberInput label="Vitesse" unit="km/h" value={values.speedKph} onChange={(v) => update('speedKph', v)} placeholder="10" />
                    </>
                  )}

                  <Text style={styles.label}>{t.plans.fatigueLabel}</Text>
                  <Text style={styles.waterBagHint}>{t.plans.fatigueHint}</Text>
                  <View style={styles.fatigueSliderWrap}>
                    <View style={styles.fatigueSliderTrack}>
                      <View
                        style={styles.fatigueSliderTouchArea}
                        onLayout={(event) => setFatigueTrackWidth(event.nativeEvent.layout.width)}
                        onTouchStart={handleFatigueTrackTouchStart}
                        onTouchEnd={handleFatigueTrackTouchEnd}
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
                      <NumberInput label="Glucides" unit="g/h"
                        value={values.targetIntakePerHour}
                        onChange={(v) => update('targetIntakePerHour', v)}
                        placeholder="70"
                      />
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 12 }]}>
                      <NumberInput label="Eau" unit="ml/h"
                        value={values.waterIntakePerHour}
                        onChange={(v) => update('waterIntakePerHour', v)}
                        placeholder="500"
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={styles.rowItem}>
                      <NumberInput label="Sodium" unit="mg/h"
                        value={values.sodiumIntakePerHour}
                        onChange={(v) => update('sodiumIntakePerHour', v)}
                        placeholder="600"
                      />
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 12 }]} />
                  </View>

                  <Text style={styles.label}>Volume de la poche à eau</Text>
                  <Text style={styles.waterBagHint}>Capacité de ta poche à eau, pas le volume total du sac/gilet.</Text>
                  <WaterBagCapacitySelector
                    value={values.waterBagLiters}
                    options={waterBagOptions}
                    onChange={(value) => update('waterBagLiters', value)}
                    onCustomValueFocus={onCustomWaterBagFocus}
                  />
                </>
              )}

              <TouchableOpacity activeOpacity={0.86} onPress={onCloseSettings} style={styles.settingsSheetDoneButton}>
                <Text style={styles.settingsSheetDoneButtonText}>Terminé</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
