import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';
import { useI18n } from '../../lib/i18n';
import type { RunnerLaunchAccessStatus } from '../../lib/runnerLaunchAnnouncement';
import { Button } from '../themed/Button';
import { DataText } from '../themed/DataText';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';

type Props = {
  onClose: () => void;
  status: RunnerLaunchAccessStatus;
};

export function RunnerLaunchAnnouncement({ onClose, status }: Props) {
  const { locale } = useI18n();
  const billing = useRevenueCatBilling();
  const isFrench = locale === 'fr';
  const coursePrice = billing.coursePriceString;
  const annualPrice = billing.currentPackage?.product.priceString ?? null;
  const statusMessage = getStatusMessage(status, locale);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.launchBadge}>
              <Text size="xs" weight="bold" letterSpacing="wide" style={styles.launchBadgeText}>
                Pace Yourself 1.0
              </Text>
            </View>

            <Heading accessibilityRole="header" variant="h2" style={styles.title}>
              {isFrench ? 'Le lancement officiel' : 'The official launch'}
            </Heading>

            <Text tone="secondary" size="sm" lineHeight="relaxed" style={styles.intro}>
              {isFrench
                ? 'Pace Yourself se lance officiellement. Merci de préparer tes courses avec nous.'
                : 'Pace Yourself is officially launching. Thank you for preparing your races with us.'}
            </Text>

            <View style={styles.freeCard}>
              <Heading variant="h3">
                {isFrench ? 'L’essentiel reste gratuit' : 'The essentials stay free'}
              </Heading>
              <Text tone="secondary" size="sm" lineHeight="relaxed">
                {isFrench
                  ? 'Ton estimation du temps total et de l’allure moyenne, ainsi que le Livret coureur, restent accessibles gratuitement.'
                  : 'Your total-time and average-pace estimate, along with the Race Book, remain available for free.'}
              </Text>
            </View>

            <Text tone="secondary" size="sm" lineHeight="relaxed">
              {isFrench
                ? 'Pour personnaliser tes prochains plans — allure section par section, nutrition ravito par ravito et récap complet — choisis l’offre adaptée.'
                : 'To personalize your next plans — section-by-section pace, aid-station-by-aid-station nutrition, and a full recap — choose the offer that suits you.'}
            </Text>

            <View style={styles.offersRow}>
              <View style={styles.offerCard}>
                <Text size="sm" weight="bold">
                  {isFrench ? 'Une course' : 'One race'}
                </Text>
                <DataText
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  tone="brand"
                  size="xl"
                  weight="bold"
                >
                  {coursePrice ?? (isFrench ? '9,99 EUR' : 'EUR 9.99')}
                </DataText>
                <Text tone="secondary" size="xs" lineHeight="relaxed">
                  {isFrench ? 'Achat unique pour une course' : 'One-time purchase for one race'}
                </Text>
                {!coursePrice ? (
                  <Text tone="tertiary" size="xs" lineHeight="relaxed">
                    {isFrench ? 'Prix de référence en EUR' : 'Reference price in EUR'}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.offerCard, styles.annualOfferCard]}>
                <Text size="sm" weight="bold">
                  {isFrench ? 'Toutes mes courses' : 'All my races'}
                </Text>
                <DataText
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  numberOfLines={1}
                  tone="brand"
                  size="xl"
                  weight="bold"
                >
                  {annualPrice ?? (isFrench ? '29,99 EUR' : 'EUR 29.99')}
                </DataText>
                <Text tone="secondary" size="xs" lineHeight="relaxed">
                  {isFrench ? 'Par an, renouvellement automatique' : 'Per year, auto-renewing'}
                </Text>
                {!annualPrice ? (
                  <Text tone="tertiary" size="xs" lineHeight="relaxed">
                    {isFrench ? 'Prix de référence en EUR' : 'Reference price in EUR'}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text size="sm" weight="semibold" lineHeight="relaxed">
                {statusMessage}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actionArea}>
            <Button fullWidth onPress={onClose}>
              {isFrench ? 'J’ai compris' : 'Got it'}
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function getStatusMessage(status: RunnerLaunchAccessStatus, locale: string) {
  const isFrench = locale === 'fr';

  if (status.kind === 'paid') {
    return isFrench
      ? 'Ton abonnement en cours conserve ses conditions actuelles.'
      : 'Your current subscription keeps its existing terms.';
  }

  if (status.kind === 'free') {
    return isFrench
      ? 'Tes plans enregistrés restent dans ton compte.'
      : 'Your saved plans remain in your account.';
  }

  const formattedEnd = formatEndDate(status.endsAt, locale);
  if (formattedEnd) {
    if (status.kind === 'trial') {
      return isFrench
        ? `Ton essai gratuit est conservé jusqu’au ${formattedEnd}.`
        : `Your free trial remains active until ${formattedEnd}.`;
    }

    return isFrench
      ? `Ton accès offert reste actif jusqu’au ${formattedEnd}.`
      : `Your complimentary access remains active until ${formattedEnd}.`;
  }

  return isFrench
    ? 'Ton accès actuel reste actif selon ses conditions actuelles.'
    : 'Your current access remains active under its existing terms.';
}

function formatEndDate(value: string | undefined, locale: string) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 14,
  },
  launchBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  launchBadgeText: {
    color: Colors.brandPrimary,
  },
  title: {
    color: Colors.textPrimary,
  },
  intro: {
    marginTop: -6,
  },
  freeCard: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.brandSurface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
  },
  offersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  offerCard: {
    flex: 1,
    minWidth: 0,
    gap: 5,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  annualOfferCard: {
    borderColor: Colors.brandBorder,
  },
  statusCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
  },
  actionArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
