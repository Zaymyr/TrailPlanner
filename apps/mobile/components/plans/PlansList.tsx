import { memo, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getIntermediateAidStationCount } from '../../lib/planPersistence';
import {
  EmptyPlanIcon,
  SummitIcon,
  TrailIcon,
  colors,
  radius,
  spacing
} from '@pace-yourself/design-system';
import { Button } from '../themed/Button';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';
import { estimateDuration, getPlanCardTitle } from './plansHelpers';
import type { PlanRow, RaceSection } from './types';

type PlansListProps = {
  sections: RaceSection[];
  collapsedSections: Set<string>;
  activePlanId: string | null;
  accessiblePlanIds: Set<string> | null;
  isPremium: boolean;
  locale: 'fr' | 'en';
  refreshing: boolean;
  sharingPlanId: string | null;
  editRaceLabel: string;
  noRaceWarningLabel: string;
  liveLabel: string;
  inProgressLabel: string;
  startButtonLabel: string;
  recapButtonLabel: string;
  shareButtonLabel: string;
  saveButtonLabel: string;
  savingLabel: string;
  deleteButtonLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  createFirstLabel: string;
  onRefresh: () => void;
  onToggleSection: (key: string) => void;
  onEditRace: (raceId: string) => void;
  onDeletePlan: (planId: string) => void;
  onRenamePlan: (planId: string, name: string) => Promise<boolean>;
  onOpenEditPlan: (planId: string) => void;
  onOpenRacePlan: (planId: string) => void;
  onOpenSummary: (planId: string) => void;
  onSharePlan: (planId: string) => void;
  onOpenLockedPlan: () => void;
  onCreateFirstPlan: () => void;
};

export const PlansList = memo(function PlansList({
  sections,
  collapsedSections,
  activePlanId,
  accessiblePlanIds,
  isPremium,
  locale,
  refreshing,
  sharingPlanId,
  editRaceLabel,
  noRaceWarningLabel,
  liveLabel,
  inProgressLabel,
  startButtonLabel,
  recapButtonLabel,
  shareButtonLabel,
  saveButtonLabel,
  savingLabel,
  deleteButtonLabel,
  emptyTitle,
  emptySubtitle,
  createFirstLabel,
  onRefresh,
  onToggleSection,
  onEditRace,
  onDeletePlan,
  onRenamePlan,
  onOpenEditPlan,
  onOpenRacePlan,
  onOpenSummary,
  onSharePlan,
  onOpenLockedPlan,
  onCreateFirstPlan,
}: PlansListProps) {
  const [managedPlan, setManagedPlan] = useState<PlanRow | null>(null);
  const [managedPlanName, setManagedPlanName] = useState('');
  const [renamingPlan, setRenamingPlan] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const localizedEmptyTitle =
    locale === 'fr' ? "Aucun plan à l'horizon" : 'The trail starts here';

  useEffect(() => {
    const hasUpcomingDeparture = sections.some((section) =>
      section.data.some((plan) => {
        const departureMs = plan.departureAt ? new Date(plan.departureAt).getTime() : Number.NaN;
        return Number.isFinite(departureMs) && departureMs > Date.now();
      }),
    );
    if (!hasUpcomingDeparture) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [sections]);

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
        contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
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

          return (
            <PlanCard
              displayName={getPlanCardTitle(item, section.eventName, locale)}
              duration={duration}
              isAccessible={isAccessible}
              isActivePlan={isActivePlan}
              isSharing={sharingPlanId === item.id}
              item={item}
              liveLabel={liveLabel}
              locale={locale}
              nowMs={nowMs}
              onLockedPress={onOpenLockedPlan}
              onManage={() => {
                setManagedPlan(item);
                setManagedPlanName(item.name);
              }}
              onOpenMain={() => (isActivePlan ? onOpenRacePlan(item.id) : onOpenEditPlan(item.id))}
              onOpenSummary={() => onOpenSummary(item.id)}
              onShare={() => onSharePlan(item.id)}
              onStart={() => onOpenRacePlan(item.id)}
              recapButtonLabel={recapButtonLabel}
              shareButtonLabel={shareButtonLabel}
              startButtonLabel={startButtonLabel}
              inProgressLabel={inProgressLabel}
            />
          );
        }}
        renderSectionFooter={({ section }) => {
          const key = section.sectionKey;
          const isCollapsed = collapsedSections.has(key);
          if (isCollapsed || section.data.length === 0) return null;
          if (section.sectionKey === '__orphan__') {
            return (
              <Text tone="secondary" size="xs" style={styles.orphanWarning}>
                {noRaceWarningLabel}
              </Text>
            );
          }
          return null;
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
              </View>
              {section.isOwned && section.raceId ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onEditRace(section.raceId!)}
                >
                  <Text tone="secondary" size="xs" weight="semibold" style={styles.editRaceText}>
                    {editRaceLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        }}
        sections={sections.map((section) => ({ ...section, key: section.sectionKey }))}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyPlanIcon
              color={colors.brand.forest}
              size={96}
              strokeWidth={1.8}
              style={styles.emptyIcon}
            />
            <Heading accessibilityLabel={emptyTitle} variant="h2" style={styles.emptyTitle}>
              {localizedEmptyTitle}
            </Heading>
            <Text tone="secondary" size="base" lineHeight="normal" style={styles.emptySubtitle}>
              {emptySubtitle}
            </Text>
            <Button onPress={onCreateFirstPlan}>{createFirstLabel}</Button>
          </View>
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
            <Text tone="secondary" size="sm" style={styles.inputLabel}>
              {locale === 'fr' ? 'Nom du plan' : 'Plan name'}
            </Text>
            <TextInput
              accessibilityLabel={locale === 'fr' ? 'Nom du plan' : 'Plan name'}
              autoCapitalize="sentences"
              autoFocus
              editable={!renamingPlan}
              maxLength={120}
              onChangeText={setManagedPlanName}
              onSubmitEditing={() => void submitPlanName()}
              placeholder={locale === 'fr' ? 'Nom du plan' : 'Plan name'}
              placeholderTextColor={colors.text.tertiary}
              returnKeyType="done"
              selectTextOnFocus
              style={styles.nameInput}
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
            <TouchableOpacity
              accessibilityRole="button"
              disabled={renamingPlan}
              onPress={() => {
                const planId = managedPlan?.id;
                setManagedPlan(null);
                if (planId) onDeletePlan(planId);
              }}
              style={styles.deleteButton}
            >
              <Ionicons color={colors.accent.terracotta} name="trash-outline" size={18} />
              <Text size="sm" weight="bold" style={styles.deleteButtonText}>
                {deleteButtonLabel}
              </Text>
            </TouchableOpacity>
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
  locale: 'fr' | 'en';
  isAccessible: boolean;
  isActivePlan: boolean;
  isSharing: boolean;
  nowMs: number;
  liveLabel: string;
  startButtonLabel: string;
  recapButtonLabel: string;
  shareButtonLabel: string;
  inProgressLabel: string;
  onManage: () => void;
  onOpenMain: () => void;
  onOpenSummary: () => void;
  onShare: () => void;
  onStart: () => void;
  onLockedPress: () => void;
};

function formatDepartureCountdown(
  departureAt: string | null | undefined,
  nowMs: number,
  locale: 'fr' | 'en',
) {
  if (!departureAt) return locale === 'fr' ? 'À renseigner' : 'Not set';
  const departureMs = new Date(departureAt).getTime();
  if (!Number.isFinite(departureMs)) return locale === 'fr' ? 'À renseigner' : 'Not set';
  const remainingSeconds = Math.floor((departureMs - nowMs) / 1_000);
  if (remainingSeconds <= 0) return locale === 'fr' ? 'Départ passé' : 'Started';

  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  return `${days}J ${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}Min ${String(seconds).padStart(2, '0')}S`;
}

function PlanCard({
  item,
  displayName,
  duration,
  locale,
  isAccessible,
  isActivePlan,
  isSharing,
  nowMs,
  liveLabel,
  startButtonLabel,
  recapButtonLabel,
  shareButtonLabel,
  inProgressLabel,
  onManage,
  onOpenMain,
  onOpenSummary,
  onShare,
  onStart,
  onLockedPress,
}: PlanCardProps) {
  const aidStationCount = getIntermediateAidStationCount(item.planner_values?.aidStations);
  const countdown = formatDepartureCountdown(item.departureAt, nowMs, locale);

  return (
    <Card padded={false} surface="white" style={[styles.card, isActivePlan && styles.cardActive]}>
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
          accessibilityLabel={item.name}
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
              {isActivePlan ? (
                <View style={styles.liveBadge}>
                  <Text tone="brand" size="xs" weight="bold" style={styles.liveBadgeText}>
                    {liveLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.meta}>
              {item.planner_values?.raceDistanceKm != null ? (
                <DataText tone="secondary" size="xs" weight="medium">
                  {item.planner_values.raceDistanceKm} km
                </DataText>
              ) : null}
              {item.planner_values?.elevationGain != null ? (
                <View style={styles.metaInline}>
                  <SummitIcon color={colors.brand.forest} size={14} strokeWidth={2.1} />
                  <DataText tone="secondary" size="xs" weight="medium">
                    D+ {item.planner_values.elevationGain}m
                  </DataText>
                </View>
              ) : null}
            </View>
            <View style={styles.planInsights}>
              <View style={[styles.planInsight, styles.planInsightDuration]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {locale === 'fr' ? 'Temps total' : 'Total time'}
                </Text>
                <DataText tone="brand" size="sm" weight="bold">
                  {duration ?? '—'}
                </DataText>
              </View>
              <View style={[styles.planInsight, styles.planInsightRavitos, styles.planInsightDivider]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {locale === 'fr' ? 'Ravitos' : 'Aid stops'}
                </Text>
                <DataText tone="brand" size="sm" weight="bold">
                  {aidStationCount}
                </DataText>
              </View>
              <View style={[styles.planInsight, styles.planInsightDivider]}>
                <Text tone="secondary" size="xs" weight="semibold">
                  {locale === 'fr' ? 'Départ dans' : 'Starts in'}
                </Text>
                <DataText numberOfLines={1} tone="brand" size="xs" weight="bold">
                  {countdown}
                </DataText>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.cardActionsRight}>
          <TouchableOpacity
            accessibilityLabel={`${recapButtonLabel} — ${item.name}`}
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={isAccessible ? onOpenSummary : onLockedPress}
            style={styles.iconBtn}
          >
            <Ionicons color={colors.brand.forest} name="document-text-outline" size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`${shareButtonLabel} — ${item.name}`}
            accessibilityRole="button"
            activeOpacity={0.8}
            disabled={isSharing}
            onPress={isAccessible ? onShare : onLockedPress}
            style={styles.iconBtn}
          >
            <Ionicons
              color={colors.brand.forest}
              name={isSharing ? 'hourglass-outline' : 'share-social-outline'}
              size={18}
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={`${isActivePlan ? inProgressLabel : startButtonLabel} — ${item.name}`}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={isAccessible ? onStart : onLockedPress}
            style={[
              styles.iconBtn,
              styles.startIconBtn,
              isActivePlan ? styles.startIconBtnActive : null,
              !isAccessible ? styles.iconBtnLocked : null,
            ]}
          >
            <Ionicons
              color={isAccessible ? colors.text.inverse : colors.accent.amber}
              name={!isAccessible ? 'lock-closed' : isActivePlan ? 'radio-button-on' : 'play'}
              size={18}
            />
          </TouchableOpacity>
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
    paddingBottom: 120,
  },
  listEmpty: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
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
  editRaceText: {
    textDecorationLine: 'underline',
  },
  orphanWarning: {
    paddingHorizontal: spacing[1],
    paddingBottom: spacing[2],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing[2],
    marginLeft: spacing[3],
    overflow: 'hidden',
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
    paddingHorizontal: spacing[4],
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
  liveBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent.amber,
    backgroundColor: colors.surface.sandLight,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  liveBadgeText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  iconBtnLocked: {
    backgroundColor: colors.surface.cream,
    borderColor: colors.accent.amber,
  },
  cardActionsRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderLeftWidth: 1,
    borderLeftColor: colors.border.subtle,
    backgroundColor: colors.surface.cream,
  },
  startIconBtn: {
    backgroundColor: colors.brand.forest,
    borderColor: colors.brand.forest,
  },
  startIconBtnActive: {
    backgroundColor: colors.brand.forestLight,
    borderColor: colors.brand.forestLight,
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
  inputLabel: {
    marginTop: spacing[5],
    marginBottom: spacing[2],
  },
  nameInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.cream,
    color: colors.text.primary,
    fontSize: 17,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  saveButton: {
    marginTop: spacing[4],
  },
  deleteButton: {
    minHeight: 48,
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  deleteButtonText: {
    color: colors.accent.terracotta,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[16],
  },
  emptyIcon: {
    opacity: 0.42,
  },
  emptyTitle: {
    textAlign: 'center',
    marginTop: spacing[5],
    marginBottom: spacing[2],
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: spacing[8],
  },
});
