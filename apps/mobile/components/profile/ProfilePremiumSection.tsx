import { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  onManageSubscription: () => void;
  onRestorePurchases: () => void;
  onUpgrade: () => void;
  premiumBenefits: string[];
  premiumBenefitsTitle: string;
  restorePurchasesLabel: string;
  showPremiumBenefits?: boolean;
  showRestorePurchases?: boolean;
  showUpgradeAction?: boolean;
  subscriptionHint?: string | null;
  subscriptionLabel: string;
  upgradeLabel: string;
};

function ProfilePremiumSectionComponent({
  badges,
  billingActionBusy = false,
  canManageSubscription = false,
  infoCards,
  isPurchasing = false,
  isRestoring = false,
  manageSubscriptionLabel,
  onManageSubscription,
  onRestorePurchases,
  onUpgrade,
  premiumBenefits,
  premiumBenefitsTitle,
  restorePurchasesLabel,
  showPremiumBenefits = false,
  showRestorePurchases = false,
  showUpgradeAction = false,
  subscriptionHint,
  subscriptionLabel,
  upgradeLabel,
}: ProfilePremiumSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>{subscriptionLabel}</Text>
        <View style={styles.badgesRow}>
          {badges.map((badge) => (
            <View
              key={`${badge.tone}-${badge.label}`}
              style={[
                styles.badge,
                badge.tone === 'premium'
                  ? styles.badgePremium
                  : badge.tone === 'trial'
                    ? styles.badgeTrial
                    : styles.badgeFree,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  badge.tone === 'premium'
                    ? styles.badgeTextPremium
                    : badge.tone === 'trial'
                      ? styles.badgeTextTrial
                      : styles.badgeTextFree,
                ]}
              >
                {badge.label}
              </Text>
            </View>
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
        <TouchableOpacity
          style={[styles.upgradeButton, billingActionBusy && styles.actionDisabled]}
          onPress={onUpgrade}
          disabled={billingActionBusy}
        >
          {isPurchasing ? (
            <ActivityIndicator color={Colors.brandPrimary} />
          ) : (
            <Text style={styles.upgradeButtonText}>{upgradeLabel}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {subscriptionHint ? <Text style={styles.subscriptionHint}>{subscriptionHint}</Text> : null}

      {canManageSubscription ? (
        <TouchableOpacity
          style={[styles.secondaryButton, billingActionBusy && styles.actionDisabled]}
          onPress={onManageSubscription}
          disabled={billingActionBusy}
        >
          <Text style={styles.secondaryButtonText}>{manageSubscriptionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {showRestorePurchases ? (
        <TouchableOpacity
          style={[styles.tertiaryButton, billingActionBusy && styles.actionDisabled]}
          onPress={onRestorePurchases}
          disabled={billingActionBusy}
        >
          {isRestoring ? (
            <ActivityIndicator color={Colors.textSecondary} />
          ) : (
            <Text style={styles.tertiaryButtonText}>{restorePurchasesLabel}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const ProfilePremiumSection = memo(ProfilePremiumSectionComponent);

const styles = StyleSheet.create({
  card: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgePremium: {
    backgroundColor: Colors.brandSurface,
    borderColor: Colors.brandBorder,
  },
  badgeTrial: {
    backgroundColor: '#FFF7D6',
    borderColor: '#F3D47A',
  },
  badgeFree: {
    backgroundColor: Colors.surfaceSecondary,
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextPremium: {
    color: Colors.brandPrimary,
  },
  badgeTextTrial: {
    color: '#A05A00',
  },
  badgeTextFree: {
    color: Colors.textSecondary,
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
  upgradeButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.brandPrimary,
    backgroundColor: Colors.brandSurface,
    paddingHorizontal: 16,
  },
  upgradeButtonText: {
    color: Colors.brandPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  subscriptionHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  tertiaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  tertiaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  actionDisabled: {
    opacity: 0.7,
  },
});
