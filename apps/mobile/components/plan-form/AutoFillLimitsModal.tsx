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
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { PlanProduct } from './contracts';
import type { AutoFillProductLimit } from './usePlanSupplies';
import type { AutoFillPreview } from '../../lib/autoFillPreview';
import { styles } from './styles';

type LimitDraft = Record<string, { limited: boolean; quantity: string }>;

type Props = {
  visible: boolean;
  products: PlanProduct[];
  productsLoading: boolean;
  initialLimits: AutoFillProductLimit[];
  fuelLabels: Record<string, string>;
  preview: AutoFillPreview | null;
  previewLoading: boolean;
  onClose: () => void;
  onPreview: (limits: AutoFillProductLimit[]) => void;
  onBack: () => void;
  onConfirm: () => void;
};

function buildInitialDraft(products: PlanProduct[], initialLimits: AutoFillProductLimit[] = []): LimitDraft {
  const limitMap = new Map(
    initialLimits.flatMap((limit) => {
      if (limit.maxQuantity === null || limit.maxQuantity === undefined) return [];

      const quantity = Math.floor(limit.maxQuantity);
      if (!Number.isFinite(quantity)) return [];

      return [[limit.productId, Math.max(0, quantity)] as const];
    }),
  );

  return Object.fromEntries(
    products.map((product) => {
      const quantity = limitMap.get(product.id);
      return [
        product.id,
        quantity === undefined ? { limited: false, quantity: '1' } : { limited: true, quantity: String(quantity) },
      ] as const;
    }),
  );
}

function sanitizeQuantity(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 3);
}

export const AutoFillLimitsModal = React.memo(function AutoFillLimitsModal({
  visible,
  products,
  productsLoading,
  initialLimits,
  fuelLabels,
  preview,
  previewLoading,
  onClose,
  onPreview,
  onBack,
  onConfirm,
}: Props) {
  const usableProducts = useMemo(
    () => products.filter((product) => (product.carbs_g ?? 0) > 0 || (product.sodium_mg ?? 0) > 0),
    [products],
  );
  const [draft, setDraft] = useState<LimitDraft>(() => buildInitialDraft(usableProducts, initialLimits));

  useEffect(() => {
    if (visible) {
      setDraft(buildInitialDraft(usableProducts, initialLimits));
    }
  }, [initialLimits, usableProducts, visible]);

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

    onPreview(limits);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.autoFillLimitsSheet}>
          <View style={styles.settingsSheetHandle} />
          <View style={styles.autoFillLimitsHeader}>
            <View style={styles.autoFillLimitsHeaderCopy}>
              <Text accessibilityRole="header" style={styles.autoFillLimitsTitle}>
                {preview ? 'Aperçu' : 'Stock disponible'}
              </Text>
            </View>
            <TouchableOpacity accessibilityLabel="Fermer" accessibilityRole="button" hitSlop={6} onPress={onClose} style={styles.pickerCloseBtn}>
              <Ionicons color={Colors.textSecondary} name="close" size={18} />
            </TouchableOpacity>
          </View>

          {previewLoading || productsLoading ? (
            <ActivityIndicator color={Colors.brandPrimary} style={styles.autoFillLimitsLoading} />
          ) : preview ? (
            <View style={styles.autoFillPreview}>
              <View style={styles.autoFillPreviewMetrics}>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.totalUnits}</Text>
                  <Text style={styles.autoFillPreviewLabel}>unités</Text>
                </View>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.productCount}</Text>
                  <Text style={styles.autoFillPreviewLabel}>produits</Text>
                </View>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.locationCount}</Text>
                  <Text style={styles.autoFillPreviewLabel}>points</Text>
                </View>
              </View>
              <View style={styles.autoFillPreviewChange}>
                <Ionicons color={Colors.brandPrimary} name="swap-horizontal" size={18} />
                <Text style={styles.autoFillPreviewChangeText}>
                  {preview.changedLocationCount} point{preview.changedLocationCount > 1 ? 's' : ''} modifié{preview.changedLocationCount > 1 ? 's' : ''}
                </Text>
              </View>
              {preview.worstShortage ? (
                <View style={styles.autoFillPreviewWarning}>
                  <Ionicons color={Colors.warning} name="warning-outline" size={18} />
                  <View style={styles.autoFillPreviewWarningCopy}>
                    <Text numberOfLines={1} style={styles.autoFillPreviewWarningTitle}>
                      {preview.worstShortage.sectionLabel}
                    </Text>
                    <Text style={styles.autoFillPreviewWarningText}>
                      {preview.worstShortage.carbsG > 0 ? `−${preview.worstShortage.carbsG} g` : ''}
                      {preview.worstShortage.carbsG > 0 && preview.worstShortage.sodiumMg > 0 ? ' · ' : ''}
                      {preview.worstShortage.sodiumMg > 0 ? `−${preview.worstShortage.sodiumMg} mg` : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.autoFillPreviewOk}>
                  <Ionicons color={Colors.success} name="checkmark-circle" size={18} />
                  <Text style={styles.autoFillPreviewOkText}>Besoins couverts</Text>
                </View>
              )}
            </View>
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
                        accessibilityLabel={`${row.limited ? 'Ne plus limiter' : 'Limiter'} ${product.name}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: row.limited }}
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
                        <View style={styles.autoFillLimitNameRow}>
                          <Text style={styles.autoFillLimitName} numberOfLines={1}>{product.name}</Text>
                          <Text style={[styles.autoFillLimitBadge, row.limited && styles.autoFillLimitBadgeActive]}>
                            Limiter
                          </Text>
                        </View>
                        <Text style={styles.autoFillLimitMeta} numberOfLines={1}>
                          {fuelLabels[product.fuel_type] ?? product.fuel_type.toUpperCase()} - {carbs}g glucides - {sodium}mg sodium
                        </Text>
                      </View>
                      <TextInput
                        editable={row.limited}
                        keyboardType="number-pad"
                        inputAccessoryViewID="pace-yourself-numeric-keyboard"
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
            <TouchableOpacity onPress={preview ? onBack : onClose} style={styles.autoFillLimitsSecondaryButton}>
              <Text style={styles.autoFillLimitsSecondaryText}>{preview ? 'Retour' : 'Annuler'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={previewLoading || productsLoading}
              onPress={preview ? onConfirm : applyLimits}
              style={[styles.autoFillLimitsPrimaryButton, (previewLoading || productsLoading) && styles.autoFillLimitsPrimaryButtonDisabled]}
            >
              <Text style={styles.autoFillLimitsPrimaryText}>{preview ? 'Appliquer' : 'Aperçu'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
