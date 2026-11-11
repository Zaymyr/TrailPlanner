import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { PlanProduct } from './contracts';
import type { AutoFillProductLimit } from './usePlanSupplies';
import type { AutoFillPreview } from '../../lib/autoFillPreview';
import { styles } from './styles';
import { useI18n } from '../../lib/i18n';

type LimitDraft = Record<string, { selected: boolean; limited: boolean; quantity: string }>;

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
  const limitMap = new Map(initialLimits.map((limit) => [limit.productId, limit.maxQuantity] as const));
  const hasExplicitSelection = initialLimits.length > 0;

  return Object.fromEntries(
    products.map((product) => {
      const maxQuantity = limitMap.get(product.id);
      const limited = typeof maxQuantity === 'number' && Number.isFinite(maxQuantity);
      return [
        product.id,
        {
          selected: hasExplicitSelection ? limitMap.has(product.id) : true,
          limited,
          quantity: limited ? String(Math.max(0, Math.floor(maxQuantity))) : '1',
        },
      ] as const;
    }),
  );
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
  const { t } = useI18n();
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

  const toggleSelected = (productId: string) => {
    setDraft((prev) => {
      const current = prev[productId] ?? { selected: true, limited: false, quantity: '1' };
      return {
        ...prev,
        [productId]: { ...current, selected: !current.selected },
      };
    });
  };

  const setUnlimited = (productId: string) => {
    setDraft((prev) => {
      const current = prev[productId] ?? { selected: true, limited: false, quantity: '1' };
      return { ...prev, [productId]: { ...current, selected: true, limited: false } };
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setDraft((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? { selected: true, limited: true, quantity: '1' }),
        selected: true,
        limited: true,
        quantity: String(prev[productId]?.limited === false ? 1 : Math.max(1, Math.min(999, (Number.parseInt(prev[productId]?.quantity ?? '1', 10) || 1) + delta))),
      },
    }));
  };

  const applyLimits = () => {
    const limits: AutoFillProductLimit[] = usableProducts.flatMap<AutoFillProductLimit>((product) => {
      const row = draft[product.id];
      if (!row?.selected) return [];
      if (!row.limited) return [{ productId: product.id, maxQuantity: null }];

      const parsedQuantity = Number.parseInt(row.quantity, 10);
      const maxQuantity = Number.isFinite(parsedQuantity) ? Math.max(0, parsedQuantity) : 0;
      return [{ productId: product.id, maxQuantity }];
    });

    onPreview(limits);
  };

  const hasSelectedProduct = usableProducts.some((product) => draft[product.id]?.selected);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View accessibilityViewIsModal style={styles.autoFillLimitsSheet}>
          <View style={styles.settingsSheetHandle} />
          <View style={styles.autoFillLimitsHeader}>
            <View style={styles.autoFillLimitsHeaderCopy}>
              <Text accessibilityRole="header" style={styles.autoFillLimitsTitle}>
                {preview ? t.autoFillLimits.preview : t.autoFillLimits.title}
              </Text>
              {!preview ? <Text style={styles.autoFillLimitsSubtitle}>{t.autoFillLimits.help}</Text> : null}
            </View>
            <IconAction accessibilityLabel={t.autoFillLimits.close} icon={<Ionicons color={Colors.textPrimary} name="close" size={20} />} onPress={onClose} />
          </View>

          {previewLoading || productsLoading ? (
            <ActivityIndicator color={Colors.brandPrimary} style={styles.autoFillLimitsLoading} />
          ) : preview ? (
            <View style={styles.autoFillPreview}>
              <View style={styles.autoFillPreviewMetrics}>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.totalUnits}</Text>
                  <Text style={styles.autoFillPreviewLabel}>{t.autoFillLimits.units}</Text>
                </View>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.productCount}</Text>
                  <Text style={styles.autoFillPreviewLabel}>{t.autoFillLimits.products}</Text>
                </View>
                <View style={styles.autoFillPreviewMetric}>
                  <Text style={styles.autoFillPreviewValue}>{preview.locationCount}</Text>
                  <Text style={styles.autoFillPreviewLabel}>{t.autoFillLimits.points}</Text>
                </View>
              </View>
              <View style={styles.autoFillPreviewChange}>
                <Ionicons color={Colors.brandPrimary} name="swap-horizontal" size={18} />
                <Text style={styles.autoFillPreviewChangeText}>
                  {t.autoFillLimits.changedPoints.replace('{count}', String(preview.changedLocationCount))}
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
                      {preview.worstShortage.carbsG > 0 ? `−${preview.worstShortage.carbsG} g glucides` : ''}
                      {preview.worstShortage.carbsG > 0 && preview.worstShortage.sodiumMg > 0 ? ' · ' : ''}
                      {preview.worstShortage.sodiumMg > 0 ? `−${preview.worstShortage.sodiumMg} mg sodium` : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.autoFillPreviewOk}>
                  <Ionicons color={Colors.success} name="checkmark-circle" size={18} />
                  <Text style={styles.autoFillPreviewOkText}>{t.autoFillLimits.needsCovered}</Text>
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
                <Text style={styles.pickerEmpty}>{t.autoFillLimits.empty}</Text>
              ) : (
                usableProducts.map((product) => {
                  const row = draft[product.id] ?? { selected: true, limited: false, quantity: '1' };
                  const carbs = Math.round(product.carbs_g ?? 0);
                  const sodium = Math.round(product.sodium_mg ?? 0);

                  return (
                    <View key={product.id} style={styles.autoFillLimitRow}>
                      <TouchableOpacity
                        accessibilityLabel={(row.selected ? t.autoFillLimits.doNotUseProduct : t.autoFillLimits.useProduct).replace('{product}', product.name)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: row.selected }}
                        onPress={() => toggleSelected(product.id)}
                        style={styles.autoFillLimitCheckbox}
                      >
                        <Ionicons
                          color={row.selected ? Colors.brandPrimary : Colors.textMuted}
                          name={row.selected ? 'checkbox' : 'square-outline'}
                          size={22}
                        />
                      </TouchableOpacity>
                      <View style={styles.autoFillLimitInfo}>
                        <View style={styles.autoFillLimitNameRow}>
                          <Text style={styles.autoFillLimitName} numberOfLines={2}>{product.name}</Text>
                        </View>
                        <Text style={styles.autoFillLimitMeta} numberOfLines={1}>
                          {fuelLabels[product.fuel_type] ?? product.fuel_type.toUpperCase()} - {carbs}g glucides - {sodium}mg sodium
                        </Text>
                      </View>
                      {row.selected ? <View accessible accessibilityLabel={t.autoFillLimits.accessibilityQuantity.replace('{product}', product.name).replace('{quantity}', row.limited ? row.quantity : t.autoFillLimits.unlimited.toLocaleLowerCase())} style={styles.autoFillQuantityArea}>
                        <View style={styles.autoFillQuantityStepper}>
                          <TouchableOpacity accessibilityRole="button" disabled={!row.limited} onPress={() => changeQuantity(product.id, -1)} style={styles.autoFillQuantityButton}><Ionicons color={row.limited ? Colors.brandPrimary : Colors.textMuted} name="remove" size={18} /></TouchableOpacity>
                          <TouchableOpacity accessibilityRole="button" onPress={() => changeQuantity(product.id, 0)} style={styles.autoFillQuantityValue}><Text style={styles.autoFillQuantityValueText}>{row.limited ? row.quantity : '∞'}</Text></TouchableOpacity>
                          <TouchableOpacity accessibilityRole="button" onPress={() => changeQuantity(product.id, 1)} style={styles.autoFillQuantityButton}><Ionicons color={Colors.brandPrimary} name="add" size={18} /></TouchableOpacity>
                        </View>
                        <TouchableOpacity accessibilityRole="button" onPress={() => setUnlimited(product.id)} style={styles.autoFillUnlimitedButton}><Text style={[styles.autoFillLimitBadge, !row.limited && styles.autoFillLimitBadgeActive]}>{t.autoFillLimits.unlimited}</Text></TouchableOpacity>
                      </View> : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.autoFillLimitsActions}>
            <TouchableOpacity onPress={preview ? onBack : onClose} style={styles.autoFillLimitsSecondaryButton}>
              <Text style={styles.autoFillLimitsSecondaryText}>{preview ? t.autoFillLimits.back : t.autoFillLimits.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={previewLoading || productsLoading || (!preview && !hasSelectedProduct)}
              onPress={preview ? onConfirm : applyLimits}
              style={[styles.autoFillLimitsPrimaryButton, (previewLoading || productsLoading || (!preview && !hasSelectedProduct)) && styles.autoFillLimitsPrimaryButtonDisabled]}
            >
              <Text style={styles.autoFillLimitsPrimaryText}>{preview ? t.autoFillLimits.apply : t.autoFillLimits.preview}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
