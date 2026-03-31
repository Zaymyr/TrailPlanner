import { Text, View } from 'react-native';
import { styles } from './styles';

type ProductBreakdownItem = {
  label: string;
  quantity: number;
};

type Props = {
  totalDurationLabel: string;
  totalProductUnits: number;
  distinctProductsCount: number;
  intermediateCount: number;
  plannedCarbsG: number;
  plannedSodiumMg: number;
  productBreakdown: ProductBreakdownItem[];
};

export function PlanHighlightsSection({
  totalDurationLabel,
  totalProductUnits,
  distinctProductsCount,
  intermediateCount,
  plannedCarbsG,
  plannedSodiumMg,
  productBreakdown,
}: Props) {
  return (
    <View style={styles.highlightsSection}>
      <View style={styles.highlightsHeader}>
        <Text style={styles.sectionTitle}>Résumé du plan</Text>
        <Text style={styles.highlightsSubtitle}>Les infos clés à garder en tête avant de finaliser le ravitaillement.</Text>
      </View>

      <View style={styles.highlightsGrid}>
        <View style={styles.highlightCard}>
          <Text style={styles.highlightValue}>{totalDurationLabel}</Text>
          <Text style={styles.highlightLabel}>Temps total estime</Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightValue}>{totalProductUnits}</Text>
          <Text style={styles.highlightLabel}>Produits à emporter</Text>
          <Text style={styles.highlightMeta}>{distinctProductsCount} référence{distinctProductsCount > 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightValue}>{plannedCarbsG} g</Text>
          <Text style={styles.highlightLabel}>Glucides planifies</Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightValue}>{intermediateCount}</Text>
          <Text style={styles.highlightLabel}>Ravitos intermédiaires</Text>
          <Text style={styles.highlightMeta}>{plannedSodiumMg} mg sodium prévus</Text>
        </View>
      </View>

      {productBreakdown.length > 0 ? (
        <View style={styles.highlightBreakdownSection}>
        <Text style={styles.highlightBreakdownLabel}>Répartition produits</Text>
          <View style={styles.highlightBreakdownRow}>
            {productBreakdown.map((item) => (
              <Text key={`${item.label}-${item.quantity}`} style={styles.highlightBreakdownChip}>
                {item.quantity > 0 ? `${item.label} x${item.quantity}` : item.label}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.highlightEmptyText}>Aucun produit ajouté pour le moment.</Text>
      )}
    </View>
  );
}
