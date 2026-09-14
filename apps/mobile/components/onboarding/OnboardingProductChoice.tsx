import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { Product } from '../nutrition/types';
import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

type OnboardingProductChoiceProps = {
  isSelected: boolean;
  isVerified: boolean;
  meta: string;
  onPress: () => void;
  product: Product;
  verifiedIcon: number;
};

/** Presentational product row used by both expanded brands and search-only results. */
export function OnboardingProductChoice({
  isSelected,
  isVerified,
  meta,
  onPress,
  product,
  verifiedIcon,
}: OnboardingProductChoiceProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
    >
      <View style={styles.contentRow}>
        <View style={styles.media}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={18} color={Colors.textMuted} />
            </View>
          )}
          {isVerified ? (
            <View style={styles.verifiedBadge}>
              <Image accessibilityIgnoresInvertColors source={verifiedIcon} style={styles.verifiedIcon} />
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text numberOfLines={2} style={styles.title}>{product.name}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <View style={[styles.selectControl, isSelected && styles.selectControlSelected]}>
          {isSelected ? <Ionicons name="checkmark" size={16} color={Colors.textOnBrand} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: 10 },
  cardSelected: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandSurface },
  contentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  media: { position: 'relative' },
  image: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.surfaceSecondary },
  imagePlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: { position: 'absolute', right: -5, bottom: -5, width: 19, height: 19, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.brandBorder },
  verifiedIcon: { width: 13, height: 13 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  selectControl: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  selectControlSelected: { borderColor: Colors.brandPrimary, backgroundColor: Colors.brandPrimary },
});
