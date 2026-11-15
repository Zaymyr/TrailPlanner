import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../themed/ActionButton';
import { Card } from '../themed/Card';
import { StatusPill } from '../themed/StatusPill';
import { Text } from '../themed/Text';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';

type PremiumBadge = {
  tone: 'premium' | 'trial' | 'free';
  label: string;
};

type PremiumInfoCard = {
  id: string;
  title: string;
  body: string;
  meta?: string | null;
};

type ProfilePremiumSectionProps = {
  badges: PremiumBadge[];
  billingActionBusy?: boolean;
  canManageSubscription?: boolean;
  infoCards: PremiumInfoCard[];
  isPurchasing?: boolean;
  isRestoring?: boolean;
  manageSubscriptionLabel: string;
  offerDuration?: string | null;
  offerPrice?: string | null;
  offerTitle?: string | null;
  onOpenPrivacyPolicy?: () => void;
  onOpenTermsOfUse?: () => void;
  onManageSubscription: () => void;
  onRestorePurchases: () => void;
  onUpgrade: () => void;
  privacyPolicyLabel?: string;
  premiumBenefits: string[];
  premiumBenefitsTitle: string;
  restorePurchasesLabel: string;
  showPremiumBenefits?: boolean;
  showRestorePurchases?: boolean;
  showUpgradeAction?: boolean;
  subscriptionHint?: string | null;
  subscriptionLabel: string;
  termsOfUseLabel?: string;
  upgradeLabel: string;
  /**
   * The upgrade action is the screen's enamel plate unless another action
   * (e.g. guest account creation) already holds it.
   */
  upgradeVariant?: 'primary' | 'secondary';
};

const BADGE_TONES = {
  premium: 'brand',
  trial: 'warning',
  free: 'neutral',
} as const;

function ProfilePremiumSectionComponent({
  badges,
  billingActionBusy = false,
  canManageSubscription = false,
  infoCards,
  isPurchasing = false,
  isRestoring = false,
  manageSubscriptionLabel,
  offerDuration,
  offerPrice,
  offerTitle,
  onOpenPrivacyPolicy,
  onOpenTermsOfUse,
  onManageSubscription,
  onRestorePurchases,
  onUpgrade,
  privacyPolicyLabel,
  premiumBenefits,
  premiumBenefitsTitle,
  restorePurchasesLabel,
  showPremiumBenefits = false,
  showRestorePurchases = false,
  showUpgradeAction = false,
  subscriptionHint,
  subscriptionLabel,
  termsOfUseLabel,
  upgradeLabel,
  upgradeVariant = 'primary',
}: ProfilePremiumSectionProps) {
  const showOfferDetails = showUpgradeAction && Boolean(offerTitle || offerDuration || offerPrice);
  const showLegalButtons =
    Boolean(privacyPolicyLabel && onOpenPrivacyPolicy) || Boolean(termsOfUseLabel && onOpenTermsOfUse);

  return (
    <Card style={styles.card} variationKey="profile-premium">
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>{subscriptionLabel}</Text>
        <View style={styles.badgesRow}>
          {badges.map((badge) => (
            <StatusPill key={`${badge.tone}-${badge.label}`} label={badge.label} tone={BADGE_TONES[badge.tone]} />
          ))}
        </View>
      </View>

      {infoCards.map((infoCard) => (
        <View key={infoCard.id} style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{infoCard.title}</Text>
          <Text style={styles.infoCardBody}>{infoCard.body}</Text>
          {infoCard.meta ? <Text style={styles.infoCardMeta}>{infoCard.meta}</Text> : null}
        </View>
      ))}

      {showOfferDetails ? (
        <View style={styles.offerCard}>
          {offerTitle ? <Text style={styles.offerTitle}>{offerTitle}</Text> : null}
          {offerDuration ? <Text style={styles.offerText}>{offerDuration}</Text> : null}
          {offerPrice ? <Text style={styles.offerText}>{offerPrice}</Text> : null}
        </View>
      ) : null}

      {showPremiumBenefits ? (
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>{premiumBenefitsTitle}</Text>
          {premiumBenefits.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.brandPrimary} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showUpgradeAction ? (
        <ActionButton
          disabled={billingActionBusy}
          fullWidth
          isLoading={isPurchasing}
          onPress={onUpgrade}
          variant={upgradeVariant}
        >
          {upgradeLabel}
        </ActionButton>
      ) : null}

      {showLegalButtons ? (
        <View style={styles.legalButtonsRow}>
          {privacyPolicyLabel && onOpenPrivacyPolicy ? (
            <ActionButton disabled={billingActionBusy} onPress={onOpenPrivacyPolicy} size="sm" variant="ghost">
              {privacyPolicyLabel}
            </ActionButton>
          ) : null}

          {termsOfUseLabel && onOpenTermsOfUse ? (
            <ActionButton disabled={billingActionBusy} onPress={onOpenTermsOfUse} size="sm" variant="ghost">
              {termsOfUseLabel}
            </ActionButton>
          ) : null}
        </View>
      ) : null}

      {subscriptionHint ? <Text style={styles.subscriptionHint}>{subscriptionHint}</Text> : null}

      {canManageSubscription ? (
        <ActionButton disabled={billingActionBusy} fullWidth onPress={onManageSubscription} variant="secondary">
          {manageSubscriptionLabel}
        </ActionButton>
      ) : null}

      {showRestorePurchases ? (
        <ActionButton
          disabled={billingActionBusy}
          isLoading={isRestoring}
          onPress={onRestorePurchases}
          style={styles.restoreButton}
          variant="ghost"
        >
          {restorePurchasesLabel}
        </ActionButton>
      ) : null}
    </Card>
  );
}

export const ProfilePremiumSection = memo(ProfilePremiumSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  infoCard: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  infoCardTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  infoCardBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  infoCardMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  offerCard: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    padding: 14,
  },
  offerTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  offerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  benefitsCard: {
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    padding: 14,
  },
  benefitsTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  subscriptionHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  legalButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  restoreButton: {
    alignSelf: 'center',
  },
});
