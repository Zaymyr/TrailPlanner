import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { PlanProduct, Supply } from './contracts';
import { styles } from './styles';

type Props = {
  supplies: Supply[];
  productMap: Record<string, PlanProduct>;
  fuelLabels: Record<string, string>;
  onOpenPicker: () => void;
  onIncreaseQty: (productId: string) => void;
  onDecreaseQty: (productId: string) => void;
  onRemoveSupply: (productId: string) => void;
};

export const SuppliesList = React.memo(function SuppliesList({
  supplies,
  productMap,
  fuelLabels,
  onOpenPicker,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveSupply,
}: Props) {
  return (
    <View style={styles.suppliesSection}>
      <View style={styles.suppliesHeader}>
        <Text style={styles.suppliesLabel}>Produits</Text>
        <TouchableOpacity onPress={onOpenPicker}>
          <Text style={styles.suppliesAddBtn}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {supplies.length === 0 ? (
        <Text style={styles.suppliesEmpty}>Aucun produit assigné</Text>
      ) : (
        supplies.map((supply) => {
          const product = productMap[supply.productId];

          return (
            <View key={supply.productId} style={styles.supplyRow}>
              <View style={styles.supplyInfo}>
                <Text style={styles.supplyName} numberOfLines={1}>
                  {product?.name ?? '...'}
                </Text>
                {product ? (
                  <>
                    <Text style={styles.supplyType}>
                      {fuelLabels[product.fuel_type] ?? product.fuel_type.toUpperCase()}
                    </Text>
                    <Text style={styles.supplyMeta}>
                      {(product.carbs_g ?? 0) * supply.quantity}g glucides · {(product.sodium_mg ?? 0) * supply.quantity}mg sodium
                    </Text>
                  </>
                ) : null}
              </View>

              <View style={styles.supplyControls}>
                <TouchableOpacity
                  style={[styles.qtyBtn, supply.quantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => onDecreaseQty(supply.productId)}
                  disabled={supply.quantity <= 1}
                >
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{supply.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => onIncreaseQty(supply.productId)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeSupplyBtn} onPress={() => onRemoveSupply(supply.productId)}>
                  <Text style={styles.removeSupplyText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
});
