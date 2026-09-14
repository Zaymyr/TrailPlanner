import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Locale, MobileTranslations } from '../../locales/types';
import type { GpxFeedback } from '../../lib/race-import';
import { Colors } from '../../constants/colors';
import type { FuelType, Product } from '../nutrition/types';
import { Text } from '../themed/Text';
import { OnboardingShell } from './OnboardingIntroSteps';
import { OnboardingProductChoice } from './OnboardingProductChoice';

const verifiedProductIcon = require('../../assets/verified-product.png');

const PRODUCT_PRIORITY: Record<FuelType, number> = {
  gel: 0,
  drink_mix: 1,
  electrolyte: 2,
  bar: 3,
  real_food: 4,
  capsule: 5,
  other: 6,
};

type OnboardingNutritionProductsStepProps = {
  copy: MobileTranslations;
  locale: Locale;
  totalSteps: number;
  skippingOnboarding: boolean;
  onSkip: () => void;
  selectedRaceSummary: string | null;
  onChangeRace: () => void;
  raceImportFeedback: GpxFeedback | null;
  products: Product[];
  selectedProductIds: string[];
  expandedBrands: string[];
  search: string;
  onChangeSearch: (value: string) => void;
  onToggleBrand: (brand: string) => void;
  onToggleProduct: (productId: string) => void;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  saving: boolean;
  onContinue: () => void;
};

function inferNutritionBrand(product: Pick<Product, 'name' | 'brand'>) {
  const explicitBrand = product.brand?.trim();
  if (explicitBrand) return explicitBrand;

  const fromDelimiter = product.name.split(' - ')[0]?.trim();
  const source = fromDelimiter || product.name;
  const firstToken = source
    .split(/\s+/)
    .map((part) => part.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, ''))
    .find(Boolean);
  const genericTokens = new Set([
    'bar',
    'capsule',
    'capsules',
    'decathlon',
    'drink',
    'electrolyte',
    'energy',
    'food',
    'fuel',
    'gel',
    'gels',
    'mix',
    'nutrition',
    'other',
    'product',
  ]);

  if (firstToken && genericTokens.has(firstToken.toLowerCase())) return null;
  return firstToken || source.trim() || 'Other';
}

function getFuelTypeLabel(fuelType: FuelType, locale: Locale) {
  const labels = locale === 'fr'
    ? {
        gel: 'Gel',
        drink_mix: 'Boisson',
        electrolyte: 'Électrolyte',
        capsule: 'Capsule',
        bar: 'Barre',
        real_food: 'Aliment',
        other: 'Autre',
      }
    : {
        gel: 'Gel',
        drink_mix: 'Drink mix',
        electrolyte: 'Electrolyte',
        capsule: 'Capsule',
        bar: 'Bar',
        real_food: 'Real food',
        other: 'Other',
      };

  return labels[fuelType];
}

function formatProductMeta(product: Product, locale: Locale) {
  const parts = [getFuelTypeLabel(product.fuel_type, locale)];
  const carbs = Math.round(product.carbs_g ?? 0);
  const sodium = Math.round(product.sodium_mg ?? 0);
  if (carbs > 0) parts.push(locale === 'fr' ? `${carbs} g glucides` : `${carbs} g carbs`);
  if (sodium > 0) parts.push(`${sodium} mg sodium`);
  return parts.join(' • ');
}

function isVerifiedProduct(product: Product) {
  return product.is_official === true;
}

export function OnboardingNutritionProductsStep({
  copy,
  locale,
  totalSteps,
  skippingOnboarding,
  onSkip,
  selectedRaceSummary,
  onChangeRace,
  raceImportFeedback,
  products,
  selectedProductIds,
  expandedBrands,
  search,
  onChangeSearch,
  onToggleBrand,
  onToggleProduct,
  loading,
  loadError,
  onRetry,
  saving,
  onContinue,
}: OnboardingNutritionProductsStepProps) {
  const groupedProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredProducts = products
      .filter((product) => {
        if (!normalizedSearch) return true;
        const brandLabel = (inferNutritionBrand(product) ?? '').toLowerCase();
        return product.name.toLowerCase().includes(normalizedSearch) || brandLabel.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const priorityDiff = (PRODUCT_PRIORITY[left.fuel_type] ?? 99) - (PRODUCT_PRIORITY[right.fuel_type] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        const densityDiff =
          (right.carbs_g ?? 0) + (right.sodium_mg ?? 0) / 100 -
          ((left.carbs_g ?? 0) + (left.sodium_mg ?? 0) / 100);
        return densityDiff !== 0 ? densityDiff : left.name.localeCompare(right.name);
      });

    return Array.from(
      filteredProducts.reduce((groups, product) => {
        const brand = inferNutritionBrand(product) || (locale === 'fr' ? 'Autres marques' : 'Other brands');
        const currentGroup = groups.get(brand) ?? [];
        currentGroup.push(product);
        groups.set(brand, currentGroup);
        return groups;
      }, new Map<string, Product[]>()),
    )
      .map(([brandLabel, grouped]) => ({ brandLabel, products: grouped }))
      .sort((left, right) => left.brandLabel.localeCompare(right.brandLabel));
  }, [locale, products, search]);
  const selectedCountLabel = copy.onboarding.nutritionSelectedCount.replace(
    '{count}',
    String(selectedProductIds.length),
  );

  return (
    <OnboardingShell
      step={6}
      totalSteps={totalSteps}
      stepLabel={copy.onboarding.stepLabel}
      skipLabel={copy.onboarding.skipOnboardingCta}
      skipDisabled={skippingOnboarding}
      onSkip={onSkip}
    >
      <Text style={styles.title}>{copy.onboarding.nutritionTitle}</Text>
      <Text style={styles.subtitle}>{copy.onboarding.nutritionSubtitle}</Text>

      <View style={styles.sectionCard}>
        {selectedRaceSummary ? (
          <View style={styles.selectionActionRow}>
            <View style={styles.selectionCountPill}>
              <Text style={styles.selectionCountText}>{selectedRaceSummary}</Text>
            </View>
            <TouchableOpacity style={styles.retryButtonInline} onPress={onChangeRace}>
              <Text style={styles.retryButtonInlineText}>{copy.onboarding.changeRaceCta}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {raceImportFeedback ? (
          <View
            style={[
              styles.importGpxFeedback,
              raceImportFeedback.tone === 'warning' && styles.importGpxFeedbackWarning,
            ]}
          >
            <Text style={styles.importGpxFeedbackText}>{raceImportFeedback.message}</Text>
          </View>
        ) : null}

        <View style={[styles.noticeBox, styles.nutritionNoticeBox]}>
          <Text style={styles.noticeTitle}>{copy.onboarding.nutritionHintTitle}</Text>
          <Text style={styles.noticeText}>{copy.onboarding.nutritionHint}</Text>
          <Text style={styles.nutritionSelectionStatus}>
            {selectedProductIds.length > 0
              ? selectedCountLabel
              : copy.onboarding.nutritionSelectionEmpty}
          </Text>
        </View>

        <TextInput
          style={styles.textInput}
          value={search}
          onChangeText={onChangeSearch}
          placeholder={copy.onboarding.nutritionSearchPlaceholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />

        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.brandPrimary} />
            <Text style={styles.stateText}>{copy.onboarding.nutritionLoading}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.centeredState}>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButtonInline} onPress={onRetry}>
              <Text style={styles.retryButtonInlineText}>{copy.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : groupedProducts.length === 0 ? (
          <View style={styles.centeredState}>
            <Text style={styles.emptyTitle}>{copy.onboarding.nutritionEmptyTitle}</Text>
            <Text style={styles.emptySubtitle}>{copy.onboarding.nutritionEmptySubtitle}</Text>
          </View>
        ) : (
          <View style={styles.productList}>
            {groupedProducts.map((group) => {
              const brandExpanded = search.trim().length > 0 || expandedBrands.includes(group.brandLabel);
              const selectedProductsInBrand = group.products.filter((product) =>
                selectedProductIds.includes(product.id),
              ).length;
              const hasVerifiedProduct = group.products.some(isVerifiedProduct);

              return (
                <View key={group.brandLabel} style={styles.productBrandGroup}>
                  <TouchableOpacity
                    style={[styles.productBrandHeader, brandExpanded && styles.productBrandHeaderExpanded]}
                    onPress={() => onToggleBrand(group.brandLabel)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.productBrandTitleRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.productBrandTitle, hasVerifiedProduct && styles.productBrandTitleOfficial]}
                      >
                        {group.brandLabel}
                      </Text>
                    </View>

                    <View style={styles.productBrandHeaderActions}>
                      {selectedProductsInBrand > 0 ? (
                        <View style={styles.productBrandSelectedPill}>
                          <Ionicons name="checkmark" size={12} color={Colors.textOnBrand} />
                          <Text style={styles.productBrandSelectedText}>{selectedProductsInBrand}</Text>
                        </View>
                      ) : null}
                      <View style={styles.productBrandCountPill}>
                        <Text style={styles.productBrandCountText}>{group.products.length}</Text>
                      </View>
                      <Ionicons
                        name={brandExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={Colors.brandPrimary}
                      />
                    </View>
                  </TouchableOpacity>

                  {brandExpanded ? (
                    <View style={styles.productBrandItems}>
                      {group.products.map((product) => (
                        <OnboardingProductChoice
                          key={product.id}
                          product={product}
                          meta={formatProductMeta(product, locale)}
                          isSelected={selectedProductIds.includes(product.id)}
                          isVerified={isVerifiedProduct(product)}
                          verifiedIcon={verifiedProductIcon}
                          onPress={() => onToggleProduct(product.id)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (selectedProductIds.length === 0 || saving) && styles.buttonDisabled]}
        onPress={onContinue}
        disabled={selectedProductIds.length === 0 || saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.textOnBrand} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {selectedProductIds.length > 0
              ? copy.onboarding.nutritionContinueCta
              : copy.onboarding.continueCta}
          </Text>
        )}
      </TouchableOpacity>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  sectionCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  selectionActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  selectionCountPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  selectionCountText: { color: Colors.brandPrimary, fontSize: 12, fontWeight: '700' },
  retryButtonInline: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface },
  retryButtonInlineText: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700' },
  importGpxFeedback: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  importGpxFeedbackWarning: { borderColor: Colors.warning },
  importGpxFeedbackText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  noticeBox: { backgroundColor: Colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 8, marginBottom: 24 },
  nutritionNoticeBox: { marginBottom: 14 },
  noticeTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  noticeText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  nutritionSelectionStatus: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  textInput: { backgroundColor: Colors.surfaceSecondary, color: Colors.textPrimary, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 8 },
  centeredState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 10 },
  stateText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  productList: { gap: 8 },
  productBrandGroup: { gap: 0 },
  productBrandHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  productBrandHeaderExpanded: { backgroundColor: Colors.brandSurface, borderColor: Colors.brandBorder },
  productBrandHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productBrandTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  productBrandTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  productBrandTitleOfficial: { color: Colors.brandLight },
  productBrandSelectedPill: { minWidth: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.brandPrimary },
  productBrandSelectedText: { color: Colors.textOnBrand, fontSize: 12, fontWeight: '800' },
  productBrandCountPill: { minWidth: 30, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.surfaceSecondary, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  productBrandCountText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  productBrandItems: { gap: 0 },
  primaryButton: { backgroundColor: Colors.brandPrimary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  primaryButtonText: { color: Colors.textOnBrand, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
