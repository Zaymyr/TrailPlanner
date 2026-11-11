import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getIntermediateAidStationCount } from '../../lib/planPersistence';
import {
  SummitIcon,
  TrailIcon,
  colors,
  radius,
  spacing
} from '@pace-yourself/design-system';
import { ActionButton } from '../themed/ActionButton';
import { Button } from '../themed/Button';
import { Card } from '../themed/Card';
import { Cote } from '../themed/Cote';
import { EmptyState } from '../themed/EmptyState';
import { Field } from '../themed/Field';
import { Heading } from '../themed/Heading';
import { IconAction } from '../themed/IconAction';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import { TrailSignButton } from '../themed/TrailSignButton';
import { CardMiniProfile } from '../themed/trail/CardProfile';
import { formatDistance, formatElevation } from '../../lib/displayFormat';
import { asTrailProfile } from '../../lib/trailSignature';
import {
  collectStoredPlanProductIds,
  computePlanReadiness,
  type PlanReadiness,
  type ReadinessProduct,
} from '../../lib/planReadiness';
import { supabase } from '../../lib/supabase';
import { estimateDuration, getPlanCardTitle } from './plansHelpers';
import { formatDepartureCountdown, resolvePlanPrimaryAction, type DepartureCountdownCopy, type PlanPrimaryAction } from '../../lib/plansListPresentation';
import type { PlanRow, RaceSection } from './types';

type PlansListProps = {
  contentTopInset?: number;
  listHeaderComponent?: ReactNode;
  listFooterComponent?: ReactNode;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  sections: RaceSection[];
  collapsedSections: Set<string>;
  activePlanId: string | null;
  accessiblePlanIds: Set<string> | null;
  isPremium: boolean;
  locale: 'fr' | 'en';
  refreshing: boolean;
  sharingPlanId: string | null;
  noRaceWarningLabel: string;
  liveLabel: string;
  inProgressLabel: string;
  startButtonLabel: string;
  editButtonLabel: string;
  recapButtonLabel: string;
  shareButtonLabel: string;
  saveButtonLabel: string;
  savingLabel: string;
  deleteButtonLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  browseRacesLabel: string;
  departureCountdownCopy: DepartureCountdownCopy;
  departureLabel: string;
  onRefresh: () => void;
  onToggleSection: (key: string) => void;
  onDeletePlan: (planId: string) => void;
  onRenamePlan: (planId: string, name: string) => Promise<boolean>;
  onOpenEditPlan: (planId: string) => void;
  onOpenRacePlan: (planId: string) => void;
  onOpenSummary: (planId: string) => void;
  onSharePlan: (planId: string) => void;
  onOpenLockedPlan: () => void;
  onBrowseRaces: () => void;
  /** Opens the format's RaceBook; plans of catalog formats lead with it. */
  onOpenRacebook?: (raceId: string) => void;
  racebookButtonLabel?: string;
  /** Status wristband labels; default to built-in FR/EN copy. */
  readyLabel?: string;
  draftLabel?: string;
  /** "Plan en cours" wristband (not the live race one). */
  inProgressStatusLabel?: string;
};

/** Product nutrition shared by every list mount: products rarely change. */
const productNutritionCache = new Map<string, ReadinessProduct | null>();

/**
 * Loads carbs / sodium / fuel type of the products the listed plans use, so
 * the wristband applies the editor's gauge rule. `null` until loaded.
 */
function usePlanListProductMap(sections: RaceSection[]): Record<string, ReadinessProduct> | null {
  const idsKey = useMemo(() => {
    const ids = new Set<string>();
    sections.forEach((section) => section.data.forEach((plan) =>
      collectStoredPlanProductIds(plan.planner_values).forEach((id) => ids.add(id)),
    ));
    return [...ids].sort().join(',');
  }, [sections]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const missing = idsKey ? idsKey.split(',').filter((id) => !productNutritionCache.has(id)) : [];
    if (missing.length === 0) {
      setLoadedKey(idsKey);
      return undefined;
    }
    void (async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, fuel_type, carbs_g, sodium_mg')
        .in('id', missing);
      if (cancelled || error) return;
      ((data ?? []) as ReadinessProduct[]).forEach((product) => productNutritionCache.set(product.id, product));
      // Unknown ids (deleted products) count as zero, like in the editor.
      missing.forEach((id) => {
        if (!productNutritionCache.has(id)) productNutritionCache.set(id, null);
      });
      setLoadedKey(idsKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return useMemo(() => {
    if (loadedKey !== idsKey) return null;
    const map: Record<string, ReadinessProduct> = {};
    productNutritionCache.forEach((product, id) => {
      if (product) map[id] = product;
    });
    return map;
  }, [idsKey, loadedKey]);
}

const READINESS_TONE = { draft: 'neutral', inProgress: 'info', ready: 'success' } as const;

export const PlansList = memo(function PlansList({
  contentTopInset = 0,
  listHeaderComponent,
  listFooterComponent,
  onScroll,
  sections,
  collapsedSections,
  activePlanId,
  accessiblePlanIds,
  isPremium,
  locale,
  refreshing,
  sharingPlanId,
  noRaceWarningLabel,
  liveLabel,
  inProgressLabel,
  startButtonLabel,
  editButtonLabel,
  recapButtonLabel,
  shareButtonLabel,
  saveButtonLabel,
  savingLabel,
  deleteButtonLabel,
  emptyTitle,
  emptySubtitle,
  browseRacesLabel,
  departureCountdownCopy,
  departureLabel,
  onRefresh,
  onToggleSection,
  onDeletePlan,
  onRenamePlan,
  onOpenEditPlan,
  onOpenRacePlan,
  onOpenSummary,
  onSharePlan,
  onOpenLockedPlan,
  onBrowseRaces,
  onOpenRacebook,
  racebookButtonLabel,
  readyLabel,
  draftLabel,
  inProgressStatusLabel,
}: PlansListProps) {
  const readinessLabels: Record<PlanReadiness, string> = {
    draft: draftLabel ?? (locale === 'fr' ? 'Brouillon' : 'Draft'),
    inProgress: inProgressStatusLabel ?? (locale === 'fr' ? 'En cours' : 'In progress'),
    ready: readyLabel ?? (locale === 'fr' ? 'Prêt' : 'Ready'),
  };
  const productMap = usePlanListProductMap(sections);
  const [managedPlan, setManagedPlan] = useState<PlanRow | null>(null);
  const [managedPlanName, setManagedPlanName] = useState('');
  const [renamingPlan, setRenamingPlan] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (sections.every((section) => section.data.length === 0)) return undefined;
    const hasDepartureWithinAnHour = sections.some((section) =>
      section.data.some((plan) => {
        const departureMs = plan.departureAt ? new Date(plan.departureAt).getTime() : Number.NaN;
        return Number.isFinite(departureMs) && departureMs > nowMs && departureMs - nowMs < 3_600_000;
      }),
    );
    const timer = setInterval(() => setNowMs(Date.now()), hasDepartureWithinAnHour ? 1_000 : 60_000);
    return () => clearInterval(timer);
  }, [nowMs, sections]);
  const closeManagePlan = () => {
    if (!renamingPlan) setManagedPlan(null);
  };

  const submitPlanName = async () => {
    if (!managedPlan || !managedPlanName.trim() || renamingPlan) return;
    setRenamingPlan(true);
    const renamed = await onRenamePlan(managedPlan.id, managedPlanName.trim());
    setRenamingPlan(false);
    if (renamed) setManagedPlan(null);
  };

  return (
    <View style={styles.screen}>
      <SectionList
        contentContainerStyle={[
          styles.list,
          { paddingTop: contentTopInset + spacing[2] },
          sections.length === 0 && styles.listEmpty,
        ]}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeaderComponent ? <View style={styles.listHeader}>{listHeaderComponent}</View> : null}
        ListFooterComponent={listFooterComponent ? <View style={styles.listFooter}>{listFooterComponent}</View> : null}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            progressViewOffset={contentTopInset}
            refreshing={refreshing}
            tintColor={colors.brand.forest}
          />
        }
        renderItem={({ item, section }) => {
          const key = section.sectionKey;
          if (collapsedSections.has(key)) return null;

          const duration = estimateDuration(item);
          const isActivePlan = activePlanId === item.id;
          const isAccessible =
            isPremium || accessiblePlanIds === null || accessiblePlanIds.has(item.id);

          const planEventName = section.pastEventNames?.[item.id] ?? section.eventName;
          const startsPastEvent = section.pastEventStartIds?.includes(item.id) === true;

          return (
            <View>
              {startsPastEvent ? (
                <Heading numberOfLines={1} variant="h3" style={styles.pastEventTitle}>
                  {planEventName}
                </Heading>
              ) : null}
              <PlanCard
                displayName={getPlanCardTitle(item, planEventName, locale)}
                departureCountdownCopy={departureCountdownCopy}
                departureLabel={departureLabel}
                duration={duration}
                editButtonLabel={editButtonLabel}
                inProgressLabel={inProgressLabel}
                isAccessible={isAccessible}
                isActivePlan={isActivePlan}
                isSharing={sharingPlanId === item.id}
                item={item}
                liveLabel={liveLabel}
                locale={locale}
                nowMs={nowMs}
                onDelete={() => onDeletePlan(item.id)}
                onLockedPress={onOpenLockedPlan}
                onManage={() => {
                  setManagedPlan(item);
                  setManagedPlanName(item.name);
                }}
                onOpenMain={() => (isActivePlan ? onOpenRacePlan(item.id) : onOpenEditPlan(item.id))}
                onOpenSummary={() => onOpenSummary(item.id)}
                onShare={() => onSharePlan(item.id)}
                onStart={() => onOpenRacePlan(item.id)}
                onOpenRacebook={
                  onOpenRacebook && racebookButtonLabel && item.race_id && item.races?.race_events
                    ? () => onOpenRacebook(item.race_id!)
                    : undefined
                }
                racebookButtonLabel={racebookButtonLabel}
                primaryAction={resolvePlanPrimaryAction(item, nowMs, activePlanId)}
                productMap={productMap}
                readinessLabels={readinessLabels}
                recapButtonLabel={recapButtonLabel}
                shareButtonLabel={shareButtonLabel}
                startButtonLabel={startButtonLabel}
              />
            </View>
          );
        }}
        renderSectionHeader={({ section }) => {
          const key = section.sectionKey;
          const isCollapsed = collapsedSections.has(key);

          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}
              activeOpacity={0.72}
              onPress={() => onToggleSection(key)}
              style={styles.sectionHeader}
            >
              <View style={styles.sectionTitleWrap}>
                <View style={styles.sectionTitleRow}>
                  <TrailIcon color={colors.brand.forest} size={20} strokeWidth={2.2} />
                  <Heading numberOfLines={1} variant="h3" style={styles.sectionTitle}>
                    {section.eventName}
                  </Heading>
                  <Ionicons
                    color={colors.brand.forest}
                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                    size={18}
                  />
                </View>
                {section.sectionKey === '__orphan__' ? (
                  <Text tone="secondary" size="xs" style={styles.orphanWarning}>
                    {noRaceWarningLabel}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
        sections={sections.map((section) => ({ ...section, key: section.sectionKey }))}
        scrollEventThrottle={16}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            actionLabel={browseRacesLabel}
            description={emptySubtitle}
            onActionPress={onBrowseRaces}
            signLabel={departureLabel}
            style={styles.emptyState}
            title={emptyTitle}
          />
        }
      />

      <Modal
        animationType="slide"
        onRequestClose={closeManagePlan}
        transparent
        visible={managedPlan !== null}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalWrapper}
        >
          <Pressable accessible={false} onPress={closeManagePlan} style={styles.modalOverlay} />
          <View accessibilityViewIsModal style={styles.manageSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.manageHeader}>
              <Heading accessibilityRole="header" variant="h2">
                {locale === 'fr' ? 'G\u00e9rer le plan' : 'Manage plan'}
              </Heading>
              <TouchableOpacity
                accessibilityLabel={locale === 'fr' ? 'Fermer' : 'Close'}
                accessibilityRole="button"
                disabled={renamingPlan}
                hitSlop={8}
                onPress={closeManagePlan}
                style={styles.closeButton}
              >
                <Ionicons color={colors.text.secondary} name="close" size={20} />
              </TouchableOpacity>
            </View>
            <Field
              autoCapitalize="sentences"
              autoFocus
              containerStyle={styles.nameField}
              editable={!renamingPlan}
              label={locale === 'fr' ? 'Nom du plan' : 'Plan name'}
              maxLength={120}
              onChangeText={setManagedPlanName}
              onSubmitEditing={() => void submitPlanName()}
              placeholder={locale === 'fr' ? 'Nom du plan' : 'Plan name'}
              returnKeyType="done"
              selectTextOnFocus
              value={managedPlanName}
            />
            <Button
              disabled={!managedPlanName.trim() || renamingPlan}
              fullWidth
              onPress={() => void submitPlanName()}
              style={styles.saveButton}
            >
              {renamingPlan ? savingLabel : saveButtonLabel}
            </Button>
            <ActionButton
              disabled={renamingPlan}
              fullWidth
              onPress={() => {
                const planId = managedPlan?.id;
                setManagedPlan(null);
                if (planId) onDeletePlan(planId);
              }}
              style={styles.deleteButton}
              variant="destructive-outline"
            >
              {deleteButtonLabel}
            </ActionButton>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

type PlanCardProps = {
  item: PlanRow;
  displayName: string;
  duration: string | null;
  departureCountdownCopy: DepartureCountdownCopy;
  departureLabel: string;
  locale: 'fr' | 'en';
  isAccessible: boolean;
  isActivePlan: boolean;
  isSharing: boolean;
  primaryAction: PlanPrimaryAction;
  nowMs: number;
  liveLabel: string;
  startButtonLabel: string;
  editButtonLabel: string;
  recapButtonLabel: string;
  shareButtonLabel: string;
  inProgressLabel: string;
  onManage: () => void;
  onDelete: () => void;
  onOpenMain: () => void;
  onOpenSummary: () => void;
  onShare: () => void;
  onStart: () => void;
  onLockedPress: () => void;
  onOpenRacebook?: () => void;
  racebookButtonLabel?: string;
  productMap: Record<string, ReadinessProduct> | null;
  readinessLabels: Record<PlanReadiness, string>;
};

function PlanCard({
  item,
  displayName,
  duration,
  departureCountdownCopy,
  departureLabel,
  locale,
  isAccessible,
  isActivePlan,
  isSharing,
  primaryAction,
  nowMs,
  liveLabel,
  startButtonLabel,
  editButtonLabel,
  recapButtonLabel,
  shareButtonLabel,
  inProgressLabel,
  onManage,
  onDelete,
  onOpenMain,
  onOpenSummary,
  onShare,
  onStart,
  onLockedPress,
  onOpenRacebook,
  racebookButtonLabel,
  productMap,
  readinessLabels,
}: PlanCardProps) {
  // Catalog formats lead with their RaceBook; the plan action becomes secondary.
  const leadsWithRacebook = Boolean(onOpenRacebook && racebookButtonLabel);
  const aidStationCount = getIntermediateAidStationCount(item.planner_values?.aidStations);
  const countdown = formatDepartureCountdown(item.departureAt, nowMs, departureCountdownCopy);
  // Only a real stored profile draws the skyline; never a placeholder ridge.
  const courseProfile = useMemo(() => asTrailProfile(item.elevation_profile), [item.elevation_profile]);
  const readiness = useMemo(
    () => computePlanReadiness(item.planner_values, item.elevation_profile, productMap),
    [item.planner_values, item.elevation_profile, productMap],
  );
  const ready = readiness === 'ready';
  const statusLabel = isActivePlan ? liveLabel : readinessLabels[readiness];
  const planKey = String(item.id);
  const primaryLabel = primaryAction === 'start'
    ? isActivePlan ? inProgressLabel : startButtonLabel
    : primaryAction === 'edit'
      ? editButtonLabel
      : recapButtonLabel;
  const handlePrimaryPress = primaryAction === 'start'
    ? onStart
    : primaryAction === 'edit'
      ? onOpenMain
      : onOpenSummary;

  return (
    <Card padded={false} surface="white" style={[styles.card, isActivePlan && styles.cardActive]} variationKey={String(item.id)}>
      <View style={styles.cardMainArea}>
        <TouchableOpacity
          accessibilityActions={[
            { name: 'activate', label: locale === 'fr' ? 'Ouvrir le plan' : 'Open plan' },
            {
              name: 'longpress',
              label: locale === 'fr' ? 'Afficher les actions du plan' : 'Show plan actions',
            },
          ]}
          accessibilityHint={
            locale === 'fr'
              ? 'Touchez deux fois pour ouvrir. Maintenez pour modifier le nom ou supprimer.'
              : 'Double tap to open. Long press to edit the name or delete.'
          }
          accessibilityLabel={`${item.name}, ${statusLabel}`}
          accessibilityRole="button"
          activeOpacity={0.8}
          delayLongPress={550}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'longpress') {
              onManage();
            } else if (event.nativeEvent.actionName === 'activate') {
              if (isAccessible) {
                onOpenMain();
              } else {
                onLockedPress();
              }
            }
          }}
          onLongPress={onManage}
          onPress={isAccessible ? onOpenMain : onLockedPress}
          style={styles.cardMainButton}
        >
          <View style={styles.cardContent}>
            <View style={styles.planTitleRow}>
              <Heading variant="h2" numberOfLines={2} style={styles.planName}>
                {displayName}
              </Heading>
              {isActivePlan
                ? <StatusPill label={liveLabel} tone="warning" />
                : <StatusPill label={statusLabel} tone={READINESS_TONE[readiness]} />}
            </View>
            <View style={styles.meta}>
              {item.planner_values?.raceDistanceKm != null ? (
                <Cote size="sm" tone="secondary" value={formatDistance(item.planner_values.raceDistanceKm, locale)} />
              ) : null}
              {item.planner_values?.elevationGain != null ? (
                <View style={styles.metaInline}>
                  <SummitIcon color={colors.brand.forest} size={14} strokeWidth={2.1} />
                  <Cote
                    prefix="D+"
                    size="sm"
                    tone="secondary"
                    value={formatElevation(item.planner_values.elevationGain, locale)}
                  />
                </View>
              ) : null}
              {courseProfile ? (
                <CardMiniProfile profile={courseProfile} style={styles.miniProfile} variant={ready ? 'ready' : 'draft'} />
              ) : null}
            </View>
            <View style={styles.planInsights}>
              <View style={[styles.planInsight, styles.planInsightDuration]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {locale === 'fr' ? 'Temps total' : 'Total time'}
                </Text>
                <Cote size="sm" tone="brand" value={duration ?? '—'} />
              </View>
              <View style={[styles.planInsight, styles.planInsightRavitos, styles.planInsightDivider]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {locale === 'fr' ? 'Ravitos' : 'Aid stops'}
                </Text>
                <Cote size="sm" tone="brand" value={aidStationCount} />
              </View>
              <View style={[styles.planInsight, styles.planInsightDivider]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {departureLabel}
                </Text>
                <Text numberOfLines={1} tone="brand" size="xs" weight="bold">
                  {countdown}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <IconAction
          accessibilityLabel={`${locale === 'fr' ? 'Supprimer le plan' : 'Delete plan'} — ${item.name}`}
          icon={<Ionicons color={colors.semantic.danger} name="trash-outline" size={18} />}
          onPress={onDelete}
          style={styles.cardDeleteButton}
        />
      </View>

      {/* Signs lead elsewhere (RaceBook, plan); recap/share stay small watch buttons on their own row. */}
      <View style={styles.cardSigns}>
        {leadsWithRacebook ? (
          <TrailSignButton
            accessibilityLabel={`${racebookButtonLabel} — ${item.name}`}
            fullWidth
            label={racebookButtonLabel ?? ''}
            onPress={onOpenRacebook}
            style={styles.cardSign}
            testID="plan-card-racebook"
            variant="solid"
            variationKey={`${planKey}|racebook`}
          />
        ) : null}
        <TrailSignButton
          accessibilityLabel={`${primaryLabel} — ${item.name}`}
          fullWidth
          icon={isAccessible ? undefined : <Ionicons color={colors.accent.amber} name="lock-closed" size={15} />}
          label={primaryLabel}
          onPress={isAccessible ? handlePrimaryPress : onLockedPress}
          style={styles.cardSign}
          variant={leadsWithRacebook ? 'soft' : 'solid'}
          variationKey={`${planKey}|plan`}
        />
      </View>
      <View style={styles.cardActions}>
        {primaryAction !== 'recap' ? (
          <IconAction
            accessibilityLabel={`${recapButtonLabel} — ${item.name}`}
            icon={
              <Ionicons
                color={isAccessible ? colors.brand.forest : colors.accent.amber}
                name={isAccessible ? 'document-text-outline' : 'lock-closed'}
                size={18}
              />
            }
            onPress={isAccessible ? onOpenSummary : onLockedPress}
          />
        ) : (
          <IconAction
            accessibilityLabel={`${editButtonLabel} — ${item.name}`}
            icon={
              <Ionicons
                color={isAccessible ? colors.brand.forest : colors.accent.amber}
                name={isAccessible ? 'create-outline' : 'lock-closed'}
                size={18}
              />
            }
            onPress={isAccessible ? onOpenMain : onLockedPress}
          />
        )}
        <IconAction
          accessibilityLabel={`${shareButtonLabel} — ${item.name}`}
          accessibilityState={{ busy: isSharing }}
          disabled={isSharing}
          icon={
            <Ionicons
              color={colors.brand.forest}
              name={isSharing ? 'hourglass-outline' : 'share-social-outline'}
              size={18}
            />
          }
          onPress={isAccessible ? onShare : onLockedPress}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.sand,
  },
  list: {
    padding: spacing[4],
    gap: 0,
    paddingBottom: spacing[8],
  },
  listHeader: {
    gap: spacing[3],
    marginBottom: spacing[1],
  },
  listFooter: {
    marginTop: spacing[4],
  },
  listEmpty: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: 0,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    backgroundColor: colors.surface.sand,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionTitle: {
    flex: 1,
    color: colors.brand.forest,
    fontSize: 21,
    lineHeight: 25,
  },
  pastEventTitle: {
    color: colors.text.secondary,
    fontSize: 15,
    marginBottom: 4,
    marginLeft: 0,
    marginTop: 8,
  },
  orphanWarning: {
    marginTop: spacing[1],
    paddingLeft: 28,
  },
  card: {
    flexDirection: 'column',
    marginBottom: spacing[2],
    marginLeft: 0,
  },
  cardDeleteButton: {
    position: 'absolute',
    right: spacing[1],
    top: spacing[1],
  },
  cardActive: {
    borderColor: colors.border.brand,
  },
  cardMainButton: {
    flex: 1,
  },
  cardMainArea: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: spacing[4],
    paddingRight: 52,
    paddingVertical: spacing[3],
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  planName: {
    flex: 1,
    fontSize: 17,
    lineHeight: 21,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  miniProfile: {
    marginLeft: 'auto',
  },
  planInsights: {
    flexDirection: 'row',
    marginTop: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface.cream,
    overflow: 'hidden',
  },
  planInsight: {
    flex: 1,
    minWidth: 0,
    gap: spacing[0.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  planInsightDuration: {
    flex: 0.7,
  },
  planInsightRavitos: {
    flex: 0.46,
    paddingHorizontal: spacing[2],
  },
  planInsightDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border.subtle,
  },
  cardSigns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
  },
  /** Two full-label signs share the row (~163pt each on a 390pt phone). */
  cardSign: {
    flex: 1,
    minWidth: 0,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  manageSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface.white,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing[4],
  },
  manageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.cream,
  },
  nameField: {
    marginTop: spacing[5],
  },
  saveButton: {
    marginTop: spacing[4],
  },
  deleteButton: {
    marginTop: spacing[3],
  },
  emptyState: {
    flex: 1,
    paddingVertical: spacing[16],
  },
});
