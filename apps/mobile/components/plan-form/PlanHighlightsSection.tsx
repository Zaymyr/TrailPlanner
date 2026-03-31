import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { styles } from './styles';

type ProductBreakdownItem = {
  label: string;
  quantity: number;
};

type Props = {
  expanded: boolean;
  onToggle: () => void;
  totalDurationLabel: string;
  paceLabel: string;
  intermediateCount: number;
  plannedCarbsG: number;
  plannedSodiumMg: number;
  productBreakdown: ProductBreakdownItem[];
};

export function PlanHighlightsSection({
  expanded,
  onToggle,
  totalDurationLabel,
  paceLabel,
  intermediateCount,
  plannedCarbsG,
  plannedSodiumMg,
  productBreakdown,
}: Props) {
  const secondarySummaryChips = [
    `${intermediateCount} ravitos`,
    `${plannedCarbsG} g glucides`,
    `${plannedSodiumMg} mg sodium`,
  ];

  return (
    <View style={styles.highlightsSection}>
      <TouchableOpacity
        style={[
          styles.sectionAccordionHeader,
          styles.sectionAccordionHeaderSpaced,
          styles.highlightsAccordionHeader,
          !expanded && styles.sectionAccordionHeaderCollapsed,
        ]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <View style={styles.sectionAccordionHeaderContent}>
          <View style={styles.sectionAccordionTitleRow}>
            <Text style={[styles.sectionTitle, styles.sectionAccordionTitle]}>Resume du plan</Text>
            {!expanded && (
              <>
                <View style={styles.highlightsInlinePrimaryBadge}>
                  <Text style={styles.highlightsInlinePrimaryValue}>{totalDurationLabel}</Text>
                  <Text style={styles.highlightsInlinePrimaryLabel}>Temps</Text>
                </View>
                <View style={styles.highlightsInlinePrimaryBadge}>
                  <Text style={styles.highlightsInlinePrimaryValue}>{paceLabel}</Text>
                  <Text style={styles.highlightsInlinePrimaryLabel}>min/km</Text>
                </View>
                {secondarySummaryChips.map((chip) => (
                  <Text key={chip} style={styles.sectionSummaryChipInline}>
                    {chip}
                  </Text>
                ))}
              </>
            )}
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded ? (
        <>
          <Text style={styles.highlightsSubtitle}>Les infos cles a garder en tete avant de finaliser le ravitaillement.</Text>

          <View style={styles.highlightsHeroRow}>
            <View style={styles.highlightsHeroPrimary}>
              <Text style={styles.highlightsHeroValue}>{totalDurationLabel}</Text>
              <Text style={styles.highlightsHeroLabel}>Temps total estime</Text>
            </View>

            <View style={styles.highlightsHeroPrimary}>
              <Text style={styles.highlightsHeroValue}>{paceLabel}</Text>
              <Text style={styles.highlightsHeroLabel}>Allure moyenne</Text>
            </View>
          </View>

          <View style={styles.highlightMetricsRow}>
            <View style={styles.highlightMetricChip}>
              <Text style={styles.highlightMetricChipLabel}>Glucides</Text>
              <Text style={styles.highlightMetricChipValue}>{plannedCarbsG} g</Text>
            </View>
            <View style={styles.highlightMetricChip}>
              <Text style={styles.highlightMetricChipLabel}>Sodium</Text>
              <Text style={styles.highlightMetricChipValue}>{plannedSodiumMg} mg</Text>
            </View>
            <View style={styles.highlightMetricChip}>
              <Text style={styles.highlightMetricChipLabel}>Ravitos</Text>
              <Text style={styles.highlightMetricChipValue}>{intermediateCount}</Text>
            </View>
          </View>

          {productBreakdown.length > 0 ? (
            <View style={styles.highlightBreakdownSection}>
              <Text style={styles.highlightBreakdownLabel}>Repartition produits</Text>
              <View style={styles.highlightBreakdownRow}>
                {productBreakdown.map((item) => (
                  <Text key={`${item.label}-${item.quantity}`} style={styles.highlightBreakdownChip}>
                    {item.quantity > 0 ? `${item.label} x${item.quantity}` : item.label}
                  </Text>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.highlightEmptyText}>Aucun produit ajoute pour le moment.</Text>
          )}
        </>
      ) : null}
    </View>
  );
}
