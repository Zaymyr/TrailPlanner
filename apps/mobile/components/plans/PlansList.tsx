import { memo } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AidStationIcon,
  EmptyPlanIcon,
  SummitIcon,
  TrailIcon,
  colors,
  radius,
  shadows,
  spacing
} from '@pace-yourself/design-system';
import { Button } from '../themed/Button';
import { Card } from '../themed/Card';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';
import { estimateDuration, formatPlanDate } from './plansHelpers';
import type { PlanRow, RaceSection } from './types';

type PlansListProps = {
  sections: RaceSection[];
  collapsedSections: Set<string>;
  activePlanId: string | null;
  accessiblePlanIds: Set<string> | null;
  isPremium: boolean;
  locale: 'fr' | 'en';
  refreshing: boolean;
  editRaceLabel: string;
  noRaceWarningLabel: string;
  liveLabel: string;
  inProgressLabel: string;
  startButtonLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  createFirstLabel: string;
  onRefresh: () => void;
  onToggleSection: (key: string) => void;
  onEditRace: (raceId: string) => void;
  onDeletePlan: (planId: string) => void;
  onOpenEditPlan: (planId: string) => void;
  onOpenRacePlan: (planId: string) => void;
  onOpenLockedPlan: () => void;
  onCreateFirstPlan: () => void;
  onOpenCatalog: () => void;
};

export const PlansList = memo(function PlansList({
  sections,
  collapsedSections,
  activePlanId,
  accessiblePlanIds,
  isPremium,
  locale,
  refreshing,
  editRaceLabel,
  noRaceWarningLabel,
  liveLabel,
  inProgressLabel,
  startButtonLabel,
  emptyTitle,
  emptySubtitle,
  createFirstLabel,
  onRefresh,
  onToggleSection,
  onEditRace,
  onDeletePlan,
  onOpenEditPlan,
  onOpenRacePlan,
  onOpenLockedPlan,
  onCreateFirstPlan,
  onOpenCatalog,
}: PlansListProps) {
  const localizedEmptyTitle =
    locale === 'fr' ? "Aucun plan à l'horizon" : 'The trail starts here';

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
          const key = section.raceId ?? '__orphan__';
          if (collapsedSections.has(key)) return null;

          const duration = estimateDuration(item.planner_values);
          const isActivePlan = activePlanId === item.id;
          const isAccessible =
            isPremium || accessiblePlanIds === null || accessiblePlanIds.has(item.id);

          return (
            <PlanCard
              duration={duration}
              editButtonVisible={!isActivePlan && isAccessible}
              isAccessible={isAccessible}
              isActivePlan={isActivePlan}
              item={item}
              liveLabel={liveLabel}
              locale={locale}
              onDelete={() => onDeletePlan(item.id)}
              onEdit={() => onOpenEditPlan(item.id)}
              onLockedPress={onOpenLockedPlan}
              onOpenMain={() => (isActivePlan ? onOpenRacePlan(item.id) : onOpenEditPlan(item.id))}
              onStart={() => onOpenRacePlan(item.id)}
              startButtonLabel={startButtonLabel}
              inProgressLabel={inProgressLabel}
            />
          );
        }}
        renderSectionFooter={({ section }) => {
          const key = section.raceId ?? '__orphan__';
          const isCollapsed = collapsedSections.has(key);
          if (isCollapsed || section.data.length === 0) return null;
          if (section.raceId === null) {
            return (
              <Text tone="secondary" size="xs" style={styles.orphanWarning}>
                {noRaceWarningLabel}
              </Text>
            );
          }
          return null;
        }}
        renderSectionHeader={({ section }) => {
          const key = section.raceId ?? '__orphan__';
          const isCollapsed = collapsedSections.has(key);

          return (
            <TouchableOpacity
              activeOpacity={0.72}
              onPress={() => onToggleSection(key)}
              style={styles.sectionHeader}
            >
              <Text tone="brand" size="sm" weight="bold" style={styles.sectionCollapseIcon}>
                {isCollapsed ? '+' : '-'}
              </Text>
              <View style={styles.sectionTitleWrap}>
                <View style={styles.sectionTitleRow}>
                  <TrailIcon color={colors.brand.forest} size={20} strokeWidth={2.2} />
                  <Heading numberOfLines={1} variant="h3" style={styles.sectionTitle}>
                    {section.raceName}
                  </Heading>
                </View>
              </View>
              <View style={styles.sectionCountBadge}>
                <AidStationIcon color={colors.brand.forest} size={15} strokeWidth={2.1} />
                <DataText tone="brand" size="xs" weight="semibold">
                  {section.data.length}
                </DataText>
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
        sections={sections.map((section) => ({ ...section, key: section.raceId ?? '__orphan__' }))}
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

      <TouchableOpacity activeOpacity={0.85} onPress={onOpenCatalog} style={styles.fab}>
        <Text tone="inverse" size="2xl" weight="bold" style={styles.fabText}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
});

type PlanCardProps = {
  item: PlanRow;
  duration: string | null;
  locale: 'fr' | 'en';
  isAccessible: boolean;
  isActivePlan: boolean;
  editButtonVisible: boolean;
  liveLabel: string;
  startButtonLabel: string;
  inProgressLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMain: () => void;
  onStart: () => void;
  onLockedPress: () => void;
};

function PlanCard({
  item,
  duration,
  locale,
  isAccessible,
  isActivePlan,
  editButtonVisible,
  liveLabel,
  startButtonLabel,
  inProgressLabel,
  onEdit,
  onDelete,
  onOpenMain,
  onStart,
  onLockedPress,
}: PlanCardProps) {
  const aidStationCount = item.planner_values?.aidStations?.length ?? 0;

  return (
    <Card padded={false} surface="white" style={[styles.card, isActivePlan && styles.cardActive]}>
      {isActivePlan ? (
        <View style={[styles.cardActionsLeft, styles.cardActionsActive]}>
          <TrailIcon color={colors.accent.amber} size={20} strokeWidth={2.2} />
          <Text tone="brand" size="xs" weight="bold" style={styles.cardActionsActiveText}>
            {liveLabel}
          </Text>
        </View>
      ) : (
        <View style={styles.cardActionsLeft}>
          {editButtonVisible ? (
            <TouchableOpacity activeOpacity={0.8} onPress={onEdit} style={styles.iconBtn}>
              <Ionicons color={colors.text.secondary} name="create-outline" size={16} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.iconBtn, styles.iconBtnLocked]}>
              <Ionicons color={colors.accent.amber} name="lock-closed-outline" size={16} />
            </View>
          )}
          <TouchableOpacity activeOpacity={0.8} onPress={onDelete} style={styles.iconBtn}>
            <Ionicons color={colors.accent.terracotta} name="trash-outline" size={16} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={isAccessible ? onOpenMain : onLockedPress}
        style={styles.cardMainButton}
      >
        <View style={styles.cardContent}>
          <View style={styles.planTitleRow}>
            <TrailIcon color={colors.brand.forest} size={18} strokeWidth={2} />
            <Heading variant="h2" numberOfLines={2} style={styles.planName}>
              {item.name}
            </Heading>
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
            {duration ? (
              <DataText tone="secondary" size="xs" weight="medium">
                {duration}
              </DataText>
            ) : null}
            {aidStationCount > 0 ? (
              <View style={styles.metaInline}>
                <AidStationIcon color={colors.brand.forest} size={14} strokeWidth={2.1} />
                <DataText tone="brand" size="xs" weight="semibold">
                  {aidStationCount}
                </DataText>
              </View>
            ) : null}
            <DataText tone="tertiary" size="xs">
              {formatPlanDate(item.updated_at, locale)}
            </DataText>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={isAccessible ? onStart : onLockedPress}
        style={[
          styles.startButton,
          isActivePlan ? styles.startButtonActive : null,
          !isAccessible ? styles.startButtonLocked : null,
        ]}
      >
        {!isAccessible ? (
          <Ionicons color={colors.accent.amber} name="lock-closed" size={18} />
        ) : (
          <>
            <Ionicons
              color={colors.text.inverse}
              name={isActivePlan ? 'radio-button-on' : 'play'}
              size={15}
            />
            <Text
              adjustsFontSizeToFit
              lineHeight="tight"
              minimumFontScale={0.82}
              numberOfLines={1}
              tone="inverse"
              size="xs"
              weight="bold"
              style={styles.startButtonText}
            >
              {isActivePlan ? inProgressLabel : startButtonLabel}
            </Text>
          </>
        )}
      </TouchableOpacity>
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
    gap: spacing[2],
    paddingBottom: 100,
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
  sectionCollapseIcon: {
    width: 18,
    textAlign: 'center',
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
  },
  sectionCountBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.cream,
    paddingHorizontal: spacing[2],
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
    marginBottom: spacing[3],
    marginLeft: spacing[6],
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: colors.border.brand,
  },
  cardActionsLeft: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRightWidth: 1,
    borderRightColor: colors.border.subtle,
    backgroundColor: colors.surface.cream,
  },
  cardActionsActive: {
    minWidth: 58,
    gap: spacing[1.5],
    backgroundColor: colors.surface.sandLight,
  },
  cardActionsActiveText: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardMainButton: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  planName: {
    flex: 1,
    fontSize: 19,
    lineHeight: 23,
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
  iconBtn: {
    width: 34,
    height: 34,
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
  startButton: {
    width: 88,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    backgroundColor: colors.brand.forest,
    borderLeftWidth: 1,
    borderLeftColor: colors.brand.forestLight,
  },
  startButtonActive: {
    backgroundColor: colors.brand.forestLight,
    borderLeftColor: colors.brand.forestDark,
  },
  startButtonLocked: {
    backgroundColor: colors.surface.cream,
    borderLeftColor: colors.accent.amber,
  },
  startButtonText: {
    textAlign: 'center',
    maxWidth: 72,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brand.forest,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: shadows.md,
  } as ViewStyle,
  fabText: {
    lineHeight: 32,
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
