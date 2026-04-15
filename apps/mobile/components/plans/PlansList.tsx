import { memo } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { estimateDuration, formatPlanDate } from './plansHelpers';
import type { PlanRow, RaceSection } from './types';

type PlansListProps = {
  sections: RaceSection[];
  collapsedSections: Set<string>;
  activePlanId: string | null;
  latestAccessiblePlanId: string | null;
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
  latestAccessiblePlanId,
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
  return (
    <View style={styles.screen}>
      <SectionList
        contentContainerStyle={[styles.list, sections.length === 0 && styles.listEmpty]}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={Colors.brandPrimary}
          />
        }
        renderItem={({ item, section }) => {
          const key = section.raceId ?? '__orphan__';
          if (collapsedSections.has(key)) return null;

          const duration = estimateDuration(item.planner_values);
          const isActivePlan = activePlanId === item.id;
          const isAccessible =
            isPremium || latestAccessiblePlanId === null || latestAccessiblePlanId === item.id;

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
            return <Text style={styles.orphanWarning}>{noRaceWarningLabel}</Text>;
          }
          return null;
        }}
        renderSectionHeader={({ section }) => {
          const key = section.raceId ?? '__orphan__';
          const isCollapsed = collapsedSections.has(key);

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onToggleSection(key)}
              style={styles.sectionHeader}
            >
              <Text style={styles.sectionCollapseIcon}>{isCollapsed ? '▶' : '▼'}</Text>
              <View style={styles.sectionTitleWrap}>
                <Text numberOfLines={1} style={styles.sectionTitle}>
                  📍 {section.raceName}
                </Text>
              </View>
              {section.isOwned && section.raceId ? (
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => onEditRace(section.raceId!)}
                >
                  <Text style={styles.editRaceText}>{editRaceLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        }}
        sections={sections.map((section) => ({ ...section, key: section.raceId ?? '__orphan__' }))}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏔️</Text>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
            <TouchableOpacity onPress={onCreateFirstPlan} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>{createFirstLabel}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity activeOpacity={0.85} onPress={onOpenCatalog} style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
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
  return (
    <View style={styles.card}>
      {isActivePlan ? (
        <View style={[styles.cardActionsLeft, styles.cardActionsActive]}>
          <Ionicons color={Colors.warning} name="radio" size={18} />
          <Text style={styles.cardActionsActiveText}>{liveLabel}</Text>
        </View>
      ) : (
        <View style={styles.cardActionsLeft}>
          {editButtonVisible ? (
            <TouchableOpacity activeOpacity={0.8} onPress={onEdit} style={styles.iconBtn}>
              <Ionicons color="#6B7280" name="create-outline" size={16} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.iconBtn, styles.iconBtnLocked]}>
              <Ionicons color={Colors.warning} name="lock-closed-outline" size={16} />
            </View>
          )}
          <TouchableOpacity activeOpacity={0.8} onPress={onDelete} style={styles.iconBtn}>
            <Ionicons color="#EF4444" name="trash-outline" size={16} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={isAccessible ? onOpenMain : onLockedPress}
        style={styles.cardMainButton}
      >
        <View style={styles.cardContent}>
          <Text style={styles.planName}>{item.name}</Text>
          <View style={styles.meta}>
            {item.planner_values?.raceDistanceKm != null ? (
              <Text style={styles.metaText}>{item.planner_values.raceDistanceKm} km</Text>
            ) : null}
            {item.planner_values?.elevationGain != null ? (
              <Text style={styles.metaText}> · D+ {item.planner_values.elevationGain}m</Text>
            ) : null}
            {duration ? <Text style={styles.metaText}> · {duration}</Text> : null}
            <Text style={styles.metaDate}> · {formatPlanDate(item.updated_at, locale)}</Text>
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
          <Ionicons color={Colors.warning} name="lock-closed" size={18} />
        ) : (
          <Text style={styles.startButtonText}>
            {isActivePlan ? inProgressLabel : startButtonLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
    gap: 4,
    paddingBottom: 100,
  },
  listEmpty: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: Colors.background,
  },
  sectionCollapseIcon: {
    color: Colors.brandPrimary,
    fontSize: 11,
    width: 14,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  editRaceText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  orphanWarning: {
    color: Colors.warning,
    fontSize: 12,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
    marginLeft: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  cardActionsLeft: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  cardActionsActive: {
    minWidth: 54,
    gap: 6,
  },
  cardActionsActiveText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardMainButton: {
    flex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  planName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBtnLocked: {
    backgroundColor: Colors.warningSurface,
    borderColor: Colors.warning,
  },
  startButton: {
    width: 76,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: Colors.brandPrimary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.brandLight,
  },
  startButtonActive: {
    backgroundColor: Colors.warning,
    borderLeftColor: '#F6C08A',
  },
  startButtonLocked: {
    backgroundColor: Colors.surfaceSecondary,
    borderLeftColor: Colors.warning,
  },
  startButtonText: {
    color: Colors.textOnBrand,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brandPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.brandPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: Colors.textOnBrand,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    backgroundColor: Colors.brandPrimary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: Colors.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
});
