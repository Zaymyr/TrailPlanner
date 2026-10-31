import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useSupportPurchase } from '../../hooks/useSupportPurchase';
import { useI18n } from '../../lib/i18n';
import { Button } from '../themed/Button';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';

type Props = {
  onClose: (dontShowAgain: boolean) => void;
  onOpenPlans?: () => void;
  userId?: string | null;
  preview?: boolean;
};

export function RunnerLaunchAnnouncement({ onClose, onOpenPlans, userId = null, preview = false }: Props) {
  const { locale } = useI18n();
  const fr = locale === 'fr';
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const support = useSupportPurchase(preview ? null : userId);
  const close = () => { if (!support.purchasing) onClose(dontShowAgain); };
  const supportLabel = support.purchased
    ? (fr ? 'Merci pour ton soutien 💚' : 'Thank you for your support 💚')
    : `${fr ? '♡ Soutenir le projet' : '♡ Support the project'} · ${support.priceString ?? '9,99 €'}`;

  return (
    <Modal animationType="fade" transparent visible onRequestClose={close}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.badge}>
              <Text tone="brand" size="xs" weight="bold">PACE YOURSELF 1.0 🎉</Text>
            </View>
            <Heading accessibilityRole="header" variant="h2">
              {fr ? 'C’est officiel, on se lance ! 🚀' : 'It’s official, we’re launching! 🚀'}
            </Heading>
            <Text>{fr ? 'Pace Yourself passe en version 1.0 !' : 'Pace Yourself is launching version 1.0!'}</Text>
            <Text>{fr
              ? 'Merci d’avoir fait partie des premiers coureurs à nous faire confiance. 💚'
              : 'Thank you for being one of the first runners to trust us. 💚'}</Text>
            <View style={styles.gift}>
              <Heading variant="h3">{fr ? '🎁 Tous tes plans restent gratuits !' : '🎁 All your existing plans stay free!'}</Heading>
              <Text lineHeight="relaxed">{fr
                ? 'Pour te remercier, tous les plans que tu as déjà créés avant le lancement restent entièrement accessibles et modifiables, sans limite de temps.'
                : 'As a thank you, every plan you created before launch stays fully accessible and editable, with no time limit.'}</Text>
            </View>
            <Text tone="secondary" size="sm" lineHeight="relaxed">{fr
              ? 'Pour tes prochaines courses, découvre nos nouvelles offres : 9,99 € par course ou 29,99 € par an. L’essentiel reste gratuit. Les prix de ton store s’appliquent.'
              : 'For your next races, discover our new offers: €9.99 per race or €29.99 per year. The essentials stay free. Local store prices apply.'}</Text>
            <View style={styles.badge}>
              <Text tone="brand" size="xs" weight="bold">{fr ? '💚 Soutien de la première heure' : '💚 Early supporter'}</Text>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={fr ? 'Ne plus afficher' : 'Don’t show again'}
              accessibilityState={{ checked: dontShowAgain, disabled: support.purchasing }}
              onPress={() => setDontShowAgain((value) => !value)}
              disabled={support.purchasing}
              style={styles.checkbox}
            >
              <Text tone="brand" weight="bold">{dontShowAgain ? '☑' : '☐'}</Text>
              <Text size="sm">{fr ? 'Ne plus afficher' : 'Don’t show again'}</Text>
            </Pressable>
            {support.error ? <Text style={{ color: Colors.danger }} size="sm" accessibilityLiveRegion="polite">{support.error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button fullWidth disabled={support.purchasing} onPress={() => { close(); onOpenPlans?.(); }}>
              {fr ? 'Accéder à mes plans offerts →' : 'View my free plans →'}
            </Button>
            <Button
              fullWidth variant="secondary" isLoading={support.purchasing}
              disabled={!preview && (support.loading || support.purchased || !support.available)}
              onPress={() => {
                if (preview) {
                  Alert.alert(fr ? 'Aperçu uniquement' : 'Preview only', fr ? 'Aucun achat n’est lancé dans cet aperçu.' : 'No purchase is started in this preview.');
                  return;
                }
                void support.purchase();
              }}
            >{supportLabel}</Button>
            <Text tone="tertiary" size="xs" style={styles.note}>{fr
              ? 'Un soutien libre et facultatif, sans achat de plan ni droit supplémentaire.'
              : 'Optional support, without buying a plan or unlocking any features.'}</Text>
            {!preview && !support.loading && !support.available && !support.purchased ? (
              <Text tone="tertiary" size="xs" style={styles.note}>{fr ? 'Le soutien n’est pas disponible sur ce store pour le moment.' : 'Support is currently unavailable in this store.'}</Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.56)' },
  sheet: { maxHeight: '100%', maxWidth: 520, width: '100%', alignSelf: 'center', borderRadius: 24, backgroundColor: Colors.surface, overflow: 'hidden' },
  content: { padding: 20, gap: 16 },
  badge: { alignSelf: 'flex-start', backgroundColor: Colors.brandSurface, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  gift: { padding: 16, gap: 8, borderRadius: 16, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  checkbox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { padding: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  note: { textAlign: 'center' },
});
