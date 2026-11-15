import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RacebookSupporterPointsSection } from '../../../components/racebook/RacebookSupporterPointsSection';
import { Card } from '../../../components/themed/Card';
import { Text, Text as Heading } from '../../../components/themed/Text';
import { Colors } from '../../../constants/colors';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout';
import { useI18n } from '../../../lib/i18n';
import type { SupporterGuidePayload } from '../../../lib/supporterGuide';
import { WEB_API_BASE_URL } from '../../../lib/webApi';

type Section = 'programme' | 'follow' | 'onsite' | 'stay' | 'practical';

export default function SupporterGuideScreen() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const { locale, t } = useI18n();
  const [guide, setGuide] = useState<SupporterGuidePayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<Section>('programme');
  const labels = locale === 'fr'
    ? { title: 'Livret accompagnateur', unavailable: 'Livret indisponible', programme: 'Programme', follow: 'Suivre', onsite: 'Sur place', stay: 'Séjour', practical: 'Pratique' }
    : { title: 'Supporter Guide', unavailable: 'Guide unavailable', programme: 'Schedule', follow: 'Follow', onsite: 'On site', stay: 'Stay', practical: 'Practical' };
  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    void fetchWithTimeout(`${WEB_API_BASE_URL}/api/supporter-guide?raceId=${encodeURIComponent(raceId)}`)
      .then(async (response) => response.ok ? response.json() as Promise<SupporterGuidePayload> : Promise.reject())
      .then((payload) => { if (!cancelled) setGuide(payload); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [raceId]);
  const sections = useMemo(() => guide ? ([
    ['programme', guide.formats.length > 0],
    ['follow', guide.formats.some((format) => format.supporterPoints.length || format.aidStations.length)],
    ['onsite', guide.onSiteServices.length > 0],
    ['stay', guide.stayServices.length > 0 || Boolean(guide.lodgingPartner)],
    ['practical', guide.practical.access.length > 0 || guide.practical.thirdPartyBibPickup.length > 0 || Boolean(guide.practical.emergencyPhone) || guide.practical.links.length > 0],
  ] as [Section, boolean][]).filter(([, visible]) => visible).map(([section]) => section) : [], [guide]);
  if (failed) return <View style={styles.center}><Heading>{labels.unavailable}</Heading></View>;
  if (!guide) return <View style={styles.center}><Text>{t.common.loading}</Text></View>;
  const open = (url: string) => { void Linking.openURL(url); };
  return <View style={styles.screen}>
    <View style={styles.header}><Text style={styles.eyebrow}>{labels.title}</Text><Heading>{guide.edition.name}</Heading><Text style={styles.muted}>{[guide.edition.location, guide.edition.startDate].filter(Boolean).join(' · ')}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{sections.map((section) => <Pressable key={section} accessibilityRole="tab" accessibilityState={{ selected: active === section }} onPress={() => setActive(section)} style={[styles.tab, active === section && styles.tabActive]}><Text style={[styles.tabText, active === section && styles.tabTextActive]}>{labels[section]}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content}>
      {active === 'programme' ? guide.formats.map((format) => <Card key={format.raceId} style={styles.card}><Heading size="sm">{format.name}</Heading><Text style={styles.muted}>{[format.date, `${format.distanceKm} km`].filter(Boolean).join(' · ')}</Text><Text>{locale === 'fr' ? 'Départ' : 'Start'} : {format.startWaves.length ? format.startWaves.map((wave) => `${wave.name} ${wave.time}`).join(' · ') : format.startTime ?? '—'}</Text>{format.finishCutoffTime ? <Text>{locale === 'fr' ? 'Barrière arrivée' : 'Finish cutoff'} : {format.finishCutoffTime}</Text> : null}{format.awards.map((award) => <Text key={award.id}>{locale === 'fr' ? 'Podium' : 'Awards'} {award.label} : {award.time}</Text>)}</Card>) : null}
      {active === 'follow' ? guide.formats.filter((format) => format.supporterPoints.length || format.aidStations.length).map((format) => <View key={format.raceId} style={styles.group}><Heading size="sm">{format.name}</Heading><RacebookSupporterPointsSection locale={locale} points={format.supporterPoints.map((point, index) => ({ id: point.id, name: point.name, km: point.km, encouragementAllowed: point.encouragementAllowed, assistanceAllowed: point.assistanceAllowed, accessLabel: point.accessLabel, latitude: point.latitude ?? 0, longitude: point.longitude ?? 0, googleMapsUrl: point.mapsUrl, accessNote: point.accessNote, planUrl: point.planUrl, orderIndex: index }))} onOpenUrl={open} />{format.aidStations.map((station) => <Card key={station.id} style={styles.card}><Text style={styles.strong}>{station.name} · km {station.km}</Text>{station.cutoffTime ? <Text>{locale === 'fr' ? 'Dernier coureur' : 'Last runner'} : {station.cutoffTime}</Text> : null}{station.maxStopMinutes ? <Text>{locale === 'fr' ? 'Arrêt max.' : 'Maximum stop'} : {station.maxStopMinutes} min</Text> : null}</Card>)}</View>) : null}
      {active === 'onsite' ? guide.onSiteServices.map((service) => <Service key={service.id} service={service} open={open} />) : null}
      {active === 'stay' ? <>{guide.stayServices.map((service) => <Service key={service.id} service={service} open={open} />)}{guide.lodgingPartner ? <Card style={styles.card}><Text style={styles.strong}>{guide.lodgingPartner.name}</Text>{guide.lodgingPartner.headline ? <Text>{guide.lodgingPartner.headline}</Text> : null}{guide.lodgingPartner.clickUrl ? <Pressable onPress={() => open(guide.lodgingPartner!.clickUrl!)}><Text style={styles.linkText}>{locale === 'fr' ? 'Découvrir' : 'Discover'}</Text></Pressable> : null}</Card> : null}</> : null}
      {active === 'practical' ? <>{guide.practical.access.map((item) => <Card key={item.raceId} style={styles.card}><Text style={styles.strong}>{item.raceName}</Text>{item.start.address ? <Text>{locale === 'fr' ? 'Départ' : 'Start'} : {item.start.address}</Text> : null}{item.finish.address ? <Text>{locale === 'fr' ? 'Arrivée' : 'Finish'} : {item.finish.address}</Text> : null}{item.parking ? <Text>Parking : {item.parking}</Text> : null}{item.shuttles ? <Text>{locale === 'fr' ? 'Navettes' : 'Shuttles'} : {item.shuttles}</Text> : null}</Card>)}{guide.practical.thirdPartyBibPickup.map((item) => <Card key={item.raceId} style={styles.card}><Text style={styles.strong}>{locale === 'fr' ? 'Retrait par un tiers' : 'Third-party bib pickup'} · {item.raceName}</Text>{item.conditions ? <Text>{item.conditions}</Text> : null}</Card>)}{guide.practical.emergencyPhone ? <Pressable onPress={() => open(`tel:${guide.practical.emergencyPhone}`)} style={styles.link}><Text style={styles.linkText}>{locale === 'fr' ? 'Urgence' : 'Emergency'} · {guide.practical.emergencyPhone}</Text></Pressable> : null}{guide.practical.links.map((link) => <Pressable key={link.url} onPress={() => open(link.url)} style={styles.link}><Text style={styles.linkText}>{link.kind === 'official' ? (locale === 'fr' ? 'Site officiel' : 'Official website') : link.kind === 'instagram' ? 'Instagram' : 'Facebook'}</Text></Pressable>)}</> : null}
    </ScrollView>
  </View>;
}

function Service({ service, open }: { service: SupporterGuidePayload['stayServices'][number]; open: (url: string) => void }) {
  return <Card style={styles.card}><Text style={styles.strong}>{service.name}</Text>{service.description ? <Text>{service.description}</Text> : null}{service.location.address ? <Text>{service.location.address}</Text> : null}{service.location.mapsUrl ? <Pressable onPress={() => open(service.location.mapsUrl!)}><Text style={styles.linkText}>Maps</Text></Pressable> : null}</Card>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, gap: 4, backgroundColor: Colors.brandSurface }, eyebrow: { color: Colors.brandPrimary, fontWeight: '800', textTransform: 'uppercase' }, muted: { color: Colors.textSecondary },
  tabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 }, tab: { minHeight: 44, justifyContent: 'center', borderRadius: 22, paddingHorizontal: 16 }, tabActive: { backgroundColor: Colors.brandPrimary }, tabText: { color: Colors.textSecondary, fontWeight: '700' }, tabTextActive: { color: Colors.textOnBrand },
  content: { padding: 16, paddingBottom: 48, gap: 12 }, group: { gap: 10 }, card: { padding: 16, gap: 7 }, strong: { color: Colors.textPrimary, fontWeight: '800' }, link: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 16 }, linkText: { color: Colors.brandPrimary, fontWeight: '800' },
});
