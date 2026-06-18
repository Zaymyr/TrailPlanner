import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { PlanProduct } from './contracts';
import type { AutoFillProductLimit } from './usePlanSupplies';
import { styles } from './styles';

type LimitDraft = Record<string, { limited: boolean; quantity: string }>;

type Props = {
  visible: boolean;
  products: PlanProduct[];
  productsLoading: boolean;
  fuelLabels: Record<string, string>;
  onClose: () => void;
  onApply: (limits: AutoFillProductLimit[]) => void;
};

function buildInitialDraft(products: PlanProduct[]): LimitDraft {
  return Object.fromEntries(products.map((product) => [product.id, { limited: false, quantity: '1' }] as const));
}

function sanitizeQuantity(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 3);
}

export const AutoFillLimitsModal = React.memo(function AutoFillLimitsModal({
  visible,
  products,
  productsLoading,
  fuelLabels,
  onClose,
  onApply,
}: Props) {
  const usableProducts = useMemo(
    () => products.filter((product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0),
    [products],
  );
  const [draft, setDraft] = useState<LimitDraft>(() => buildInitialDraft(usableProducts));

  useEffect(() => {
    if (visible) {
      setDraft(buildInitialDraft(usableProducts));
    }
  }, [usableProducts, visible]);

  const toggleLimited = (productId: string) => {
    setDraft((prev) => {
      const current = prev[productId] ?? { limited: false, quantity: '1' };
      return {
        ...prev,
        [productId]: {
          limited: !current.limited,
          quantity: current.quantity || '1',
        },
      };
    });
  };

  const updateQuantity = (productId: string, quantity: string) => {
    setDraft((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? { limited: true, quantity: '1' }),
        limited: true,
        quantity: sanitizeQuantity(quantity),
      },
    }));
  };

  const applyLimits = () => {
    const limits = usableProducts.flatMap((product) => {
      const row = draft[product.id];
      if (!row?.limited) return [];

      const parsedQuantity = Number.parseInt(row.quantity, 10);
      const maxQuantity = Number.isFinite(parsedQuantity) ? Math.max(0, parsedQuantity) : 0;
      return [{ productId: product.id, maxQuantity }];
    });

    onApply(limits);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.autoFillLimitsSheet}>
          <View style={styles.settingsSheetHandle} />
          <View style={styles.autoFillLimitsHeader}>
            <View style={styles.autoFillLimitsHeaderCopy}>
              <Text style={styles.autoFillLimitsTitle}>Stock disponible</Text>
              <Text style={styles.autoFillLimitsSubtitle}>
                Limite les favoris que le calcul auto peut utiliser. Sans limite, le produit reste illimite.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.pickerCloseBtn}>
              <Ionicons color={Colors.textSecondary} name="close" size={18} />
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <ActivityIndicator color={Colors.brandPrimary} style={styles.autoFillLimitsLoading} />
          ) : (
            <ScrollView
              contentContainerStyle={styles.autoFillLimitsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {usableProducts.length === 0 ? (
                <Text style={styles.pickerEmpty}>Aucun favori utilisable.</Text>
              ) : (
                usableProducts.map((product) => {
                  const row = draft[product.id] ?? { limited: false, quantity: '1' };
                  const carbs = Math.round(product.carbs_g ?? 0);
                  const sodium = Math.round(product.sodium_mg ?? 0);

                  return (
                    <View key={product.id} style={styles.autoFillLimitRow}>
                      <TouchableOpacity
                        accessibilityLabel={row.limited ? 'Retirer la limite' : 'Limiter ce produit'}
                        onPress={() => toggleLimited(product.id)}
                        style={styles.autoFillLimitCheckbox}
                      >
                        <Ionicons
                          color={row.limited ? Colors.brandPrimary : Colors.textMuted}
                          name={row.limited ? 'checkbox' : 'square-outline'}
                          size={22}
                        />
                      </TouchableOpacity>
                      <View style={styles.autoFillLimitInfo}>
                        <Text style={styles.autoFillLimitName} numberOfLines={1}>
                          {product.name}
                        </Text>
                        <Text style={styles.autoFillLimitMeta} numberOfLines={1}>
                          {fuelLabels[product.fuel_type] ?? product.fuel_type.toUpperCase()} - {carbs}g glucides - {sodium}mg sodium
                        </Text>
                      </View>
                      <TextInput
                        editable={row.limited}
                        keyboardType="number-pad"
                        onChangeText={(value) => updateQuantity(product.id, value)}
                        placeholder={row.limited ? '0' : 'Illimite'}
                        placeholderTextColor={Colors.textMuted}
                        selectTextOnFocus
                        style={[styles.autoFillLimitInput, !row.limited && styles.autoFillLimitInputDisabled]}
                        value={row.limited ? row.quantity : ''}
                      />
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.autoFillLimitsActions}>
            <TouchableOpacity onPress={onClose} style={styles.autoFillLimitsSecondaryButton}>
              <Text style={styles.autoFillLimitsSecondaryText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={applyLimits} style={styles.autoFillLimitsPrimaryButton}>
              <Text style={styles.autoFillLimitsPrimaryText}>Lancer le calcul</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
